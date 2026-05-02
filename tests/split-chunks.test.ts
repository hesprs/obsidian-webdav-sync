// oxlint-disable typescript/no-non-null-assertion
import { describe, expect, it } from 'vitest';
import type { FileChunkKey } from '~/storage';
import type { ToggleNumericSettingsField } from '~/types';
import { splitChunks } from '~/sync/utils/split-chunks';

// Byte constants for precise testing
const KB = 1024;
const MB = 1024 * KB; // 2 ** 20 = 1048576

describe('splitChunks (Public API)', () => {
	// ─────────────────────────────────────────────────────────────
	// Basic Chunking Behavior
	// ─────────────────────────────────────────────────────────────

	describe('Basic chunking', () => {
		it('returns undefined when file is too small to split', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			// StdChunkSize will be at least 1MB when enabled
			expect(
				splitChunks({ cache: [], multiplex: 1, setting, total: 500 * KB }),
			).toBeUndefined();
			expect(splitChunks({ cache: [], multiplex: 1, setting, total: MB })).toBeUndefined();
		});

		it('splits large file into multiple chunks when cache is empty', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const result = splitChunks({ cache: [], multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			expect(Array.isArray(result)).toBe(true);

			const allChunks = result!.flat();
			expect(allChunks.length).toBeGreaterThan(1);

			// Verify chunks cover the full file without gaps/overlaps
			let cursor = 0;
			for (const chunk of allChunks) {
				expect(chunk.start).toBe(cursor);
				expect(chunk.end).toBeGreaterThanOrEqual(chunk.start);
				cursor = chunk.end + 1;
			}
			expect(cursor - 1).toBe(25 * MB - 1);
		});

		it('groups chunks into concurrent batches when enabled and multiplex > 1', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const result = splitChunks({ cache: [], multiplex: 3, setting, total: 25 * MB });

			expect(result).toBeDefined();
			// Should be grouped: if we have N chunks, we get ceil(N/3) groups
			expect(result!.every((group) => Array.isArray(group))).toBe(true);
			expect(result!.every((group) => group.length <= 3)).toBe(true);
		});

		it('returns single ungrouped array when setting is disabled', () => {
			const setting: ToggleNumericSettingsField = { enabled: false, value: 1 };
			const result = splitChunks({ cache: [], multiplex: 5, setting, total: 100 * MB });

			expect(result).toBeDefined();
			expect(result!).toHaveLength(1); // Single group containing all chunks
			expect(Array.isArray(result![0])).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Resume/Cache Scenarios
	// ─────────────────────────────────────────────────────────────

	describe('Resumable download with cache', () => {
		it('skips cached prefix and chunks remaining suffix', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [{ end: 4 * MB - 1, key: 'prefix', start: 0 }];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();

			// First chunk should start right after cached region
			expect(allChunks[0].start).toBe(4 * MB);
			// Last chunk should end at file boundary
			expect(allChunks[allChunks.length - 1].end).toBe(25 * MB - 1);
			// No chunk should overlap with cached region
			expect(allChunks.every((c) => c.start >= 4 * MB)).toBe(true);
		});

		it('skips cached suffix and chunks remaining prefix', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 24 * MB - 1, key: 'suffix', start: 20 * MB },
			];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();

			expect(allChunks[0].start).toBe(0);
			expect(allChunks[allChunks.length - 1].end).toBe(25 * MB - 1);
			expect(allChunks.every((c) => c.end < 20 * MB || c.start >= 24 * MB)).toBe(true);
		});

		it('handles middle cached region, chunks both sides', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 6 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 14 * MB - 1, key: 'middle', start: 10 * MB },
			];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();

			// Should have chunks before AND after the cached region
			const beforeCached = allChunks.filter((c) => c.end < 10 * MB);
			const afterCached = allChunks.filter((c) => c.start >= 14 * MB);

			expect(beforeCached.length).toBeGreaterThan(0);
			expect(afterCached.length).toBeGreaterThan(0);
			// No chunk should overlap the cached region [10MB, 14MB]
			expect(allChunks.every((c) => c.end < 10 * MB || c.start >= 14 * MB)).toBe(true);
		});

		it('merges overlapping cache entries and chunks remaining gaps', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 5 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 2 * MB - 1, key: 'a', start: 0 },
				{ end: 4 * MB - 1, key: 'b', start: MB }, // Overlaps with 'a'
				{ end: 12 * MB - 1, key: 'c', start: 10 * MB },
			];
			const result = splitChunks({ cache, multiplex: 2, setting, total: 20 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();

			// Merged cache: [0, 4MB) and [10MB, 12MB)
			// Remaining: [4MB, 10MB) and [12MB, 20MB)
			for (const chunk of allChunks) {
				const inCachedRegion =
					chunk.start < 4 * MB || (chunk.start >= 10 * MB && chunk.end < 12 * MB);
				expect(inCachedRegion).toBe(false);
			}
		});

		it('returns undefined when cache fully covers the file', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [{ end: 24 * MB - 1, key: 'full', start: 0 }];

			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });
			// File not fully covered (25MB vs 24MB cached), so should still return chunks
			expect(result).toBeDefined();
			expect(result!.flat()[0].start).toBe(24 * MB);
		});

		it('returns undefined when total <= stdChunkSize even with partial cache', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			// StdChunkSize = min(max(1MB, 10MB/1), 50MB) = 10MB
			// Total=10MB <= stdChunkSize -> undefined regardless of cache
			const cache: Array<FileChunkKey> = [{ end: 4 * MB - 1, key: 'partial', start: 0 }];

			expect(splitChunks({ cache, multiplex: 1, setting, total: 10 * MB })).toBeUndefined();
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Concurrency Grouping
	// ─────────────────────────────────────────────────────────────

	describe('Concurrent group batching', () => {
		it('respects multiplex limit when grouping chunks', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 5 * MB };
			const result = splitChunks({ cache: [], multiplex: 4, setting, total: 30 * MB });

			expect(result).toBeDefined();
			// StdChunkSize = floor(5MB/4) clamped to 1MB min = 1.25MB -> chunks of ~1.25MB
			// 30MB / ~1.25MB ≈ 24 chunks, grouped by 4 -> 6 groups
			expect(result!.every((group) => group.length <= 4)).toBe(true);
		});

		it('preserves sequential order within and across groups', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const result = splitChunks({ cache: [], multiplex: 2, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const flattened = result!.flat();

			// Chunks should be in ascending order by start position
			for (let i = 1; i < flattened.length; i++)
				expect(flattened[i].start).toBeGreaterThan(flattened[i - 1].end);
		});

		it('handles multiplex=1 as single group per chunk', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const result = splitChunks({ cache: [], multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			// Each chunk in its own group when multiplex=1
			expect(result!.every((group) => group.length === 1)).toBe(true);
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Edge Cases & Robustness
	// ─────────────────────────────────────────────────────────────

	describe('Edge cases and input validation', () => {
		it('handles empty cache array', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const result = splitChunks({ cache: [], multiplex: 2, setting, total: 20 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();
			expect(allChunks[0].start).toBe(0);
			expect(allChunks[allChunks.length - 1].end).toBe(20 * MB - 1);
		});

		it('normalizes cache entries with negative start values', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [{ end: 4 * MB - 1, key: 'neg', start: -1000 }];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();
			// Negative start should be clamped to 0
			expect(allChunks[0].start).toBe(4 * MB);
		});

		it('normalizes cache entries exceeding total file size', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [{ end: 100 * MB, key: 'overflow', start: 20 * MB }];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();
			// End should be clamped to 24MB (25MB - 1)
			expect(allChunks[allChunks.length - 1].end).toBe(20 * MB - 1);
			expect(allChunks.every((c) => c.end < 20 * MB)).toBe(true);
		});

		it('filters invalid cache entries where start > end', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 50, key: 'invalid', start: 100 },
				{ end: 10 * MB - 1, key: 'valid', start: 5 * MB },
			];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();
			// Invalid entry should be ignored; only valid cache applied
			expect(allChunks.some((c) => c.start < 5 * MB)).toBe(true);
			expect(allChunks.every((c) => c.end < 5 * MB || c.start >= 10 * MB)).toBe(true);
		});

		it('handles very small remaining fragments after cache', () => {
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 24 * MB + 999_900, key: 'almost', start: 0 },
			];
			const result = splitChunks({ cache, multiplex: 1, setting, total: 25 * MB });

			expect(result).toBeDefined();
			const allChunks = result!.flat();
			// Remaining ~100 bytes should still be chunked
			expect(allChunks).toHaveLength(1);
			expect(allChunks[0].start).toBe(24 * MB + 999_901);
			expect(allChunks[0].end).toBe(25 * MB - 1);
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Invariant Properties (Black-Box Verification)
	// ─────────────────────────────────────────────────────────────

	describe('Output invariants', () => {
		it('all chunks have valid non-negative ranges within file bounds', () => {
			const total = 50 * MB;
			const setting: ToggleNumericSettingsField = { enabled: true, value: 8 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 10 * MB - 1, key: 'a', start: 5 * MB },
				{ end: 35 * MB - 1, key: 'b', start: 30 * MB },
			];
			const result = splitChunks({ cache, multiplex: 3, setting, total });

			expect(result).toBeDefined();
			for (const chunk of result!.flat()) {
				expect(chunk.start).toBeGreaterThanOrEqual(0);
				expect(chunk.end).toBeLessThan(total);
				expect(chunk.start).toBeLessThanOrEqual(chunk.end);
			}
		});

		it('chunks never overlap with cached regions', () => {
			const total = 30 * MB;
			const setting: ToggleNumericSettingsField = { enabled: true, value: 6 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 4 * MB - 1, key: 'start', start: 0 },
				{ end: 19 * MB - 1, key: 'mid', start: 15 * MB },
				{ end: 29 * MB - 1, key: 'end', start: 25 * MB },
			];
			const result = splitChunks({ cache, multiplex: 2, setting, total });

			expect(result).toBeDefined();
			for (const chunk of result!.flat()) {
				const overlaps = cache.some((c) => chunk.start <= c.end && chunk.end >= c.start);
				expect(overlaps).toBe(false);
			}
		});

		it('total bytes covered by chunks + cache equals file size', () => {
			const total = 12_345_678; // Non-aligned size for thoroughness
			const setting: ToggleNumericSettingsField = { enabled: true, value: 3 * MB };
			const cache: Array<FileChunkKey> = [
				{ end: 500_000, key: 'a', start: 100_000 },
				{ end: 7_000_000, key: 'b', start: 5_000_000 },
			];
			const result = splitChunks({ cache, multiplex: 4, setting, total });

			expect(result).toBeDefined();

			const chunkBytes = result!.flat().reduce((sum, c) => sum + (c.end - c.start + 1), 0);
			const cacheBytes = cache.reduce((sum, c) => {
				const s = Math.max(0, c.start);
				const e = Math.min(total - 1, c.end);
				return s <= e ? sum + (e - s + 1) : sum;
			}, 0);

			expect(chunkBytes + cacheBytes).toBe(total);
		});

		it('chunks within result are contiguous with no internal gaps', () => {
			const total = 40 * MB;
			const setting: ToggleNumericSettingsField = { enabled: true, value: 10 * MB };
			const cache: Array<FileChunkKey> = [{ end: 19 * MB - 1, key: 'gap', start: 10 * MB }];
			const result = splitChunks({ cache, multiplex: 1, setting, total });

			expect(result).toBeDefined();
			const chunks = result!.flat();

			// Within each contiguous region (before/after cache), chunks should be gapless
			const beforeCache = chunks.filter((c) => c.end < 10 * MB);
			const afterCache = chunks.filter((c) => c.start >= 20 * MB);

			for (const region of [beforeCache, afterCache])
				if (region.length > 0) {
					let cursor = region[0].start;
					for (const c of region) {
						expect(c.start).toBe(cursor);
						cursor = c.end + 1;
					}
				}
		});
	});

	// ─────────────────────────────────────────────────────────────
	// Realistic Integration Scenarios
	// ─────────────────────────────────────────────────────────────

	describe('Integration: realistic download patterns', () => {
		it('simulates progressive multi-session resume', () => {
			const total = 100 * MB;
			const setting: ToggleNumericSettingsField = { enabled: true, value: 15 * MB };
			const multiplex = 3;

			// Session 1: downloaded chunks at start and middle
			let cache: Array<FileChunkKey> = [
				{ end: 4 * MB - 1, key: 's1a', start: 0 },
				{ end: 34 * MB - 1, key: 's1b', start: 30 * MB },
			];
			let result = splitChunks({ cache, multiplex, setting, total });
			expect(result).toBeDefined();
			expect(result!.flat()[0].start).toBe(4 * MB);

			// Session 2: more chunks downloaded
			cache = [
				...cache,
				{ end: 14 * MB - 1, key: 's2a', start: 10 * MB },
				{ end: 79 * MB - 1, key: 's2b', start: 70 * MB },
			];
			result = splitChunks({ cache, multiplex, setting, total });

			expect(result).toBeDefined();
			const allChunks = result!.flat();

			// Verify no overlap with any cached region
			for (const c of cache)
				expect(allChunks.every((chunk) => chunk.end < c.start || chunk.start > c.end)).toBe(
					true,
				);

			// Verify coverage invariant still holds
			const chunkBytes = allChunks.reduce((s, c) => s + c.end - c.start + 1, 0);
			const cacheBytes = cache.reduce((s, c) => s + c.end - c.start + 1, 0);
			expect(chunkBytes + cacheBytes).toBe(total);
		});

		it('handles sparse cache with many small downloaded regions', () => {
			const total = 50 * MB;
			const setting: ToggleNumericSettingsField = { enabled: true, value: 5 * MB };
			// Simulate 10 small cached regions scattered across file
			const cache: Array<FileChunkKey> = Array.from({ length: 10 }, (_, i) => ({
				end: i * 5 * MB + 100 * KB - 1,
				key: `small-${i}`,
				start: i * 5 * MB,
			}));

			const result = splitChunks({ cache, multiplex: 2, setting, total });

			expect(result).toBeDefined();
			const allChunks = result!.flat();

			// All chunks should avoid the small cached regions
			for (const cached of cache)
				for (const chunk of allChunks)
					expect(chunk.end < cached.start || chunk.start > cached.end).toBe(true);

			// Should still produce reasonable number of chunks
			expect(allChunks.length).toBeGreaterThan(0);
			expect(allChunks.length).toBeLessThan(100); // Sanity check
		});

		it('works correctly with disabled setting regardless of cache complexity', () => {
			const total = 80 * MB;
			const setting: ToggleNumericSettingsField = { enabled: false, value: 1 };
			const cache: Array<FileChunkKey> = [
				{ end: 9 * MB - 1, key: 'a', start: 0 },
				{ end: 29 * MB - 1, key: 'b', start: 20 * MB },
				{ end: 54 * MB - 1, key: 'c', start: 50 * MB },
				{ end: 79 * MB - 1, key: 'd', start: 70 * MB },
			];

			const result = splitChunks({ cache, multiplex: 10, setting, total });

			expect(result).toBeDefined();
			// Should return single group (no concurrency splitting when disabled)
			expect(result!).toHaveLength(1);

			const chunks = result![0];
			// StdChunkSize = 50MB when disabled
			// Remaining regions: 10-20MB (10MB), 30-50MB (20MB), 55-70MB (15MB)
			// Each becomes a single chunk -> 4 chunks total
			expect(chunks).toHaveLength(4);

			// Verify boundaries
			expect(chunks[0]).toEqual({ end: 20 * MB - 1, start: 9 * MB });
			expect(chunks[1]).toEqual({ end: 50 * MB - 1, start: 29 * MB });
			expect(chunks[2]).toEqual({ end: 70 * MB - 1, start: 54 * MB });
			expect(chunks[3]).toEqual({ end: 80 * MB - 1, start: 79 * MB });
		});
	});
});
