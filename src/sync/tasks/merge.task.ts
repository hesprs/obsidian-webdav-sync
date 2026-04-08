import type { MergeTaskOptions } from '~/sync/decision/sync-decision.interface';
import type { StatModel } from '~/types';
import i18n from '~/i18n';
import { arrayBufferEquals, arrayBufferToText, toArrayBuffer } from '~/platform/binary';
import { isMergeablePath } from '~/sync/utils/is-mergeable-path';
import logger from '~/utils/logger';
import { mergeDigIn } from '~/utils/merge-dig-in';
import { statVaultItem, statWebDAVItem } from '~/utils/stat-item';
import { resolveByIntelligentMerge } from '../utils/merge';
import { BaseTask, type BaseTaskOptions, toTaskError } from './task.interface';

export enum ConflictStrategy {
	DiffMatchPatch = 'diffMatchPatch',
	LatestTimeStamp = 'latestTimestamp',
	KeepLocal = 'keepLocal',
	KeepRemote = 'keepRemote',
	Skip = 'skip',
}

export default class MergeTask extends BaseTask {
	constructor(public readonly options: BaseTaskOptions & MergeTaskOptions) {
		super(options);
	}
	readonly name = 'merge';

	private async getConflictSnapshots() {
		const local = this.options.local?.stat;
		const remote = this.options.remote?.stat;
		if (!local || local.isDir) {
			throw new Error('missing local file snapshot for merge: ' + this.localPath);
		}
		if (!remote || remote.isDir) {
			throw new Error('missing remote file snapshot for merge: ' + this.remotePath);
		}

		const localContent = this.options.local?.content;
		const remoteContent = this.options.remote?.content;
		if (!localContent) {
			throw new Error('missing local content snapshot for merge: ' + this.localPath);
		}
		if (!remoteContent) {
			throw new Error('missing remote content snapshot for merge: ' + this.remotePath);
		}

		return {
			local,
			remote,
			localBuffer: await toArrayBuffer(localContent),
			remoteBuffer: await toArrayBuffer(remoteContent),
		};
	}

	private isMergeableConflict() {
		return isMergeablePath(this.localPath) && isMergeablePath(this.remotePath);
	}

	async exec() {
		try {
			return await this.execIntelligentMerge(await this.getConflictSnapshots());
		} catch (e) {
			logger.error(`Failed to resolve conflict: ${this.localPath}`, e);
			return {
				success: false,
				error: toTaskError(e, this),
			};
		}
	}

	async execIntelligentMerge({
		local,
		remote,
		localBuffer,
		remoteBuffer,
	}: Awaited<ReturnType<MergeTask['getConflictSnapshots']>>) {
		try {
			if (arrayBufferEquals(localBuffer, remoteBuffer)) {
				await this.syncRecord.upsertRecords({
					baseText: await arrayBufferToText(localBuffer),
					local,
					remote,
					key: this.localPath,
				});
				return { success: true } as const;
			}

			if (!this.isMergeableConflict()) {
				throw new Error(i18n.t('sync.error.mergeNotSupported'));
			}

			const localText = await arrayBufferToText(localBuffer);
			const remoteText = await arrayBufferToText(remoteBuffer);
			const baseText = (await this.syncRecord.getBaseText(this.localPath)) ?? localText;
			let mergedText: string;
			const mergeResult = resolveByIntelligentMerge({
				localContentText: localText,
				remoteContentText: remoteText,
				baseContentText: baseText,
			});

			if (mergeResult.isIdentical) {
				await this.syncRecord.upsertRecords({
					baseText: localText,
					local,
					remote,
					key: this.localPath,
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

			let newRemote: StatModel | undefined;
			let newLocal: StatModel | undefined;
			if (mergedText !== remoteText) {
				const putResult = await this.webdav.putFileContents(this.remotePath, mergedText, {
					overwrite: true,
				});
				if (!putResult) throw new Error(i18n.t('sync.error.failedToUploadMerged'));
				const fetchedRemoteStat = await statWebDAVItem(this.webdav, this.remotePath);
				if (!fetchedRemoteStat || fetchedRemoteStat.isDir)
					throw new Error(
						`failed to read remote file stat after intelligent merge: ${this.localPath}`,
					);
				newRemote = fetchedRemoteStat;
			}
			if (localText !== mergedText) {
				await this.vault.adapter.writeBinary(
					this.localPath,
					new TextEncoder().encode(mergedText).buffer,
				);
				const fetchedLocalStat = statVaultItem(this.vault, this.localPath);
				if (!fetchedLocalStat || fetchedLocalStat.isDir)
					throw new Error(
						`failed to read local file stat after intelligent merge: ${this.localPath}`,
					);
				newLocal = fetchedLocalStat;
			}

			await this.syncRecord.upsertRecords({
				baseText: mergedText,
				local: newLocal ?? local,
				remote: newRemote ?? remote,
				key: this.localPath,
			});
			return { success: true } as const;
		} catch (e) {
			logger.error(`Failed to resolve conflict for ${this.localPath} by smart merging`, e);
			return { success: false, error: toTaskError(e, this) };
		}
	}
}
