import { requestUrl as obsidianRequestUrl } from 'obsidian';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import logger from '~/utils/logger';
import requestUrl from '~/utils/request-url';

vi.mock('obsidian', async () => {
	const actual = await vi.importActual<typeof import('./mocks/obsidian')>('./mocks/obsidian');
	return {
		...actual,
		requestUrl: vi.fn(),
	};
});

vi.mock('~/utils/logger', () => ({
	default: {
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

describe('requestUrl', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('skips logging expected 404 responses when throw is false', async () => {
		vi.mocked(obsidianRequestUrl).mockResolvedValue({
			status: 404,
			text: '<html>not found</html>',
			headers: {},
		} as never);

		await expect(
			requestUrl({
				url: 'https://dav.example.com/missing/',
				method: 'PROPFIND',
				throw: false,
			}),
		).resolves.toMatchObject({ status: 404 });

		expect(logger.error).not.toHaveBeenCalled();
	});

	it('still logs and throws unexpected 404 responses', async () => {
		vi.mocked(obsidianRequestUrl).mockResolvedValue({
			status: 404,
			text: '<html>not found</html>',
			headers: {},
		} as never);

		await expect(requestUrl('https://dav.example.com/missing/')).rejects.toThrow(
			'404: <html>not found</html>',
		);

		expect(logger.error).toHaveBeenCalledOnce();
	});

	it('still logs non-404 failures even when throw is false', async () => {
		vi.mocked(obsidianRequestUrl).mockResolvedValue({
			status: 500,
			text: 'server error',
			headers: {},
		} as never);

		await expect(
			requestUrl({
				url: 'https://dav.example.com/missing/',
				method: 'PROPFIND',
				throw: false,
			}),
		).resolves.toMatchObject({ status: 500 });

		expect(logger.error).toHaveBeenCalledOnce();
	});
});
