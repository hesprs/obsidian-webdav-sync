import type WebDAVSyncPlugin from '~';
import { baseDirShim, rateLimiterShim, RemoteFs, retryShim, VaultFs, WebdavFs } from '~/fs-new';
import getCredential from './get-credential';
import isRetryableError from './is-retryable-error';

export function createWebdavFs(plugin: WebDAVSyncPlugin, applyBaseDir = false) {
	const { settings } = plugin;
	const { remoteDir, serverUrl, account, minWebDAVRequestInterval, maxWebDAVConcurrency } =
		settings;
	let fs: RemoteFs = new WebdavFs({
		endpoint: serverUrl,
		password: getCredential(plugin),
		username: account,
	});
	if (applyBaseDir) fs = baseDirShim(fs, remoteDir);
	fs = retryShim(fs, { isRetryable: isRetryableError });
	return rateLimiterShim(fs, {
		maxConcurrency: maxWebDAVConcurrency.value,
		minInterval: minWebDAVRequestInterval.value,
	});
}

export function createVaultFs(plugin: WebDAVSyncPlugin) {
	return new VaultFs(plugin.app.vault);
}
