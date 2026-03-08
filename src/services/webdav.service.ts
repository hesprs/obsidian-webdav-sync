import { createClient, type WebDAVClient } from 'webdav';
import NutstorePlugin from '../index';
import { createRateLimitedWebDAVClient } from '../utils/rate-limited-client';

export class WebDAVService {
	constructor(private plugin: NutstorePlugin) {}

	private getServerUrl(): string {
		const serverUrl = this.plugin.settings.serverUrl.trim().replace(/\/+$/, '');
		if (!serverUrl) {
			throw new Error('WebDAV server URL is not configured');
		}
		return serverUrl;
	}

	async createWebDAVClient(): Promise<WebDAVClient> {
		const client = createClient(this.getServerUrl(), {
			username: this.plugin.settings.account,
			password: this.plugin.settings.credential,
		});
		return createRateLimitedWebDAVClient(client);
	}

	async checkWebDAVConnection(): Promise<{ error?: Error; success: boolean }> {
		try {
			const client = await this.createWebDAVClient();
			return { success: await client.exists('/') };
			// oxlint-disable-next-line typescript/no-explicit-any
		} catch (error: any) {
			return {
				error,
				success: false,
			};
		}
	}
}
