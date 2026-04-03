import { Vault } from 'obsidian';
import type { IndexedDbSyncStateStore } from '~/storage';
import { useSettings } from '~/settings';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import postTraversal from '~/utils/post-traversal';
import { WebDAVTraversal } from '~/utils/traverse-webdav';
import { type FsWalkOptions } from './fs.interface';

export class RemoteWebDAVFileSystem {
	constructor(
		private options: {
			vault: Vault;
			token: string;
			remoteServerUrl?: string;
			remoteBaseDir: string;
			syncStateStore: IndexedDbSyncStateStore;
		},
	) {}

	async walk(options?: FsWalkOptions) {
		const settings = await useSettings();
		const stateKey = getSyncStateKey({
			vaultName: this.options.vault.getName(),
			remoteBaseDir: this.options.remoteBaseDir,
			serverUrl: this.options.remoteServerUrl || settings.serverUrl,
			account: settings.account,
		});

		const remoteServerUrl = this.options.remoteServerUrl || settings.serverUrl;
		const traversal = new WebDAVTraversal({
			remoteServerUrl,
			token: this.options.token,
			remoteBaseDir: this.options.remoteBaseDir,
			stateKey,
		});
		let stats = await traversal.traverse({
			onProgress: options?.onTraversalProgress,
		});

		return postTraversal(stats, settings.filterRules);
	}
}
