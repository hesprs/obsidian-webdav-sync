import type { WebDAVClient } from 'webdav';
import { apiLimiter } from './api-limiter';

export function createRateLimitedWebDAVClient(client: WebDAVClient): WebDAVClient {
	return new Proxy(client, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value === 'function') {
				// oxlint-disable-next-line typescript/no-explicit-any
				return (...args: any[]) => {
					return apiLimiter.schedule(() => value.apply(target, args));
				};
			}
			return value;
		},
	});
}
