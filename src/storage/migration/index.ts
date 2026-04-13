import type WebDAVSyncPlugin from '~';
import { getSyncStateKey } from '~/utils/get-sync-state-key';
import { migrate, pruneBaseTextStore } from './migrate';

// TODO: Remove in May 2026
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

	// TODO: remove 17 April 2026 (10 days after release)
	await pruneBaseTextStore(namespace);
}
