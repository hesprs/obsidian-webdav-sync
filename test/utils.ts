import type { Vault, requestUrl } from 'obsidian';
import type { Ref } from 'synthkernel';
import type { RootLocalFs, Stat, RootRemoteFs, Progress } from '~/fs';
import type { MaybePromise } from '~/types';

export type RequestResponse = {
	headers: Record<string, string>;
	status: number;
	text: string;
};

function createEmptyReadableStream() {
	return new ReadableStream<ArrayBuffer>({
		start(controller) {
			controller.close();
		},
	});
}

export class ShimmedRemoteFs implements RootRemoteFs {
	public calls = {
		checkConnection: 0,
		delete: [] as Array<string>,
		exists: [] as Array<string>,
		list: [] as Array<string>,
		listAll: [] as Array<string>,
		mkdir: [] as Array<string>,
		move: [] as Array<[string, string]>,
		read: [] as Array<string>,
		readStream: [] as Array<[string, number | undefined]>,
		stat: [] as Array<string>,
		write: [] as Array<[string, number]>,
	};

	public writePayloads: Array<[string, ArrayBuffer]> = [];

	public checkConnectionResponse: MaybePromise<
		{ success: true } | { success: false; reason: string }
	> = {
		success: true,
	};

	public readResponse: (key: string) => MaybePromise<ArrayBuffer> = async () =>
		new ArrayBuffer(0);

	public readStreamResponse: (
		key: string,
		totalSize?: number,
	) => MaybePromise<ReadableStream<ArrayBuffer>> = async () => createEmptyReadableStream();

	public writeResponse: (key: string, value: ArrayBuffer) => MaybePromise<string> = async () =>
		'written';

	public deleteResponse: (key: string) => MaybePromise<void> = async () => undefined;

	public mkdirResponse: (key: string, recursive?: boolean) => MaybePromise<void> = async () =>
		undefined;

	public moveResponse: (oldKey: string, newKey: string) => MaybePromise<void> = async () =>
		undefined;

	public statResponse: (key: string) => MaybePromise<Stat> = (key) =>
		key.endsWith('/')
			? ({ isDir: true, key } as Stat)
			: ({ isDir: false, key, mtime: 10, size: 5, uid: 'uid' } as Stat);

	public existsResponse: (key: string) => MaybePromise<boolean> = async () => false;

	public listResponse: (key: string) => MaybePromise<Array<Stat>> = async (key) => [
		{ isDir: true, key: `${key}folder/` } as Stat,
		{ isDir: false, key: `${key}note.md`, mtime: 11, size: 6, uid: 'note' } as Stat,
	];

	public listAllResponse: (key: string, progress?: Ref<Progress>) => MaybePromise<Array<Stat>> =
		async (key) => [
			{ isDir: true, key } as Stat,
			{ isDir: true, key: `${key}folder/` } as Stat,
			{
				isDir: false,
				key: `${key}folder/note.md`,
				mtime: 12,
				size: 7,
				uid: 'note-2',
			} as Stat,
		];

	constructor(request: (input: string) => Promise<RequestResponse>) {
		this.request = request as typeof requestUrl;
	}
	public request: typeof requestUrl;

	getUid() {
		return 'remote';
	}

	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }> {
		this.calls.checkConnection += 1;
		return this.checkConnectionResponse;
	}

	async read(key: string) {
		this.calls.read.push(key);
		await this.request(key as never);
		return await this.readResponse(key);
	}

	async readStream(key: string, totalSize?: number) {
		this.calls.readStream.push([key, totalSize]);
		return await this.readStreamResponse(key, totalSize);
	}

	async write(key: string, value: ArrayBuffer) {
		this.calls.write.push([key, value.byteLength]);
		this.writePayloads.push([key, value]);
		return await this.writeResponse(key, value);
	}

	async delete(key: string) {
		this.calls.delete.push(key);
		return await this.deleteResponse(key);
	}

	async mkdir(key: string, recursive?: boolean) {
		this.calls.mkdir.push(key);
		return await this.mkdirResponse(key, recursive);
	}

	async move(oldKey: string, newKey: string) {
		this.calls.move.push([oldKey, newKey]);
		return await this.moveResponse(oldKey, newKey);
	}

	async stat(key: string) {
		this.calls.stat.push(key);
		return await this.statResponse(key);
	}

	exists(key: string): MaybePromise<boolean> {
		this.calls.exists.push(key);
		return this.existsResponse(key);
	}

	async list(key: string) {
		this.calls.list.push(key);
		return await this.listResponse(key);
	}

	async listAll(key: string, progress?: Ref<Progress>) {
		this.calls.listAll.push(key);
		return await this.listAllResponse(key, progress);
	}
}

export function createVaultFs() {
	const calls = {
		delete: [] as Array<string>,
		listAll: [] as Array<string>,
		mkdir: [] as Array<string>,
		move: [] as Array<[string, string]>,
		read: [] as Array<[string, number | undefined]>,
		stat: [] as Array<string>,
		write: [] as Array<[string, number]>,
		writeStream: [] as Array<string>,
	};

	const control = {
		deleteResponse: async (_key: string): Promise<void> => undefined,
		listAllResponse: async (_key: string): Promise<Array<Stat>> => [],
		mkdirResponse: async (_key: string): Promise<void> => undefined,
		moveResponse: async (_oldKey: string, _newKey: string): Promise<void> => undefined,
		readResponse: async (_key: string, _size?: number): Promise<ArrayBuffer> =>
			new ArrayBuffer(0),
		statResponse: async (key: string): Promise<Stat> =>
			key.endsWith('/')
				? ({ isDir: true, key } as Stat)
				: ({ isDir: false, key, mtime: 1, size: 1, uid: 'uid' } as Stat),
		writeResponse: async (_key: string, _value: ArrayBuffer): Promise<string> => 'write-uid',
		writeStreamResponse: async (
			_key: string,
			_value: ReadableStream<ArrayBuffer>,
		): Promise<string> => 'stream-uid',
	};

	const original: RootLocalFs = {
		delete: async (key: string) => {
			calls.delete.push(key);
			return await control.deleteResponse(key);
		},
		getUid: () => 'vault',
		listAll: async (key: string) => {
			calls.listAll.push(key);
			return await control.listAllResponse(key);
		},
		mkdir: async (key: string) => {
			calls.mkdir.push(key);
			return await control.mkdirResponse(key);
		},
		move: async (oldKey: string, newKey: string) => {
			calls.move.push([oldKey, newKey]);
			return await control.moveResponse(oldKey, newKey);
		},
		read: async (key: string, size?: number) => {
			calls.read.push([key, size]);
			return await control.readResponse(key, size);
		},
		stat: async (key: string) => {
			calls.stat.push(key);
			return await control.statResponse(key);
		},
		vault: { getName: () => 'Vault' } as Vault,
		write: async (key: string, value: ArrayBuffer) => {
			calls.write.push([key, value.byteLength]);
			return await control.writeResponse(key, value);
		},
		writeStream: async (key: string, value: ReadableStream<ArrayBuffer>) => {
			calls.writeStream.push(key);
			return await control.writeStreamResponse(key, value);
		},
	};

	return { calls, control, original };
}

export function createVaultStub() {
	const calls = {
		delete: [] as Array<string>,
		listAll: [] as Array<string>,
		mkdir: [] as Array<string>,
		move: [] as Array<[string, string]>,
		read: [] as Array<[string, number | undefined]>,
		stat: [] as Array<string>,
		write: [] as Array<[string, number]>,
		writeStream: [] as Array<string>,
	};

	const control = {
		deleteResponse: async (_key: string): Promise<void> => undefined,
		listAllResponse: async (_key: string): Promise<Array<Stat>> => [],
		mkdirResponse: async (_key: string): Promise<void> => undefined,
		moveResponse: async (_oldKey: string, _newKey: string): Promise<void> => undefined,
		readResponse: async (_key: string, _size?: number): Promise<ArrayBuffer> =>
			new ArrayBuffer(0),
		statResponse: async (key: string): Promise<Stat> =>
			key.endsWith('/')
				? ({ isDir: true, key } as Stat)
				: ({ isDir: false, key, mtime: 1, size: 1, uid: key } as Stat),
		writeResponse: async (_key: string, _value: ArrayBuffer): Promise<string> => 'write-uid',
		writeStreamResponse: async (
			_key: string,
			_value: ReadableStream<ArrayBuffer>,
		): Promise<string> => 'stream-uid',
	};

	const original: RootLocalFs = {
		delete: async (key: string) => {
			calls.delete.push(key);
			return await control.deleteResponse(key);
		},
		getUid: () => 'vault',
		listAll: async (key: string) => {
			calls.listAll.push(key);
			return await control.listAllResponse(key);
		},
		mkdir: async (key: string) => {
			calls.mkdir.push(key);
			return await control.mkdirResponse(key);
		},
		move: async (oldKey: string, newKey: string) => {
			calls.move.push([oldKey, newKey]);
			return await control.moveResponse(oldKey, newKey);
		},
		read: async (key: string, size?: number) => {
			calls.read.push([key, size]);
			return await control.readResponse(key, size);
		},
		stat: async (key: string) => {
			calls.stat.push(key);
			return await control.statResponse(key);
		},
		vault: { getName: () => 'Vault' } as Vault,
		write: async (key: string, value: ArrayBuffer) => {
			calls.write.push([key, value.byteLength]);
			return await control.writeResponse(key, value);
		},
		writeStream: async (key: string, value: ReadableStream<ArrayBuffer>) => {
			calls.writeStream.push(key);
			return await control.writeStreamResponse(key, value);
		},
	};

	return { calls, control, original };
}

export function toBuffer(value: string) {
	return new TextEncoder().encode(value).buffer;
}

export function createDeferred<T>() {
	let resolve!: (value: T | PromiseLike<T>) => void;
	let reject!: (reason?: unknown) => void;
	const promise = new Promise<T>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return { promise, reject, resolve };
}

export async function flushMicrotasks(turns = 4) {
	for (let index = 0; index < turns; index += 1)
		await new Promise<void>((resolve) => queueMicrotask(resolve));
}
