import type { requestUrl } from 'obsidian';
import type { RemoteFs } from '../interface';
import ApiLimiter from '../utils/api-limiter';

type RateLimiterShimOptions = {
	maxConcurrency: number;
	minInterval: number;
};

export default function applyRateLimiterShim<T extends object>(
	original: RemoteFs<T>,
	options: RateLimiterShimOptions,
): RemoteFs<T> {
	const limiter = new ApiLimiter(options);
	const request = original.request;

	original.request = limiter.wrap((...args: Parameters<typeof requestUrl>) =>
		request(...args),
	) as typeof requestUrl;

	return original;
}
