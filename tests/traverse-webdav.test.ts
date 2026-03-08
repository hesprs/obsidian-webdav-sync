import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDirectoryContents } from '~/api';

const traverseCacheState = new Map<string, { queue: string[]; nodes: Record<string, unknown> }>();

vi.mock('~/api', () => ({
	getDirectoryContents: vi.fn(),
}));

vi.mock('~/utils/api-limiter', () => ({
	apiLimiter: {
		wrap: <T>(fn: T) => fn,
	},
}));

vi.mock('~/storage', () => ({
	traverseWebDAVKV: {
		get: vi.fn(async (key: string) => traverseCacheState.get(key)),
		set: vi.fn(
			async (key: string, value: { queue: string[]; nodes: Record<string, unknown> }) => {
				traverseCacheState.set(key, value);
			},
		),
		unset: vi.fn(async (key: string) => {
			traverseCacheState.delete(key);
		}),
	},
}));

vi.mock('~/utils/logger', () => ({
	default: {
		error: vi.fn(),
		warn: vi.fn(),
	},
}));

describe('ResumableWebDAVTraversal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		traverseCacheState.clear();
	});

	it('uses remote-base-aware path when enqueuing child directories', async () => {
		const { ResumableWebDAVTraversal } = await import('../src/utils/traverse-webdav');

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

		const traversal = new ResumableWebDAVTraversal({
			remoteServerUrl: 'https://dav.example.com/dav',
			token: 'token',
			remoteBaseDir: '/test/',
			kvKey: 'traverse-path-fix',
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
		const { ResumableWebDAVTraversal } = await import('../src/utils/traverse-webdav');

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

		const traversal = new ResumableWebDAVTraversal({
			remoteServerUrl: 'https://dav.example.com/dav',
			token: 'token',
			remoteBaseDir: '/test/',
			kvKey: 'traverse-404-skip',
		});

		await expect(traversal.traverse()).resolves.toBeDefined();

		const saved = traverseCacheState.get('traverse-404-skip');
		expect(saved?.queue).toEqual([]);
		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav',
			'token',
			'/test/missing/',
		);
	});
});
