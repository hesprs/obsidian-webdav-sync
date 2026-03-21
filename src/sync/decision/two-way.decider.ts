import type { SyncRecord } from '~/storage';
import { SyncRunKind } from '~/model/sync-record.model';
import type { SyncEngine } from '..';
import type {
	ConflictTaskOptions,
	PullTaskOptions,
	SkippedTaskOptions,
	TaskFactory,
	TaskOptions,
} from './sync-decision.interface';
import CleanRecordTask from '../tasks/clean-record.task';
import ConflictResolveTask from '../tasks/conflict-resolve.task';
import FilenameErrorTask from '../tasks/filename-error.task';
import MkdirLocalTask from '../tasks/mkdir-local.task';
import MkdirRemoteTask from '../tasks/mkdir-remote.task';
import NoopTask from '../tasks/noop.task';
import PullTask from '../tasks/pull.task';
import PushTask from '../tasks/push.task';
import RemoveLocalTask from '../tasks/remove-local.task';
import RemoveRemoteTask from '../tasks/remove-remote.task';
import SkippedTask from '../tasks/skipped.task';
import { BaseTask } from '../tasks/task.interface';
import { twoWayDecider } from './two-way.decider.function';

export default class TwoWaySyncDecider {
	constructor(
		protected sync: SyncEngine,
		protected syncRecordStorage: SyncRecord,
	) {}

	protected getSyncRecordStorage() {
		return this.syncRecordStorage;
	}

	get webdav() {
		return this.sync.webdav;
	}

	get settings() {
		return this.sync.settings;
	}

	get vault() {
		return this.sync.vault;
	}

	get remoteBaseDir() {
		return this.sync.remoteBaseDir;
	}

	async decide(): Promise<BaseTask[]> {
		const syncRecordStorage = this.getSyncRecordStorage();
		const [previousLocalRecords, previousRemoteRecord, currentLocalStats] = await Promise.all([
			syncRecordStorage.getLocalRecords(),
			syncRecordStorage.getRemoteRecord(),
			this.sync.localFS.walk(),
		]);
		const previousRemoteStats = previousRemoteRecord
			? await this.sync.remoteFs.walk({ remoteSource: 'stored-record' })
			: [];
		const currentRemoteStats =
			this.sync.runKind === SyncRunKind.NUMB
				? previousRemoteStats
				: await this.sync.remoteFs.walk({ freshness: 'fresh' });

		// 创建共用的task选项
		const commonTaskOptions = {
			webdav: this.webdav,
			vault: this.vault,
			remoteBaseDir: this.remoteBaseDir,
			syncRecord: syncRecordStorage,
		};

		// 创建Task工厂
		const taskFactory: TaskFactory = {
			createPullTask: (options: PullTaskOptions) =>
				new PullTask({ ...commonTaskOptions, ...options }),
			createPushTask: (options: TaskOptions) =>
				new PushTask({ ...commonTaskOptions, ...options }),
			createConflictResolveTask: (options: ConflictTaskOptions) =>
				new ConflictResolveTask({ ...commonTaskOptions, ...options }),
			createNoopTask: (options: TaskOptions) =>
				new NoopTask({ ...commonTaskOptions, ...options }),
			createRemoveLocalTask: (options: TaskOptions) =>
				new RemoveLocalTask({ ...commonTaskOptions, ...options }),
			createRemoveRemoteTask: (options: TaskOptions) =>
				new RemoveRemoteTask({ ...commonTaskOptions, ...options }),
			createMkdirLocalTask: (options: TaskOptions) =>
				new MkdirLocalTask({ ...commonTaskOptions, ...options }),
			createMkdirRemoteTask: (options: TaskOptions) =>
				new MkdirRemoteTask({ ...commonTaskOptions, ...options }),
			createCleanRecordTask: (options: TaskOptions) =>
				new CleanRecordTask({ ...commonTaskOptions, ...options }),
			createFilenameErrorTask: (options: TaskOptions) =>
				new FilenameErrorTask({ ...commonTaskOptions, ...options }),
			createSkippedTask: (options: SkippedTaskOptions) =>
				new SkippedTask({ ...commonTaskOptions, ...options }),
		};

		const compareFileContent = async (filePath: string, baseText: string): Promise<boolean> => {
			const file = this.vault.getFileByPath(filePath);
			if (!file) return false;
			const currentContent = await this.vault.read(file);
			return currentContent === baseText;
		};

		return await twoWayDecider({
			settings: {
				skipLargeFiles: this.settings.skipLargeFiles,
				conflictStrategy: this.settings.conflictStrategy,
				useGitStyle: this.settings.useGitStyle,
				syncMode: this.settings.syncMode,
			},
			currentLocalStats,
			currentRemoteStats,
			previousRemoteStats,
			previousLocalRecords,
			remoteBaseDir: this.remoteBaseDir,
			compareFileContent,
			taskFactory,
		});
	}
}
