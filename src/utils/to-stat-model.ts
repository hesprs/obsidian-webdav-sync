import type { FileStat } from 'webdav';
import { type Stat } from 'obsidian';
import type { StatModel } from '~/types';

export function remoteToStatModel(from: FileStat, path: string): StatModel {
	const isDir = from.type === 'directory';
	if (isDir) return { path, isDir };
	else return { path, isDir, mtime: new Date(from.lastmod).valueOf(), size: from.size };
}

export function localToStatModel(file: Stat, path: string): StatModel {
	if (file.type === 'file') {
		return { path, isDir: false, mtime: file.mtime, size: file.size };
	} else return { path, isDir: true };
}
