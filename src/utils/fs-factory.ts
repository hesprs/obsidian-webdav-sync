import type WebDAVSyncPlugin from '~';
import {
	baseDirShim,
	encryptionShim,
	rateLimiterShim,
	RemoteFs,
	retryShim,
	VaultFs,
	WebdavFs,
} from '~/fs-new';
import getCredential from './get-credential';
import isRetryableError from './is-retryable-error';

export function createWebdavFs(plugin: WebDAVSyncPlugin, pure = false) {
	const { settings } = plugin;
	const {
		remoteDir,
		serverUrl,
		account,
		minWebDAVRequestInterval,
		maxWebDAVConcurrency,
		token,
		encryption,
	} = settings;
	let fs: RemoteFs = new WebdavFs({
		endpoint: serverUrl,
		password: getCredential(plugin, token),
		username: account,
	});
	fs = retryShim(fs, { isRetryable: isRetryableError });
	fs = rateLimiterShim(fs, {
		maxConcurrency: maxWebDAVConcurrency.value,
		minInterval: minWebDAVRequestInterval.value,
	});
	if (!pure) {
		fs = baseDirShim(fs, remoteDir);
		if (encryption.enabled) fs = encryptionShim(fs, encryption.value);
	}
	return fs;
}

export function createVaultFs(plugin: WebDAVSyncPlugin) {
	return new VaultFs(plugin.app.vault);
}
