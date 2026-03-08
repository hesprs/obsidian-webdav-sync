import { createClient, type WebDAVClient } from 'webdav';
import WebDAVSyncPlugin from '../index';
import { createRateLimitedWebDAVClient } from '../utils/rate-limited-client';

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
