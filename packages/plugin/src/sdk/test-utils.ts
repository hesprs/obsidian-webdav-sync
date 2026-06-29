import type { Vault, requestUrl } from 'obsidian';
import type { RootLocalFs, RootRemoteFs } from '@/fs/interface';
import type { MaybePromise, Progress, Stat } from '@/types';

type ConnectionResult = { success: true } | { success: false; reason: string };

type RequestResponse = {
	headers: Record<string, string>;
	status: number;
	text: string;
};

type FsCalls = {
	checkConnection: number;
	delete: Array<string>;
	exists: Array<string>;
	list: Array<string>;
	mkdir: Array<string>;
	move: Array<[string, string]>;
	read: Array<[string, number | undefined]>;
	readStream: Array<[string, number | undefined]>;
	stat: Array<string>;
	write: Array<[string, number]>;
	writeStream: Array<string>;
};

type FsControl = {
	checkConnection: () => MaybePromise<ConnectionResult>;
	delete: (key: string) => MaybePromise<void>;
	exists: (key: string) => MaybePromise<boolean>;
	list: (key: string, progress?: unknown) => MaybePromise<Array<Stat>>;
	mkdir: (key: string, recursive?: boolean) => MaybePromise<void>;
	move: (oldKey: string, newKey: string) => MaybePromise<void>;
	read: (key: string, size?: number) => MaybePromise<ArrayBuffer>;
	readStream: (key: string, size?: number) => MaybePromise<ReadableStream<ArrayBuffer>>;
	request: (input: string) => MaybePromise<RequestResponse>;
	stat: (key: string) => MaybePromise<Stat>;
	write: (key: string, value: ArrayBuffer) => MaybePromise<string>;
	writeStream: (key: string, value: ReadableStream<ArrayBuffer>) => MaybePromise<string>;
};

export type HarnessState = {
	requestCalls: Array<string>;
	vault?: Vault;
	writePayloads: Array<[string, ArrayBuffer]>;
};

type StubFsHarness<TFs extends RootLocalFs | RootRemoteFs> = {
	calls: FsCalls;
	control: FsControl;
	fs: TFs;
	state: HarnessState;
};

type LocalHarnessOptions = {
	control?: Partial<FsControl>;
	uid?: string;
	vaultName?: string;
};

type RemoteHarnessOptions = {
	control?: Partial<FsControl>;
	uid?: string;
};

const textEncoder = new TextEncoder();

function bytes(value: string) {
	return textEncoder.encode(value).buffer;
}

function file(key: string, options: { mtime?: number; size?: number; uid?: string } = {}): Stat {
	const { mtime = 1, size = 5, uid = `${key}-uid` } = options;
	return { isDir: false, key, mtime, size, uid };
}

function folder(key: string): Stat {
	return { isDir: true, key };
}

function defaultStat(key: string) {
	return key === '/' || key.endsWith('/')
		? folder(key)
		: file(key, { mtime: 10, size: 5, uid: 'uid' });
}

function toArrayBuffer(chunk: ArrayBuffer | Uint8Array | string) {
	if (typeof chunk === 'string') return bytes(chunk);
	if (chunk instanceof Uint8Array)
		return chunk.buffer.slice(
			chunk.byteOffset,
			chunk.byteOffset + chunk.byteLength,
		) as ArrayBuffer;
	return chunk;
}

function stream(chunks: Array<ArrayBuffer | Uint8Array | string> = []) {
	return new ReadableStream<ArrayBuffer>({
		start(controller) {
			for (const chunk of chunks) controller.enqueue(toArrayBuffer(chunk));
			controller.close();
		},
	});
}

function deferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return { promise, reject, resolve };
}

async function collectStream(source: ReadableStream<ArrayBuffer>) {
	const reader = source.getReader();
	const chunks: Array<Uint8Array> = [];
	let total = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		const chunk = new Uint8Array(value);
		chunks.push(chunk);
		total += chunk.byteLength;
	}
	const result = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		result.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return result.buffer;
}

export async function flush(turns = 4) {
	for (let index = 0; index < turns; index += 1)
		await new Promise<void>((resolve) => queueMicrotask(resolve));
}

function createCalls(): FsCalls {
	return {
		checkConnection: 0,
		delete: [],
		exists: [],
		list: [],
		mkdir: [],
		move: [],
		read: [],
		readStream: [],
		stat: [],
		write: [],
		writeStream: [],
	};
}

function createControl(overrides: Partial<FsControl> = {}): FsControl {
	return {
		checkConnection: async () => ({ success: true }),
		delete: async () => undefined,
		exists: async () => false,
		list: async (key: string) => [
			defaultStat(key),
			folder(`${key}folder/`),
			file(`${key}folder/note.md`, { mtime: 12, size: 7, uid: 'note-2' }),
		],
		mkdir: async () => undefined,
		move: async () => undefined,
		read: async () => new ArrayBuffer(0),
		readStream: async () => stream(),
		request: async () => ({ headers: {}, status: 200, text: '' }),
		stat: async (key: string) => defaultStat(key),
		write: async () => 'write-uid',
		writeStream: async () => 'stream-uid',
		...overrides,
	};
}

function remoteFs(options: RemoteHarnessOptions = {}): StubFsHarness<RootRemoteFs> {
	const calls = createCalls();
	const control = createControl(options.control);
	const state: HarnessState = { requestCalls: [], writePayloads: [] };

	const fs: RootRemoteFs = {
		checkConnection: async () => {
			calls.checkConnection += 1;
			return await control.checkConnection();
		},
		delete: async (key: string) => {
			calls.delete.push(key);
			return await control.delete(key);
		},
		exists: async (key: string) => {
			calls.exists.push(key);
			return await control.exists(key);
		},
		getUid: () => options.uid ?? 'remote',
		list: async (key: string, progress?: (prog: Progress) => void) => {
			calls.list.push(key);
			return await control.list(key, progress);
		},
		mkdir: async (key: string, recursive?: boolean) => {
			calls.mkdir.push(key);
			return await control.mkdir(key, recursive);
		},
		move: async (oldKey: string, newKey: string) => {
			calls.move.push([oldKey, newKey]);
			return await control.move(oldKey, newKey);
		},
		read: async (key: string, size?: number) => {
			calls.read.push([key, size]);
			await fs.request(key as never);
			return await control.read(key, size);
		},
		readStream: async (key: string, size?: number) => {
			calls.readStream.push([key, size]);
			return await control.readStream(key, size);
		},
		request: (async (input: string) => {
			state.requestCalls.push(input);
			return await control.request(input);
		}) as typeof requestUrl,
		stat: async (key: string) => {
			calls.stat.push(key);
			return await control.stat(key);
		},
		write: async (key: string, value: ArrayBuffer) => {
			calls.write.push([key, value.byteLength]);
			state.writePayloads.push([key, value]);
			return await control.write(key, value);
		},
	};

	return { calls, control, fs, state };
}

function localFs(options: LocalHarnessOptions = {}): StubFsHarness<RootLocalFs> {
	const calls = createCalls();
	const control = createControl(options.control);
	const vault = { getName: () => options.vaultName ?? 'Vault' } as Vault;
	const state: HarnessState = { requestCalls: [], vault, writePayloads: [] };

	const fs: RootLocalFs = {
		delete: async (key: string) => {
			calls.delete.push(key);
			return await control.delete(key);
		},
		getUid: () => options.uid ?? 'vault',
		list: async (key: string) => {
			calls.list.push(key);
			return await control.list(key);
		},
		mkdir: async (key: string) => {
			calls.mkdir.push(key);
			return await control.mkdir(key);
		},
		move: async (oldKey: string, newKey: string) => {
			calls.move.push([oldKey, newKey]);
			return await control.move(oldKey, newKey);
		},
		read: async (key: string, size?: number) => {
			calls.read.push([key, size]);
			return await control.read(key, size);
		},
		stat: async (key: string) => {
			calls.stat.push(key);
			return await control.stat(key);
		},
		vault,
		write: async (key: string, value: ArrayBuffer) => {
			calls.write.push([key, value.byteLength]);
			state.writePayloads.push([key, value]);
			return await control.write(key, value);
		},
		writeStream: async (key: string, value: ReadableStream<ArrayBuffer>) => {
			calls.writeStream.push(key);
			return await control.writeStream(key, value);
		},
	};

	return { calls, control, fs, state };
}

const testKit = { bytes, collectStream, deferred, file, flush, folder, localFs, remoteFs, stream };
export default testKit;
