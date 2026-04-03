import type { MaybePromise } from '~/types';
import type { TraversalProgress } from '~/utils/traverse-webdav';

export interface FsWalkOptions {
	onTraversalProgress?: (progress: TraversalProgress) => MaybePromise<void>;
}
