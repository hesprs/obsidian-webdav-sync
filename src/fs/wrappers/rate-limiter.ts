import type { requestUrl } from 'obsidian';
import type { RemoteFs, RemoteFsWrapper, RootRemoteFs } from '../interface';
import ApiLimiter from '../utils/api-limiter';
import digOriginal from '../utils/dig-original';

type RateLimiterOptions = {
	maxConcurrency: number;
	minInterval: number;
};

function rateLimiterWrapper(original: RemoteFs, options: RateLimiterOptions): RemoteFs {
	const limiter = new ApiLimiter(options);
	const root = digOriginal(original).at(-1) as RootRemoteFs;
	const request = root.request;

	root.request = limiter.wrap((...args: Parameters<typeof requestUrl>) =>
		request(...args),
	) as typeof requestUrl;

	return original;
}

export default rateLimiterWrapper satisfies RemoteFsWrapper<RateLimiterOptions>;
