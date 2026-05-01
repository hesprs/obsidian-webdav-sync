import { diff3Merge } from 'node-diff3';

export enum LatestTimestampResolution {
	NoChange,
	UseRemote,
	UseLocal,
}

export type LatestTimestampParams = {
	localMtime: number;
	remoteMtime: number;
	localContent: ArrayBuffer;
	remoteContent: ArrayBuffer;
};

export type LatestTimestampResult =
	| { status: LatestTimestampResolution.NoChange }
	| { status: LatestTimestampResolution.UseRemote; content: ArrayBuffer }
	| { status: LatestTimestampResolution.UseLocal; content: ArrayBuffer };

export function resolveByLatestTimestamp(params: LatestTimestampParams): LatestTimestampResult {
	const { localMtime, remoteMtime, localContent, remoteContent } = params;

	if (remoteMtime === localMtime) return { status: LatestTimestampResolution.NoChange };
	const useRemote = remoteMtime > localMtime;

	if (useRemote) {
		if (localContent !== remoteContent)
			return {
				content: remoteContent,
				status: LatestTimestampResolution.UseRemote,
			};
	} else if (localContent !== remoteContent)
		return {
			content: localContent,
			status: LatestTimestampResolution.UseLocal,
		};
	return { status: LatestTimestampResolution.NoChange };
}

// --- Logic for Intelligent Merge Resolution ---

export type IntelligentMergeParams = {
	localContentText: string;
	remoteContentText: string;
	baseContentText: string;
};

export type IntelligentMergeResult = {
	success: boolean;
	mergedText?: string;
	error?: string; // Generic error message
	isIdentical?: boolean; // Flag if contents were already identical
};

// Helper for diff3Merge logic, adapted from the original class method
function diff3MergeStrings(
	base: string | Array<string>,
	local: string | Array<string>,
	remote: string | Array<string>,
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
	if (localContentText === remoteContentText) return { isIdentical: true, success: true };
	const diff3MergedText = diff3MergeStrings(baseContentText, localContentText, remoteContentText);
	if (diff3MergedText !== false) return { mergedText: diff3MergedText, success: true };
	return { success: false };
}
