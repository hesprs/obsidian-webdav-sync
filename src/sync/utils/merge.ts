import { diff3Merge } from 'node-diff3';

// --- Logic for Latest Timestamp Resolution ---

export enum LatestTimestampResolution {
	NoChange,
	UseRemote,
	UseLocal,
}

export interface LatestTimestampParams {
	localMtime: number;
	remoteMtime: number;
	localContent: ArrayBuffer;
	remoteContent: ArrayBuffer;
}

export type LatestTimestampResult =
	| { status: LatestTimestampResolution.NoChange }
	| { status: LatestTimestampResolution.UseRemote; content: ArrayBuffer }
	| { status: LatestTimestampResolution.UseLocal; content: ArrayBuffer };

export function resolveByLatestTimestamp(params: LatestTimestampParams): LatestTimestampResult {
	const { localMtime, remoteMtime, localContent, remoteContent } = params;

	if (remoteMtime === localMtime) return { status: LatestTimestampResolution.NoChange };
	const useRemote = remoteMtime > localMtime;

	if (useRemote) {
		// Only return UseRemote if content is actually different
		if (localContent !== remoteContent)
			return {
				status: LatestTimestampResolution.UseRemote,
				content: remoteContent,
			};
		return { status: LatestTimestampResolution.NoChange };
	} else {
		// Local is newer (or same age but remote wasn't newer)
		// Only return UseLocal if content is actually different
		if (localContent !== remoteContent)
			return {
				status: LatestTimestampResolution.UseLocal,
				content: localContent,
			};
		return { status: LatestTimestampResolution.NoChange };
	}
}

// --- Logic for Intelligent Merge Resolution ---

export interface IntelligentMergeParams {
	localContentText: string;
	remoteContentText: string;
	baseContentText: string;
}

export interface IntelligentMergeResult {
	success: boolean;
	mergedText?: string;
	error?: string; // Generic error message
	isIdentical?: boolean; // Flag if contents were already identical
}

// Helper for diff3Merge logic, adapted from the original class method
function diff3MergeStrings(
	base: string | string[],
	local: string | string[],
	remote: string | string[],
): string | false {
	const regions = diff3Merge(local, base, remote, {
		excludeFalseConflicts: true,
		stringSeparator: '\n',
	});

	if (regions.some((region) => !region.ok)) return false;
	return regions.flatMap((region) => region.ok).join('\n');
}

export function resolveByIntelligentMerge(params: IntelligentMergeParams): IntelligentMergeResult {
	const { localContentText, remoteContentText, baseContentText } = params;
	if (localContentText === remoteContentText) return { success: true, isIdentical: true };
	const diff3MergedText = diff3MergeStrings(baseContentText, localContentText, remoteContentText);
	if (diff3MergedText !== false) return { success: true, mergedText: diff3MergedText };
	return { success: false };
}
