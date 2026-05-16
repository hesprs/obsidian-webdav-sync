import type { SecretStorage } from 'obsidian';
import type { RangedFileDecrypter } from '~/composable/encryption';
import type { PluginSettings } from '~/settings';
import {
	createRangedFileDecrypter,
	decryptFileContent,
	decryptBasename,
	deriveMasterKey,
	deriveMasterSalt,
	deriveNameKey,
	deriveRootFileKey,
	encryptBasename,
	encryptFileContent,
} from '~/composable/encryption';
import {
	joinRemotePathFromBaseDir,
	normalizePathToRelative,
	splitRemotePathAtBaseDir,
} from '~/platform/path';
import { usePlugin } from '~/settings/plugin-instance';

type SyncEncryptionKeys = {
	rootFileKey: Uint8Array;
	nameKey: Uint8Array;
};

type SyncEncryptionBasenameCache = {
	decryptedToEncrypted: Map<string, string>;
	encryptedToDecrypted: Map<string, string>;
};

export type SyncEncryptionContext = {
	basenameCache: SyncEncryptionBasenameCache;
	keysPromise: Promise<SyncEncryptionKeys>;
};

const BASENAME_CACHE_LIMIT = 10_000;

async function deriveSyncEncryptionKeys(
	settings: PluginSettings,
	secretStorage: SecretStorage,
): Promise<SyncEncryptionKeys> {
	const password = getEncryptionPassword(settings, secretStorage);
	const masterSalt = await deriveMasterSalt(settings);
	const masterKey = await deriveMasterKey(password, masterSalt);
	const masterKeyBytes = new Uint8Array(masterKey);
	const [rootFileKey, nameKey] = await Promise.all([
		deriveRootFileKey(masterKeyBytes),
		deriveNameKey(masterKeyBytes),
	]);
	return { nameKey, rootFileKey };
}

function createSyncEncryptionBasenameCache(): SyncEncryptionBasenameCache {
	return {
		decryptedToEncrypted: new Map(),
		encryptedToDecrypted: new Map(),
	};
}

export function createSyncEncryptionContext(
	settings: PluginSettings,
	secretStorage: SecretStorage,
): SyncEncryptionContext {
	return {
		basenameCache: createSyncEncryptionBasenameCache(),
		keysPromise: deriveSyncEncryptionKeys(settings, secretStorage),
	};
}

async function decryptRemotePathBelowBaseDir(
	remoteDir: string,
	remotePath: string,
	context: SyncEncryptionContext,
): Promise<string> {
	const { descendantSegments, isDir } = splitRemotePathAtBaseDir(remoteDir, remotePath);
	if (descendantSegments.length === 0) return remoteDir;

	const decryptedSegments = await transformPathSegments(descendantSegments, context, 'decrypt');
	return joinRemotePathFromBaseDir(remoteDir, decryptedSegments, isDir);
}

async function encryptRemotePathBelowBaseDir(
	remoteDir: string,
	virtualRelativePath: string,
	isDir: boolean,
	context: SyncEncryptionContext,
): Promise<string> {
	const normalizedRelativePath = normalizeRelativeDescendantPath(virtualRelativePath);
	if (normalizedRelativePath === '/') return remoteDir;

	const encryptedSegments = await transformPathSegments(
		normalizedRelativePath.split('/'),
		context,
		'encrypt',
	);
	return joinRemotePathFromBaseDir(remoteDir, encryptedSegments, isDir);
}

export async function decryptRemotePathForTraversal(remotePath: string): Promise<string> {
	const plugin = await usePlugin();
	if (!plugin.settings.encryption.enabled) return remotePath;

	const remoteDir = plugin.settings.remoteDir;
	return decryptRemotePathBelowBaseDir(remoteDir, remotePath, plugin.getSyncEncryptionContext());
}

export async function resolveRemoteExecutionPath(virtualAbsolutePath: string): Promise<string> {
	const plugin = await usePlugin();
	if (!plugin.settings.encryption.enabled) return virtualAbsolutePath;

	const remoteDir = plugin.settings.remoteDir;
	const relativePath = normalizePathToRelative(remoteDir, virtualAbsolutePath);
	return encryptRemotePathBelowBaseDir(
		remoteDir,
		relativePath,
		virtualAbsolutePath.endsWith('/'),
		plugin.getSyncEncryptionContext(),
	);
}

export async function encryptContentForRemoteFile(
	virtualPath: string,
	plaintext: ArrayBuffer,
): Promise<ArrayBuffer> {
	const plugin = await usePlugin();
	if (!plugin.settings.encryption.enabled) return plaintext;
	const { rootFileKey } = await plugin.getSyncEncryptionKeys();
	return await encryptFileContent(rootFileKey, virtualPath, plaintext);
}

export async function decryptRemoteFileContent(
	virtualPath: string,
	encryptedContent: ArrayBuffer,
	encryptedFileSize: number,
): Promise<ArrayBuffer> {
	const plugin = await usePlugin();
	if (!plugin.settings.encryption.enabled) return encryptedContent;
	const { rootFileKey } = await plugin.getSyncEncryptionKeys();
	return await decryptFileContent(rootFileKey, virtualPath, encryptedContent, encryptedFileSize);
}

export async function createRemoteFileContentRangedDecrypter(
	virtualPath: string,
	encryptedFileSize: number,
): Promise<RangedFileDecrypter | undefined> {
	const plugin = await usePlugin();
	if (!plugin.settings.encryption.enabled) return undefined;
	const { rootFileKey } = await plugin.getSyncEncryptionKeys();
	return createRangedFileDecrypter(rootFileKey, virtualPath, encryptedFileSize);
}

function getEncryptionPassword(settings: PluginSettings, secretStorage: SecretStorage): string {
	const secretReference = settings.encryption.value.trim();
	if (secretReference === '') throw new Error('Failed to retrieve encryption password!');

	const password = secretStorage.getSecret(secretReference);
	if (!password) throw new Error('Failed to retrieve encryption password!');
	if (password.trim() === '') throw new Error('Failed to retrieve encryption password!');
	return password;
}

async function transformPathSegments(
	segments: Array<string>,
	context: SyncEncryptionContext,
	direction: 'decrypt' | 'encrypt',
): Promise<Array<string>> {
	const { nameKey } = await context.keysPromise;
	return segments.map((segment) =>
		transformPathSegment(segment, nameKey, context.basenameCache, direction),
	);
}

function transformPathSegment(
	segment: string,
	nameKey: Uint8Array,
	cache: SyncEncryptionBasenameCache,
	direction: 'decrypt' | 'encrypt',
): string {
	if (direction === 'encrypt') {
		const cached = cache.decryptedToEncrypted.get(segment);
		if (cached) return cached;

		const encrypted = encryptBasename(nameKey, segment);
		cacheSegmentPair(cache, segment, encrypted);
		return encrypted;
	}

	const cached = cache.encryptedToDecrypted.get(segment);
	if (cached) return cached;

	const decrypted = decryptBasename(nameKey, segment);
	cacheSegmentPair(cache, decrypted, segment);
	return decrypted;
}

function cacheSegmentPair(
	cache: SyncEncryptionBasenameCache,
	decrypted: string,
	encrypted: string,
) {
	cacheLimitedSet(cache.decryptedToEncrypted, decrypted, encrypted);
	cacheLimitedSet(cache.encryptedToDecrypted, encrypted, decrypted);
}

function cacheLimitedSet(map: Map<string, string>, key: string, value: string) {
	if (map.has(key)) return;
	if (map.size >= BASENAME_CACHE_LIMIT) {
		const oldestKey = map.keys().next().value;
		if (oldestKey) map.delete(oldestKey);
	}
	map.set(key, value);
}

function normalizeRelativeDescendantPath(path: string): string {
	const normalized = path.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
	return normalized === ''
		? '/'
		: normalized
				.split('/')
				.map((segment) => segment.normalize('NFC'))
				.join('/');
}
