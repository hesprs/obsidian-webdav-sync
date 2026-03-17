import type { Vault } from 'obsidian';
import type { WebDAVClient } from 'webdav';
import { chunk } from 'lodash-es';
import type { StatModel } from '~/model/stat.model';
import type { LocalRecordModel } from '~/model/sync-record.model';
import type { SyncStateModel } from '~/model/sync-record.model';
import { emitSyncUpdateMtimeProgress } from '~/events';
import { SyncRecord } from '~/storage';
import { isMergeablePath } from '~/sync/utils/is-mergeable-path';
import logger from '~/utils/logger';
import { statVaultItem } from '~/utils/stat-vault-item';
import { statWebDAVItem } from '~/utils/stat-webdav-item';
import type { BaseTask, TaskResult } from '../tasks/task.interface';
import CleanRecordTask from '../tasks/clean-record.task';
import ConflictResolveTask from '../tasks/conflict-resolve.task';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import MkdirsRemoteTask from '../tasks/mkdirs-remote.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteRecursivelyTask from '../tasks/remove-remote-recursively.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';

const MAX_BASE_TEXT_BYTES = 1024 * 1024;

function isNotFoundError(error: unknown): boolean {
	if (!error || typeof error !== 'object') return false;
	const errorWithStatus = error as { response?: { status?: number }; res?: { status?: number } };
	return errorWithStatus.response?.status === 404 || errorWithStatus.res?.status === 404;
}

async function statRemotePath(
	webdav: WebDAVClient,
	remotePath: string,
): Promise<StatModel | undefined> {
	try {
		return await statWebDAVItem(webdav, remotePath);
	} catch (error) {
		if (isNotFoundError(error)) return undefined;
		throw error;
	}
}

async function statRemoteItem(task: BaseTask): Promise<StatModel | undefined> {
	return await statRemotePath(task.webdav, task.remotePath);
}

async function createBaseText(vault: Vault, local: StatModel): Promise<string | undefined> {
	if (local.isDir || !isMergeablePath(local.path)) return undefined;
	if (local.size > MAX_BASE_TEXT_BYTES) return undefined;

	const file = vault.getFileByPath(local.path);
	if (!file) return undefined;

	return await vault.read(file);
}

async function createLocalRecord(
	vault: Vault,
	local: StatModel | undefined,
	remote: StatModel | undefined,
): Promise<LocalRecordModel | undefined> {
	if (!local || !remote) return undefined;

	return {
		local,
		baseText: await createBaseText(vault, local),
	};
}

async function syncPathState(task: BaseTask): Promise<{
	localPath: string;
	remotePath: string;
	local?: StatModel;
	remote?: StatModel;
	localRecord?: LocalRecordModel;
}> {
	const [local, remote] = await Promise.all([
		statVaultItem(task.vault, task.localPath),
		statRemoteItem(task),
	]);

	return {
		localPath: task.localPath,
		remotePath: task.remotePath,
		local,
		remote,
		localRecord: await createLocalRecord(task.vault, local, remote),
	};
}

type TaskStateUpdate =
	| {
			kind: 'remove-subtree';
			localPath: string;
			remotePath: string;
	  }
	| {
			kind: 'sync-path';
			localPath: string;
			remotePath: string;
			remote?: StatModel;
			localRecord?: LocalRecordModel;
	  };

function applyStateUpdate(
	syncRecord: SyncRecord,
	state: SyncStateModel,
	update: TaskStateUpdate,
): void {
	if (update.kind === 'remove-subtree') {
		syncRecord.removeLocalSubtreeInState(state, update.localPath);
		syncRecord.removeRemoteSubtreeInState(state, update.remotePath);
		return;
	}

	if (update.remote) syncRecord.upsertRemotePathInState(state, update.remote);
	else syncRecord.removeRemotePathInState(state, update.remotePath);

	if (update.localRecord) {
		syncRecord.upsertLocalRecordInState(state, update.localPath, update.localRecord);
	} else {
		syncRecord.removeLocalRecordInState(state, update.localPath);
	}
}

async function prepareTaskUpdate(task: BaseTask): Promise<TaskStateUpdate[]> {
	if (task instanceof CleanRecordTask) {
		return [{ kind: 'remove-subtree', localPath: task.localPath, remotePath: task.remotePath }];
	}

	if (task instanceof RemoveLocalTask) {
		return [{ kind: 'remove-subtree', localPath: task.localPath, remotePath: task.remotePath }];
	}

	if (task instanceof RemoveRemoteTask || task instanceof RemoveRemoteRecursivelyTask) {
		return [{ kind: 'remove-subtree', localPath: task.localPath, remotePath: task.remotePath }];
	}

	if (task instanceof MkdirsRemoteTask) {
		const pathStates = await Promise.all(
			task.getAllPaths().map(async (pathInfo) => {
				const [local, remote] = await Promise.all([
					statVaultItem(task.vault, pathInfo.localPath),
					statRemotePath(task.webdav, pathInfo.remotePath),
				]);

				return {
					localPath: pathInfo.localPath,
					remotePath: pathInfo.remotePath,
					local,
					remote,
					localRecord: await createLocalRecord(task.vault, local, remote),
				};
			}),
		);

		return pathStates.map((pathState) => ({
			kind: 'sync-path' as const,
			localPath: pathState.localPath,
			remotePath: pathState.remotePath,
			remote: pathState.remote,
			localRecord: pathState.localRecord,
		}));
	}

	if (
		task instanceof PushTask ||
		task instanceof PullTask ||
		task instanceof MkdirRemoteTask ||
		task instanceof MkdirLocalTask ||
		task instanceof ConflictResolveTask
	) {
		const pathState = await syncPathState(task);
		return [
			{
				kind: 'sync-path',
				localPath: pathState.localPath,
				remotePath: pathState.remotePath,
				remote: pathState.remote,
				localRecord: pathState.localRecord,
			},
		];
	}

	return [];
}

/**
 * Apply deterministic, task-driven sync-state updates.
 */
export async function updateMtimeInRecord(
	vault: Vault,
	tasks: BaseTask[],
	results: TaskResult[],
	batchSize: number,
): Promise<void> {
	if (tasks.length === 0) return;

	const successfulTasks = tasks.filter(
		(_task, index) => results[index]?.success && !results[index]?.skipRecord,
	);
	if (successfulTasks.length === 0) return;

	const syncRecord = successfulTasks[0]?.syncRecord;
	if (!syncRecord) return;

	let completedCount = 0;
	const startAt = Date.now();

	for (const taskChunk of chunk(successfulTasks, batchSize)) {
		const chunkUpdates = await Promise.all(
			taskChunk.map(async (task) => {
				try {
					return await prepareTaskUpdate(task);
				} catch (error) {
					const taskString = task.toJSON();
					logger.error(
						`Failed to update modification time in record for task ${taskString.taskName}`,
					);
					logger.debug(error, taskString);
					return [];
				} finally {
					completedCount++;
				}
			}),
		);

		await syncRecord.mutateState((state) => {
			for (const updates of chunkUpdates) {
				for (const update of updates) {
					applyStateUpdate(syncRecord, state, update);
				}
			}
		});

		emitSyncUpdateMtimeProgress(successfulTasks.length, completedCount);
	}

	logger.debug('Records saving completed', {
		recordsSize: (await syncRecord.getLocalRecords()).size,
		elapsedMs: Date.now() - startAt,
		updatedTaskCount: successfulTasks.length,
		vault: vault.getName(),
	});
}
