import type { Vault } from 'obsidian';
import type { WebDAVClient } from 'webdav';
import type { TranslationShape } from '~/i18n';
import type { SyncRecord } from '~/storage';
import type { MaybePromise } from '~/types';
import type { TaskOptions } from '../decision/sync-decision.interface';

export type BaseTaskOptions = {
	vault: Vault;
	webdav: WebDAVClient;
	syncRecord: SyncRecord;
};

type TaskSuccessResult = {
	success: true;
};

type TaskFailureResult = {
	success: false;
	error: TaskError;
};

export type TaskResult = TaskSuccessResult | TaskFailureResult;
export type TaskNames = BaseTask['name'];

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
	abstract readonly name: keyof TranslationShape['sync']['fileOp'];
	readonly localPath: string;
	readonly remotePath: string;
	protected readonly webdav: WebDAVClient;
	protected readonly syncRecord: SyncRecord;
	protected readonly vault: Vault;
	readonly local: (BaseTaskOptions & T)['local'];
	readonly remote: (BaseTaskOptions & T)['remote'];

	abstract exec(): MaybePromise<TaskResult>;
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
	if (e instanceof TaskError) return e;

	const message = e instanceof Error ? e.message : String(e);
	return new TaskError(message, task, e instanceof Error ? e : undefined);
}
