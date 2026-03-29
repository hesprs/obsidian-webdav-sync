import { parse as bytesParse } from 'bytes-iec';
import type { StatModel } from '~/model/stat.model';
import { SyncPlanningSubStage } from '~/events';
import { remotePathToAbsolute } from '~/platform/path/remote-path';
import { normalizeVaultPath } from '~/platform/path/vault-path';
import { SyncMode } from '~/settings';
import { hasInvalidChar } from '~/utils/has-invalid-char';
import logger from '~/utils/logger';
import type {
	PlannedLocalSnapshot,
	PlannedRemoteSnapshot,
	SyncDecisionInput,
} from './sync-decision.interface';
import { ConflictStrategy } from '../tasks/conflict-resolve.task';
import { SkipReason } from '../tasks/skipped.task';
import { BaseTask } from '../tasks/task.interface';
import { getIgnoredPathsInFolder, hasIgnoredInFolder } from '../utils/has-ignored-in-folder';
import { isSameTime } from '../utils/is-same-time';
import { hasFolderContentChanged } from './has-folder-content-changed';

export async function twoWayDecider(input: SyncDecisionInput): Promise<BaseTask[]> {
	const {
		settings,
		currentLocalStats: localStats,
		currentRemoteStats: remoteStats,
		previousRemoteRecords,
		previousLocalRecords,
		remoteBaseDir,
		compareFileContent,
		onProgress,
		taskFactory,
		createPlannedLocalFileSnapshot,
		createPlannedRemoteFileSnapshot,
		createPlannedLocalFolderSnapshot,
		createPlannedRemoteFolderSnapshot,
	} = input;

	let maxFileSize = Infinity;
	const maxFileSizeStr = settings.skipLargeFiles.maxSize.trim();
	if (maxFileSizeStr !== '') {
		maxFileSize = bytesParse(maxFileSizeStr, { mode: 'jedec' }) ?? Infinity;
	}

	// Filter out ignored files and extract StatModel from FsWalkResult
	const localStatsFiltered = localStats.filter((item) => !item.ignored).map((item) => item.stat);
	const remoteStatsFiltered = remoteStats
		.filter((item) => !item.ignored)
		.map((item) => item.stat);

	const localStatsMap = new Map(localStatsFiltered.map((item) => [item.path, item]));
	const remoteStatsMap = new Map(remoteStatsFiltered.map((item) => [item.path, item]));
	const previousRemoteStatsMap = new Map(previousRemoteRecords.map((item) => [item.path, item]));
	const syncRecords = new Map(
		Array.from(previousLocalRecords.entries()).flatMap(([path, record]) => {
			const remote = previousRemoteStatsMap.get(path);
			if (!remote) return [];
			return [
				[
					path,
					{
						local: record.local,
						remote,
						baseText: record.baseText,
					},
				],
			] as const;
		}),
	);
	const mixedPath = new Set([...localStatsMap.keys(), ...remoteStatsMap.keys()]);

	logger.debug(
		'local state',
		localStatsFiltered.map((d) => ({
			path: d.path,
			size: d.isDir ? undefined : d.size,
			isDir: d.isDir,
		})),
	);
	logger.debug(
		'remote state',
		remoteStatsFiltered.map((d) => ({
			path: d.path,
			size: d.isDir ? undefined : d.size,
			isDir: d.isDir,
		})),
	);

	const tasks: BaseTask[] = [];
	const removeRemoteFolderTasks: BaseTask[] = [];
	const removeLocalFolderTasks: BaseTask[] = [];
	const mkdirLocalTasks: BaseTask[] = [];
	const mkdirRemoteTasks: BaseTask[] = [];

	let completedUnits = -1;
	const updateProgress = async () => {
		completedUnits++;
		await onProgress?.({
			subStage: SyncPlanningSubStage.deciding,
			totalWorkUnits: mixedPath.size,
			completedWorkUnits: completedUnits,
		});
	};

	const createPushTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			local?: PlannedLocalSnapshot;
			remote?: PlannedRemoteSnapshot;
		},
		localStat: PlannedLocalSnapshot['stat'],
	) => {
		const plannedLocal =
			(await createPlannedLocalFileSnapshot(options.localPath, localStat)) ?? options.local;
		tasks.push(
			taskFactory.createPushTask({
				...options,
				local: plannedLocal,
			}),
		);
	};

	const createPullTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			local?: PlannedLocalSnapshot;
			remote?: PlannedRemoteSnapshot;
		},
		remoteStat: StatModel,
	) => {
		const plannedRemote =
			(await createPlannedRemoteFileSnapshot(options.remotePath, remoteStat)) ??
			options.remote;
		tasks.push(
			taskFactory.createPullTask({
				...options,
				remote: plannedRemote,
			}),
		);
	};

	const createConflictResolveTaskWithSnapshot = async (
		options: {
			remotePath: string;
			localPath: string;
			record?: typeof syncRecords extends Map<string, infer T> ? T : never;
			strategy: ConflictStrategy;
			useGitStyle: boolean;
		},
		localStat: StatModel,
		remoteStat: StatModel,
	) => {
		const [plannedLocal, plannedRemote] = await Promise.all([
			createPlannedLocalFileSnapshot(options.localPath, localStat),
			createPlannedRemoteFileSnapshot(options.remotePath, remoteStat),
		]);
		if (!plannedLocal) {
			throw new Error(`Cannot plan local conflict snapshot: ${options.localPath}`);
		}
		if (!plannedRemote) {
			throw new Error(`Cannot plan remote conflict snapshot: ${options.remotePath}`);
		}
		tasks.push(
			taskFactory.createConflictResolveTask({
				...options,
				record: options.record,
				local: plannedLocal,
				remote: plannedRemote,
			}),
		);
	};

	const createMkdirLocalTaskWithSnapshot = (
		options: { localPath: string; remotePath: string },
		remoteStat: PlannedRemoteSnapshot['stat'],
	) => {
		const plannedRemote = createPlannedRemoteFolderSnapshot(options.remotePath, remoteStat);
		mkdirLocalTasks.push(
			taskFactory.createMkdirLocalTask({
				...options,
				remote: plannedRemote,
			}),
		);
	};

	const createMkdirRemoteTaskWithSnapshot = (
		options: { localPath: string; remotePath: string },
		localStat: StatModel,
	) => {
		const plannedLocal = createPlannedLocalFolderSnapshot(options.localPath, localStat);
		mkdirRemoteTasks.push(
			taskFactory.createMkdirRemoteTask({
				...options,
				local: plannedLocal,
			}),
		);
	};

	const createAddFileRecordTaskWithSnapshot = async (
		options: { localPath: string; remotePath: string },
		localStat: StatModel,
		remoteStat: StatModel,
	) => {
		const plannedLocal = await createPlannedLocalFileSnapshot(options.localPath, localStat);
		tasks.push(
			taskFactory.createAddRecordTask({
				...options,
				local: plannedLocal,
				remote: remoteStat,
			}),
		);
	};

	const createAddFolderRecordTaskWithSnapshot = (
		options: { localPath: string; remotePath: string },
		localStat: StatModel,
		remoteStat: StatModel,
	) => {
		const plannedLocal = createPlannedLocalFolderSnapshot(options.localPath, localStat);
		tasks.push(
			taskFactory.createAddRecordTask({
				...options,
				local: plannedLocal,
				remote: remoteStat,
			}),
		);
	};

	// * sync files
	for (const p of mixedPath) {
		await updateProgress();
		const remote = remoteStatsMap.get(p);
		const local = localStatsMap.get(p);
		const record = syncRecords.get(p);
		const localPath = normalizeVaultPath(p);
		const remotePath = remotePathToAbsolute(remoteBaseDir, p);

		const options = {
			remotePath,
			localPath,
		};

		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged = false;
		let localChanged = false;

		if (local?.isDir || remote?.isDir) continue;

		if (record) {
			if (remote) {
				remoteChanged = !isSameTime(remote.mtime, record.remote.mtime);
				if (local) {
					localChanged = !isSameTime(local.mtime, record.local.mtime);
					if (localChanged && record.baseText)
						localChanged = !(await compareFileContent(local.path, record.baseText));
					if (remoteChanged && localChanged) caseName = 'RECORD_REMOTE_LOCAL_CONFLICT';
					else if (remoteChanged) caseName = 'RECORD_REMOTE_LOCAL_PULL';
					else if (localChanged) caseName = 'RECORD_REMOTE_LOCAL_PUSH';
				} else {
					if (remoteChanged) caseName = 'RECORD_REMOTE_NOLOCAL_PULL';
					else caseName = 'RECORD_REMOTE_NOLOCAL_REMOVE';
				}
			} else if (local) {
				localChanged = !isSameTime(local.mtime, record.local.mtime);
				if (localChanged) caseName = 'RECORD_NOREMOTE_LOCAL_PUSH';
				else caseName = 'RECORD_NOREMOTE_LOCAL_REMOVE';
			} else caseName = 'RECORD_NOREMOTE_NOLOCAL_UNRECORD';
		} else {
			if (remote) {
				if (local) {
					if (
						settings.syncMode === SyncMode.LOOSE &&
						!remote.isDeleted &&
						!remote.isDir &&
						remote.size === local.size
					)
						caseName = 'NORECORD_REMOTE_LOCAL_RECORD';
					else caseName = 'NORECORD_REMOTE_LOCAL_CONFLICT';
				} else caseName = 'NORECORD_REMOTE_NOLOCAL_PULL';
			} else if (local) caseName = 'NORECORD_NOREMOTE_LOCAL_PUSH';
		}

		const operations = {
			NONE: () => {},
			RECORD_NOREMOTE_NOLOCAL_UNRECORD: () => {
				logger.debug(`cleaning orphaned sync record`, {
					reason: 'both local and remote deleted',
					remotePath,
					localPath,
					conditions: {
						localExists: !!local,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});

				tasks.push(
					taskFactory.createCleanRecordTask({
						remotePath,
						localPath,
					}),
				);
			},
			NORECORD_REMOTE_LOCAL_RECORD: async () => {
				if (!local || !remote) return;
				logger.debug(`creating new record`, {
					reason: 'both local and remote exist but no record',
					remotePath,
					localPath,
					conditions: {
						localExists: !!local,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});

				await createAddFileRecordTaskWithSnapshot(
					{
						localPath,
						remotePath,
					},
					local,
					remote,
				);
			},
			RECORD_REMOTE_LOCAL_CONFLICT: async () => {
				if (!remote || !local) return;
				logger.debug(`Detected conflict between \`${localPath}\` and \`${remotePath}\``, {
					reason: 'both local and remote files changed',
					remotePath,
					localPath,
					conditions: {
						remoteChanged,
						localChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (remote.size > maxFileSize || local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
							localSize: local.size,
						}),
					);
					return;
				}

				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else {
					await createConflictResolveTaskWithSnapshot(
						{
							...options,
							record,
							strategy: settings.conflictStrategy,
							useGitStyle: settings.useGitStyle,
						},
						local,
						remote,
					);
				}
			},
			RECORD_REMOTE_LOCAL_PULL: async () => {
				if (!remote || !local) return;
				logger.debug(`Pull remote file \`${remotePath}\` changes to local`, {
					reason: 'remote file changed',
					remotePath,
					localPath,
					conditions: {
						remoteChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (remote.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
							localSize: local.size,
						}),
					);
					return;
				}
				await createPullTaskWithSnapshot(options, remote);
			},
			RECORD_REMOTE_LOCAL_PUSH: async () => {
				if (!remote || !local) return;
				logger.debug(`Push local file \`${localPath}\` changes to remote`, {
					reason: 'local file changed',
					remotePath,
					localPath,
					conditions: {
						localChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
							localSize: local.size,
						}),
					);
					return;
				}
				if (hasInvalidChar(local.path))
					tasks.push(taskFactory.createFilenameErrorTask(options));
				else await createPushTaskWithSnapshot(options, local);
			},
			RECORD_REMOTE_NOLOCAL_PULL: async () => {
				if (!remote) return;
				logger.debug(`Pull remote file \`${remotePath}\` to local`, {
					reason: 'remote file changed and local file does not exist',
					remotePath,
					localPath,
					conditions: {
						remoteChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (remote.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							maxSize: maxFileSize,
							remoteSize: remote.size,
						}),
					);
					return;
				}
				await createPullTaskWithSnapshot(options, remote);
			},
			RECORD_REMOTE_NOLOCAL_REMOVE: () => {
				if (!remote) return;
				logger.debug(`Remove remote file \`${remote.path}\``, {
					reason: 'remote file is removable',
					remotePath,
					localPath,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				tasks.push(taskFactory.createRemoveRemoteTask(options));
			},
			RECORD_NOREMOTE_LOCAL_PUSH: async () => {
				if (!local) return;
				logger.debug(`Push local file \`${localPath}\` to remote`, {
					reason: 'local file changed and remote file does not exist',
					remotePath,
					localPath,
					conditions: {
						localChanged,
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				if (local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							localSize: local.size,
							maxSize: maxFileSize,
						}),
					);
					return;
				}
				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else await createPushTaskWithSnapshot(options, local);
			},
			RECORD_NOREMOTE_LOCAL_REMOVE: () => {
				if (!local) return;
				logger.debug(`Remove local file \`${localPath}\``, {
					reason: 'local file is removable',
					remotePath,
					localPath,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});
				tasks.push(taskFactory.createRemoveLocalTask(options));
				return;
			},
			NORECORD_REMOTE_LOCAL_CONFLICT: async () => {
				if (!remote || !local) return;
				logger.debug(
					`Detected conflict between local file \`${localPath}\` and remote file ${remotePath}`,
					{
						reason: 'both local and remote files exist without a record',
						remotePath,
						localPath,
						conditions: {
							recordExists: !!record,
							remoteExists: !!remote,
							localExists: !!local,
						},
					},
				);

				if (remote.size > maxFileSize || local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							remoteSize: remote.size,
							localSize: local.size,
							maxSize: maxFileSize,
						}),
					);
					return;
				}

				if (hasInvalidChar(local.path)) {
					tasks.push(taskFactory.createFilenameErrorTask(options));
				} else {
					await createConflictResolveTaskWithSnapshot(
						{
							...options,
							strategy: settings.conflictStrategy,
							useGitStyle: settings.useGitStyle,
						},
						local,
						remote,
					);
				}
			},
			NORECORD_REMOTE_NOLOCAL_PULL: async () => {
				if (!remote) return;
				logger.debug(`Pull remote file \`${remotePath}\` to local`, {
					reason: 'remote file exists without a local file',
					remotePath,
					localPath,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});

				if (remote.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							remoteSize: remote.size,
							maxSize: maxFileSize,
						}),
					);
					return;
				}
				await createPullTaskWithSnapshot(options, remote);
			},
			NORECORD_NOREMOTE_LOCAL_PUSH: async () => {
				if (!local) return;
				logger.debug(`Push local file \`${localPath}\` to remote`, {
					reason: 'local file exists without a remote file',
					remotePath,
					localPath,
					conditions: {
						recordExists: !!record,
						remoteExists: !!remote,
						localExists: !!local,
					},
				});

				if (local.size > maxFileSize) {
					tasks.push(
						taskFactory.createSkippedTask({
							...options,
							reason: SkipReason.FileTooLarge,
							localSize: local.size,
							maxSize: maxFileSize,
						}),
					);
					return;
				}
				if (hasInvalidChar(local.path))
					tasks.push(taskFactory.createFilenameErrorTask(options));
				else await createPushTaskWithSnapshot(options, local);
			},
		};

		await operations[caseName]();
	}

	// * sync folders
	for (const p of mixedPath) {
		const remote = remoteStatsMap.get(p);
		const local = localStatsMap.get(p);
		const record = syncRecords.get(p);
		const localPath = normalizeVaultPath(p);
		const remotePath = remotePathToAbsolute(remoteBaseDir, p);
		if (!(remote?.isDir || local?.isDir)) continue;

		let caseName: keyof typeof operations = 'NONE';
		let remoteChanged = false;
		let localChanged = false;

		if (record) {
			if (local) {
				if (remote) caseName = 'LOCAL_REMOTE_RECORD_NOOP';
				else {
					localChanged = hasFolderContentChanged(
						local.path,
						localStatsFiltered,
						syncRecords,
						'local',
					);
					if (localChanged) caseName = 'LOCAL_NOREMOTE_RECORD_PUSH';
					else if (hasIgnoredInFolder(local.path, localStats))
						caseName = 'LOCAL_NOREMOTE_RECORD_SKIP';
					else caseName = 'LOCAL_NOREMOTE_RECORD_REMOVE';
				}
			} else if (remote) {
				remoteChanged = hasFolderContentChanged(
					remotePath,
					remoteStatsFiltered,
					syncRecords,
					'remote',
				);
				if (remoteChanged) caseName = 'REMOTE_NOLOCAL_RECORD_PULL';
				else if (hasIgnoredInFolder(remotePath, remoteStats))
					caseName = 'REMOTE_NOLOCAL_RECORD_SKIP';
				else caseName = 'REMOTE_NOLOCAL_RECORD_REMOVE';
			} else caseName = 'NOLOCAL_NOREMOTE_RECORD_UNRECORD';
		} else {
			if (local && remote) caseName = 'LOCAL_REMOTE_NORECORD_RECORD';
			else if (local) caseName = 'LOCAL_NOREMOTE_NORECORD_PUSH';
			else if (remote) caseName = 'REMOTE_NOLOCAL_NORECORD_PULL';
			else caseName = 'NONE';
		}

		const operations = {
			NONE: () => {},
			NOLOCAL_NOREMOTE_RECORD_UNRECORD: () => {
				logger.debug(`cleaning orphaned sync record`, {
					reason: 'both local and remote deleted',
					remotePath,
					localPath,
					conditions: {
						localExists: !!local,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});

				tasks.push(
					taskFactory.createCleanRecordTask({
						remotePath,
						localPath,
					}),
				);
			},
			LOCAL_REMOTE_NORECORD_RECORD: () => {
				if (!local || !remote) return;
				logger.debug(`creating new record`, {
					reason: 'both local and remote exist but no record',
					remotePath,
					localPath,
					conditions: {
						localExists: !!local,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});

				createAddFolderRecordTaskWithSnapshot(
					{
						localPath,
						remotePath,
					},
					local,
					remote,
				);
			},
			LOCAL_REMOTE_RECORD_NOOP: () => {
				if (!remote || !local) return;
				if (!remote.isDir)
					throw new Error(
						`Folder conflict: local path ${localPath} is a folder but remote path ${remotePath} is a file`,
					);
				else if (!local.isDir)
					throw new Error(
						`Folder conflict: remote path ${remotePath} is a folder but local path ${localPath} is a file`,
					);
			},
			REMOTE_NOLOCAL_RECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create local folder according to remote \`${remotePath}\``, {
					reason: 'remote folder content changed',
					remotePath,
					localPath,
					conditions: {
						remoteChanged: true,
						localExists: !!local,
						recordExists: !!record,
					},
				});

				createMkdirLocalTaskWithSnapshot(
					{
						localPath,
						remotePath,
					},
					remote,
				);
			},
			REMOTE_NOLOCAL_RECORD_SKIP: () => {
				const ignoredPaths = getIgnoredPathsInFolder(remotePath, remoteStats);
				logger.debug(`Skip removing remote folder \`${remotePath}\``, {
					reason: 'remote folder contains ignored items',
					remotePath,
					localPath,
					conditions: {
						hasIgnoredItems: true,
						localExists: !!local,
						recordExists: !!record,
					},
					ignoredPaths,
				});
				tasks.push(
					taskFactory.createSkippedTask({
						localPath,
						remotePath,
						reason: SkipReason.FolderContainsIgnoredItems,
						ignoredPaths,
					}),
				);
			},
			REMOTE_NOLOCAL_RECORD_REMOVE: () => {
				logger.debug(`Remove remote folder \`${remotePath}\``, {
					reason: 'remote folder is removable (no content changes)',
					remotePath,
					localPath,
					conditions: {
						removable: true,
						localExists: !!local,
						recordExists: !!record,
					},
				});
				removeRemoteFolderTasks.push(
					taskFactory.createRemoveRemoteTask({
						localPath,
						remotePath,
					}),
				);
			},
			REMOTE_NOLOCAL_NORECORD_PULL: () => {
				if (!remote) return;
				logger.debug(`Create  local folder according to remote \`${remotePath}\``, {
					reason: 'remote folder does not exist locally',
					remotePath,
					localPath,
					conditions: {
						localExists: !!local,
						recordExists: !!record,
					},
				});

				createMkdirLocalTaskWithSnapshot(
					{
						localPath,
						remotePath,
					},
					remote,
				);
			},
			LOCAL_NOREMOTE_RECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${localPath}\``, {
					reason: 'local folder content changed',
					remotePath,
					localPath,
					conditions: {
						localChanged,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});
				if (hasInvalidChar(localPath)) {
					tasks.push(
						taskFactory.createFilenameErrorTask({
							localPath,
							remotePath,
						}),
					);
				} else {
					createMkdirRemoteTaskWithSnapshot(
						{
							localPath,
							remotePath,
						},
						local,
					);
				}
			},
			LOCAL_NOREMOTE_RECORD_SKIP: () => {
				const ignoredPaths = getIgnoredPathsInFolder(localPath, localStats);
				logger.debug(`Skip removing local folder \`${localPath}\``, {
					reason: '(contains ignored items)',
					remotePath,
					localPath,
					conditions: {
						hasIgnoredItems: true,
						remoteExists: !!remote,
						recordExists: !!record,
					},
					ignoredPaths,
				});
				tasks.push(
					taskFactory.createSkippedTask({
						localPath,
						remotePath,
						reason: SkipReason.FolderContainsIgnoredItems,
						ignoredPaths,
					}),
				);
			},
			LOCAL_NOREMOTE_RECORD_REMOVE: () => {
				logger.debug(`Remove local folder \`${localPath}\``, {
					reason: 'local folder is removable (no content changes)',
					remotePath,
					localPath,
					conditions: {
						removable: true,
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});
				removeLocalFolderTasks.push(
					taskFactory.createRemoveLocalRecursivelyTask({
						localPath,
						remotePath,
					}),
				);
			},
			LOCAL_NOREMOTE_NORECORD_PUSH: () => {
				if (!local) return;
				logger.debug(`Create remote folder according to local \`${localPath}\``, {
					reason: 'local folder does not exist remotely',
					remotePath,
					localPath,
					conditions: {
						remoteExists: !!remote,
						recordExists: !!record,
					},
				});
				if (hasInvalidChar(localPath)) {
					tasks.push(
						taskFactory.createFilenameErrorTask({
							localPath,
							remotePath,
						}),
					);
				} else {
					createMkdirRemoteTaskWithSnapshot(
						{
							localPath,
							remotePath,
						},
						local,
					);
				}
			},
		};

		operations[caseName]();
	}

	await updateProgress();
	tasks.push(
		...removeRemoteFolderTasks,
		...removeLocalFolderTasks,
		...mkdirLocalTasks,
		...mkdirRemoteTasks,
	);
	return tasks;
}
