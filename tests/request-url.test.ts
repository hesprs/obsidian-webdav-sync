import { requestUrl as obsidianRequestUrl } from 'obsidian';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
			headers: {},
			status: 404,
			text: '<html>not found</html>',
		} as never);

		await expect(
			requestUrl({
				method: 'PROPFIND',
				throw: false,
				url: 'https://dav.example.com/missing/',
			}),
		).resolves.toMatchObject({ status: 404 });

		expect(logger.error).not.toHaveBeenCalled();
	});

	it('still logs and throws unexpected 404 responses', async () => {
		vi.mocked(obsidianRequestUrl).mockResolvedValue({
			headers: {},
			status: 404,
			text: '<html>not found</html>',
		} as never);

		await expect(requestUrl('https://dav.example.com/missing/')).rejects.toThrow(
			'404: <html>not found</html>',
		);

		expect(logger.error).toHaveBeenCalledOnce();
	});

	it('still logs non-404 failures even when throw is false', async () => {
		vi.mocked(obsidianRequestUrl).mockResolvedValue({
			headers: {},
			status: 500,
			text: 'server error',
		} as never);

		await expect(
			requestUrl({
				method: 'PROPFIND',
				throw: false,
				url: 'https://dav.example.com/missing/',
			}),
		).resolves.toMatchObject({ status: 500 });

		expect(logger.error).toHaveBeenCalledOnce();
	});

	it('logs safe response metadata instead of raw response objects', async () => {
		vi.mocked(obsidianRequestUrl).mockResolvedValue({
			headers: { 'content-type': 'text/html' },
			json: () => {
				throw new SyntaxError("JSON Parse error: Unrecognized token '<'");
			},
			status: 401,
			text: '<html>unauthorized</html>',
		} as never);

		await expect(
			requestUrl({
				method: 'DELETE',
				throw: false,
				url: 'https://dav.example.com/test',
			}),
		).resolves.toMatchObject({ status: 401 });

		expect(logger.error).toHaveBeenCalledWith('Received unexpected status code 401', {
			headers: { 'content-type': 'text/html' },
			status: 401,
			text: '<html>unauthorized</html>',
		});
	});
});
