import type WebDAVSyncPlugin from '~/index';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import { migrate, pruneBaseTextStore } from './migrate';

// TODO: Remove in July 2026 (3 months after release)
export async function migrateStorage(plugin: WebDAVSyncPlugin): Promise<void> {
	const namespace = getSyncStateKey({
		vaultName: plugin.app.vault.getName(),
		remoteBaseDir: plugin.settings.remoteDir,
		serverUrl: plugin.settings.serverUrl,
		account: plugin.settings.account,
	});

	const syncStateStore = plugin.syncStateStore;

	const meta = await syncStateStore.get(namespace, 'meta');
	if ((meta as unknown as { version: number })?.version === 1) await migrate(plugin, namespace);

	// TODO: remove 27 April 2026 (20 days after release)
	await pruneBaseTextStore(namespace);
}
