import type { StatsMap } from '~/types';
import { getDirectoryContents } from '~/api';
import { remotePathToAbsolute, remotePathToVault } from '~/platform/path';
import { apiLimiter } from '~/utils/api-limiter';
import { fileStatToStatModel } from '~/utils/file-stat-to-stat-model';
import { isRetryableError } from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import sleep from '~/utils/sleep';
import type { OnProgress } from './fs.interface';

interface TraverseWebDAVOptions {
	onProgress?: OnProgress;
	serverUrl: string;
	token: string;
	remoteBaseDir: string;
}

function isNotFoundError(err: unknown): boolean {
	if (!err || typeof err !== 'object') return false;
	const errWithRes = err as { res?: { status?: number }; message?: string };
	if (errWithRes.res?.status === 404) return true;
	return typeof errWithRes.message === 'string' && /^404\s*:/.test(errWithRes.message);
}

export async function traverseWebDAV({
	onProgress,
	serverUrl,
	token,
	remoteBaseDir,
}: TraverseWebDAVOptions) {
	const queue = [remoteBaseDir];
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
					const resultItems = (await getContent(currentPath)).map(fileStatToStatModel);

					for (const item of resultItems) {
						const vaultPath = remotePathToVault(remoteBaseDir, item.path);
						const absolutePath = remotePathToAbsolute(remoteBaseDir, item);
						result.set(vaultPath, { ...item, path: absolutePath });
						if (item.isDir) queue.push(absolutePath);
					}

					processedCount++;
					void reportProgress(currentPath);
				} catch (err) {
					logger.error(`Error processing ${currentPath}`, err);
					if (isNotFoundError(err)) {
						processedCount++;
						await reportProgress(currentPath);
						return;
					}
					throw err;
				}
			}),
		);
	}
	return result;
}
