import { requestUrl } from 'obsidian';
import { sleep } from '~/utils/sleep';
import type { RemoteFs, RemoteFsWrapper } from '../interface';
import digOriginal from '../utils/dig-original';

type RetryOptions = {
	maxRetry?: number;
	isRetryable: (error: unknown) => boolean;
	retryDelayMs?: number;
};

function retryWrapper(
	original: RemoteFs,
	{ maxRetry = 3, isRetryable, retryDelayMs = 1000 }: RetryOptions,
): RemoteFs {
	const root = digOriginal(original);
	const request = root.request;
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

	root.request = wrappedRequest as typeof requestUrl;
	return original;
}

export default retryWrapper satisfies RemoteFsWrapper<RetryOptions>;
