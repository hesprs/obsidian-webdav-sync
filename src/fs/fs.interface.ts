import type { StatModel } from '~/model/stat.model';
import type { MaybePromise } from '~/types';
import type { TraversalProgress, WalkFreshness } from '~/utils/traverse-webdav';

export interface FsWalkResult {
	stat: StatModel;
	ignored: boolean;
}

export interface FsWalkOptions {
	freshness?: WalkFreshness;
	remoteSource?: 'traversal' | 'stored-record';
	onTraversalProgress?: (progress: TraversalProgress) => MaybePromise<void>;
}
