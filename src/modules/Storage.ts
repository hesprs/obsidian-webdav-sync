import type { App } from 'obsidian';
import { deleteMemoryDB, openIndexedDB, openMemoryDB } from 'uni-kv';
import type {
	LocalFs,
	LocalFsWrapper,
	RemoteFs,
	RemoteFsWrapper,
	RootRemoteFsCtor,
	Stat,
} from '~/fs';
import type { Decider } from '~/sync';
import type { General, RecordStat } from '~/types';
import { STORAGE_NAME } from '~/consts';
import { VaultFs } from '~/fs';
import { SyncRecord } from '~/storage';
import { hash } from '~/utils/crypto';

export type MemoryDBMeta = {
	lastLocalContextUid: string;
	lastRemoteContextUid: string;
};

export type MemoryDBSchema = {
	localStatContext: Stat;
	remoteStatContext: Stat;
};

export type IndexedDBSchema = {
	'base-text': string;
	'sync-state': RecordStat;
};

export type IndexedDBMeta = {
	version: number;
};

type LocalFsWrapperEntry<O> = {
	order: number;
	wrapper: LocalFsWrapper<O>;
	options: O;
};
type RemoteFsWrapperEntry<O> = {
	order: number;
	wrapper: RemoteFsWrapper<O>;
	options: O;
};
type RemoteFsEntry<O> = { fs: RootRemoteFsCtor<O>; prettyName: string; options: O };
type DeciderEntry = { decider: Decider; prettyName: string };

export type Infras = Awaited<ReturnType<Storage['initializeSync']>>;

// Private readonly memoryConsumption = 0;
// 	Private readonly hangingOperations: Array<{
// 		Size: number;
// 		Resume: () => void;
// 	}> = [];

export default class Storage {
	private readonly memoryDB = openMemoryDB<MemoryDBSchema, MemoryDBMeta>(STORAGE_NAME);
	private readonly indexedDB = openIndexedDB<IndexedDBSchema, IndexedDBMeta>(STORAGE_NAME);

	private readonly localFsWrapperRegistry = new Set<LocalFsWrapperEntry<General>>();
	private readonly remoteFsWrapperRegistry = new Set<RemoteFsWrapperEntry<General>>();
	private readonly remoteFsRegistry = new Map<string, RemoteFsEntry<General>>();
	private readonly deciderRegistry = new Map<string, DeciderEntry>();
	declare readonly settings: { remoteFs: string; decider: string };

	private readonly registerLocalFsWrapper = <O>(entry: LocalFsWrapperEntry<O>) => {
		this.localFsWrapperRegistry.add(entry);
		return () => this.localFsWrapperRegistry.delete(entry);
	};
	private readonly registerRemoteFsWrapper = <O>(entry: RemoteFsWrapperEntry<O>) => {
		this.remoteFsWrapperRegistry.add(entry);
		return () => this.remoteFsWrapperRegistry.delete(entry);
	};
	private readonly registerRemoteFs = <O>(id: string, entry: RemoteFsEntry<O>) => {
		this.remoteFsRegistry.set(id, entry);
		return () => this.remoteFsRegistry.delete(id);
	};
	private readonly registerDecider = (id: string, entry: DeciderEntry) => {
		this.deciderRegistry.set(id, entry);
		return () => this.deciderRegistry.delete(id);
	};

	private readonly createLocalFs = () => {
		const wrappers: Record<number, { wrapper: LocalFsWrapper<General>; options: unknown }> = {};
		for (const { options, order, wrapper } of this.localFsWrapperRegistry)
			wrappers[order] = { options, wrapper };
		let fs: LocalFs = new VaultFs(this.ctx.app.vault);
		for (const { options, wrapper } of Object.values(wrappers)) fs = wrapper(fs, options);
		return fs;
	};

	private readonly createRemoteFs = () => {
		const wrappers: Record<number, { wrapper: RemoteFsWrapper<General>; options: unknown }> =
			{};
		for (const { options, order, wrapper } of this.remoteFsWrapperRegistry)
			wrappers[order] = { options, wrapper };
		const entry = this.remoteFsRegistry.get(this.settings.remoteFs);
		if (!entry) throw new Error(`Backend "${this.settings.remoteFs}" not installed!`);
		let fs: RemoteFs = new entry.fs(entry.options);
		for (const { options, wrapper } of Object.values(wrappers)) fs = wrapper(fs, options);
		return fs;
	};

	private readonly getDecider = () => {
		const decider = this.deciderRegistry.get(this.settings.decider);
		if (!decider) throw new Error(`Decider "${this.settings.decider}" not installed!`);
		return decider.decider;
	};

	private readonly initializeSync = async () => {
		const localFs = this.createLocalFs();
		const remoteFs = this.createRemoteFs();
		const stateKey = hash(`${localFs.getUid()}~~${remoteFs.getUid()}`);
		const record = new SyncRecord(stateKey, await this.indexedDB);
		return { localFs, record, remoteFs };
	};

	root = {
		createLocalFs: this.createLocalFs,
		createRemoteFs: this.createRemoteFs,
		getDecider: this.getDecider,
		indexedDB: this.indexedDB,
		initializeSync: this.initializeSync,
		memoryDB: this.memoryDB,
		registerDecider: this.registerDecider,
		registerLocalFsWrapper: this.registerLocalFsWrapper,
		registerRemoteFs: this.registerRemoteFs,
		registerRemoteFsWrapper: this.registerRemoteFsWrapper,
	};

	constructor(private readonly ctx: { app: App }) {}

	dispose() {
		deleteMemoryDB(STORAGE_NAME);
	}
}
