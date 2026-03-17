import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RemoteRecordModel } from '~/model/sync-record.model';
import type { SyncStateStore } from '~/storage';
import { getDirectoryContents } from '~/api';

const remoteRecordState = new Map<string, RemoteRecordModel>();
const syncStateStore = {} as SyncStateStore;

vi.mock('~/api', () => ({
	getDirectoryContents: vi.fn(),
}));

vi.mock('~/utils/api-limiter', () => ({
	apiLimiter: {
		wrap: <T>(fn: T) => fn,
	},
}));

vi.mock('~/storage/sync-record', () => ({
	SyncRecord: class {
		constructor(private namespace: string) {}

		async getRemoteRecord(): Promise<RemoteRecordModel> {
			return (
				remoteRecordState.get(this.namespace) ?? {
					queue: [],
					nodes: {},
					isComplete: false,
				}
			);
		}

		async setRemoteRecord(remoteRecord: RemoteRecordModel): Promise<void> {
			remoteRecordState.set(this.namespace, remoteRecord);
		}

		async clearRemoteRecord(): Promise<void> {
			remoteRecordState.delete(this.namespace);
		}
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
		remoteRecordState.clear();
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
			stateKey: 'traverse-path-fix',
			syncStateStore,
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
			stateKey: 'traverse-404-skip',
			syncStateStore,
		});

		await expect(traversal.traverse()).resolves.toBeDefined();

		const saved = remoteRecordState.get('traverse-404-skip');
		expect(saved?.queue).toEqual([]);
		expect(vi.mocked(getDirectoryContents)).toHaveBeenNthCalledWith(
			2,
			'https://dav.example.com/dav',
			'token',
			'/test/missing/',
		);
	});
});
