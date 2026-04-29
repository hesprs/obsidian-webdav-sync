import { describe, expect, it } from 'vitest';
import { arrayBufferEquals } from '~/platform/binary';
import {
	LatestTimestampResolution,
	resolveByIntelligentMerge,
	resolveByLatestTimestamp,
	type IntelligentMergeParams,
	type LatestTimestampParams,
} from '~/sync/utils/merge';
import { mergeDigIn } from '~/utils/merge-dig-in';

function textToArrayBuffer(value: string): ArrayBuffer {
	return new TextEncoder().encode(value).buffer;
}

describe('resolveByLatestTimestamp', () => {
	// --- 无更改 ---
	it('情况 1.1: 时间戳相同，应无更改', () => {
		const params: LatestTimestampParams = {
			localMtime: 1000,
			remoteMtime: 1000,
			localContent: textToArrayBuffer('abc'),
			remoteContent: textToArrayBuffer('abc'),
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.NoChange);
	});

	it('情况 1.2: 远程较新但内容相同，应无更改', () => {
		const sharedContent = textToArrayBuffer('abc');
		const params: LatestTimestampParams = {
			localMtime: 1000,
			remoteMtime: 1001,
			localContent: sharedContent,
			remoteContent: sharedContent,
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.NoChange);
	});

	it('情况 1.3: 本地较新但内容相同，应无更改', () => {
		const sharedContent = textToArrayBuffer('abc');
		const params: LatestTimestampParams = {
			localMtime: 1001,
			remoteMtime: 1000,
			localContent: sharedContent,
			remoteContent: sharedContent,
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.NoChange);
	});

	// --- 使用远程版本 ---
	it('情况 2.1: 远程较新且内容不同，应使用远程版本', () => {
		const params: LatestTimestampParams = {
			localMtime: 1000,
			remoteMtime: 1001,
			localContent: textToArrayBuffer('abc'),
			remoteContent: textToArrayBuffer('abcd'),
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.UseRemote);
		if (result.status === LatestTimestampResolution.UseRemote) {
			expect(arrayBufferEquals(result.content, textToArrayBuffer('abcd'))).toBe(true);
		}
	});

	it('情况 2.2: 远程较新，Buffer 内容不同，应使用远程版本', () => {
		const params: LatestTimestampParams = {
			localMtime: 1000,
			remoteMtime: 1001,
			localContent: textToArrayBuffer('binarydata1'),
			remoteContent: textToArrayBuffer('binarydata2'),
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.UseRemote);
		if (result.status === LatestTimestampResolution.UseRemote) {
			expect(arrayBufferEquals(result.content, textToArrayBuffer('binarydata2'))).toBe(true);
		}
	});

	// --- 使用本地版本 ---
	it('情况 3.1: 本地较新且内容不同，应使用本地版本', () => {
		const params: LatestTimestampParams = {
			localMtime: 1001,
			remoteMtime: 1000,
			localContent: textToArrayBuffer('xyz'),
			remoteContent: textToArrayBuffer('xy'),
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.UseLocal);
		if (result.status === LatestTimestampResolution.UseLocal) {
			expect(arrayBufferEquals(result.content, textToArrayBuffer('xyz'))).toBe(true);
		}
	});

	it('情况 3.2: 本地较新，Buffer 内容不同，应使用本地版本', () => {
		const params: LatestTimestampParams = {
			localMtime: 1001,
			remoteMtime: 1000,
			localContent: textToArrayBuffer('localbinary'),
			remoteContent: textToArrayBuffer('remotebinary'),
		};
		const result = resolveByLatestTimestamp(params);
		expect(result.status).toBe(LatestTimestampResolution.UseLocal);
		if (result.status === LatestTimestampResolution.UseLocal) {
			expect(arrayBufferEquals(result.content, textToArrayBuffer('localbinary'))).toBe(true);
		}
	});
});

describe('resolveByIntelligentMerge', () => {
	it('returns success for non-conflicting edits', () => {
		const params: IntelligentMergeParams = {
			baseContentText: 'a\nb',
			localContentText: 'a\nb\nc',
			remoteContentText: 'a\nb',
		};
		const result = resolveByIntelligentMerge(params);
		expect(result.success).toBe(true);
		expect(result.mergedText).toBe('a\nb\nc');
	});

	it('returns failure on node-diff3 conflict', () => {
		const params: IntelligentMergeParams = {
			baseContentText: 'shared line',
			localContentText: 'local line',
			remoteContentText: 'remote line',
		};
		const result = resolveByIntelligentMerge(params);
		expect(result.success).toBe(false);
	});
});

describe('mergeDigIn', () => {
	it('formats node-diff3 conflicts directly', () => {
		const result = mergeDigIn('local line', 'shared line', 'remote line', {
			stringSeparator: '\n',
			useGitStyle: true,
		});

		expect(result.conflict).toBe(true);
		expect(result.result.join('\n')).toContain('<<<<<<<');
	});
});
