import type { MemoryDatabase } from 'uni-kv';
import type { TogglableValue } from '~/types';
import {
	commonOptimizationWrapper,
	localCancellationWrapper,
	localContextWrapper,
	localMemoryControlWrapper,
	localOptimizationWrapper,
	rateLimiterWrapper,
	remoteCancellationWrapper,
	remoteContextWrapper,
	remoteMemoryControlWrapper,
	retryWrapper,
} from '~/fs';
import en from '~/i18n/en';
import { bidirectionalDecider } from '~/sync';
import type { On } from './EventBus';
import type { ObsidianLanguageCode, Translate } from './I18n';
import type {
	DeciderEntry,
	LocalFsWrapperEntry,
	MemoryDBMeta,
	MemoryDBSchema,
	RemoteFsEntry,
	RemoteFsWrapperEntry,
} from './Storage';

export default class Bootstrap {
	private readonly cleanupCallbacks: Array<() => void> = [];
	private readonly hangingOperations: Array<{
		size: number;
		resume: () => void;
	}> = [];
	private isCancelled = () => false;
	private memoryConsumption = 0;

	declare readonly i18n: {
		bidirectional: string;
	};

	declare readonly settings: {
		maxMemoryConsumption: TogglableValue;
		maxRequestConcurrency: TogglableValue;
		minRequestInterval: TogglableValue;
	};

	constructor(
		private readonly ctx: {
			registerI18n: (code: ObsidianLanguageCode, resource: Record<string, string>) => void;
			on: On;
			memoryDB: MemoryDatabase<MemoryDBSchema, MemoryDBMeta>;
			registerDecider: (id: string, entry: DeciderEntry) => void;
			registerLocalFsWrapper: (entry: LocalFsWrapperEntry) => void;
			registerRemoteFs: (id: string, entry: RemoteFsEntry) => void;
			registerRemoteFsWrapper: (entry: RemoteFsWrapperEntry) => void;
			translate: Translate;
		},
	) {
		const { registerI18n, registerLocalFsWrapper, registerRemoteFsWrapper, on, memoryDB } = ctx;
		const { maxMemoryConsumption, maxRequestConcurrency, minRequestInterval } = this.settings;
		registerI18n('en', en);

		const getMaxMemory = () =>
			maxMemoryConsumption.enabled ? maxMemoryConsumption.value : Infinity;
		const getMaxConcurrency = () =>
			maxRequestConcurrency.enabled ? maxRequestConcurrency.value : Infinity;
		const getMinInterval = () => (minRequestInterval.enabled ? minRequestInterval.value : 0);

		registerLocalFsWrapper({
			apply: (fs) =>
				localMemoryControlWrapper(fs, {
					hangingOperations: this.hangingOperations,
					maxMemory: getMaxMemory(),
					memoryConsumption: this.memoryConsumption,
				}),
			order: 1000,
		});
		registerLocalFsWrapper({ apply: (fs) => localOptimizationWrapper(fs), order: 2000 });
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
		registerRemoteFsWrapper({ apply: (fs) => commonOptimizationWrapper(fs), order: 2000 });
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

		this.cleanupCallbacks.push(
			on('syncStarted', ({ isCancelled: syncIsCancelled }) => {
				this.isCancelled = syncIsCancelled;
				this.hangingOperations.length = this.memoryConsumption = 0;
			}),
			on('syncTerminate', () => {
				this.isCancelled = () => false;
			}),
		);
	}

	readonly start = () => {
		const { registerDecider, translate: t } = this.ctx;
		registerDecider('bidirectional', {
			decider: bidirectionalDecider,
			prettyName: t('bidirectional'),
		});
	};

	readonly dispose = () => {
		this.cleanupCallbacks.forEach((cb) => cb());
		this.hangingOperations.length = 0;
	};
}
