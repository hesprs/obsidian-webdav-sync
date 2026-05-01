import type { StatsMap } from '~/types';
import { getDirectoryContents } from '~/api';
import { apiLimiter } from '~/composable/api-limiter';
import { normalizePathToAbsolute, normalizePathToRelative } from '~/platform/path';
import { useSettings } from '~/settings';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import sleep from '~/utils/sleep';
import type { OnProgress } from '../fs.interface';
import postTraversal from '../post-traversal';
import { toStatModel } from './utils';

interface TraverseWebDAVOptions {
	onProgress?: OnProgress;
	throwIfCancelled?: () => void;
	token: string;
}

function isNotFoundError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const errWithRes = err as { res?: { status?: number }; message?: string };
	if (errWithRes.res?.status === 404) return true;
	return typeof errWithRes.message === 'string' && /^404\s*:/.test(errWithRes.message);
}

export async function traverse({ onProgress, token, throwIfCancelled }: TraverseWebDAVOptions) {
	const { filterRules, skipLargeFiles, serverUrl, remoteDir, exhaustiveRemoteTraversal } =
		await useSettings();
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
			} catch (err) {
				if (isRetryableError(err)) await sleep(5_000);
				else throw err;
			}
		}
	};

	if (exhaustiveRemoteTraversal) {
		const resultItems = (await getContent(remoteDir)).map((stat) => {
			const path = normalizePathToAbsolute(
				remoteDir,
				stat.filename,
				stat.type === 'directory',
			);
			return toStatModel(stat, path);
		});
		for (const item of resultItems) {
			const vaultPath = normalizePathToRelative(remoteDir, item.path);
			result.set(vaultPath, item);
		}
		onProgress?.({
			processedDirectories: result.size,
			totalDirectories: result.size,
			currentDirectory: remoteDir,
		});
	} else {
		let processedCount = 0;
		const queue = [remoteDir];
		const reportProgress = (current: string) => {
			throwIfCancelled?.();
			processedCount++;
			onProgress?.({
				processedDirectories: processedCount,
				totalDirectories: processedCount + queue.length,
				currentDirectory: current,
			});
		};

		while (queue.length > 0) {
			const currentLevelPaths = queue.splice(0);

			await Promise.all(
				currentLevelPaths.map(async (currentPath) => {
					try {
						const resultItems = (await getContent(currentPath)).map((stat) => {
							const path = normalizePathToAbsolute(
								remoteDir,
								stat.filename,
								stat.type === 'directory',
							);
							return toStatModel(stat, path);
						});

						for (const item of resultItems) {
							const vaultPath = normalizePathToRelative(remoteDir, item.path);
							result.set(vaultPath, item);
							if (item.isDir) queue.push(item.path);
						}
						reportProgress(currentPath);
					} catch (err) {
						logger.error(`Error processing ${currentPath}`, err);
						if (isNotFoundError(err)) {
							reportProgress(currentPath);
							return;
						}
						throw err;
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
