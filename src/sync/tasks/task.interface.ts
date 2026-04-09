import type { WebDAVClient } from 'webdav';
import { Vault } from 'obsidian';
import type en from '~/i18n/enold';
import type { SyncRecord } from '~/storage';
import type { MaybePromise } from '~/types';
import getTaskName from '~/utils/get-task-name';
import type { TaskOptions } from '../decision/sync-decision.interface';

export interface BaseTaskOptions {
	vault: Vault;
	webdav: WebDAVClient;
	syncRecord: SyncRecord;
}

interface TaskSuccessResult {
	success: true;
}

interface TaskFailureResult {
	success: false;
	error: TaskError;
}

export type TaskResult = TaskSuccessResult | TaskFailureResult;

export abstract class BaseTask<T extends TaskOptions = TaskOptions> {
	constructor(readonly options: BaseTaskOptions & T) {
		this.webdav = options.webdav;
		this.vault = options.vault;
		this.syncRecord = options.syncRecord;
		this.localPath = options.localPath;
		this.remotePath = options.remotePath;
		this.local = options.local;
		this.remote = options.remote;
	}
	readonly name?: keyof typeof en.sync.fileOp;
	readonly localPath: string;
	readonly remotePath: string;
	protected readonly webdav: WebDAVClient;
	protected readonly syncRecord: SyncRecord;
	protected readonly vault: Vault;
	protected readonly local: (BaseTaskOptions & T)['local'];
	protected readonly remote: (BaseTaskOptions & T)['remote'];

	abstract exec(): MaybePromise<TaskResult>;

	toJSON() {
		const { localPath, remotePath } = this;
		const taskName = getTaskName(this);
		return {
			taskName,
			localPath,
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
