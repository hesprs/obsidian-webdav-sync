import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StatsMap } from '~/types';
import { getDirectoryContents } from '~/api';
import { WebDAVTraversal } from '~/fs/traverse-webdav';

const remoteRecordState: StatsMap = new Map();

vi.mock('~/api', () => ({
	getDirectoryContents: vi.fn(),
}));

vi.mock('~/utils/api-limiter', () => ({
	apiLimiter: {
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

describe('WebDAVTraversal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		remoteRecordState.clear();
	});

	it('uses remote-base-aware path when enqueuing child directories', async () => {
		vi.mocked(getDirectoryContents)
			.mockResolvedValueOnce([
				{
					filename: '/test/webdav-sync/',
					basename: 'webdav-sync',
					lastmod: 'Mon, 01 Jan 2024 00:00:00 GMT',
					size: 0,
					type: 'directory',
					etag: null,
					mime: undefined,
				},
			])
			.mockResolvedValueOnce([]);

		const traversal = new WebDAVTraversal({
			remoteServerUrl: 'https://dav.example.com/dav',
			token: 'token',
			remoteBaseDir: '/test/',
			stateKey: 'traverse-path-fix',
		});

		await traversal.traverse();

		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			1,
			'https://dav.example.com/dav',
			'token',
			'/test/',
		);
		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav',
			'token',
			'/test/webdav-sync/',
		);
	});

	it('skips not-found traversal nodes instead of failing and persisting retry loop', async () => {
		vi.mocked(getDirectoryContents)
			.mockResolvedValueOnce([
				{
					filename: '/test/missing/',
					basename: 'missing',
					lastmod: 'Mon, 01 Jan 2024 00:00:00 GMT',
					size: 0,
					type: 'directory',
					etag: null,
					mime: undefined,
				},
			])
			.mockRejectedValueOnce({
				res: { status: 404 },
				message: '404: Not Found',
			});

		const traversal = new WebDAVTraversal({
			remoteServerUrl: 'https://dav.example.com/dav',
			token: 'token',
			remoteBaseDir: '/test/',
			stateKey: 'traverse-404-skip',
		});

		await expect(traversal.traverse()).resolves.toBeDefined();

		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav',
			'token',
			'/test/missing/',
		);
	});
});
