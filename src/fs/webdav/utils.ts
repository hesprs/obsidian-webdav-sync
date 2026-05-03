import type { WebDAVClient } from 'webdav';
import type { BinaryLike } from '~/platform/binary';
import type { StatModel } from '~/types';
import { toArrayBuffer } from '~/platform/binary';
import type { FileStat } from './api';

export async function statItem(client: WebDAVClient, path: string, statPath = path) {
	const stat = (await client.stat(path, { details: false })) as FileStat;
	return toStatModel(stat, statPath);
}

export function toStatModel(from: FileStat, path: string): StatModel {
	const isDir = from.type === 'directory';
	return isDir
		? { isDir, path }
		: { isDir, mtime: new Date(from.lastmod).valueOf(), path, size: from.size };
}

export async function getContent(webdav: WebDAVClient, path: string) {
	if (path.endsWith('/')) throw new Error(`Cannot read a folder as a file: ${path}`);
	const content = (await webdav.getFileContents(path)) as BinaryLike;
	return toArrayBuffer(content);
}

export function mkdirsWebDAV(client: WebDAVClient, path: string) {
	return client.createDirectory(path, {
		recursive: true,
	});
}
