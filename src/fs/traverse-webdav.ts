import type { StatsMap } from '~/types';
import { getDirectoryContents } from '~/api';
import { normalizeRemotePathToRelative } from '~/platform/path';
import { useSettings } from '~/settings';
import { apiLimiter } from '~/utils/api-limiter';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import sleep from '~/utils/sleep';
import { remoteToStatModel } from '~/utils/to-stat-model';
import type { OnProgress } from './fs.interface';
import postTraversal from './post-traversal';

interface TraverseWebDAVOptions {
	onProgress?: OnProgress;
	token: string;
}

function isNotFoundError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const errWithRes = err as { res?: { status?: number }; message?: string };
	if (errWithRes.res?.status === 404) return true;
	return typeof errWithRes.message === 'string' && /^404\s*:/.test(errWithRes.message);
}

export async function traverseWebDAV({ onProgress, token }: TraverseWebDAVOptions) {
	const { filterRules, skipLargeFiles, serverUrl, remoteDir } = await useSettings();
	const queue = [remoteDir];
	const result: StatsMap = new Map();
	let processedCount = 0;
	const getContentFunc = (path: string) =>
		apiLimiter.wrap(getDirectoryContents)(serverUrl, token, path);

	const getContent = async (path: string) => {
		let retryCount = 0;
		while (true) {
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

	const reportProgress = async (current: string) => {
		processedCount++;
		await onProgress?.({
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
					const resultItems = (await getContent(currentPath)).map((stat) =>
						remoteToStatModel(stat, remoteDir),
					);

					for (const item of resultItems) {
						const vaultPath = normalizeRemotePathToRelative(remoteDir, item.path);
						result.set(vaultPath, item);
						if (item.isDir) queue.push(item.path);
					}
					void reportProgress(currentPath);
				} catch (err) {
					logger.error(`Error processing ${currentPath}`, err);
					if (isNotFoundError(err)) {
						void reportProgress(currentPath);
						return;
					}
					throw err;
				}
			}),
		);
	}
	return postTraversal(result, filterRules, skipLargeFiles.bytes);
}
