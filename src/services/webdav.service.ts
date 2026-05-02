import type { WebDAVClient } from 'webdav';
import type WebDAVSyncPlugin from '~';
import { createClient } from 'webdav';
import apiLimiter from '~/composable/api-limiter';
import getCredential from '~/utils/get-credential';

export function createRateLimitedWebDAVClient(client: WebDAVClient): WebDAVClient {
	return new Proxy(client, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value === 'function')
				return (...args: Array<unknown>) =>
					apiLimiter.schedule(() => value.apply(target, args));

			return value;
		},
	});
}

export class WebDAVService {
	constructor(private readonly plugin: WebDAVSyncPlugin) {}

	createWebDAVClient(): WebDAVClient {
		const client = createClient(this.plugin.settings.serverUrl, {
			password: getCredential(this.plugin),
			username: this.plugin.settings.account,
		});
		return createRateLimitedWebDAVClient(client);
	}

	async checkWebDAVConnection(): Promise<{ error?: Error; success: boolean }> {
		try {
			const client = this.createWebDAVClient();
			return { success: await client.exists('/') };
		} catch (error) {
			return {
				error: error as Error,
				success: false,
			};
		}
	}
}
