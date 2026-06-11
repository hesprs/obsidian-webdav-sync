import { expect, mock, test } from 'bun:test';
import type { Stat } from '~/fs-new';
import { RemoteFs, baseDirShim, retryShim } from '~/fs-new';

const sleepMock = mock(() => Promise.resolve());
void mock.module('~/utils/sleep', () => ({
	default: sleepMock,
}));

type RequestResponse = {
	headers: Record<string, string>;
	status: number;
	text: string;
};

class ShimmedRemoteFs extends RemoteFs<Record<string, never>> {
	public calls = {
		checkConnection: 0,
		delete: [] as Array<string>,
		list: [] as Array<string>,
		listAll: [] as Array<string>,
		mkdir: [] as Array<string>,
		move: [] as Array<[string, string]>,
		read: [] as Array<string>,
		readStream: [] as Array<string>,
		stat: [] as Array<string>,
		write: [] as Array<[string, number]>,
	};

	public readonly requestImpl: (input: string) => Promise<RequestResponse>;

	constructor(requestImpl: (input: string) => Promise<RequestResponse>) {
		const request = (input: string) => requestImpl(input);
		super({}, request as never);
		this.requestImpl = requestImpl;
	}

	getUid() {
		return 'remote';
	}

	checkConnection(): Promise<{ success: true } | { success: false; reason: string }> {
		this.calls.checkConnection++;
		return Promise.resolve({ success: true });
	}

	read(key: string) {
		this.calls.read.push(key);
		return Promise.resolve(this.request(key)).then(() => new ArrayBuffer(0));
	}

	readStream(key: string) {
		this.calls.readStream.push(key);
		return Promise.resolve(
			new ReadableStream<Uint8Array>({
				start(controller) {
					controller.close();
				},
			}),
		);
	}

	write(key: string, value: ArrayBuffer) {
		this.calls.write.push([key, value.byteLength]);
		return Promise.resolve('written');
	}

	delete(key: string) {
		this.calls.delete.push(key);
		return Promise.resolve();
	}

	mkdir(key: string) {
		this.calls.mkdir.push(key);
		return Promise.resolve();
	}

	move(oldKey: string, newKey: string) {
		this.calls.move.push([oldKey, newKey]);
		return Promise.resolve();
	}

	stat(key: string) {
		this.calls.stat.push(key);
		if (key.endsWith('/')) return Promise.resolve({ isDir: true, key } as Stat);
		return Promise.resolve({ isDir: false, key, mtime: 10, size: 5, uid: 'uid' } as Stat);
	}

	list(key: string) {
		this.calls.list.push(key);
		return Promise.resolve([
			{ isDir: true, key: `${key}folder/` } as Stat,
			{ isDir: false, key: `${key}note.md`, mtime: 11, size: 6, uid: 'note' } as Stat,
		]);
	}

	listAll(key: string) {
		this.calls.listAll.push(key);
		return Promise.resolve([
			{ isDir: true, key } as Stat,
			{ isDir: true, key: `${key}folder/` } as Stat,
			{
				isDir: false,
				key: `${key}folder/note.md`,
				mtime: 12,
				size: 7,
				uid: 'note-2',
			} as Stat,
		]);
	}
}

test('base-dir shim rewrites keys relative to its base', async () => {
	const original = new ShimmedRemoteFs(async () => ({ headers: {}, status: 200, text: '' }));
	const shim = baseDirShim(original, '/base');

	expect(shim.getUid()).toBe('remote~base/');

	const rootStat = await shim.stat('/');
	const stat = await shim.stat('note.md');
	const listAll = await shim.listAll('/');

	expect(original.calls.stat).toStrictEqual(['base/', 'base/note.md']);
	expect(rootStat).toStrictEqual({ isDir: true, key: '/' });
	expect(stat).toStrictEqual({ isDir: false, key: 'note.md', mtime: 10, size: 5, uid: 'uid' });
	expect(original.calls.listAll).toStrictEqual(['base/']);
	expect(listAll).toStrictEqual([
		{ isDir: true, key: 'folder/' },
		{ isDir: false, key: 'folder/note.md', mtime: 12, size: 7, uid: 'note-2' },
	]);
});

test('retry shim retries matching request statuses and waits between attempts', async () => {
	sleepMock.mockReset();
	const attempts: Array<string> = [];
	const original = new ShimmedRemoteFs(async (input) => {
		attempts.push(input);
		if (attempts.length < 3) throw { res: { status: 503 } };

		return { headers: {}, status: 200, text: '' };
	});

	retryShim(original, {
		maxRetry: 2,
		retryDelayMs: 25,
		retryableStatusCodes: [503],
	});

	await original.read('retry.md');

	expect(attempts).toStrictEqual(['retry.md', 'retry.md', 'retry.md']);
	expect(sleepMock).toHaveBeenCalledTimes(2);
	expect(sleepMock).toHaveBeenNthCalledWith(1, 25);
	expect(sleepMock).toHaveBeenNthCalledWith(2, 25);
});

test('retry shim stops after max retry count and ignores other statuses', async () => {
	sleepMock.mockReset();
	const attempts: Array<string> = [];
	const original = new ShimmedRemoteFs(async (input) => {
		attempts.push(input);
		throw { res: { status: 404 } };
	});

	retryShim(original, {
		maxRetry: 3,
		retryDelayMs: 25,
		retryableStatusCodes: [503],
	});

	expect(original.read('missing.md')).rejects.toStrictEqual({ res: { status: 404 } });
	expect(attempts).toStrictEqual(['missing.md']);
	expect(sleepMock).not.toHaveBeenCalled();
});
