import type { Ref } from 'synthkernel';
import { requestUrl } from 'obsidian';
import type { MaybePromise } from '~/types';

// oxlint-disable typescript/method-signature-style
// oxlint-disable typescript/consistent-type-definitions

export interface VaultFsInterface {
	/**
	 * All keys use unified format:
	 * - root: `/`
	 * - file: `note.md`, `folder/note.md`
	 * - folder: `folder/`, `folder/nested/`
	 */
	getUid(): string; // String whose inequality signifies the client is unique
	read(key: string): MaybePromise<ArrayBuffer>;
	write(key: string, value: ArrayBuffer): MaybePromise<string>; // Returns uid
	writeStream(key: string, value: ReadableStream): MaybePromise<string>; // Returns uid
	delete(key: string): MaybePromise<void>;
	move(oldKey: string, newKey: string): MaybePromise<void>;
	mkdir(key: string): MaybePromise<void>;
	stat(key: string): MaybePromise<Stat>;
	listAll(key: string): MaybePromise<Array<Stat>>; // List recursive children under one folder
}

export abstract class RemoteFs<T extends object = object> {
	constructor(
		public options: T,
		public request: typeof requestUrl = requestUrl,
	) {}
	abstract getUid(): string; // String whose inequality signifies the client is unique, must start with `<fs-type>`, use `~` as delimiter
	abstract checkConnection(): MaybePromise<
		{ success: true } | { success: false; reason: string }
	>;
	abstract read(key: string): MaybePromise<ArrayBuffer>;
	abstract readStream(key: string, totalSize?: number): MaybePromise<ReadableStream>;
	abstract write(key: string, value: ArrayBuffer): MaybePromise<string>; // Returns uid
	abstract delete(key: string): MaybePromise<void>;
	abstract mkdir(key: string, recursive?: boolean): MaybePromise<void>;
	abstract stat(key: string): MaybePromise<Stat>;
	abstract exists(key: string): MaybePromise<boolean>;
	abstract list(key: string): MaybePromise<Array<Stat>>; // List direct children under one folder
	abstract listAll(key: string, progress?: Ref<Progress>): MaybePromise<Array<Stat>>; // List recursive children under one folder
}

export type RemoteFsShim = (original: RemoteFs, ...args: Array<unknown>) => RemoteFs;

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
export type Progress = {
	total: number;
	completed: number;
};
