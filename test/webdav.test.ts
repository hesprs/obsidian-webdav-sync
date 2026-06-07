import { beforeEach, expect, mock, test } from 'bun:test';
import type { FileStatModel } from '~/types';

type RequestUrlResponse = {
	headers: Record<string, string | undefined>;
	text: string;
};

type ParsedResponse = {
	multistatus: {
		response: Array<unknown>;
	};
};

let requestUrlResponse: RequestUrlResponse;
let parsedResponse: ParsedResponse;
const requestUrlMock = mock(async () => requestUrlResponse);
const parseXMLMock = mock(() => parsedResponse);

void mock.module('~/utils/request-url', () => ({
	default: requestUrlMock,
}));
void mock.module('~/composable/parse-xml', () => ({
	default: parseXMLMock,
}));

const webdavApi = import('../src/fs/webdav/api');

beforeEach(() => {
	requestUrlResponse = {
		headers: {},
		text: '',
	};
	parsedResponse = {
		multistatus: {
			response: [],
		},
	};
});

function mockDirectoryResponse(xml: string, responses: Array<unknown>): void {
	requestUrlResponse = {
		headers: {},
		text: xml,
	};
	parsedResponse = {
		multistatus: {
			response: responses,
		},
	};
}

test('parses absolute href responses from Nextcloud', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/alice/Notes/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
        <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Notes/Folder%20A/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
        <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/alice/Notes/Project%20Plan.md</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getlastmodified>Mon, 01 Jan 2024 00:00:00 GMT</d:getlastmodified>
        <d:getcontentlength>12</d:getcontentlength>
        <d:getcontenttype>text/markdown</d:getcontenttype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: '/remote.php/dav/files/alice/Notes/',
				propstat: {
					prop: {
						getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
						resourcetype: { collection: {} },
					},
					status: 'HTTP/1.1 200 OK',
				},
			},
			{
				href: '/remote.php/dav/files/alice/Notes/Folder%20A/',
				propstat: {
					prop: {
						getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
						resourcetype: { collection: {} },
					},
					status: 'HTTP/1.1 200 OK',
				},
			},
			{
				href: '/remote.php/dav/files/alice/Notes/Project%20Plan.md',
				propstat: {
					prop: {
						getcontentlength: '12',
						getcontenttype: 'text/markdown',
						getlastmodified: 'Mon, 01 Jan 2024 00:00:00 GMT',
						resourcetype: {},
					},
					status: 'HTTP/1.1 200 OK',
				},
			},
		],
	);

	const files = await getDirectoryContents(
		'https://cloud.example.com/remote.php/dav/files/alice',
		'token',
		'/Notes',
	);

	expect(files).toHaveLength(2);
	expect(files.map((file) => file.path)).toStrictEqual([
		'/Notes/Folder A/',
		'/Notes/Project Plan.md',
	]);
	expect(files[0].isDir).toBe(true);
	expect(files[1].isDir).toBe(false);
});

test('parses path-only href responses from server-relative listings', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/vault/Notes/</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype><d:collection/></d:resourcetype>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/Notes/%E4%B8%AD%E6%96%87.md</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontentlength>4</d:getcontentlength>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: '/vault/Notes/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/Notes/%E4%B8%AD%E6%96%87.md',
				propstat: {
					prop: { getcontentlength: '4', resourcetype: {} },
					status: 'HTTP/1.1 200 OK',
				},
			},
		],
	);

	const files = await getDirectoryContents('https://dav.example.com/vault', 'token', '/Notes');

	expect(files).toHaveLength(1);
	expect(files[0].path).toBe('/Notes/中文.md');
	expect((files[0] as FileStatModel).size).toBe(4);
});

test('picks successful prop values from propstat arrays', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/Notes/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Notes/Folder/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype/></d:prop>
      <d:status>HTTP/1.1 404 Not Found</d:status>
    </d:propstat>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Notes/file.md</d:href>
    <d:propstat>
      <d:prop><d:resourcetype/></d:prop>
      <d:status>HTTP/1.1 404 Not Found</d:status>
    </d:propstat>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontentlength>9</d:getcontentlength>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: '/dav/Notes/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/Notes/Folder/',
				propstat: [
					{ prop: { resourcetype: {} }, status: 'HTTP/1.1 404 Not Found' },
					{ prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
				],
			},
			{
				href: '/dav/Notes/file.md',
				propstat: [
					{ prop: { resourcetype: {} }, status: 'HTTP/1.1 404 Not Found' },
					{
						prop: { getcontentlength: '9', resourcetype: {} },
						status: 'HTTP/1.1 200 OK',
					},
				],
			},
		],
	);

	const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/Notes');

	expect(files).toHaveLength(2);
	expect(files.map((file) => file.path)).toStrictEqual(['/Notes/Folder/', '/Notes/file.md']);
	expect(files[0].isDir).toBe(true);
	expect(files[1].isDir).toBe(false);
	expect((files[1] as FileStatModel).size).toBe(9);
});

test('skips malformed response items without prop values', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/Notes/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Notes/Broken.md</d:href>
    <d:propstat>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/Notes/Ok.md</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontentlength>5</d:getcontentlength>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: '/dav/Notes/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/Notes/Broken.md',
				propstat: { status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/Notes/Ok.md',
				propstat: {
					prop: { getcontentlength: '5', resourcetype: {} },
					status: 'HTTP/1.1 200 OK',
				},
			},
		],
	);

	const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/Notes');

	expect(files).toHaveLength(1);
	expect(files[0].path).toBe('/Notes/Ok.md');
	expect((files[0] as FileStatModel).size).toBe(5);
});

test('keeps nested absolute paths when listing a subdirectory', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/test/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/test/abc/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: '/dav/test/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/test/abc/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
		],
	);

	const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/test/');

	expect(files).toHaveLength(1);
	expect(files[0].path).toBe('/test/abc/');
	expect(files[0].isDir).toBe(true);
});

test('decodes XML entities in href values', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/dav/&lt;test&gt;/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>/dav/&lt;test&gt;/ab &amp; c/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: '/dav/<test>/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/<test>/ab & c/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
		],
	);

	const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/<test>/');

	expect(files).toHaveLength(1);
	expect(files[0].path).toBe('/<test>/ab & c/');
	expect(files[0].isDir).toBe(true);
});

test('normalizes absolute IIS href responses', async () => {
	const { getDirectoryContents } = await webdavApi;
	mockDirectoryResponse(
		`<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>http://192.168.1.165:8000/obsidian_sync/</d:href>
    <d:propstat>
      <d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
  <d:response>
    <d:href>http://192.168.1.165:8000/obsidian_sync/Folder%20A/Note.md</d:href>
    <d:propstat>
      <d:prop>
        <d:resourcetype/>
        <d:getcontentlength>7</d:getcontentlength>
      </d:prop>
      <d:status>HTTP/1.1 200 OK</d:status>
    </d:propstat>
  </d:response>
</d:multistatus>`,
		[
			{
				href: 'http://192.168.1.165:8000/obsidian_sync/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: 'http://192.168.1.165:8000/obsidian_sync/Folder%20A/Note.md',
				propstat: {
					prop: { getcontentlength: '7', resourcetype: {} },
					status: 'HTTP/1.1 200 OK',
				},
			},
		],
	);

	const files = await getDirectoryContents(
		'http://192.168.1.165:8000/',
		'token',
		'/obsidian_sync/',
	);

	expect(files).toHaveLength(1);
	expect(files[0].path).toBe('/obsidian_sync/Folder A/Note.md');
	expect(files[0].isDir).toBe(false);
	expect((files[0] as FileStatModel).size).toBe(7);
});
