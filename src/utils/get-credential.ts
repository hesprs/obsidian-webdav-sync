import type WebDAVSyncPlugin from '~';

export default function getCredential(plugin: WebDAVSyncPlugin): string {
	const credential = plugin.app.secretStorage.getSecret(plugin.settings.token);
	if (!credential) throw new Error('Failed to retrieve WebDAV credential!');
	return credential;
}
