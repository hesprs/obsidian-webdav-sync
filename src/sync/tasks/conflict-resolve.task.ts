import type { ConflictTaskOptions } from '~/sync/decision/sync-decision.interface';
import i18n from '~/i18n';
import { arrayBufferEquals, toArrayBuffer } from '~/platform/binary';
import { isMergeablePath } from '~/sync/utils/is-mergeable-path';
import logger from '~/utils/logger';
import { mergeDigIn } from '~/utils/merge-dig-in';
import {
	LatestTimestampResolution,
	resolveByIntelligentMerge,
	resolveByLatestTimestamp,
} from '../utils/merge';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export enum ConflictStrategy {
	DiffMatchPatch = 'diff-match-patch',
	LatestTimeStamp = 'latest-timestamp',
	Skip = 'skip',
}

export default class ConflictResolveTask extends BaseTask {
	constructor(public readonly options: BaseTaskOptions & ConflictTaskOptions) {
		super(options);
	}

	private assertConflictMtime(mtime: number | undefined, path: string) {
		if (mtime === undefined) {
			throw new Error('missing planned mtime for conflict: ' + path);
		}
		return mtime;
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
			await this.syncRecord.upsertSyncedFileFromLocalSnapshot({
				localPath: this.localPath,
				remotePath: this.remotePath,
				localStat,
				baseText,
			});
			return;
		}

		await this.syncRecord.upsertSyncedFileFromRemoteSnapshot({
			localPath: this.localPath,
			remotePath: this.remotePath,
			remoteStat,
			baseText,
		});
	}

	private async updateMergedRecord(params: {
		mergedText: string;
		localStat: ConflictTaskOptions['local']['stat'];
		remoteStat: ConflictTaskOptions['remote']['stat'];
	}) {
		const mergedBytes = new TextEncoder().encode(params.mergedText);
		const localMtime = this.assertConflictMtime(params.localStat.mtime, this.localPath);
		const remoteMtime = this.assertConflictMtime(params.remoteStat.mtime, this.remotePath);
		await this.syncRecord.upsertMergedConflictFromSyntheticSnapshot({
			localPath: this.localPath,
			remotePath: this.remotePath,
			mtime: Math.max(localMtime, remoteMtime),
			size: mergedBytes.byteLength,
			baseText: params.mergedText,
		});
	}

	async exec() {
		try {
			const snapshots = await this.getConflictSnapshots();

			switch (this.options.strategy) {
				case ConflictStrategy.DiffMatchPatch:
					return await this.execIntelligentMerge(snapshots);
				case ConflictStrategy.LatestTimeStamp:
					return await this.execLatestTimeStamp(snapshots);
				case ConflictStrategy.Skip:
					return { success: true, skipRecord: true } as const;
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

	async execIntelligentMerge({
		localStat,
		remoteStat,
		localBuffer,
		remoteBuffer,
	}: Awaited<ReturnType<ConflictResolveTask['getConflictSnapshots']>>) {
		try {
			if (arrayBufferEquals(localBuffer, remoteBuffer)) {
				await this.updateMergedRecord({
					mergedText: await this.toText(localBuffer),
					localStat,
					remoteStat,
				});
				return { success: true } as const;
			}

			if (!this.isMergeableConflict()) {
				throw new Error(i18n.t('sync.error.mergeNotSupported'));
			}

			const localText = await this.toText(localBuffer);
			const remoteText = await this.toText(remoteBuffer);
			const baseText = this.options.record?.baseText ?? localText;

			const mergeResult = await resolveByIntelligentMerge({
				localContentText: localText,
				remoteContentText: remoteText,
				baseContentText: baseText,
			});

			if (!mergeResult.success) {
				const mergeDigInResult = mergeDigIn(localText, baseText, remoteText, {
					stringSeparator: '\n',
					useGitStyle: this.options.useGitStyle,
				});
				const mergedText = mergeDigInResult.result.join('\n');

				const putResult = await this.webdav.putFileContents(this.remotePath, mergedText, {
					overwrite: true,
				});

				if (!putResult) {
					throw new Error(i18n.t('sync.error.failedToUploadMerged'));
				}

				await this.writeLocalBuffer(new TextEncoder().encode(mergedText).buffer);
				await this.updateMergedRecord({ mergedText, localStat, remoteStat });
				return { success: true } as const;
			}

			if (mergeResult.isIdentical) {
				await this.updateMergedRecord({
					mergedText: localText,
					localStat,
					remoteStat,
				});
				return { success: true } as const;
			}

			const mergedText = mergeResult.mergedText as string;

			if (mergedText !== remoteText) {
				const putResult = await this.webdav.putFileContents(this.remotePath, mergedText, {
					overwrite: true,
				});

				if (!putResult) {
					throw new Error(i18n.t('sync.error.failedToUploadMerged'));
				}
			}

			if (localText !== mergedText) {
				await this.writeLocalBuffer(new TextEncoder().encode(mergedText).buffer);
			}

			await this.updateMergedRecord({ mergedText, localStat, remoteStat });
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to resolve conflict for ${this.localPath} by smart merging`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
