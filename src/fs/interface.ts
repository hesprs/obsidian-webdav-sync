import { requestUrl, Vault } from 'obsidian';
import type { MaybePromise } from '~/types';

// oxlint-disable typescript/method-signature-style

/**
 * All keys use unified format:
 * - root: `/`
 * - file: `note.md`, `folder/note.md`
 * - folder: `folder/`, `folder/nested/`
 */

export type RootVaultFs = {
	vault: Vault;
	getUid(): string; // String whose inequality signifies the client is unique
	read(key: string, size?: number): MaybePromise<ArrayBuffer>;
	write(key: string, value: ArrayBuffer): MaybePromise<string>; // Returns uid
	writeStream(key: string, value: ReadableStream<ArrayBuffer>): MaybePromise<string>; // Returns uid
	delete(key: string): MaybePromise<void>;
	move(oldKey: string, newKey: string): MaybePromise<void>;
	mkdir(key: string): MaybePromise<void>;
	stat(key: string): MaybePromise<Stat>;
	listAll(key: string): MaybePromise<Array<Stat>>; // List recursive children under one folder
};

export type RootRemoteFs = {
	request: typeof requestUrl;
	getUid(): string; // String whose inequality signifies the client is unique, must start with the file system type, use `~` as delimiter
	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }>;
	read(key: string, size?: number): MaybePromise<ArrayBuffer>;
	readStream(key: string, size?: number): MaybePromise<ReadableStream<ArrayBuffer>>;
	write(key: string, value: ArrayBuffer): MaybePromise<string>; // Returns uid
	delete(key: string): MaybePromise<void>;
	mkdir(key: string, recursive?: boolean): MaybePromise<void>;
	stat(key: string): MaybePromise<Stat>;
	exists(key: string): MaybePromise<boolean>;
	list(key: string): MaybePromise<Array<Stat>>; // List direct children under one folder
	listAll(key: string, progress?: (progress: Progress) => void): MaybePromise<Array<Stat>>; // List recursive children under one folder
};

export type RemoteFsCtor<O> = new (options: O, request?: typeof requestUrl) => RootRemoteFs;

export type WrappedVaultFs = { original: VaultFs } & Omit<RootVaultFs, 'vault'>;
export type WrappedRemoteFs = { original: RemoteFs } & Omit<RootRemoteFs, 'request'>;

export type RemoteFs = WrappedRemoteFs | RootRemoteFs;
export type VaultFs = WrappedVaultFs | RootVaultFs;

export type RemoteFsWrapper<O> = (original: RemoteFs, option: O) => RemoteFs;

export type FileStat = {
	isDir: false;
	key: string;
	mtime: number;
	size: number;
	// Etag or other kinds of string whose equality signifies the file is unchanged
	uid: string;
};
export type FolderStat = {
	isDir: true;
	key: string;
};
export type Stat = FileStat | FolderStat;
export type Progress<T = string> = {
	total: number;
	completed: number;
	current?: T;
};
