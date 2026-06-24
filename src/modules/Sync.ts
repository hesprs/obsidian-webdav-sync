import type { PluginSettings } from '~';
import type { LocalFs, Progress, Stat } from '~/fs';
import type {
	Decider,
	OptionsWithBothFileStatsAndSettings,
	OptionsWithBothStats,
	OptionsWithLocalFileStat,
	OptionsWithLocalFolderStat,
	OptionsWithLocalStat,
	OptionsWithRemoteFileStat,
	OptionsWithRemoteFolderStat,
	OptionsWithRemoteStat,
	TaskOptions,
	TaskFactory,
	TaskNames,
} from '~/sync';
import type {
	ConflictStrategy,
	GlobMatchOptions,
	RecordStatsMap,
	StatsMap,
	TogglableValue,
	UnmergeableStrategy,
} from '~/types';
import {
	RemoveLocalTask,
	RemoveRemoteTask,
	MkdirLocalTask,
	MkdirRemoteTask,
	PushTask,
	PullTask,
	AddRecordTask,
	RemoveRecordTask,
	MergeTask,
	BaseTask,
	postTraversal,
} from '~/sync';
import type { Dispatch, On } from './EventBus';
import type { Translate } from './I18n';
import type { DeleteConfirmReturn } from './ProgressModal';
import type { Infras } from './Storage';

type SyncTerminateReason =
	| { result: 'cancelled' }
	| { result: 'completed' }
	| { result: 'failed'; error: string }
	| { result: 'noop' };

export type SyncTrigger = 'manual' | 'nonInteractiveManual' | 'startup' | 'interval' | 'realtime';
export type TaskInfo = { name: TaskNames; key: string; prettyName: string };
export type FailedTaskInfo = TaskInfo & { error: string };

const syncCancelledError = new Error('Sync cancelled by user.');

export default class Sync {
	dispatch: Dispatch;
	on: On;

	constructor(
		private readonly ctx: {
			dispatch: Dispatch;
			initializeSync: () => Promise<Infras>;
			getDecider: () => Decider;
			on: On;
			translate: Translate;
		},
	) {
		this.dispatch = ctx.dispatch;
		this.on = ctx.on;
	}

	declare readonly events: {
		syncStarted: { isCancelled: () => boolean; trigger: SyncTrigger };
		remoteWalkProgress: Progress;
		syncTerminate: SyncTerminateReason;
		requestConfirmDelete: Array<RemoveLocalTask>;
		requestConfirmTasks: Array<BaseTask>;
		syncCanceled: undefined;
		taskCompleted: TaskInfo;
		taskFailed: FailedTaskInfo;
		executionStarted: Array<BaseTask>;
	};

	declare readonly settings: {
		realtimeSyncFastMode: boolean;
		maxFileSize: TogglableValue;
		exclusionRules: Array<GlobMatchOptions>;
		inclusionRules: Array<GlobMatchOptions>;
		conflictStrategy: ConflictStrategy;
		unmergeableStrategy: UnmergeableStrategy;
		confirmDeleteInAutoSync: boolean;
		confirmTasksInSync: boolean;
		useGitStyle: boolean;
	};

	private readonly postProcess = (stats: Array<Stat>) =>
		postTraversal({
			exclusionRules: this.settings.exclusionRules,
			inclusionRules: this.settings.inclusionRules,
			maxSize: this.settings.maxFileSize.enabled
				? this.settings.maxFileSize.value
				: undefined,
			stats: toMap(stats),
		});

	private readonly confirmTasks = (tasks: Array<BaseTask>) =>
		new Promise<Array<BaseTask>>((resolve, reject) => {
			const unsub1 = this.on('tasksConfirmed', (result) => {
				cleanup();
				resolve(result);
			});
			const unsub2 = this.on('syncCanceled', () => {
				cleanup();
				reject(syncCancelledError);
			});
			function cleanup() {
				unsub1();
				unsub2();
			}
			this.dispatch('requestConfirmTasks', tasks);
		});

	private readonly confirmDeletion = (tasks: Array<RemoveLocalTask>) =>
		new Promise<DeleteConfirmReturn>((resolve, reject) => {
			const unsub1 = this.on('deleteConfirmed', (result) => {
				cleanup();
				resolve(result);
			});
			const unsub2 = this.on('syncCanceled', () => {
				cleanup();
				reject(syncCancelledError);
			});
			function cleanup() {
				unsub1();
				unsub2();
			}
			this.dispatch('requestConfirmDelete', tasks);
		});

	private readonly executeSync = async (trigger: SyncTrigger) => {
		let cancelled = false;
		let failedCount = 0;
		let tasks: Array<BaseTask>;
		const isCancelled = () => cancelled;
		try {
			this.dispatch('syncStarted', { isCancelled, trigger });
			this.on('syncCanceled', () => (cancelled = true));
			const { record, localFs, remoteFs } = await this.ctx.initializeSync();
			const [localList, remoteList, records] = await Promise.all([
				localFs.listAll('/'),
				this.settings.realtimeSyncFastMode && trigger === 'realtime'
					? Promise.resolve(undefined)
					: (async () => {
							try {
								return await remoteFs.listAll('/', (progress) =>
									this.dispatch('remoteWalkProgress', progress),
								);
							} catch (error) {
								if (await remoteFs.exists('/')) throw error;
								await Promise.all([remoteFs.mkdir('/', true), record.drop()]);
								return [];
							}
						})(),
				record.getRecords(),
			]);
			const localStats = this.postProcess(localList);
			const remoteStats = this.postProcess(remoteList ?? extractRemoteRecords(records));
			this.dispatch(
				'log',
				`Local ${localStats.size} items, remote ${remoteStats.size} items, record ${records.size} items.`,
			);

			const taskFactory = createTaskFactory({
				localFs,
				record,
				remoteFs,
				translate: this.ctx.translate,
			});
			tasks = this.ctx.getDecider()({
				localStats,
				logger: (log: string) => this.dispatch('log', log),
				records,
				remoteStats,
				settings: this.settings as PluginSettings,
				taskFactory,
			});
			if (tasks.length === 0) {
				this.dispatch('syncTerminate', { result: 'noop' });
				return;
			}
			this.dispatch('log', `Planning finished with ${tasks.length} tasks.`);

			const [nonDisplayableTasks, displayableTasks] = partition(
				tasks,
				(task) => task instanceof AddRecordTask || task instanceof RemoveRecordTask,
			);
			if (
				trigger === 'manual' &&
				this.settings.confirmTasksInSync &&
				displayableTasks.length !== 0
			) {
				const confirmResult = await this.confirmTasks(tasks);
				tasks = [...nonDisplayableTasks, ...confirmResult];
			}

			const [removeLocalTasks, otherTasks] = partition(
				tasks,
				(task) => task instanceof RemoveLocalTask,
			);
			if (
				trigger !== 'manual' &&
				trigger !== 'nonInteractiveManual' &&
				this.settings.confirmDeleteInAutoSync &&
				removeLocalTasks.length !== 0
			) {
				const confirmResult = await this.confirmDeletion(removeLocalTasks);
				tasks = [
					...confirmResult.delete,
					...(await this.convertDeleteToUpload(confirmResult.reupload, localFs)),
					...otherTasks,
				];
			}

			this.dispatch('executionStarted', tasks);
			await Promise.all(
				tasks.map(async (task) => {
					try {
						await task.exec();
						this.dispatch('taskCompleted', toTaskInfo(task));
					} catch (error) {
						if (cancelled) return;
						failedCount++;
						this.dispatch('taskFailed', {
							...toTaskInfo(task),
							error: toErrorMessage(error),
						});
					}
				}),
			);

			this.dispatch('syncTerminate', { result: 'completed' });
		} catch (error) {
			if (cancelled) this.dispatch('syncTerminate', { result: 'cancelled' });
			else if (failedCount)
				this.dispatch('syncTerminate', {
					error: `Execution of ${failedCount} tasks failed.`,
					result: 'failed',
				});
			else this.dispatch('syncTerminate', { error: toErrorMessage(error), result: 'failed' });
		}
	};

	private async convertDeleteToUpload(tasks: Array<RemoveLocalTask>, localFs: LocalFs) {
		const final: Array<PushTask | MkdirRemoteTask> = [];
		await Promise.all(
			tasks.map(async (task) => {
				const options = task.options;
				const local = await localFs.stat(options.key);
				if (!local) {
					this.dispatch(
						'log',
						`Local file \`${options.key}\` not found during reupload.`,
					);
					return;
				}
				if (local.isDir) final.push(new MkdirRemoteTask({ ...options, local }));
				else final.push(new PushTask({ ...options, local }));
			}),
		);
		return final;
	}

	root = { executeSync: this.executeSync };
}

function toMap(stats: Array<Stat>): StatsMap {
	const res = new Map<string, Stat>();
	for (const stat of stats) res.set(stat.key, stat);
	return res;
}

function createTaskFactory(
	baseOptions: Infras & { translate: (key: TaskNames) => string },
): TaskFactory {
	return {
		createAddRecordTask: (opts: OptionsWithBothStats) =>
			new AddRecordTask({ ...baseOptions, ...opts }),
		createCleanRecordTask: (opts: TaskOptions) =>
			new RemoveRecordTask({ ...baseOptions, ...opts }),
		createMergeTask: (opts: OptionsWithBothFileStatsAndSettings) =>
			new MergeTask({ ...baseOptions, ...opts }),
		createMkdirLocalTask: (opts: OptionsWithRemoteFolderStat) =>
			new MkdirLocalTask({ ...baseOptions, ...opts }),
		createMkdirRemoteTask: (opts: OptionsWithLocalFolderStat) =>
			new MkdirRemoteTask({ ...baseOptions, ...opts }),
		createPullTask: (opts: OptionsWithRemoteFileStat) =>
			new PullTask({ ...baseOptions, ...opts }),
		createPushTask: (opts: OptionsWithLocalFileStat) =>
			new PushTask({ ...baseOptions, ...opts }),
		createRemoveLocalTask: (opts: OptionsWithLocalStat) =>
			new RemoveLocalTask({ ...baseOptions, ...opts }),
		createRemoveRemoteTask: (opts: OptionsWithRemoteStat) =>
			new RemoveRemoteTask({ ...baseOptions, ...opts }),
	};
}

function partition<T, U extends T>(
	items: ReadonlyArray<T>,
	predicate: (item: T, index: number) => item is U,
): [Array<U>, Array<Exclude<T, U>>];

function partition<T>(
	items: ReadonlyArray<T>,
	predicate: (item: T, index: number) => boolean,
): [Array<T>, Array<T>] {
	const truthy: Array<T> = [];
	const falsy: Array<T> = [];
	for (let i = 0; i < items.length; i++) (predicate(items[i], i) ? truthy : falsy).push(items[i]);
	return [truthy, falsy];
}

function toTaskInfo(task: BaseTask): TaskInfo {
	return { key: task.key, name: task.name, prettyName: task.prettyName };
}

function extractRemoteRecords(records: RecordStatsMap): Array<Stat> {
	const res: Array<Stat> = [];
	for (const [key, record] of records)
		res.push(
			record.isDir
				? { isDir: true, key }
				: { isDir: false, key, mtime: 0, size: 0, uid: record.remote },
		);
	return res;
}

export function toErrorMessage(error: unknown) {
	return error instanceof Error ? error.message : String(error);
}
