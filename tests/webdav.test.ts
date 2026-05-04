import { describe, expect, it, vi } from 'vitest';
import parseXML from '~/composable/parse-xml';
import requestUrl from '~/utils/request-url';

vi.mock('~/utils/request-url', () => ({
	default: vi.fn(),
}));
vi.mock('~/composable/parse-xml', () => ({
	default: vi.fn(),
}));
vi.mock('~/utils/is-503-error', () => ({
	is503Error: () => false,
}));
vi.mock('~/utils/logger', () => ({
	default: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}));
vi.mock('~/utils/sleep', () => ({ default: vi.fn() }));

describe('getDirectoryContents', () => {
	const parseXMLMock = vi.mocked(parseXML);

	function mockParsedResponse(response: Array<unknown>): void {
		parseXMLMock.mockReturnValueOnce({
			multistatus: {
				response,
			},
		} as never);
	}

	it('parses absolute href responses (Nextcloud style)', async () => {
		vi.clearAllMocks();

		const getDirectoryContents = (await import('../src/fs/webdav/api')).default;
		vi.mocked(requestUrl).mockResolvedValue({
			headers: {},
			text: `<?xml version="1.0"?>
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
		} as never);
		mockParsedResponse([
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
		]);

		const files = await getDirectoryContents(
			'https://cloud.example.com/remote.php/dav/files/alice',
			'token',
			'/Notes',
		);

		expect(files).toHaveLength(2);
		expect(files.map((f) => f.filename)).toStrictEqual([
			'/Notes/Folder A/',
			'/Notes/Project Plan.md',
		]);
		expect(files[0].type).toBe('directory');
		expect(files[1].type).toBe('file');
	});

	it('parses path-only href responses (server-relative style)', async () => {
		vi.clearAllMocks();

		const getDirectoryContents = (await import('../src/fs/webdav/api')).default;
		vi.mocked(requestUrl).mockResolvedValue({
			headers: {},
			text: `<?xml version="1.0"?>
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
		} as never);
		mockParsedResponse([
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
		]);

		const files = await getDirectoryContents(
			'https://dav.example.com/vault',
			'token',
			'/Notes',
		);

		expect(files).toHaveLength(1);
		expect(files[0].filename).toBe('/Notes/中文.md');
		expect(files[0].size).toBe(4);
	});

	it('handles propstat arrays and picks successful prop values', async () => {
		vi.clearAllMocks();

		const getDirectoryContents = (await import('../src/fs/webdav/api')).default;
		vi.mocked(requestUrl).mockResolvedValue({
			headers: {},
			text: `<?xml version="1.0"?>
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
		} as never);
		mockParsedResponse([
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
		]);

		const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/Notes');

		expect(files).toHaveLength(2);
		expect(files.map((f) => f.filename)).toStrictEqual(['/Notes/Folder/', '/Notes/file.md']);
		expect(files[0].type).toBe('directory');
		expect(files[1].type).toBe('file');
		expect(files[1].size).toBe(9);
	});

	it('skips malformed response items without prop values', async () => {
		const getDirectoryContents = (await import('../src/fs/webdav/api')).default;
		vi.mocked(requestUrl).mockResolvedValue({
			headers: {},
			text: `<?xml version="1.0"?>
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
		} as never);
		mockParsedResponse([
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
		]);

		const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/Notes');

		expect(files).toHaveLength(1);
		expect(files[0].filename).toBe('/Notes/Ok.md');
		expect(files[0].size).toBe(5);
	});

	it('keeps nested absolute path when listing non-root directory', async () => {
		const getDirectoryContents = (await import('../src/fs/webdav/api')).default;
		vi.mocked(requestUrl).mockResolvedValue({
			headers: {},
			text: `<?xml version="1.0"?>
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
		} as never);
		mockParsedResponse([
			{
				href: '/dav/test/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/test/abc/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
		]);

		const files = await getDirectoryContents('https://dav.example.com/dav', 'token', '/test/');

		expect(files).toHaveLength(1);
		expect(files[0].filename).toBe('/test/abc/');
		expect(files[0].type).toBe('directory');
	});

	it('decodes XML entities', async () => {
		const getDirectoryContents = (await import('../src/fs/webdav/api')).default;
		vi.mocked(requestUrl).mockResolvedValue({
			headers: {},
			text: `<?xml version="1.0"?>
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
		} as never);
		mockParsedResponse([
			{
				href: '/dav/<test>/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
			{
				href: '/dav/<test>/ab & c/',
				propstat: { prop: { resourcetype: { collection: {} } }, status: 'HTTP/1.1 200 OK' },
			},
		]);

		const files = await getDirectoryContents(
			'https://dav.example.com/dav',
			'token',
			'/<test>/',
		);

		expect(files).toHaveLength(1);
		expect(files[0].filename).toBe('/<test>/ab & c/');
		expect(files[0].type).toBe('directory');
	});
});
