import type { WebDAVClient } from 'webdav';
import { type Vault } from 'obsidian';
import { toArrayBuffer, type BinaryLike } from '~/platform/binary';

export async function getLocalContent(vault: Vault, path: string) {
	return vault.adapter.readBinary(path);
}

export async function getRemoteContent(webdav: WebDAVClient, path: string) {
	if (path.endsWith('/')) throw new Error(`Cannot read a folder as a file: ${path}`);
	const content = (await webdav.getFileContents(path)) as BinaryLike;
	return toArrayBuffer(content);
}
