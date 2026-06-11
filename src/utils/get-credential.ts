import type WebDAVSyncPlugin from '~';

export default function getCredential(plugin: WebDAVSyncPlugin, token: string): string {
	const credential = plugin.app.secretStorage.getSecret(token);
	if (!credential) throw new Error('Failed to retrieve WebDAV credential!');
	return credential;
}
