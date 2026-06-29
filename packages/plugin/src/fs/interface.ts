// oxlint-disable typescript/method-signature-style
import { requestUrl, Vault } from 'obsidian';
import type { MaybePromise, Progress, Stat } from '@/types';

/**
 * All keys use unified format:
 * - root: `/`
 * - file: `note.md`, `folder/note.md`
 * - folder: `folder/`, `folder/nested/`
 */

export type RootLocalFs = {
	vault: Vault;
	getUid(): string; // String whose inequality signifies the client is unique
	read(key: string, size?: number): MaybePromise<ArrayBuffer>;
	write(key: string, value: ArrayBuffer): MaybePromise<string>; // Returns uid
	writeStream(key: string, value: ReadableStream<ArrayBuffer>): MaybePromise<string>; // Returns uid, should only resolve when the stream si fully consumed
	delete(key: string): MaybePromise<void>;
	move(oldKey: string, newKey: string): MaybePromise<void>;
	mkdir(key: string): MaybePromise<void>;
	stat(key: string): MaybePromise<Stat>;
	list(key: string): MaybePromise<Array<Stat>>; // List recursive children under one folder
};

export type RootRemoteFs = {
	request: typeof requestUrl;
	getUid(): string; // String whose inequality signifies the client is unique, must start with the file system type, use `~` as delimiter
	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }>;
	read(key: string, size?: number): MaybePromise<ArrayBuffer>;
	readStream(key: string, size?: number): MaybePromise<ReadableStream<ArrayBuffer>>;
	write(key: string, value: ArrayBuffer): MaybePromise<string>; // Returns uid
	delete(key: string): MaybePromise<void>;
	move(oldKey: string, newKey: string): MaybePromise<void>;
	mkdir(key: string, recursive?: boolean): MaybePromise<void>;
	stat(key: string): MaybePromise<Stat>;
	exists(key: string): MaybePromise<boolean>;
	list(key: string, progress?: (progress: Progress) => void): MaybePromise<Array<Stat>>; // List recursive children under one folder
};

export type RootLocalFsCtor<O = undefined> = new (options: O) => RootLocalFs;
export type RootRemoteFsCtor<O = undefined> = new (
	options: O,
	request?: typeof requestUrl,
) => RootRemoteFs;

export type WrappedLocalFs = { original: LocalFs } & Omit<RootLocalFs, 'vault'>;
export type WrappedRemoteFs = { original: RemoteFs } & Omit<RootRemoteFs, 'request'>;

export type RemoteFs = WrappedRemoteFs | RootRemoteFs;
export type LocalFs = WrappedLocalFs | RootLocalFs;

export type RemoteFsWrapper<O = undefined> = (original: RemoteFs, option: O) => RemoteFs;
export type LocalFsWrapper<O = undefined> = (original: LocalFs, option: O) => LocalFs;

export type WriteAtom = { type: 'write'; key: string; execute: () => MaybePromise<string> };
export type DeleteAtom = { type: 'delete'; key: string; execute: () => MaybePromise<void> };
export type MoveAtom = {
	type: 'move';
	oldKey: string;
	newKey: string;
	execute: () => MaybePromise<void>;
};
export type MkdirAtom = { type: 'mkdir'; key: string; execute: () => MaybePromise<void> };
export type InputAtom = WriteAtom | DeleteAtom | MoveAtom | MkdirAtom;
export type CustomAtom = {
	type: 'custom';
	execute: () => MaybePromise<void>;
};
export type OutputAtom = InputAtom | CustomAtom;

export type OptimizerInput<Fs extends RemoteFs | LocalFs> = {
	atoms: Array<InputAtom>;
	fs: Fs;
	executeAtom: <A extends OutputAtom>(atom: A) => ReturnType<A['execute']>;
};

// Batch optimizer works by wrapping each atom's `execute()` to await for the resolve of other dependency atoms' `execute()`. It may also add / delete atoms.
export type BatchOptimizer<Fs extends RemoteFs | LocalFs> = (
	input: OptimizerInput<Fs>,
) => Array<OutputAtom>;
