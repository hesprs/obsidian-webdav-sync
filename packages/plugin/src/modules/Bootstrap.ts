import type { Events, Translations } from '@';
import type { DatabaseSync } from 'uni-kv';
import type { LocalFs, BatchOptimizer, RemoteFs } from '@/fs';
import type { TogglableValue } from '@/types';
import {
	localCancellationWrapper,
	localContextWrapper,
	localMemoryControlWrapper,
	localOptimizationWrapper,
	rateLimiterWrapper,
	remoteCancellationWrapper,
	remoteOptimizationWrapper,
	remoteContextWrapper,
	remoteMemoryControlWrapper,
	retryWrapper,
	hierarchalOptimizer,
	asymmetricStorageWrapper,
} from '@/fs';
import en from '@/i18n/en';
import { bidirectionalDecider } from '@/sync';
import type { On } from './EventBus';
import type { ObsidianLanguageCode, Translate } from './I18n';
import type {
	DeciderEntry,
	LocalFsWrapperEntry,
	MemoryDBMeta,
	MemoryDBSchema,
	RemoteFsEntry,
	RemoteFsWrapperEntry,
	SyncTriggerEntry,
} from './Registrar';

export default class Bootstrap {
	private readonly cleanupCallbacks: Array<() => void> = [];
	private readonly hangingOperations: Array<{
		size: number;
		resume: () => void;
	}> = [];
	private isCancelled = () => false;
	private memoryConsumption = 0;

	private readonly localPool: Array<string> = [];
	private readonly remotePool: Array<string> = [];

	declare readonly i18n: {
		bidirectional: string;
	};
	declare readonly settings: {
		maxMemoryConsumption: TogglableValue;
		maxRequestConcurrency: TogglableValue;
		minRequestInterval: TogglableValue;
		realtimeSyncFastMode: boolean;
		asymmetricStorage: boolean;
	};

	constructor(
		private readonly ctx: {
			registerI18n: (code: ObsidianLanguageCode, resource: Record<string, string>) => void;
			on: On<Events>;
			memoryDB: DatabaseSync<MemoryDBSchema, MemoryDBMeta>;
			registerDecider: (id: string, entry: DeciderEntry) => void;
			registerLocalFsWrapper: (entry: LocalFsWrapperEntry) => void;
			registerRemoteFs: (id: string, entry: RemoteFsEntry) => void;
			registerRemoteFsWrapper: (entry: RemoteFsWrapperEntry) => void;
			translate: Translate<Translations>;
			getLocalOptimizer: () => BatchOptimizer<LocalFs>;
			getRemoteOptimizer: () => BatchOptimizer<RemoteFs>;
			registerLocalOptimizer: (optimizer: BatchOptimizer<LocalFs>) => void;
			registerRemoteOptimizer: (optimizer: BatchOptimizer<RemoteFs>) => void;
			registerSyncTrigger: (trigger: string, entry: SyncTriggerEntry) => void;
		},
	) {
		ctx.registerI18n('en', en);
	}

	readonly start = () => {
		const {
			registerLocalFsWrapper,
			registerRemoteFsWrapper,
			on,
			memoryDB,
			registerDecider,
			translate: t,
			registerLocalOptimizer,
			registerRemoteOptimizer,
			registerSyncTrigger,
		} = this.ctx;
		const { maxMemoryConsumption, maxRequestConcurrency, minRequestInterval } = this.settings;

		const getMaxMemory = () =>
			maxMemoryConsumption.enabled ? maxMemoryConsumption.value : Infinity;
		const getMaxConcurrency = () =>
			maxRequestConcurrency.enabled ? maxRequestConcurrency.value : Infinity;
		const getMinInterval = () => (minRequestInterval.enabled ? minRequestInterval.value : 0);

		registerSyncTrigger('manual', { priority: 5000 });
		registerSyncTrigger('nonInteractiveManual', { priority: 4000 });
		registerSyncTrigger('startup', { priority: 3000 });
		registerSyncTrigger('interval', { priority: 2000 });
		registerSyncTrigger('realtime', {
			getRemoteList: () => {
				if (this.settings.realtimeSyncFastMode) return;
				const stats = memoryDB.getStore('remoteStatContext').values();
				return stats.length ? stats : undefined;
			},
			priority: 1000,
		});

		registerLocalOptimizer(hierarchalOptimizer);
		registerRemoteOptimizer(hierarchalOptimizer);
		registerLocalFsWrapper({
			apply: (fs) =>
				localMemoryControlWrapper(fs, {
					hangingOperations: this.hangingOperations,
					maxMemory: getMaxMemory(),
					memoryConsumption: this.memoryConsumption,
				}),
			order: 1000,
		});
		registerLocalFsWrapper({
			apply: (fs) =>
				localOptimizationWrapper(fs, {
					batchOptimizer: this.ctx.getLocalOptimizer(),
					localPool: this.localPool,
					remotePool: this.remotePool,
				}),
			order: 2000,
		});
		registerLocalFsWrapper({
			apply: (fs) => localCancellationWrapper(fs, this.isCancelled),
			order: 3000,
		});
		registerLocalFsWrapper({ apply: (fs) => localContextWrapper(fs, memoryDB), order: 10_000 });

		registerRemoteFsWrapper({
			apply: (fs) =>
				remoteMemoryControlWrapper(fs, {
					hangingOperations: this.hangingOperations,
					maxMemory: getMaxMemory(),
					memoryConsumption: this.memoryConsumption,
				}),
			order: 1000,
		});
		registerRemoteFsWrapper({
			apply: (fs) =>
				remoteOptimizationWrapper(fs, {
					batchOptimizer: this.ctx.getRemoteOptimizer(),
					localPool: this.localPool,
					remotePool: this.remotePool,
				}),
			order: 2000,
		});
		registerRemoteFsWrapper({
			apply: (fs) => remoteCancellationWrapper(fs, this.isCancelled),
			order: 3000,
		});
		registerRemoteFsWrapper({ apply: (fs) => retryWrapper(fs), order: 4000 });
		registerRemoteFsWrapper({
			apply: (fs) =>
				rateLimiterWrapper(fs, {
					maxConcurrency: getMaxConcurrency(),
					minInterval: getMinInterval(),
				}),
			order: 5000,
		});
		registerRemoteFsWrapper({
			apply: (fs) => remoteContextWrapper(fs, memoryDB),
			order: 10_000,
		});
		registerRemoteFsWrapper({
			apply: (fs) =>
				this.settings.asymmetricStorage ? asymmetricStorageWrapper(fs, memoryDB) : fs,
			order: 11_000,
		});

		registerDecider('bidirectional', {
			decider: bidirectionalDecider,
			prettyName: t('bidirectional'),
		});

		this.cleanupCallbacks.push(
			on('syncStarted', ({ isCancelled }) => {
				this.isCancelled = isCancelled;
				this.hangingOperations.length = this.memoryConsumption = 0;
				this.localPool.length = this.remotePool.length = 0;
			}),
			on('syncTerminated', () => {
				this.isCancelled = () => false;
			}),
		);
	};

	readonly dispose = () => {
		this.cleanupCallbacks.forEach((cb) => cb());
		this.cleanupCallbacks.length = 0;
		this.hangingOperations.length = 0;
	};
}
