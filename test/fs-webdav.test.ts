import { beforeEach, expect, mock, test } from 'bun:test';
import { ref } from 'synthkernel';
import { WebdavFs } from '~/fs-new';
import { createWebDAVReadStream } from '~/fs-new/webdav/read-stream';

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

const requestUrlMock = mock(async (_params: RequestUrlParam) => response);
const parseXMLMock = mock(() => parsedResponse);

let response: RequestUrlResponse;
let parsedResponse: ParsedResponse;

void mock.module('obsidian', () => ({
	requestUrl: requestUrlMock,
}));
void mock.module('~/fs-new/utils/parse-xml', () => ({
	default: parseXMLMock,
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
	requestUrlMock.mockReset();
	requestUrlMock.mockImplementation(async () => response);
	parseXMLMock.mockReset();
	parseXMLMock.mockImplementation(() => parsedResponse);
});

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

function chunkBuffer(value: number, size: number) {
	return new Uint8Array(Array.from({ length: size }, () => value)).buffer;
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

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/remote.php/dav/files/alice',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	const stat = await fs.stat('Notes/file.md');

	expect(requestUrlMock.mock.calls[0]?.[0]?.url).toBe(
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
	requestUrlMock.mockImplementationOnce(async () => {
		throw { res: { status: 404 } };
	});
	requestUrlMock.mockImplementationOnce(async () => {
		throw { res: { status: 500 } };
	});

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	await fs.delete('Notes/file.md');
	expect(fs.delete('Notes/file.md')).rejects.toStrictEqual({ res: { status: 500 } });
});

test('mkdir recursively creates parent folders in order', async () => {
	requestUrlMock.mockImplementation(async (params) => {
		if (params.url === 'https://dav.example.com/dav/Notes/') return response;
		if (params.url === 'https://dav.example.com/dav/Notes/Folder%20A/')
			throw { res: { status: 405 } };
		if (params.url === 'https://dav.example.com/dav/Notes/Folder%20A/Child/') return response;
		throw new Error(`Unexpected URL: ${params.url}`);
	});

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/dav',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	await fs.mkdir('Notes/Folder A/Child/', true);

	expect(
		requestUrlMock.mock.calls.map(([params]) => ({ method: params.method, url: params.url })),
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

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/dav',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	const list = await fs.list('Notes/');

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

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/dav',
		password: 'pass',
		useInfinity: true,
		username: 'alice',
	});

	const progress = ref({ completed: 0, total: 0 });
	const list = await fs.listAll('Notes/', progress);

	expect(requestUrlMock).toHaveBeenCalledWith(
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
	expect(progress()).toStrictEqual({ completed: 1, total: 1 });
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

	requestUrlMock.mockImplementationOnce(async () => {
		setXmlResponse(rootItems);
		return response;
	});
	requestUrlMock.mockImplementationOnce(async () => {
		setXmlResponse(childItems);
		return response;
	});

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/dav',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	const progress = ref({ completed: 0, total: 0 });
	const list = await fs.listAll('Notes/', progress);

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
	expect(progress()).toStrictEqual({ completed: 2, total: 2 });
});

test('readStream reorders out-of-order ranged responses', async () => {
	const requestRanges: Array<{ start: number; end: number }> = [];
	const resolvers: Array<(buffer: ArrayBuffer) => void> = [];

	const stream = createWebDAVReadStream({
		chunkSize: 2,
		maxConcurrent: 3,
		requestRange: async (start, end) => {
			requestRanges.push({ end, start });
			return await new Promise<ArrayBuffer>((resolve) => {
				resolvers.push(resolve);
			});
		},
		size: 6,
	});

	const reader = stream.getReader();
	const firstRead = reader.read();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(requestRanges).toStrictEqual([
		{ end: 1, start: 0 },
		{ end: 3, start: 2 },
		{ end: 5, start: 4 },
	]);

	resolvers[2]?.(chunkBuffer(3, 2));
	resolvers[0]?.(chunkBuffer(1, 2));
	resolvers[1]?.(chunkBuffer(2, 2));

	const firstResult = await firstRead;
	const chunks = [...(firstResult.value ?? [])];
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(...value);
	}

	expect(chunks).toStrictEqual([1, 1, 2, 2, 3, 3]);
});

test('readStream uses 2 MiB ranges from stat size', async () => {
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
	const pending = new Map<string, (value: RequestUrlResponse) => void>();

	requestUrlMock.mockImplementation(async (params) => {
		if (params.method === 'PROPFIND') return response;
		const range = params.headers?.Range ?? '';
		ranges.push(range);
		return await new Promise<RequestUrlResponse>((resolve) => {
			pending.set(range, resolve);
		});
	});

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/dav',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	const stream = await fs.readStream('Notes/file.bin');
	const reader = stream.getReader();
	const collected = (async () => {
		const bytes: Array<number> = [];
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			bytes.push(...value);
		}
		return bytes;
	})();

	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(ranges).toStrictEqual([
		'bytes=0-2097151',
		'bytes=2097152-4194303',
		'bytes=4194304-5242880',
	]);

	const makeResponse = (byte: number): RequestUrlResponse => ({
		arrayBuffer: new Uint8Array([byte]).buffer,
		headers: {},
		text: '',
	});

	pending.get('bytes=4194304-5242880')?.(makeResponse(3));
	pending.get('bytes=0-2097151')?.(makeResponse(1));
	pending.get('bytes=2097152-4194303')?.(makeResponse(2));

	expect(await collected).toStrictEqual([1, 2, 3]);
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
	const pending = new Map<string, (value: RequestUrlResponse) => void>();
	requestUrlMock.mockImplementation(async (params) => {
		if (params.method === 'PROPFIND') return response;
		const range = params.headers?.Range ?? '';
		ranges.push(range);
		return await new Promise<RequestUrlResponse>((resolve) => {
			pending.set(range, resolve);
		});
	});

	const fs = new WebdavFs({
		endpoint: 'https://dav.example.com/dav',
		password: 'pass',
		useInfinity: false,
		username: 'alice',
	});

	const stream = await fs.readStream('Notes/file.bin');
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(ranges).toStrictEqual([]);

	const reader = stream.getReader();
	void reader.read();
	await new Promise((resolve) => setTimeout(resolve, 0));
	expect(ranges).toStrictEqual(['bytes=0-3']);
	pending.get('bytes=0-3')?.({
		arrayBuffer: new Uint8Array([1, 2, 3, 4]).buffer,
		headers: {},
		text: '',
	});
	await reader.cancel();
});
