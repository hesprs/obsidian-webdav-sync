import type { FileStat } from 'webdav';
import { TFile, type TAbstractFile } from 'obsidian';
import type { StatModel } from '~/types';
import { normalizeRemotePathToAbsolute, normalizeVaultPath } from '~/platform/path';

export function remoteToStatModel(from: FileStat, remoteDir: string): StatModel {
	const isDir = from.type === 'directory';
	const path = normalizeRemotePathToAbsolute(remoteDir, from.filename, isDir);
	if (isDir)
		return {
			path,
			isDir,
		};
	else
		return {
			path,
			isDir,
			mtime: new Date(from.lastmod).valueOf(),
			size: from.size,
		};
}

export function localToStatModel(file: TAbstractFile): StatModel {
	const path = normalizeVaultPath(file.path);
	if (file instanceof TFile) {
		return {
			path,
			isDir: false,
			mtime: file.stat.mtime,
			size: file.stat.size,
		};
	} else
		return {
			path,
			isDir: true,
		};
}
