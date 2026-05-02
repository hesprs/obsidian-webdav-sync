import type { FileChunkKey } from '~/storage';
import type { ToggleNumericSettingsField } from '~/types';
import { chunk } from '~/utils/fns';

type Fragment = {
	start: number;
	length: number;
};

type Range = {
	start: number;
	end: number;
};

function splitStartEnd(total: number, stdChunkSize: number, start = 0): Array<Range> {
	const count = Math.ceil(total / stdChunkSize);
	const chunkSize = Math.ceil(total / count);
	const result: Array<Range> = [];
	for (let i = 0; i < total; i += chunkSize)
		result.push({ end: Math.min(total, i + chunkSize) - 1 + start, start: i + start });
	return result;
}

export function getStdChunkSize(
	chunkSetting: ToggleNumericSettingsField,
	multiplex: number,
): number {
	return chunkSetting.enabled
		? Math.min(Math.max(2 ** 20, Math.floor(chunkSetting.value / multiplex)), 50 * 2 ** 20)
		: 50 * 2 ** 20;
}

function getRemainingFragments(
	totalSize: number,
	rangesToRemove: Array<FileChunkKey>,
): Array<Fragment> {
	if (totalSize <= 0) return [];

	// 1. Normalize, sort, and merge ranges in one pass
	const merged = rangesToRemove
		.map((r) => ({ end: Math.min(totalSize - 1, r.end), start: Math.max(0, r.start) }))
		.filter((r) => r.start <= r.end)
		.sort((a, b) => a.start - b.start)
		.reduce<Array<Range>>((acc, curr) => {
			const last = acc[acc.length - 1];
			if (last && curr.start <= last.end + 1) last.end = Math.max(last.end, curr.end);
			else acc.push({ ...curr });
			return acc;
		}, []);
	const fragments: Array<Fragment> = [];
	let cursor = 0;
	for (const { start, end } of merged) {
		if (start > cursor) fragments.push({ length: start - cursor, start: cursor });
		cursor = Math.max(cursor, end + 1);
	}
	if (cursor < totalSize) fragments.push({ length: totalSize - cursor, start: cursor });
	return fragments;
}

export function splitChunks({
	total,
	setting,
	multiplex,
	cache,
	chunkSize,
}: {
	total: number;
	setting: ToggleNumericSettingsField;
	multiplex: number;
	cache: Array<FileChunkKey>;
	chunkSize?: number;
}): Array<Array<Range>> | undefined {
	const stdChunkSize = chunkSize ?? getStdChunkSize(setting, multiplex);
	if (total <= stdChunkSize) return;
	const chunks: Array<Range> = [];
	getRemainingFragments(total, cache).forEach(({ start, length }) => {
		chunks.push(...splitStartEnd(length, stdChunkSize, start));
	});
	return setting.enabled ? chunk(chunks, multiplex) : [chunks];
}
