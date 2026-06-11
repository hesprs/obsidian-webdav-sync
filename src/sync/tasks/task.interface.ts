import type { RemoteFs, VaultFs } from '~/fs-new';
import type { TranslationShape } from '~/i18n';
import type { SyncRecord } from '~/storage';
import type { MaybePromise } from '~/types';
import type { TaskOptions } from '../decision/sync-decision.interface';

export type BaseTaskOptions = {
	vault: VaultFs;
	webdav: RemoteFs;
	syncRecord: SyncRecord;
};

export type TaskResult =
	| {
			success: true;
	  }
	| {
			success: false;
			error: TaskError;
	  };

export type TaskNames = BaseTask['name'];

export abstract class BaseTask<T extends TaskOptions = TaskOptions> {
	constructor(readonly options: BaseTaskOptions & T) {
		this.webdav = options.webdav;
		this.vault = options.vault;
		this.syncRecord = options.syncRecord;
		this.key = options.key;
		this.local = options.local;
		this.remote = options.remote;
	}
	abstract readonly name: keyof TranslationShape['sync']['fileOp'];
	readonly key: string;
	protected readonly webdav: RemoteFs;
	protected readonly syncRecord: SyncRecord;
	protected readonly vault: VaultFs;
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
