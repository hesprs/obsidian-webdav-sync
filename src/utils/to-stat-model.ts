import type { FileStat } from 'webdav';
import { TFile, type TAbstractFile } from 'obsidian';
import type { StatModel } from '~/types';
import { normalizeRemotePathToAbsolute, normalizeVaultPath } from '~/platform/path';

export function remoteToStatModel(from: FileStat, remoteDir: string): StatModel {
	const isDir = from.type === 'directory';
	return {
		path: normalizeRemotePathToAbsolute(remoteDir, from.filename, isDir),
		isDir,
		mtime: new Date(from.lastmod).valueOf(),
		size: from.size,
	};
}

export function localToStatModel(file: TAbstractFile): StatModel {
	if (file instanceof TFile) {
		return {
			path: normalizeVaultPath(file.path),
			isDir: false,
			mtime: file.stat.mtime,
			size: file.stat.size,
		};
	} else
		return {
			path: normalizeVaultPath(file.path),
			isDir: true,
		};
}
