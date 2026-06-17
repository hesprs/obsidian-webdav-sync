import type WebDAVSyncPlugin from '~';
import getCredential from '~/utils/get-credential';
import type { RemoteFs } from '../interface';
import VaultFs from '../vault/fs';
import WebdavFs from '../webdav/fs';
import baseDirWrapper from '../wrappers/base-dir';
import encryptionWrapper from '../wrappers/encryption';
import { localMemoryControlWrapper, remoteMemoryControlWrapper } from '../wrappers/memory-control';
import commonOptimizationWrapper from '../wrappers/optimization/common-optimization';
import localOptimizationWrapper from '../wrappers/optimization/vault-optimization';
import rateLimiterWrapper from '../wrappers/rate-limiter';
import retryWrapper from '../wrappers/retry';
import isRetryableError from './is-retryable-error';

let memoryConsumption = 0;
const hangingOperations: Array<{
	size: number;
	resume: () => void;
}> = [];

export function createWebdavFs(plugin: WebDAVSyncPlugin, pure = false) {
	const { settings } = plugin;
	const {
		remoteDir,
		serverUrl,
		account,
		minRequestInterval,
		maxRequestConcurrency,
		token,
		encryption,
		maxMemoryConsumption,
	} = settings;
	let fs: RemoteFs = new WebdavFs({
		endpoint: serverUrl,
		password: getCredential(plugin, token),
		username: account,
	});
	const maxConcurrency = maxRequestConcurrency.enabled ? maxRequestConcurrency.value : Infinity;
	const minInterval = minRequestInterval.enabled ? minRequestInterval.value : 0;
	const maxMemory = maxMemoryConsumption.enabled ? maxMemoryConsumption.value : Infinity;
	fs = remoteMemoryControlWrapper(fs, { hangingOperations, maxMemory, memoryConsumption });
	fs = commonOptimizationWrapper(fs);
	fs = retryWrapper(fs, { isRetryable: isRetryableError });
	fs = rateLimiterWrapper(fs, { maxConcurrency, minInterval });
	if (!pure) {
		fs = baseDirWrapper(fs, remoteDir);
		if (encryption.enabled) fs = encryptionWrapper(fs, getCredential(plugin, encryption.value));
	}
	return fs;
}

export function createVaultFs(plugin: WebDAVSyncPlugin) {
	const { maxMemoryConsumption } = plugin.settings;
	const maxMemory = maxMemoryConsumption.enabled ? maxMemoryConsumption.value : Infinity;
	return localOptimizationWrapper(
		localMemoryControlWrapper(new VaultFs(plugin.app.vault), {
			hangingOperations,
			maxMemory,
			memoryConsumption,
		}),
	);
}

export function clearMemoryStates() {
	memoryConsumption = 0;
	hangingOperations.length = 0;
}
