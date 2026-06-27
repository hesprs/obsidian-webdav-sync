import type { App } from 'obsidian';
import { hash } from '@repo/shared';
import { deleteMemoryDB, openIndexedDB, openMemoryDB } from 'uni-kv';
import type { LocalFs, RemoteFs, RootRemoteFs } from '@/fs';
import type { Decider } from '@/sync';
import type { RecordStat, Stat } from '@/types';
import { STORAGE_NAME } from '@/consts';
import { VaultFs } from '@/fs';
import { SyncRecord } from '@/storage';

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

export type LocalFsWrapperEntry = {
	order: number;
	apply: (fs: LocalFs) => LocalFs;
};
export type RemoteFsWrapperEntry = {
	order: number;
	apply: (fs: RemoteFs) => RemoteFs;
};
export type RemoteFsEntry = { instantiate: () => RootRemoteFs; prettyName: string };
export type DeciderEntry = { decider: Decider; prettyName: string };

export type Infras = Awaited<ReturnType<Storage['initializeSync']>>;

export default class Storage {
	private readonly memoryDB = openMemoryDB<MemoryDBSchema, MemoryDBMeta>(STORAGE_NAME);
	private readonly indexedDB = openIndexedDB<IndexedDBSchema, IndexedDBMeta>(STORAGE_NAME);

	private readonly localFsWrapperRegistry = new Set<LocalFsWrapperEntry>();
	private readonly remoteFsWrapperRegistry = new Set<RemoteFsWrapperEntry>();
	private readonly remoteFsRegistry = new Map<string, RemoteFsEntry>();
	private readonly deciderRegistry = new Map<string, DeciderEntry>();
	declare readonly settings: { remoteFs: string; decider: string };

	constructor(private readonly ctx: { app: App }) {}

	private readonly registerLocalFsWrapper = (entry: LocalFsWrapperEntry) => {
		this.localFsWrapperRegistry.add(entry);
		return () => this.localFsWrapperRegistry.delete(entry);
	};
	private readonly registerRemoteFsWrapper = (entry: RemoteFsWrapperEntry) => {
		this.remoteFsWrapperRegistry.add(entry);
		return () => this.remoteFsWrapperRegistry.delete(entry);
	};
	private readonly registerRemoteFs = (id: string, entry: RemoteFsEntry) => {
		this.remoteFsRegistry.set(id, entry);
		return () => this.remoteFsRegistry.delete(id);
	};
	private readonly registerDecider = (id: string, entry: DeciderEntry) => {
		this.deciderRegistry.set(id, entry);
		return () => this.deciderRegistry.delete(id);
	};

	private readonly createLocalFs = () => {
		const wrappers: Record<number, (fs: LocalFs) => LocalFs> = {};
		for (const { apply, order } of this.localFsWrapperRegistry) wrappers[order] = apply;
		let fs: LocalFs = new VaultFs(this.ctx.app.vault);
		for (const apply of Object.values(wrappers)) fs = apply(fs);
		return fs;
	};

	private readonly createRemoteFs = () => {
		const wrappers: Record<number, (fs: RemoteFs) => RemoteFs> = {};
		for (const { apply, order } of this.remoteFsWrapperRegistry) wrappers[order] = apply;
		const { remoteFs } = this.settings;
		const entry = this.remoteFsRegistry.get(remoteFs);
		if (!entry) {
			if (!remoteFs) throw new Error('Please install a backend!');
			throw new Error(`Backend "${remoteFs}" is not installed!`);
		}
		let fs: RemoteFs = entry.instantiate();
		for (const apply of Object.values(wrappers)) fs = apply(fs);
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

	dispose() {
		deleteMemoryDB(STORAGE_NAME);
	}
}
