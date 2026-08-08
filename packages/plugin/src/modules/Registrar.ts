import type { Events } from '@';
import type { App, Plugin, RequestUrlParam } from 'obsidian';
import type { StoreAsync } from 'uni-kv';
import { toArrayBuffer, toUint8Array } from '@repo/shared/binary';
import hash from '@repo/shared/crypto';
import { PluginSettingTab, requestUrl } from 'obsidian';
import type { BatchOptimizer, Fs, ListReporter, RootFs, VaultRequest } from '@/fs';
import type { ConflictResolver, Decider } from '@/sync';
import type { General, MaybePromise, RecordStat, Stat, Binary } from '@/types';
import { createVaultRequest, VaultFs } from '@/fs';
import type { On } from './EventBus';
import type { RecordStore } from './Storage';

type RejectableWrapper<T> = (value: T) => T | undefined;
type OrderedWrapperEntry<T> = { priority: number; apply: RejectableWrapper<T> };
export type RemoteRequestMiddlewareEntry = OrderedWrapperEntry<Request>;
export type LocalRequestMiddlewareEntry = OrderedWrapperEntry<VaultRequest>;
export type FsWrapperEntry = OrderedWrapperEntry<Fs>;

export type CheckConnectionResult = { success: true } | { success: false; reason: string };
export type RemoteFsEntry = {
	instantiate: (request: Request) => RootFs;
	prettyName: () => string;
	checkConnection: (request: Request) => MaybePromise<CheckConnectionResult>;
};
export type DeciderEntry = { decider: Decider; prettyName: () => string };
export type ConflictResolverEntry = {
	prettyName: () => string;
	resolver: ConflictResolver;
};

type GeneralFn = (...args: ReadonlyArray<General>) => unknown;
type RejectableApply<F extends GeneralFn> = (...input: Parameters<F>) => ReturnType<F> | undefined;
type OrderedApplyEntry<F extends GeneralFn> = { apply: RejectableApply<F>; priority: number };

export type RemoteLister = (
	info: Infras & { trigger: string; reporter: ListReporter },
) => MaybePromise<Array<Stat>>;
export type RemoteListerEntry = OrderedApplyEntry<RemoteLister>;
export type OptimizerEntry = OrderedApplyEntry<BatchOptimizer>;

export type SettingEntry = {
	priority: number;
	apply: (el: HTMLElement) => void;
};

export type RequestParam = Omit<RequestUrlParam, 'body'> & { body?: string | Binary };
export type RequestResponse = {
	text: () => string;
	bytes: () => Binary;
	json: () => General;
	headers: Record<string, string>;
	status: number;
};
export type Request = (params: RequestParam | string) => Promise<RequestResponse>;

export type Infras = { localFs: Fs; remoteFs: Fs; record: RecordStore };

const request: Request = async (params: RequestParam | string) => {
	if (typeof params === 'object' && params.body instanceof Uint8Array)
		(params as RequestUrlParam).body = toArrayBuffer(params.body);
	const response = await requestUrl(params as RequestUrlParam);
	return {
		bytes: () => toUint8Array(response.arrayBuffer),
		headers: response.headers,
		json: () => response.json as object,
		status: response.status,
		text: () => response.text,
	};
};

export default class Registrar {
	private settingTab?: SettingTab;
	private readonly cleanupCallbacks: Array<() => void> = [];

	private readonly localFsWrapperRegistry = new Set<FsWrapperEntry>();
	private readonly remoteFsWrapperRegistry = new Set<FsWrapperEntry>();
	private readonly localOptimizerRegistry = new Set<OptimizerEntry>();
	private readonly remoteOptimizerRegistry = new Set<OptimizerEntry>();
	private readonly remoteListerRegistry = new Set<RemoteListerEntry>();
	private readonly settingRegistry = new Set<SettingEntry>();
	private readonly remoteRequestMiddlewareRegistry = new Set<RemoteRequestMiddlewareEntry>();
	private readonly localRequestMiddlewareRegistry = new Set<LocalRequestMiddlewareEntry>();
	private readonly remoteFsRegistry = new Map<string, RemoteFsEntry>();
	private readonly deciderRegistry = new Map<string, DeciderEntry>();
	private readonly conflictResolverRegistry = new Map<string, ConflictResolverEntry>();

	declare readonly settings: { remoteFs: string; decider: string; conflictResolver: string };

	constructor(
		private readonly ctx: {
			app: App;
			on: On<Events>;
			getRecordStore: (namespace?: string) => StoreAsync<RecordStat>;
		},
	) {
		this.cleanupCallbacks.push(
			ctx.on('moduleLoaded', this.rerenderSettingTab),
			ctx.on('moduleUnloaded', this.rerenderSettingTab),
		);
	}

	private readonly getVaultRequest = () =>
		wrapInOrder(createVaultRequest(this.ctx.app), this.localRequestMiddlewareRegistry);

	private readonly createLocalFs = () => {
		const { vault } = this.ctx.app;
		return wrapInOrder(
			new VaultFs(this.getVaultRequest(), vault.getName()),
			this.localFsWrapperRegistry,
		);
	};

	private readonly createRemoteFs = (remoteFs = this.settings.remoteFs) => {
		const entry = this.remoteFsRegistry.get(remoteFs);
		if (!entry) {
			if (!remoteFs) throw new Error('Please set a backend!');
			throw new Error(`Backend "${remoteFs}" is not installed!`);
		}
		return wrapInOrder(entry.instantiate(this.getRequest()), this.remoteFsWrapperRegistry);
	};

	private readonly getRequest = () => wrapInOrder(request, this.remoteRequestMiddlewareRegistry);

	private readonly getCheckConnection = (remoteFs = this.settings.remoteFs) => {
		const entry = this.remoteFsRegistry.get(remoteFs);
		if (!entry) {
			if (!remoteFs) throw new Error('Please install a backend!');
			throw new Error(`Backend "${remoteFs}" is not installed!`);
		}
		return () => entry.checkConnection(this.getRequest());
	};

	private readonly getDecider = () => {
		const decider = this.deciderRegistry.get(this.settings.decider);
		if (!decider) throw new Error(`Decider "${this.settings.decider}" not installed!`);
		return decider.decider;
	};

	private readonly optimizeLocal: BatchOptimizer = (input) =>
		applyFirst(this.localOptimizerRegistry, input);
	private readonly optimizeRemote: BatchOptimizer = (input) =>
		applyFirst(this.remoteOptimizerRegistry, input);
	private readonly listRemote: RemoteLister = (input) =>
		applyFirst(this.remoteListerRegistry, input);

	private readonly getConflictResolver = () => {
		const id = this.settings.conflictResolver;
		const resolver = this.conflictResolverRegistry.get(id);
		if (!resolver) throw new Error(`Conflict resolution strategy "${id}" not installed!`);
		return resolver.resolver;
	};

	private readonly getNamespace = (localFs?: Fs, remoteFs?: Fs) => {
		localFs ??= this.createLocalFs();
		remoteFs ??= this.createRemoteFs();
		return hash(`${localFs.getUid()}~~${remoteFs.getUid()}`);
	};

	private readonly initializeSync = (): Infras => {
		const localFs = this.createLocalFs();
		const remoteFs = this.createRemoteFs();
		const namespace = this.getNamespace(localFs, remoteFs);
		const record = this.ctx.getRecordStore(namespace);
		return { localFs, record, remoteFs };
	};

	private readonly addSettingTab = (plugin: Plugin) => {
		this.settingTab = new SettingTab(plugin, this.settingRegistry);
		plugin.addSettingTab(this.settingTab);
	};
	private readonly rerenderSettingTab = () => this.settingTab?.display();

	root = {
		addSettingTab: this.addSettingTab,
		conflictResolverRegistry: this.conflictResolverRegistry,
		createLocalFs: this.createLocalFs,
		createRemoteFs: this.createRemoteFs,
		deciderRegistry: this.deciderRegistry,
		getCheckConnection: this.getCheckConnection,
		getConflictResolver: this.getConflictResolver,
		getDecider: this.getDecider,
		getNamespace: this.getNamespace,
		getRequest: this.getRequest,
		getVaultRequest: this.getVaultRequest,
		initializeSync: this.initializeSync,
		listRemote: this.listRemote,
		optimizeLocal: this.optimizeLocal,
		optimizeRemote: this.optimizeRemote,
		registerConflictResolver: mapRegister(this.conflictResolverRegistry),
		registerCss: (css: string) => {
			const style = createEl('style', { text: css, type: 'text/css' });
			document.head.append(style);
			return () => style.remove();
		},
		registerDecider: mapRegister(this.deciderRegistry),
		registerLocalFsWrapper: setRegister(this.localFsWrapperRegistry),
		registerLocalOptimizer: setRegister(this.localOptimizerRegistry),
		registerLocalRequestMiddleware: setRegister(this.localRequestMiddlewareRegistry),
		registerRemoteFs: mapRegister(this.remoteFsRegistry),
		registerRemoteFsWrapper: setRegister(this.remoteFsWrapperRegistry),
		registerRemoteLister: setRegister(this.remoteListerRegistry),
		registerRemoteOptimizer: setRegister(this.remoteOptimizerRegistry),
		registerRemoteRequestMiddleware: setRegister(this.remoteRequestMiddlewareRegistry),
		registerSetting: setRegister(this.settingRegistry),
		remoteFsRegistry: this.remoteFsRegistry,
		rerenderSettingTab: this.rerenderSettingTab,
	};

	readonly dispose = () => this.cleanupCallbacks.splice(0).forEach((fn) => fn());
}

class SettingTab extends PluginSettingTab {
	constructor(
		plugin: Plugin,
		private readonly settingRegistry: Set<SettingEntry>,
	) {
		super(plugin.app, plugin);
		this.icon = 'cpu';
	}

	display(): void {
		this.containerEl.empty();
		const sorted: Record<number, (el: HTMLElement) => void> = {};
		for (const { priority, apply } of this.settingRegistry) sorted[priority] = apply;
		for (const render of Object.values(sorted)) render(this.containerEl);
	}
}

function wrapInOrder<T>(initial: T, set: Set<OrderedWrapperEntry<T>>) {
	const middlewares: Record<number, Array<RejectableWrapper<T>>> = {};
	for (const { apply, priority } of set) {
		middlewares[priority] ??= [];
		middlewares[priority].push(apply);
	}
	let result = initial;
	for (const orders of Object.values(middlewares))
		for (const middleware of orders) {
			const wrapped = middleware(result);
			if (wrapped) {
				result = wrapped;
				break;
			}
		}
	return result;
}

function applyFirst<F extends GeneralFn>(set: Set<OrderedApplyEntry<F>>, ...input: Parameters<F>) {
	const middlewares: Record<number, Array<RejectableApply<F>>> = {};
	for (const { apply, priority } of set) {
		middlewares[priority] ??= [];
		middlewares[priority].push(apply);
	}
	for (const orders of Object.values(middlewares))
		for (const apply of orders) {
			const result = apply(...input);
			if (result) return result;
		}
	throw new Error('No qualified apply found!');
}

function setRegister<T>(registry: Set<T>) {
	return (entry: T) => {
		registry.add(entry);
		return () => registry.delete(entry);
	};
}

function mapRegister<T>(registry: Map<string, T>) {
	return (key: string, entry: T) => {
		registry.set(key, entry);
		return () => registry.delete(key);
	};
}
