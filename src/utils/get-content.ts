import type { WebDAVClient } from 'webdav';
import { TFolder, type Vault } from 'obsidian';
import { toArrayBuffer, type BinaryLike } from '~/platform/binary';

export async function getLocalContent(vault: Vault, path: string) {
	const file = vault.getFileByPath(path);
	if (!file) throw new Error(`Cannot plan local file content: ${path}`);
	if (file instanceof TFolder) throw new Error(`Cannot read a folder as a file: ${path}`);

	return await vault.readBinary(file);
}

export async function getRemoteContent(webdav: WebDAVClient, path: string) {
	if (path.endsWith('/')) throw new Error(`Cannot read a folder as a file: ${path}`);
	const content = (await webdav.getFileContents(path)) as BinaryLike;
	return toArrayBuffer(content);
}
