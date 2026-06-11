import { requestUrl } from 'obsidian';
import sleep from '~/utils/sleep';
import type { RemoteFs } from '../interface';

type RetryShimOptions = {
	maxRetry?: number;
	isRetryable: (error: unknown) => boolean;
	retryDelayMs?: number;
};

export default function applyRetryShim<T extends object>(
	original: RemoteFs<T>,
	{ maxRetry = 3, isRetryable, retryDelayMs = 1000 }: RetryShimOptions,
): RemoteFs<T> {
	const request = original.request;
	type RequestParam = Parameters<typeof requestUrl>[0];

	async function wrappedRequest(p: RequestParam, retryCount = 0) {
		try {
			return await request(p);
		} catch (error) {
			if (!isRetryable(error) || retryCount >= maxRetry) throw error;
			await sleep(retryDelayMs);
			return wrappedRequest(p, retryCount + 1);
		}
	}

	original.request = wrappedRequest as typeof requestUrl;

	return original;
}
