import type { Ref } from 'synthkernel';
import type { Progress, Stat } from '~/fs/interface';
import type { MaybePromise } from '~/types';
import { RemoteFs } from '~/fs/interface';

export type RequestResponse = {
	headers: Record<string, string>;
	status: number;
	text: string;
};

function createEmptyReadableStream() {
	return new ReadableStream<Uint8Array>({
		start(controller) {
			controller.close();
		},
	});
}

export class ShimmedRemoteFs extends RemoteFs<Record<string, never>> {
	public readonly requestImpl: (input: string) => Promise<RequestResponse>;

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
	) => MaybePromise<ReadableStream<Uint8Array>> = async () => createEmptyReadableStream();

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

	constructor(requestImpl: (input: string) => Promise<RequestResponse>) {
		const request = (input: string) => requestImpl(input);
		super({}, request as never);
		this.requestImpl = requestImpl;
	}

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
