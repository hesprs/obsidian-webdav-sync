import type WebDAVSyncPlugin from '~';
import getCredential from '~/utils/get-credential';
import type { RemoteFs } from '../interface';
import VaultFs from '../vault/fs';
import WebdavFs from '../webdav/fs';
import baseDirWrapper from '../wrappers/base-dir';
import encryptionWrapper from '../wrappers/encryption';
import rateLimiterWrapper from '../wrappers/rate-limiter';
import retryWrapper from '../wrappers/retry';
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
	fs = retryWrapper(fs, { isRetryable: isRetryableError });
	fs = rateLimiterWrapper(fs, {
		maxConcurrency: maxWebDAVConcurrency.value,
		minInterval: minWebDAVRequestInterval.value,
	});
	if (!pure) {
		fs = baseDirWrapper(fs, remoteDir);
		if (encryption.enabled) fs = encryptionWrapper(fs, encryption.value);
	}
	return fs;
}

export function createVaultFs(plugin: WebDAVSyncPlugin) {
	return new VaultFs(plugin.app.vault);
}
