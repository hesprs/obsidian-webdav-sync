import type { WebDAVClient } from 'webdav';
import { Vault } from 'obsidian';
import type { MaybePromise } from '~/utils/types';
import {
	isAbsoluteRemotePath,
	joinRemotePath,
	normalizeRemotePath,
} from '~/platform/path/remote-path';
import { normalizeVaultPath } from '~/platform/path/vault-path';
import { SyncRecord } from '~/storage/sync-record';
import getTaskName from '~/utils/get-task-name';

export interface BaseTaskOptions {
	vault: Vault;
	webdav: WebDAVClient;
	remoteBaseDir: string;
	remotePath: string;
	localPath: string;
	syncRecord: SyncRecord;
}

interface TaskSuccessResult {
	success: true;
	skipRecord?: boolean;
}

interface TaskFailureResult {
	success: false;
	error: TaskError;
	skipRecord?: boolean;
}

export type TaskResult = TaskSuccessResult | TaskFailureResult;

export abstract class BaseTask {
	constructor(readonly options: BaseTaskOptions) {}

	get vault() {
		return this.options.vault;
	}

	get syncRecord() {
		return this.options.syncRecord;
	}

	get webdav() {
		return this.options.webdav;
	}

	get remoteBaseDir() {
		return this.options.remoteBaseDir;
	}

	get remotePath() {
		return isAbsoluteRemotePath(this.options.remotePath)
			? normalizeRemotePath(this.options.remotePath)
			: joinRemotePath(this.remoteBaseDir, this.options.remotePath);
	}

	get localPath() {
		return normalizeVaultPath(this.options.localPath);
	}

	abstract exec(): MaybePromise<TaskResult>;

	toJSON() {
		const { localPath, remoteBaseDir, remotePath } = this;
		const taskName = getTaskName(this);
		return {
			taskName,
			localPath,
			remoteBaseDir,
			remotePath,
		};
	}
}

export class TaskError extends Error {
	constructor(
		message: string,
		readonly task: BaseTask,
		readonly cause?: Error,
	) {
		super(message);
		this.name = 'TaskError';
	}
}

export function toTaskError(e: unknown, task: BaseTask): TaskError {
	if (e instanceof TaskError) {
		return e;
	}
	const message = e instanceof Error ? e.message : String(e);
	return new TaskError(message, task, e instanceof Error ? e : undefined);
}
