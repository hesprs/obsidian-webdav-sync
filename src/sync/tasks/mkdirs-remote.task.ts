import logger from '~/utils/logger';
import { statWebDAVItem } from '~/utils/stat-item';
import type { PlannedPathSnapshot } from '../decision/sync-decision.interface';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

interface MkdirsRemoteTaskOptions extends BaseTaskOptions {
	local?: PlannedPathSnapshot['local'];
	remote?: PlannedPathSnapshot['remote'];
	// Additional paths that will be created along with the main path
	additionalPaths: PlannedPathSnapshot[];
}

/**
 * Task to create multiple directories in one operation.
 * Uses recursive: true so creating the deepest path will create all parents.
 * Stores all paths for sync record updates.
 */
export default class MkdirsRemoteTask extends BaseTask {
	readonly additionalPaths: PlannedPathSnapshot[];

	constructor(options: MkdirsRemoteTaskOptions) {
		super(options);
		this.additionalPaths = options.additionalPaths;
	}
	readonly name = 'createRemoteDirs';

	async exec() {
		try {
			await this.webdav.createDirectory(this.remotePath, {
				recursive: true,
			});

			for (const pathSnapshot of this.getAllPaths()) {
				const remote = await statWebDAVItem(this.webdav, pathSnapshot.remotePath);
				const local = pathSnapshot.local?.stat;
				if (!remote || !remote.isDir || !local)
					throw new Error(
						`failed to read remote directory stat after creation: ${pathSnapshot.remotePath}`,
					);
				await this.syncRecord.upsertRecords({
					key: pathSnapshot.localPath,
					local,
					remote,
				});
			}

			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to create remote directory recursively: ${this.remotePath}`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}

	/**
	 * Get all directory paths that will be created by this task
	 */
	getAllPaths(): PlannedPathSnapshot[] {
		const options = this.options as MkdirsRemoteTaskOptions;
		return [
			{
				localPath: this.localPath,
				remotePath: this.remotePath,
				local: options.local,
				remote: options.remote,
			},
			...this.additionalPaths,
		];
	}
}
