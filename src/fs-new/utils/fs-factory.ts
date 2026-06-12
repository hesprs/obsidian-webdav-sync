import type WebDAVSyncPlugin from '~';
import getCredential from '~/utils/get-credential';
import { RemoteFs } from '../interface';
import baseDirShim from '../shims/base-dir';
import encryptionShim from '../shims/encryption';
import rateLimiterShim from '../shims/rate-limiter';
import retryShim from '../shims/retry';
import VaultFs from '../vault/fs';
import WebdavFs from '../webdav/fs';
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
