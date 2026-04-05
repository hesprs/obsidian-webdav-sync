import type { WebDAVClient } from 'webdav';
import { Vault } from 'obsidian';
import type en from '~/i18n/enold';
import type { SyncRecord } from '~/storage';
import type { MaybePromise } from '~/types';
import getTaskName from '~/utils/get-task-name';
import type { TaskOptions } from '../decision/sync-decision.interface';

export interface BaseTaskOptions extends TaskOptions {
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

export abstract class BaseTask {
	constructor(readonly options: BaseTaskOptions) {}
	readonly name?: keyof typeof en.sync.fileOp;

	get vault() {
		return this.options.vault;
	}

	get syncRecord() {
		return this.options.syncRecord;
	}

	get webdav() {
		return this.options.webdav;
	}

	get remotePath() {
		return this.options.remotePath;
	}

	get localPath() {
		return this.options.localPath;
	}

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
