import { describe, expect, it, vi } from 'vitest';
import type { StatsMap } from '~/types';
import { traverseWebDAV, getDirectoryContents } from '~/fs/webdav';

const remoteRecordState: StatsMap = new Map();

vi.mock('~/fs/webdav/api', () => ({ getDirectoryContents: vi.fn() }));

vi.mock('~/utils/api-limiter', () => ({
	default: { wrap: <T>(fn: T) => fn },
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
		encryption: { enabled: false },
		exhaustiveRemoteTraversal: false,
		remoteDir: '/test/',
		serverUrl: 'https://dav.example.com/dav',
		skipLargeFiles: { enabled: false },
	})),
}));

describe('webDAVTraversal', () => {
	it('uses remote-base-aware path when enqueuing child directories', async () => {
		vi.clearAllMocks();
		remoteRecordState.clear();

		vi.mocked(getDirectoryContents)
			.mockResolvedValueOnce([{ isDir: true, path: '/test/webdav-sync/' }])
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
		vi.clearAllMocks();
		remoteRecordState.clear();

		vi.mocked(getDirectoryContents)
			.mockResolvedValueOnce([{ isDir: true, path: '/test/missing/' }])
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
