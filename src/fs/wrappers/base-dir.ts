import type { Ref } from 'synthkernel';
import type { MaybePromise } from '~/types';
import { normalizeBaseDir } from '~/utils/path';
import type { Progress, RemoteFs, RemoteFsWrapper, Stat, WrappedRemoteFs } from '../interface';

function joinUnifiedKey(baseDir: string, key: string) {
	const joined = `${baseDir}${key}`;
	return joined.endsWith('//') ? joined.slice(0, -1) : joined;
}

function stripBaseDir(baseDir: string, stat: Stat): Stat {
	const originalKey = stat.key;
	if (!originalKey.startsWith(baseDir))
		throw new Error(`Accessed out-of-scope path ${originalKey}`);
	const key = originalKey.slice(baseDir.length);
	return { ...stat, key: key === '' ? '/' : key };
}

function stripBaseDirFromStats(baseDir: string, stats: Array<Stat>) {
	return stats.map((stat) => stripBaseDir(baseDir, stat)).filter((stat) => stat.key !== '/');
}

class BaseDirRemoteFs implements WrappedRemoteFs {
	constructor(
		public readonly original: RemoteFs | WrappedRemoteFs,
		private readonly baseDir: string,
	) {}

	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }> {
		return this.original.checkConnection();
	}

	getUid(): string {
		return `${this.original.getUid()}~${this.baseDir}`;
	}

	read(key: string, size?: number) {
		return this.original.read(joinUnifiedKey(this.baseDir, key), size);
	}

	readStream(key: string, size?: number) {
		return this.original.readStream(joinUnifiedKey(this.baseDir, key), size);
	}

	write(key: string, value: ArrayBuffer) {
		return this.original.write(joinUnifiedKey(this.baseDir, key), value);
	}

	delete(key: string) {
		return this.original.delete(joinUnifiedKey(this.baseDir, key));
	}

	mkdir(key: string, recursive?: boolean) {
		return this.original.mkdir(joinUnifiedKey(this.baseDir, key), recursive);
	}

	async stat(key: string) {
		return Promise.resolve(this.original.stat(joinUnifiedKey(this.baseDir, key))).then((stat) =>
			stripBaseDir(this.baseDir, stat),
		);
	}

	exists(key: string): MaybePromise<boolean> {
		return this.original.exists(joinUnifiedKey(this.baseDir, key));
	}

	async list(key: string) {
		return Promise.resolve(this.original.list(joinUnifiedKey(this.baseDir, key))).then(
			(stats) => stripBaseDirFromStats(this.baseDir, stats),
		);
	}

	async listAll(key: string, progress?: Ref<Progress>) {
		return Promise.resolve(
			this.original.listAll(joinUnifiedKey(this.baseDir, key), progress),
		).then((stats) => stripBaseDirFromStats(this.baseDir, stats));
	}
}

function baseDirWrapper(original: RemoteFs, baseDir: string): WrappedRemoteFs {
	const normalizedBaseDir = normalizeBaseDir(baseDir);
	return new BaseDirRemoteFs(original, normalizedBaseDir);
}

export default baseDirWrapper satisfies RemoteFsWrapper<string>;
