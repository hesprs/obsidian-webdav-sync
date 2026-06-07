import type { StatsMap } from '~/types';
import apiLimiter from '~/composable/api-limiter';
import { normalizePathToRelative } from '~/platform/path';
import { useSettings } from '~/settings';
import { decryptRemotePathForTraversal } from '~/utils/encryption';
import isRetryableError from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import sleep from '~/utils/sleep';
import type { TraversalProgress } from '../fs.interface';
import postTraversal from '../post-traversal';
import { getDirectoryContents } from './api';

type TraverseWebDAVOptions = {
	onProgress?: (progress: TraversalProgress) => void;
	throwIfCancelled?: () => void;
	token: string;
};

function isNotFoundError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const errWithRes = err as { res?: { status?: number }; message?: string };
	if (errWithRes.res?.status === 404) return true;
	return typeof errWithRes.message === 'string' && /^404\s*:/.test(errWithRes.message);
}

export default async function traverse({
	onProgress,
	token,
	throwIfCancelled,
}: TraverseWebDAVOptions) {
	const { filterRules, skipLargeFiles, serverUrl, remoteDir, exhaustiveRemoteTraversal } =
		await useSettings();
	const encrypted = (await useSettings()).encryption.enabled;
	const result: StatsMap = new Map();

	const getContentFunc = (path: string) =>
		apiLimiter.wrap(getDirectoryContents)(serverUrl, token, path, exhaustiveRemoteTraversal);

	const getContent = async (path: string) => {
		let retryCount = 0;
		while (true) {
			throwIfCancelled?.();
			if (retryCount > 3) throw new Error('Failed to get WebDAV content after 3 retries');
			try {
				retryCount++;
				return await getContentFunc(path);
			} catch (error) {
				if (isRetryableError(error)) await sleep(5000);
				else throw error;
			}
		}
	};

	if (exhaustiveRemoteTraversal) {
		const resultItems = await Promise.all(
			(await getContent(remoteDir)).map(async (stat) => {
				if (encrypted) stat.path = await decryptRemotePathForTraversal(stat.path);
				return stat;
			}),
		);
		for (const item of resultItems) {
			const vaultPath = normalizePathToRelative(remoteDir, item.path);
			result.set(vaultPath, item);
		}
		onProgress?.({
			currentDirectory: remoteDir,
			processedDirectories: result.size,
			totalDirectories: result.size,
		});
	} else {
		let processedCount = 0;
		const queue = [remoteDir];
		const reportProgress = (current: string) => {
			throwIfCancelled?.();
			processedCount++;
			onProgress?.({
				currentDirectory: current,
				processedDirectories: processedCount,
				totalDirectories: processedCount + queue.length,
			});
		};

		while (queue.length > 0) {
			const currentLevelPaths = queue.splice(0);

			await Promise.all(
				currentLevelPaths.map(async (currentPath) => {
					try {
						const resultItems = await Promise.all(
							(await getContent(currentPath)).map(async (stat) => {
								const listingPath = stat.path;
								if (encrypted)
									stat.path = await decryptRemotePathForTraversal(listingPath);
								return { listingPath, statModel: stat };
							}),
						);

						for (const item of resultItems) {
							const vaultPath = normalizePathToRelative(
								remoteDir,
								item.statModel.path,
							);
							result.set(vaultPath, item.statModel);
							if (item.statModel.isDir) queue.push(item.listingPath);
						}
						reportProgress(currentPath);
					} catch (error) {
						logger.error(`Error processing ${currentPath}`, error);
						if (isNotFoundError(error)) {
							reportProgress(currentPath);
							return;
						}
						throw error;
					}
				}),
			);
		}
	}

	return postTraversal(
		result,
		filterRules,
		skipLargeFiles.enabled ? skipLargeFiles.value : undefined,
	);
}
