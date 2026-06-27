import type { Progress, RootRemoteFs } from '@hesprs/sync-engine-sdk';
import type { requestUrl } from 'obsidian';
import { testKit } from '@hesprs/sync-engine-sdk';
import { beforeEach, expect, mock, test } from 'bun:test';
import type { WebdavFsOptions } from '@/webdav/fs';
import WebdavFs from '@/webdav/fs';
import createWebDAVReadStream from '@/webdav/read-stream';

const { collectStream, deferred, flush } = testKit;

type RequestUrlParam = {
	body?: string | ArrayBuffer;
	headers?: Record<string, string>;
	method?: string;
	url: string;
};

type RequestUrlResponse = {
	headers: Record<string, string | undefined>;
	text: string;
	arrayBuffer: ArrayBuffer;
};

type ParsedResponse = {
	multistatus: {
		response: Array<unknown>;
	};
};

let response: RequestUrlResponse;
let parsedResponse: ParsedResponse;

const defaultOptions = {
	endpoint: 'https://dav.example.com/dav',
	password: 'pass',
	useInfinity: false,
	username: 'alice',
} satisfies WebdavFsOptions;

void mock.module('@/parse-xml', () => ({
	default: () => parsedResponse,
}));

beforeEach(() => {
	response = {
		arrayBuffer: new ArrayBuffer(0),
		headers: {},
		text: '',
	};
	parsedResponse = {
		multistatus: {
			response: [],
		},
	};
});

type RequestHandler = (params: RequestUrlParam) => Promise<RequestUrlResponse>;

type WebdavHarness = {
	calls: Array<RequestUrlParam>;
	fs: RootRemoteFs;
	setRequest: (handler: RequestHandler) => void;
};

function createWebdavFs(options: Partial<WebdavFsOptions> = {}): WebdavHarness {
	const calls: Array<RequestUrlParam> = [];
	let requestHandler: RequestHandler = async () => response;
	const fs = new WebdavFs({ ...defaultOptions, ...options }, (async (
		params: string | RequestUrlParam,
	) => {
		if (typeof params === 'string') throw new Error(`Unexpected string request: ${params}`);
		calls.push(params);
		return await requestHandler(params);
	}) as typeof requestUrl);

	return {
		calls,
		fs,
		setRequest: (handler: RequestHandler) => {
			requestHandler = handler;
		},
	};
}

function setXmlResponse(items: Array<unknown>, text = '<xml />') {
	response = {
		arrayBuffer: new ArrayBuffer(0),
		headers: {},
		text,
	};
	parsedResponse = {
		multistatus: {
			response: items,
		},
	};
}

function createBuffer(value: number, size: number) {
	return new Uint8Array(size).fill(value).buffer;
}

test('stat parses dav fields and prefers etag for uid', async () => {
	setXmlResponse([
		{
			href: 'https://dav.example.com/remote.php/dav/files/alice/Notes/file.md',
			propstat: {
				prop: {
					getcontentlength: { '#text': '12' },
					getetag: 'etag-123',
					getlastmodified: { '#text': 'Mon, 01 Jan 2024 00:00:00 GMT' },
					resourcetype: {},
				},
				status: 'HTTP/1.1 200 OK',
			},
		},
	]);

	const webdav = createWebdavFs({
		endpoint: 'https://dav.example.com/remote.php/dav/files/alice',
	});

	const stat = await webdav.fs.stat('Notes/file.md');

	expect(webdav.calls[0]?.url).toBe(
		'https://dav.example.com/remote.php/dav/files/alice/Notes/file.md',
	);

	expect(stat).toStrictEqual({
		isDir: false,
		key: 'Notes/file.md',
		mtime: new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf(),
		size: 12,
		uid: 'etag-123',
	});
});

test('delete swallows 404 and rethrows other failures', async () => {
	let attempts = 0;
	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com' });
	webdav.setRequest(async () => {
		attempts += 1;
		if (attempts === 1) throw { res: { status: 404 } };
		throw { res: { status: 500 } };
	});

	await webdav.fs.delete('Notes/file.md');
	expect(webdav.fs.delete('Notes/file.md')).rejects.toStrictEqual({ res: { status: 500 } });
});

test('mkdir recursively creates parent folders in order', async () => {
	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com/dav' });
	webdav.setRequest(async (params) => {
		if (params.url === 'https://dav.example.com/dav/Notes/') return response;
		if (params.url === 'https://dav.example.com/dav/Notes/Folder%20A/')
			throw { res: { status: 405 } };
		if (params.url === 'https://dav.example.com/dav/Notes/Folder%20A/Child/') return response;
		throw new Error(`Unexpected URL: ${params.url}`);
	});

	await webdav.fs.mkdir('Notes/Folder A/Child/', true);

	expect(
		webdav.calls.map((params) => ({ method: params.method, url: params.url })),
	).toStrictEqual([
		{ method: 'MKCOL', url: 'https://dav.example.com/dav/Notes/' },
		{ method: 'MKCOL', url: 'https://dav.example.com/dav/Notes/Folder%20A/' },
		{ method: 'MKCOL', url: 'https://dav.example.com/dav/Notes/Folder%20A/Child/' },
	]);
});

test('list excludes the queried folder and normalizes descendant keys', async () => {
	setXmlResponse([
		{
			href: 'https://dav.example.com/dav/Notes/',
			propstat: {
				prop: { resourcetype: { collection: {} } },
				status: 'HTTP/1.1 200 OK',
			},
		},
		{
			href: 'https://dav.example.com/dav/Notes/Folder%20A/',
			propstat: {
				prop: { resourcetype: { collection: {} } },
				status: 'HTTP/1.1 200 OK',
			},
		},
		{
			href: 'https://dav.example.com/dav/Notes/Project%20Plan.md',
			propstat: {
				prop: {
					getcontentlength: '9',
					getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
					resourcetype: {},
				},
				status: 'HTTP/1.1 200 OK',
			},
		},
	]);

	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com/dav' });

	const list = await webdav.fs.list('Notes/');

	expect(list).toStrictEqual([
		{ isDir: true, key: 'Notes/Folder A/' },
		{
			isDir: false,
			key: 'Notes/Project Plan.md',
			mtime: new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf(),
			size: 9,
			uid: String(new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf()),
		},
	]);
});

test('listAll uses infinity when enabled', async () => {
	setXmlResponse([
		{
			href: 'https://dav.example.com/dav/Notes/',
			propstat: {
				prop: { resourcetype: { collection: {} } },
				status: 'HTTP/1.1 200 OK',
			},
		},
		{
			href: 'https://dav.example.com/dav/Notes/file.md',
			propstat: {
				prop: {
					getcontentlength: '3',
					getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
					resourcetype: {},
				},
				status: 'HTTP/1.1 200 OK',
			},
		},
	]);

	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com/dav', useInfinity: true });

	let storedProgress: Progress = { completed: 0, total: 0 };
	const progress = (prog: Progress) => (storedProgress = prog);
	const list = await webdav.fs.listAll('Notes/', progress);

	expect(webdav.calls[0]).toStrictEqual(
		expect.objectContaining({
			headers: expect.objectContaining({ Depth: 'infinity' }),
			method: 'PROPFIND',
		}),
	);
	expect(list).toStrictEqual([
		{
			isDir: false,
			key: 'Notes/file.md',
			mtime: new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf(),
			size: 3,
			uid: String(new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf()),
		},
	]);
	expect(storedProgress).toStrictEqual({ completed: 1, total: 1 });
});

test('listAll bfs updates progress when infinity is disabled', async () => {
	const rootItems = [
		{
			href: 'https://dav.example.com/dav/Notes/',
			propstat: {
				prop: { resourcetype: { collection: {} } },
				status: 'HTTP/1.1 200 OK',
			},
		},
		{
			href: 'https://dav.example.com/dav/Notes/Folder%20A/',
			propstat: {
				prop: { resourcetype: { collection: {} } },
				status: 'HTTP/1.1 200 OK',
			},
		},
	];
	const childItems = [
		{
			href: 'https://dav.example.com/dav/Notes/Folder%20A/',
			propstat: {
				prop: { resourcetype: { collection: {} } },
				status: 'HTTP/1.1 200 OK',
			},
		},
		{
			href: 'https://dav.example.com/dav/Notes/Folder%20A/file.md',
			propstat: {
				prop: {
					getcontentlength: '7',
					getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
					resourcetype: {},
				},
				status: 'HTTP/1.1 200 OK',
			},
		},
	];

	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com/dav' });
	webdav.setRequest(async (params) => {
		if (params.url === 'https://dav.example.com/dav/Notes/') {
			setXmlResponse(rootItems);
			return response;
		}
		if (params.url === 'https://dav.example.com/dav/Notes/Folder%20A/') {
			setXmlResponse(childItems);
			return response;
		}
		throw new Error(`Unexpected URL: ${params.url}`);
	});

	let storedProgress: Progress = { completed: 0, total: 0 };
	const progress = (prog: Progress) => (storedProgress = prog);
	const list = await webdav.fs.listAll('Notes/', progress);

	expect(list).toStrictEqual([
		{ isDir: true, key: 'Notes/Folder A/' },
		{
			isDir: false,
			key: 'Notes/Folder A/file.md',
			mtime: new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf(),
			size: 7,
			uid: String(new Date('Mon, 01 Jan 2024 00:00:00 GMT').valueOf()),
		},
	]);
	expect(storedProgress).toStrictEqual({ completed: 2, current: 'Notes/Folder A/', total: 2 });
});

test('readStream reorders out-of-order ranged responses', async () => {
	const requestRanges: Array<{ start: number; end: number }> = [];
	const resolvers: Array<ReturnType<typeof deferred<ArrayBuffer>>> = [];
	const toBytes = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)];

	const stream = createWebDAVReadStream({
		chunkSize: 2,
		maxConcurrent: 3,
		requestRange: async (start, end) => {
			requestRanges.push({ end, start });
			const pending = deferred<ArrayBuffer>();
			resolvers.push(pending);
			return await pending.promise;
		},
		size: 6,
	});

	const collected = collectStream(stream);
	await flush();
	expect(requestRanges).toStrictEqual([
		{ end: 1, start: 0 },
		{ end: 3, start: 2 },
		{ end: 5, start: 4 },
	]);

	resolvers[2]?.resolve(createBuffer(3, 2));
	resolvers[0]?.resolve(createBuffer(1, 2));
	resolvers[1]?.resolve(createBuffer(2, 2));

	expect(toBytes(await collected)).toStrictEqual([1, 1, 2, 2, 3, 3]);
});

test('readStream uses 1 MiB ranges from stat size', async () => {
	setXmlResponse([
		{
			href: 'https://dav.example.com/dav/Notes/file.bin',
			propstat: {
				prop: {
					getcontentlength: String(5 * 1024 * 1024 + 1),
					getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
					resourcetype: {},
				},
				status: 'HTTP/1.1 200 OK',
			},
		},
	]);

	const ranges: Array<string> = [];
	const pending = new Map<string, ReturnType<typeof deferred<RequestUrlResponse>>>();
	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com/dav' });
	webdav.setRequest(async (params) => {
		if (params.method === 'PROPFIND') return response;
		const range = params.headers?.Range ?? '';
		ranges.push(range);
		const wait = deferred<RequestUrlResponse>();
		pending.set(range, wait);
		return await wait.promise;
	});

	const collected = collectStream(await webdav.fs.readStream('Notes/file.bin'));
	await flush();
	expect(ranges).toStrictEqual([
		'bytes=0-1048575',
		'bytes=1048576-2097151',
		'bytes=2097152-3145727',
		'bytes=3145728-4194303',
	]);

	const makeResponse = (byte: number): RequestUrlResponse => ({
		arrayBuffer: new Uint8Array([byte]).buffer,
		headers: {},
		text: '',
	});

	pending.get('bytes=3145728-4194303')?.resolve(makeResponse(4));
	pending.get('bytes=2097152-3145727')?.resolve(makeResponse(3));
	pending.get('bytes=1048576-2097151')?.resolve(makeResponse(2));
	pending.get('bytes=0-1048575')?.resolve(makeResponse(1));

	await flush();
	expect(ranges).toStrictEqual([
		'bytes=0-1048575',
		'bytes=1048576-2097151',
		'bytes=2097152-3145727',
		'bytes=3145728-4194303',
		'bytes=4194304-5242879',
		'bytes=5242880-5242880',
	]);

	pending.get('bytes=4194304-5242879')?.resolve(makeResponse(5));
	pending.get('bytes=5242880-5242880')?.resolve(makeResponse(6));

	expect(new Uint8Array(await collected)).toStrictEqual(new Uint8Array([1, 2, 3, 4, 5, 6]));
});

test('readStream waits for consumer demand before scheduling', async () => {
	setXmlResponse([
		{
			href: 'https://dav.example.com/dav/Notes/file.bin',
			propstat: {
				prop: {
					getcontentlength: '4',
					getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
					resourcetype: {},
				},
				status: 'HTTP/1.1 200 OK',
			},
		},
	]);

	const ranges: Array<string> = [];
	const pending = new Map<string, ReturnType<typeof deferred<RequestUrlResponse>>>();
	const webdav = createWebdavFs({ endpoint: 'https://dav.example.com/dav' });
	webdav.setRequest(async (params) => {
		if (params.method === 'PROPFIND') return response;
		const range = params.headers?.Range ?? '';
		ranges.push(range);
		const wait = deferred<RequestUrlResponse>();
		pending.set(range, wait);
		return await wait.promise;
	});

	const stream = await webdav.fs.readStream('Notes/file.bin');
	await flush();
	expect(ranges).toStrictEqual([]);

	const collected = collectStream(stream);
	await flush();
	expect(ranges).toStrictEqual(['bytes=0-3']);
	pending.get('bytes=0-3')?.resolve({
		arrayBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
		headers: {},
		text: '',
	});
	expect(new Uint8Array(await collected)).toStrictEqual(new Uint8Array([1, 2, 3, 4]));
});
