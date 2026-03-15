import type { StatModel } from '~/model/stat.model';
import type { WalkFreshness } from '~/utils/traverse-webdav';
import type { MaybePromise } from '~/utils/types';

export interface FsWalkResult {
	stat: StatModel;
	ignored: boolean;
}

export interface FsWalkOptions {
	freshness?: WalkFreshness;
}

export default abstract class AbstractFileSystem {
	abstract walk(options?: FsWalkOptions): MaybePromise<FsWalkResult[]>;
}
