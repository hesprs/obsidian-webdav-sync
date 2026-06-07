import { expect, test } from 'bun:test';
import type { FileChunkKey } from '~/storage';
import type { ToggleNumericSettingsField } from '~/types';
import { splitChunks } from '~/sync/utils/split-chunks';

const KB = 1024;
const MB = 1024 * KB;

const enabledSetting = (value: number): ToggleNumericSettingsField => ({ enabled: true, value });
const disabledSetting = (value: number): ToggleNumericSettingsField => ({ enabled: false, value });

const definedResult = (result: ReturnType<typeof splitChunks>) => {
	expect(result).toBeDefined();
	return result as NonNullable<ReturnType<typeof splitChunks>>;
};

test('returns undefined for files smaller than the enabled chunk size', () => {
	const setting = enabledSetting(10 * MB);

	expect(splitChunks({ cache: [], multiplex: 1, setting, total: 500 * KB })).toBeUndefined();
	expect(splitChunks({ cache: [], multiplex: 1, setting, total: MB })).toBeUndefined();
});

test('splits a large file into multiple chunks when caching is empty', () => {
	const result = splitChunks({
		cache: [],
		multiplex: 1,
		setting: enabledSetting(10 * MB),
		total: 25 * MB,
	});
	const allChunks = definedResult(result).flat();

	expect(allChunks.length).toBeGreaterThan(1);

	let cursor = 0;
	for (const chunk of allChunks) {
		expect(chunk.start).toBe(cursor);
		expect(chunk.end).toBeGreaterThanOrEqual(chunk.start);
		cursor = chunk.end + 1;
	}
	expect(cursor - 1).toBe(25 * MB - 1);
});

test('groups chunks into batches that respect the multiplex limit', () => {
	const result = splitChunks({
		cache: [],
		multiplex: 3,
		setting: enabledSetting(10 * MB),
		total: 25 * MB,
	});
	const groups = definedResult(result);

	expect(groups.every((group) => Array.isArray(group))).toBe(true);
	expect(groups.every((group) => group.length <= 3)).toBe(true);
});

test('returns a single group when chunk grouping is disabled', () => {
	const result = splitChunks({
		cache: [],
		multiplex: 5,
		setting: disabledSetting(1),
		total: 100 * MB,
	});

	expect(definedResult(result)).toHaveLength(1);
	expect(Array.isArray(definedResult(result)[0])).toBe(true);
});

test('skips a cached prefix and chunks the remaining suffix', () => {
	const cache: Array<FileChunkKey> = [{ end: 4 * MB - 1, key: 'prefix', start: 0 }];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	expect(allChunks[0].start).toBe(4 * MB);
	expect(allChunks[allChunks.length - 1].end).toBe(25 * MB - 1);
	expect(allChunks.every((chunk) => chunk.start >= 4 * MB)).toBe(true);
});

test('skips a cached suffix and chunks the remaining prefix', () => {
	const cache: Array<FileChunkKey> = [{ end: 24 * MB - 1, key: 'suffix', start: 20 * MB }];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	expect(allChunks[0].start).toBe(0);
	expect(allChunks[allChunks.length - 1].end).toBe(25 * MB - 1);
	expect(allChunks.every((chunk) => chunk.end < 20 * MB || chunk.start >= 24 * MB)).toBe(true);
});

test('chunks both sides of a cached middle region', () => {
	const cache: Array<FileChunkKey> = [{ end: 14 * MB - 1, key: 'middle', start: 10 * MB }];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(6 * MB), total: 25 * MB }),
	).flat();

	const beforeCached = allChunks.filter((chunk) => chunk.end < 10 * MB);
	const afterCached = allChunks.filter((chunk) => chunk.start >= 14 * MB);

	expect(beforeCached.length).toBeGreaterThan(0);
	expect(afterCached.length).toBeGreaterThan(0);
	expect(allChunks.every((chunk) => chunk.end < 10 * MB || chunk.start >= 14 * MB)).toBe(true);
});

test('ignores overlapping cache entries and chunks the remaining gaps', () => {
	const cache: Array<FileChunkKey> = [
		{ end: 2 * MB - 1, key: 'a', start: 0 },
		{ end: 4 * MB - 1, key: 'b', start: MB },
		{ end: 12 * MB - 1, key: 'c', start: 10 * MB },
	];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 2, setting: enabledSetting(5 * MB), total: 20 * MB }),
	).flat();

	for (const chunk of allChunks) {
		const inCachedRegion =
			chunk.start < 4 * MB || (chunk.start >= 10 * MB && chunk.end < 12 * MB);
		expect(inCachedRegion).toBe(false);
	}
});

test('returns chunks for a file that is not fully covered by cache', () => {
	const cache: Array<FileChunkKey> = [{ end: 24 * MB - 1, key: 'full', start: 0 }];
	const result = splitChunks({
		cache,
		multiplex: 1,
		setting: enabledSetting(10 * MB),
		total: 25 * MB,
	});

	expect(result).toBeDefined();
	expect(definedResult(result).flat()[0].start).toBe(24 * MB);
});

test('returns undefined when the total size is at or below the standard chunk size', () => {
	const cache: Array<FileChunkKey> = [{ end: 4 * MB - 1, key: 'partial', start: 0 }];

	expect(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 10 * MB }),
	).toBeUndefined();
});

test('keeps each batch within the configured multiplex limit', () => {
	const result = splitChunks({
		cache: [],
		multiplex: 4,
		setting: enabledSetting(5 * MB),
		total: 30 * MB,
	});

	expect(definedResult(result).every((group) => group.length <= 4)).toBe(true);
});

test('preserves chunk order across the flattened result', () => {
	const flattened = definedResult(
		splitChunks({ cache: [], multiplex: 2, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	for (let i = 1; i < flattened.length; i++)
		expect(flattened[i].start).toBeGreaterThan(flattened[i - 1].end);
});

test('puts each chunk in its own group when multiplex is one', () => {
	const result = splitChunks({
		cache: [],
		multiplex: 1,
		setting: enabledSetting(10 * MB),
		total: 25 * MB,
	});

	expect(definedResult(result).every((group) => group.length === 1)).toBe(true);
});

test('handles an empty cache array', () => {
	const allChunks = definedResult(
		splitChunks({ cache: [], multiplex: 2, setting: enabledSetting(10 * MB), total: 20 * MB }),
	).flat();

	expect(allChunks[0].start).toBe(0);
	expect(allChunks[allChunks.length - 1].end).toBe(20 * MB - 1);
});

test('clamps negative cache starts to zero', () => {
	const cache: Array<FileChunkKey> = [{ end: 4 * MB - 1, key: 'neg', start: -1000 }];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	expect(allChunks[0].start).toBe(4 * MB);
});

test('clamps cache entries that extend beyond the file size', () => {
	const cache: Array<FileChunkKey> = [{ end: 100 * MB, key: 'overflow', start: 20 * MB }];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	expect(allChunks[allChunks.length - 1].end).toBe(20 * MB - 1);
	expect(allChunks.every((chunk) => chunk.end < 20 * MB)).toBe(true);
});

test('ignores cache entries where the start is greater than the end', () => {
	const cache: Array<FileChunkKey> = [
		{ end: 50, key: 'invalid', start: 100 },
		{ end: 10 * MB - 1, key: 'valid', start: 5 * MB },
	];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	expect(allChunks.some((chunk) => chunk.start < 5 * MB)).toBe(true);
	expect(allChunks.every((chunk) => chunk.end < 5 * MB || chunk.start >= 10 * MB)).toBe(true);
});

test('chunks very small remaining fragments after cache', () => {
	const cache: Array<FileChunkKey> = [{ end: 24 * MB + 999_900, key: 'almost', start: 0 }];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total: 25 * MB }),
	).flat();

	expect(allChunks).toHaveLength(1);
	expect(allChunks[0].start).toBe(24 * MB + 999_901);
	expect(allChunks[0].end).toBe(25 * MB - 1);
});

test('produces valid chunk ranges within file bounds', () => {
	const total = 50 * MB;
	const cache: Array<FileChunkKey> = [
		{ end: 10 * MB - 1, key: 'a', start: 5 * MB },
		{ end: 35 * MB - 1, key: 'b', start: 30 * MB },
	];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 3, setting: enabledSetting(8 * MB), total }),
	).flat();

	for (const chunk of allChunks) {
		expect(chunk.start).toBeGreaterThanOrEqual(0);
		expect(chunk.end).toBeLessThan(total);
		expect(chunk.start).toBeLessThanOrEqual(chunk.end);
	}
});

test('avoids overlapping cached regions', () => {
	const total = 30 * MB;
	const cache: Array<FileChunkKey> = [
		{ end: 4 * MB - 1, key: 'start', start: 0 },
		{ end: 19 * MB - 1, key: 'mid', start: 15 * MB },
		{ end: 29 * MB - 1, key: 'end', start: 25 * MB },
	];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 2, setting: enabledSetting(6 * MB), total }),
	).flat();

	for (const chunk of allChunks) {
		const overlaps = cache.some(
			(cached) => chunk.start <= cached.end && chunk.end >= cached.start,
		);
		expect(overlaps).toBe(false);
	}
});

test('keeps total coverage equal to the file size', () => {
	const total = 12_345_678;
	const cache: Array<FileChunkKey> = [
		{ end: 500_000, key: 'a', start: 100_000 },
		{ end: 7_000_000, key: 'b', start: 5_000_000 },
	];
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 4, setting: enabledSetting(3 * MB), total }),
	).flat();

	const chunkBytes = allChunks.reduce((sum, chunk) => sum + (chunk.end - chunk.start + 1), 0);
	const cacheBytes = cache.reduce((sum, chunk) => {
		const start = Math.max(0, chunk.start);
		const end = Math.min(total - 1, chunk.end);
		return start <= end ? sum + (end - start + 1) : sum;
	}, 0);

	expect(chunkBytes + cacheBytes).toBe(total);
});

test('keeps chunks contiguous inside each uncovered region', () => {
	const total = 40 * MB;
	const cache: Array<FileChunkKey> = [{ end: 19 * MB - 1, key: 'gap', start: 10 * MB }];
	const chunks = definedResult(
		splitChunks({ cache, multiplex: 1, setting: enabledSetting(10 * MB), total }),
	).flat();

	const beforeCache = chunks.filter((chunk) => chunk.end < 10 * MB);
	const afterCache = chunks.filter((chunk) => chunk.start >= 20 * MB);

	for (const region of [beforeCache, afterCache])
		if (region.length > 0) {
			let cursor = region[0].start;
			for (const chunk of region) {
				expect(chunk.start).toBe(cursor);
				cursor = chunk.end + 1;
			}
		}
});

test('supports progressive multi-session resume patterns', () => {
	const total = 100 * MB;
	const setting = enabledSetting(15 * MB);
	const multiplex = 3;

	let cache: Array<FileChunkKey> = [
		{ end: 4 * MB - 1, key: 's1a', start: 0 },
		{ end: 34 * MB - 1, key: 's1b', start: 30 * MB },
	];
	let result = splitChunks({ cache, multiplex, setting, total });
	expect(definedResult(result).flat()[0].start).toBe(4 * MB);

	cache = [
		...cache,
		{ end: 14 * MB - 1, key: 's2a', start: 10 * MB },
		{ end: 79 * MB - 1, key: 's2b', start: 70 * MB },
	];
	result = splitChunks({ cache, multiplex, setting, total });
	const allChunks = definedResult(result).flat();

	for (const cached of cache)
		expect(
			allChunks.every((chunk) => chunk.end < cached.start || chunk.start > cached.end),
		).toBe(true);

	const chunkBytes = allChunks.reduce((sum, chunk) => sum + chunk.end - chunk.start + 1, 0);
	const cacheBytes = cache.reduce((sum, chunk) => sum + chunk.end - chunk.start + 1, 0);
	expect(chunkBytes + cacheBytes).toBe(total);
});

test('handles a sparse cache of many small downloaded regions', () => {
	const total = 50 * MB;
	const cache: Array<FileChunkKey> = Array.from({ length: 10 }, (_, i) => ({
		end: i * 5 * MB + 100 * KB - 1,
		key: `small-${i}`,
		start: i * 5 * MB,
	}));
	const allChunks = definedResult(
		splitChunks({ cache, multiplex: 2, setting: enabledSetting(5 * MB), total }),
	).flat();

	for (const cached of cache)
		allChunks.forEach((chunk) => {
			expect(chunk.end < cached.start || chunk.start > cached.end).toBe(true);
		});

	expect(allChunks.length).toBeGreaterThan(0);
	expect(allChunks.length).toBeLessThan(100);
});

test('returns a single group when chunking is disabled, regardless of cache complexity', () => {
	const total = 80 * MB;
	const cache: Array<FileChunkKey> = [
		{ end: 9 * MB - 1, key: 'a', start: 0 },
		{ end: 29 * MB - 1, key: 'b', start: 20 * MB },
		{ end: 54 * MB - 1, key: 'c', start: 50 * MB },
		{ end: 79 * MB - 1, key: 'd', start: 70 * MB },
	];
	const result = splitChunks({ cache, multiplex: 10, setting: disabledSetting(1), total });
	const chunks = definedResult(result)[0];

	expect(definedResult(result)).toHaveLength(1);
	expect(chunks).toHaveLength(4);
	expect(chunks[0]).toStrictEqual({ end: 20 * MB - 1, start: 9 * MB });
	expect(chunks[1]).toStrictEqual({ end: 50 * MB - 1, start: 29 * MB });
	expect(chunks[2]).toStrictEqual({ end: 70 * MB - 1, start: 54 * MB });
	expect(chunks[3]).toStrictEqual({ end: 80 * MB - 1, start: 79 * MB });
});
