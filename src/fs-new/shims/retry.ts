import { requestUrl } from 'obsidian';
import sleep from '~/utils/sleep';
import type { RemoteFs } from '../interface';

type RetryShimOptions = {
	maxRetry: number;
	retryableStatusCodes: Array<number>;
	retryDelayMs: number;
};

function getRequestStatus(error: unknown) {
	if (typeof error !== 'object' || error === null) return undefined;
	const res = (error as { res?: { status?: unknown } }).res;
	return typeof res?.status === 'number' ? res.status : undefined;
}

export default function applyRetryShim<T extends object>(
	original: RemoteFs<T>,
	options: RetryShimOptions,
): RemoteFs<T> {
	const request = original.request;
	const retryableStatusCodes = new Set(options.retryableStatusCodes);
	type RequestParam = Parameters<typeof requestUrl>[0];

	async function wrappedRequest(p: RequestParam, retryCount = 0) {
		try {
			return await request(p);
		} catch (error) {
			const status = getRequestStatus(error);
			if (
				status === undefined ||
				!retryableStatusCodes.has(status) ||
				retryCount >= options.maxRetry
			)
				throw error;
			await sleep(options.retryDelayMs);
			return wrappedRequest(p, retryCount + 1);
		}
	}

	original.request = wrappedRequest as typeof requestUrl;

	return original;
}
