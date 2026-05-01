import { createClient, type WebDAVClient } from 'webdav';
import WebDAVSyncPlugin from '~';
import { apiLimiter } from '~/composable/api-limiter';
import { getCredential } from '~/utils/get-credential';

export function createRateLimitedWebDAVClient(client: WebDAVClient): WebDAVClient {
	return new Proxy(client, {
		get(target, prop, receiver) {
			const value = Reflect.get(target, prop, receiver);
			if (typeof value === 'function') {
				return (...args: unknown[]) => {
					return apiLimiter.schedule(() => value.apply(target, args));
				};
			}
			return value;
		},
	});
}

export class WebDAVService {
	constructor(private plugin: WebDAVSyncPlugin) {}

	private getServerUrl(): string {
		const serverUrl = this.plugin.settings.serverUrl.trim().replace(/\/+$/, '');
		if (!serverUrl) {
			throw new Error('WebDAV server URL is not configured');
		}

		let parsedUrl: URL;
		try {
			parsedUrl = new URL(serverUrl);
		} catch {
			throw new Error('WebDAV server URL is invalid');
		}

		if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
			throw new Error('WebDAV server URL must start with http:// or https://');
		}

		return parsedUrl.toString().replace(/\/+$/, '');
	}

	createWebDAVClient(): WebDAVClient {
		const client = createClient(this.getServerUrl(), {
			username: this.plugin.settings.account,
			password: getCredential(this.plugin),
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
