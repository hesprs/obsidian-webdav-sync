import type { StatModel } from '~/model/stat.model';
import type { ConflictTaskOptions } from '~/sync/decision/sync-decision.interface';
import i18n from '~/i18n';
import { arrayBufferEquals, toArrayBuffer } from '~/platform/binary';
import { isMergeablePath } from '~/sync/utils/is-mergeable-path';
import logger from '~/utils/logger';
import { mergeDigIn } from '~/utils/merge-dig-in';
import { statVaultItem } from '~/utils/stat-vault-item';
import { statWebDAVItem } from '~/utils/stat-webdav-item';
import {
	LatestTimestampResolution,
	resolveByIntelligentMerge,
	resolveByLatestTimestamp,
} from '../utils/merge';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export enum ConflictStrategy {
	DiffMatchPatch = 'diffMatchPatch',
	LatestTimeStamp = 'latestTimestamp',
	KeepLocal = 'keepLocal',
	KeepRemote = 'keepRemote',
	Skip = 'skip',
}

export default class ConflictResolveTask extends BaseTask {
	constructor(public readonly options: BaseTaskOptions & ConflictTaskOptions) {
		super(options);
	}

	private async getConflictSnapshots() {
		const localStat = this.options.local?.stat;
		const remoteStat = this.options.remote?.stat;
		if (!localStat || localStat.isDir) {
			throw new Error('missing local file snapshot for conflict: ' + this.localPath);
		}
		if (!remoteStat || remoteStat.isDir) {
			throw new Error('missing remote file snapshot for conflict: ' + this.remotePath);
		}

		const localContent = this.options.local?.content;
		const remoteContent = this.options.remote?.content;
		if (!localContent) {
			throw new Error('missing local content snapshot for conflict: ' + this.localPath);
		}
		if (!remoteContent) {
			throw new Error('missing remote content snapshot for conflict: ' + this.remotePath);
		}

		return {
			localStat,
			remoteStat,
			localBuffer: await toArrayBuffer(localContent),
			remoteBuffer: await toArrayBuffer(remoteContent),
		};
	}

	private isMergeableConflict() {
		return isMergeablePath(this.localPath) && isMergeablePath(this.remotePath);
	}

	private async toText(content: ArrayBuffer) {
		return await new Blob([new Uint8Array(content)]).text();
	}

	private async writeLocalBuffer(content: ArrayBuffer) {
		await this.vault.adapter.writeBinary(this.localPath, content);
	}

	private async updateLatestTimestampRecord(params: {
		winner: 'local' | 'remote';
		localStat: ConflictTaskOptions['local']['stat'];
		remoteStat: ConflictTaskOptions['remote']['stat'];
		winnerContent: ArrayBuffer;
	}) {
		const { winner, localStat, remoteStat, winnerContent } = params;
		const baseText = this.isMergeableConflict() ? await this.toText(winnerContent) : undefined;

		if (winner === 'local') {
			// no race condition since we've just uploaded it
			const newRemoteStat = await statWebDAVItem(this.webdav, this.remotePath);
			if (!newRemoteStat || newRemoteStat.isDir)
				throw new Error(
					`failed to read remote file stat after timestamp merge: ${this.localPath}`,
				);
			await this.syncRecord.upsertSyncedFileFromSnapshots({
				remotePath: this.remotePath,
				localPath: this.localPath,
				localStat,
				remoteStat: newRemoteStat,
				baseText,
			});
		} else {
			// no race condition since we've just written it
			const newLocalStat = statVaultItem(this.vault, this.localPath);
			if (!newLocalStat || newLocalStat.isDir)
				throw new Error(
					`failed to read remote file stat after timestamp merge: ${this.localPath}`,
				);
			await this.syncRecord.upsertSyncedFileFromSnapshots({
				remotePath: this.remotePath,
				localPath: this.localPath,
				localStat: newLocalStat,
				remoteStat,
				baseText,
			});
		}
	}

	async exec() {
		try {
			const snapshots = await this.getConflictSnapshots();

			switch (this.options.strategy) {
				case ConflictStrategy.DiffMatchPatch:
					return await this.execIntelligentMerge(snapshots);
				case ConflictStrategy.LatestTimeStamp:
					return await this.execLatestTimeStamp(snapshots);
				case ConflictStrategy.KeepLocal:
					return await this.execKeepLocal(snapshots);
				case ConflictStrategy.KeepRemote:
					return await this.execKeepRemote(snapshots);
				case ConflictStrategy.Skip:
					return { success: true } as const;
			}
		} catch (e) {
			logger.error(`Failed to resolve conflict: ${this.localPath}`, e);
			return {
				success: false,
				error: toTaskError(e, this),
			};
		}
	}

	async execLatestTimeStamp({
		localStat,
		remoteStat,
		localBuffer,
		remoteBuffer,
	}: Awaited<ReturnType<ConflictResolveTask['getConflictSnapshots']>>) {
		try {
			const result = resolveByLatestTimestamp({
				localMtime: localStat.mtime,
				remoteMtime: remoteStat.mtime,
				localContent: localBuffer,
				remoteContent: remoteBuffer,
			});

			switch (result.status) {
				case LatestTimestampResolution.UseRemote:
					await this.writeLocalBuffer(result.content);
					await this.updateLatestTimestampRecord({
						winner: 'remote',
						localStat,
						remoteStat,
						winnerContent: remoteBuffer,
					});
					break;
				case LatestTimestampResolution.UseLocal:
					await this.webdav.putFileContents(this.remotePath, result.content, {
						overwrite: true,
					});
					await this.updateLatestTimestampRecord({
						winner: 'local',
						localStat,
						remoteStat,
						winnerContent: localBuffer,
					});
					break;
				case LatestTimestampResolution.NoChange:
					await this.updateLatestTimestampRecord({
						winner: remoteStat.mtime > localStat.mtime ? 'remote' : 'local',
						localStat,
						remoteStat,
						winnerContent:
							remoteStat.mtime > localStat.mtime ? remoteBuffer : localBuffer,
					});
					break;
			}

			return { success: true } as const;
		} catch (e) {
			logger.error(
				`Failed to resolve conflict for ${this.localPath} by latest-survive policy`,
				e,
			);
			return { success: false, error: toTaskError(e, this) };
		}
	}

	async execKeepLocal({
		localStat,
		localBuffer,
	}: Awaited<ReturnType<ConflictResolveTask['getConflictSnapshots']>>) {
		try {
			await this.webdav.putFileContents(this.remotePath, localBuffer, {
				overwrite: true,
			});
			const newRemoteStat = await statWebDAVItem(this.webdav, this.remotePath);
			if (!newRemoteStat || newRemoteStat.isDir)
				throw new Error(
					`failed to read remote file stat after keep-local merge: ${this.localPath}`,
				);

			const baseText = await this.toText(localBuffer);
			await this.syncRecord.upsertSyncedFileFromSnapshots({
				remotePath: this.remotePath,
				localPath: this.localPath,
				localStat,
				remoteStat: newRemoteStat,
				baseText,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(
				`Failed to resolve conflict for ${this.localPath} by keep-local policy`,
				e,
			);
			return { success: false, error: toTaskError(e, this) };
		}
	}

	async execKeepRemote({
		remoteStat,
		remoteBuffer,
	}: Awaited<ReturnType<ConflictResolveTask['getConflictSnapshots']>>) {
		try {
			await this.writeLocalBuffer(remoteBuffer);
			const newLocalStat = statVaultItem(this.vault, this.localPath);
			if (!newLocalStat || newLocalStat.isDir)
				throw new Error(
					`failed to read local file stat after keep-remote merge: ${this.localPath}`,
				);

			const baseText = await this.toText(remoteBuffer);
			await this.syncRecord.upsertSyncedFileFromSnapshots({
				remotePath: this.remotePath,
				localPath: this.localPath,
				localStat: newLocalStat,
				remoteStat,
				baseText,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(
				`Failed to resolve conflict for ${this.localPath} by keep-remote policy`,
				e,
			);
			return { success: false, error: toTaskError(e, this) };
		}
	}

	async execIntelligentMerge({
		localStat,
		remoteStat,
		localBuffer,
		remoteBuffer,
	}: Awaited<ReturnType<ConflictResolveTask['getConflictSnapshots']>>) {
		try {
			if (arrayBufferEquals(localBuffer, remoteBuffer)) {
				await this.syncRecord.upsertSyncedFileFromSnapshots({
					baseText: await this.toText(localBuffer),
					localStat,
					remoteStat,
					remotePath: this.remotePath,
					localPath: this.localPath,
				});
				return { success: true } as const;
			}

			if (!this.isMergeableConflict()) {
				throw new Error(i18n.t('sync.error.mergeNotSupported'));
			}

			const localText = await this.toText(localBuffer);
			const remoteText = await this.toText(remoteBuffer);
			const baseText = this.options.record?.baseText ?? localText;
			let mergedText: string;
			const mergeResult = resolveByIntelligentMerge({
				localContentText: localText,
				remoteContentText: remoteText,
				baseContentText: baseText,
			});

			if (mergeResult.isIdentical) {
				await this.syncRecord.upsertSyncedFileFromSnapshots({
					baseText: localText,
					localStat,
					remoteStat,
					remotePath: this.remotePath,
					localPath: this.localPath,
				});
				return { success: true } as const;
			}

			if (!mergeResult.success) {
				const mergeDigInResult = mergeDigIn(localText, baseText, remoteText, {
					stringSeparator: '\n',
					useGitStyle: this.options.useGitStyle,
				});
				mergedText = mergeDigInResult.result.join('\n');
			} else mergedText = mergeResult.mergedText as string;

			let newRemoteStat: StatModel | undefined;
			let newLocalStat: StatModel | undefined;
			if (mergedText !== remoteText) {
				const putResult = await this.webdav.putFileContents(this.remotePath, mergedText, {
					overwrite: true,
				});
				if (!putResult) throw new Error(i18n.t('sync.error.failedToUploadMerged'));
				// no race condition since we've just uploaded it
				const fetchedRemoteStat = await statWebDAVItem(this.webdav, this.remotePath);
				if (!fetchedRemoteStat || fetchedRemoteStat.isDir)
					throw new Error(
						`failed to read remote file stat after intelligent merge: ${this.localPath}`,
					);
				newRemoteStat = fetchedRemoteStat;
			}
			if (localText !== mergedText) {
				await this.writeLocalBuffer(new TextEncoder().encode(mergedText).buffer);
				const fetchedLocalStat = statVaultItem(this.vault, this.localPath);
				if (!fetchedLocalStat || fetchedLocalStat.isDir)
					throw new Error(
						`failed to read local file stat after intelligent merge: ${this.localPath}`,
					);
				newLocalStat = fetchedLocalStat;
			}

			await this.syncRecord.upsertSyncedFileFromSnapshots({
				baseText: mergedText,
				localStat: newLocalStat ?? localStat,
				remoteStat: newRemoteStat ?? remoteStat,
				remotePath: this.remotePath,
				localPath: this.localPath,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to resolve conflict for ${this.localPath} by smart merging`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
