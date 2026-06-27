import type { RemoteFs, LocalFs } from '@/fs';
import type { SyncRecord } from '@/storage';
import type { MaybePromise } from '@/types';
import type { TaskOptions } from '../decision/interface';

export type BaseTaskOptions = {
	localFs: LocalFs;
	remoteFs: RemoteFs;
	record: SyncRecord;
};

export type TaskNames =
	| 'addRecord'
	| 'removeRecord'
	| 'createLocalDir'
	| 'createRemoteDir'
	| 'download'
	| 'merge'
	| 'removeLocal'
	| 'removeRemote'
	| 'upload';

export abstract class BaseTask<T extends TaskOptions = TaskOptions> {
	constructor(readonly options: BaseTaskOptions & T) {
		this.remoteFs = options.remoteFs;
		this.localFs = options.localFs;
		this.record = options.record;
		this.key = options.key;
		this.local = options.local;
		this.remote = options.remote;
	}
	protected readonly remoteFs: RemoteFs;
	protected readonly localFs: LocalFs;
	protected readonly record: SyncRecord;
	declare name: TaskNames;
	declare prettyName: string;
	readonly key: string;
	readonly local: (BaseTaskOptions & T)['local'];
	readonly remote: (BaseTaskOptions & T)['remote'];

	abstract exec(): MaybePromise<void>;
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

const RED_COLOR = 'var(--color-red)';
const BLUE_COLOR = 'var(--color-blue)';
const YELLOW_COLOR = 'var(--color-yellow)';

export function getTaskIcon(taskName: TaskNames): string {
	switch (taskName) {
		case 'createRemoteDir': {
			return 'folder-up';
		}
		case 'createLocalDir': {
			return 'folder-down';
		}
		case 'download': {
			return 'file-down';
		}
		case 'upload': {
			return 'file-up';
		}
		case 'merge': {
			return 'combine';
		}
		case 'removeLocal': {
			return 'file-x';
		}
		case 'removeRemote': {
			return 'archive-x';
		}
		default: {
			return 'refresh-cw';
		}
	}
}

export function getTaskColor(taskName: TaskNames): string {
	switch (taskName) {
		case 'merge': {
			return YELLOW_COLOR;
		}
		case 'removeLocal':
		case 'removeRemote': {
			return RED_COLOR;
		}
		case 'createRemoteDir':
		case 'createLocalDir':
		case 'download':
		case 'upload':
		default: {
			return BLUE_COLOR;
		}
	}
}
