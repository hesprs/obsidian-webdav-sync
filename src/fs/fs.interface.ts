import type { MaybePromise } from '~/types';

interface TraversalProgress {
	processedDirectories: number;
	totalDirectories: number;
	currentDirectory?: string;
}

export type OnProgress = (progress: TraversalProgress) => MaybePromise<void>;
