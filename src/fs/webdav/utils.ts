import type { FileStat, WebDAVClient } from 'webdav';
import type { StatModel } from '~/types';
import { toArrayBuffer, type BinaryLike } from '~/platform/binary';

export async function statItem(client: WebDAVClient, path: string) {
	const stat = (await client.stat(path, { details: false })) as FileStat;
	return toStatModel(stat, path);
}

export function toStatModel(from: FileStat, path: string): StatModel {
	const isDir = from.type === 'directory';
	if (isDir) return { path, isDir };
	else return { path, isDir, mtime: new Date(from.lastmod).valueOf(), size: from.size };
}

export async function getContent(webdav: WebDAVClient, path: string) {
	if (path.endsWith('/')) throw new Error(`Cannot read a folder as a file: ${path}`);
	const content = (await webdav.getFileContents(path)) as BinaryLike;
	return toArrayBuffer(content);
}
