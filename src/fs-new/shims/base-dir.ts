import type { requestUrl } from 'obsidian';
import type { Ref } from 'synthkernel';
import type { MaybePromise } from '~/types';
import { normalizeBaseDir } from '~/platform/path';
import type { Progress, Stat } from '../interface';
import { RemoteFs } from '../interface';

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

class BaseDirRemoteFs<T extends object> implements RemoteFs<T> {
	constructor(
		private readonly original: RemoteFs<T>,
		private readonly baseDir: string,
	) {
		this.options = original.options;
		this.request = original.request;
	}

	options: T;
	request: typeof requestUrl;

	checkConnection(): MaybePromise<{ success: true } | { success: false; reason: string }> {
		return this.original.checkConnection();
	}

	getUid(): string {
		return `${this.original.getUid()}~${this.baseDir}`;
	}

	read(key: string) {
		return this.original.read(joinUnifiedKey(this.baseDir, key));
	}

	readStream(key: string) {
		return this.original.readStream(joinUnifiedKey(this.baseDir, key));
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

export default function applyBaseDirShim<T extends object>(
	original: RemoteFs<T>,
	baseDir: string,
): RemoteFs<T> {
	const normalizedBaseDir = normalizeBaseDir(baseDir);
	return new BaseDirRemoteFs(original, normalizedBaseDir);
}
