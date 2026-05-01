import { beforeEach, describe, expect, it, vi } from 'vitest';
import { traverseWebDAV, getDirectoryContents } from '~/fs/webdav';
import { type StatsMap } from '~/types';

const remoteRecordState: StatsMap = new Map();

vi.mock('~/fs/webdav/api', () => ({
	default: vi.fn(),
}));

vi.mock('~/utils/api-limiter', () => ({
	default: {
		wrap: <T>(fn: T) => fn,
	},
}));

vi.mock('~/utils/logger', () => ({
	default: {
		debug: vi.fn(),
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

vi.mock('~/settings', () => ({
	useSettings: vi.fn(() => ({
		exhaustiveRemoteTraversal: false,
		remoteDir: '/test/',
		serverUrl: 'https://dav.example.com/dav',
		skipLargeFiles: {
			bytes: 10 * 1024 * 1024,
			maxSize: '10MB',
		},
	})),
}));

describe('WebDAVTraversal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		remoteRecordState.clear();
	});

	it('uses remote-base-aware path when enqueuing child directories', async () => {
		vi.mocked(getDirectoryContents)
			.mockResolvedValueOnce([
				{
					basename: 'webdav-sync',
					filename: '/test/webdav-sync/',
					lastmod: 'Mon, 01 Jan 2024 00:00:00 GMT',
					mime: undefined,
					size: 0,
					type: 'directory',
				},
			])
			.mockResolvedValueOnce([]);

		await traverseWebDAV({ token: 'token' });

		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			1,
			'https://dav.example.com/dav',
			'token',
			'/test/',
			false,
		);
		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav',
			'token',
			'/test/webdav-sync/',
			false,
		);
	});

	it('skips not-found traversal nodes instead of failing and persisting retry loop', async () => {
		vi.mocked(getDirectoryContents)
			.mockResolvedValueOnce([
				{
					basename: 'missing',
					filename: '/test/missing/',
					lastmod: 'Mon, 01 Jan 2024 00:00:00 GMT',
					mime: undefined,
					size: 0,
					type: 'directory',
				},
			])
			.mockRejectedValueOnce({
				message: '404: Not Found',
				res: { status: 404 },
			});

		const traversal = traverseWebDAV({ token: 'token' });

		await expect(traversal).resolves.toBeDefined();

		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav',
			'token',
			'/test/missing/',
			false,
		);
	});
});
