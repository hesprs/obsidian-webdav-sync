import { expect, test } from 'bun:test';
import type { IntelligentMergeParams, LatestTimestampParams } from '~/sync/utils/merge';
import { arrayBufferEquals } from '~/platform/binary';
import {
	LatestTimestampResolution,
	resolveByIntelligentMerge,
	resolveByLatestTimestamp,
} from '~/sync/utils/merge';
import mergeDigIn from '~/utils/merge-dig-in';

function textToArrayBuffer(value: string): ArrayBuffer {
	return new TextEncoder().encode(value).buffer;
}

test('returns no change when timestamps are equal', () => {
	const params: LatestTimestampParams = {
		localContent: textToArrayBuffer('abc'),
		localMtime: 1000,
		remoteContent: textToArrayBuffer('abc'),
		remoteMtime: 1000,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.NoChange);
});

test('returns no change when remote content matches and is newer', () => {
	const sharedContent = textToArrayBuffer('abc');
	const params: LatestTimestampParams = {
		localContent: sharedContent,
		localMtime: 1000,
		remoteContent: sharedContent,
		remoteMtime: 1001,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.NoChange);
});

test('returns no change when local content matches and is newer', () => {
	const sharedContent = textToArrayBuffer('abc');
	const params: LatestTimestampParams = {
		localContent: sharedContent,
		localMtime: 1001,
		remoteContent: sharedContent,
		remoteMtime: 1000,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.NoChange);
});

test('uses remote version when remote is newer and content differs', () => {
	const params: LatestTimestampParams = {
		localContent: textToArrayBuffer('abc'),
		localMtime: 1000,
		remoteContent: textToArrayBuffer('abcd'),
		remoteMtime: 1001,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.UseRemote);
	if (result.status === LatestTimestampResolution.UseRemote)
		expect(arrayBufferEquals(result.content, textToArrayBuffer('abcd'))).toBe(true);
});

test('uses remote version when remote binary content differs', () => {
	const params: LatestTimestampParams = {
		localContent: textToArrayBuffer('binarydata1'),
		localMtime: 1000,
		remoteContent: textToArrayBuffer('binarydata2'),
		remoteMtime: 1001,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.UseRemote);
	if (result.status === LatestTimestampResolution.UseRemote)
		expect(arrayBufferEquals(result.content, textToArrayBuffer('binarydata2'))).toBe(true);
});

test('uses local version when local is newer and content differs', () => {
	const params: LatestTimestampParams = {
		localContent: textToArrayBuffer('xyz'),
		localMtime: 1001,
		remoteContent: textToArrayBuffer('xy'),
		remoteMtime: 1000,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.UseLocal);
	if (result.status === LatestTimestampResolution.UseLocal)
		expect(arrayBufferEquals(result.content, textToArrayBuffer('xyz'))).toBe(true);
});

test('uses local version when local binary content differs', () => {
	const params: LatestTimestampParams = {
		localContent: textToArrayBuffer('localbinary'),
		localMtime: 1001,
		remoteContent: textToArrayBuffer('remotebinary'),
		remoteMtime: 1000,
	};
	const result = resolveByLatestTimestamp(params);
	expect(result.status).toBe(LatestTimestampResolution.UseLocal);
	if (result.status === LatestTimestampResolution.UseLocal)
		expect(arrayBufferEquals(result.content, textToArrayBuffer('localbinary'))).toBe(true);
});

test('returns success for non-conflicting edits', () => {
	const params: IntelligentMergeParams = {
		baseContentText: 'a\nb',
		localContentText: 'a\nb\nc',
		remoteContentText: 'a\nb',
	};
	const result = resolveByIntelligentMerge(params);
	expect(result.success).toBe(true);
	expect(result.mergedText).toBe('a\nb\nc');
});

test('returns failure for node-diff3 conflict', () => {
	const params: IntelligentMergeParams = {
		baseContentText: 'shared line',
		localContentText: 'local line',
		remoteContentText: 'remote line',
	};
	const result = resolveByIntelligentMerge(params);
	expect(result.success).toBe(false);
});

test('formats node-diff3 conflicts directly', () => {
	const result = mergeDigIn('local line', 'shared line', 'remote line', {
		stringSeparator: '\n',
		useGitStyle: true,
	});

	expect(result.conflict).toBe(true);
	expect(result.result.join('\n')).toContain('<<<<<<<');
});
