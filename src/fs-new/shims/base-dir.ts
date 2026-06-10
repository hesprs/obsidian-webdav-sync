import type { requestUrl } from 'obsidian';
import type { Ref } from 'synthkernel';
import type { MaybePromise } from '~/types';
import { normalizeBaseDir, splitRemotePathAtBaseDir } from '~/platform/path';
import type { Progress, Stat } from '../interface';
import { RemoteFs } from '../interface';

function splitUnifiedKey(key: string) {
	if (key === '/') return { descendantSegments: [] as Array<string>, isDir: true };
	const isDir = key.endsWith('/');
	const trimmed = key.replace(/^\/+/, '').replace(/\/+$/, '');
	return {
		descendantSegments: trimmed === '' ? [] : trimmed.split('/'),
		isDir,
	};
}

function joinUnifiedKey(baseDir: string, key: string) {
	const { descendantSegments, isDir } = splitUnifiedKey(key);
	if (baseDir === '/')
		return descendantSegments.length === 0
			? '/'
			: `${descendantSegments.join('/')}${isDir ? '/' : ''}`;

	const baseSegments = baseDir.replace(/^\/+/, '').replace(/\/+$/, '').split('/');
	if (descendantSegments.length === 0) return `${baseSegments.join('/')}/`;
	return `${[...baseSegments, ...descendantSegments].join('/')}${isDir ? '/' : ''}`;
}

function stripBaseDir(baseDir: string, stat: Stat): Stat {
	const { descendantSegments, isDir } = splitRemotePathAtBaseDir(baseDir, stat.key);
	const key =
		descendantSegments.length === 0
			? '/'
			: `${descendantSegments.join('/')}${isDir ? '/' : ''}`;
	return { ...stat, key };
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
