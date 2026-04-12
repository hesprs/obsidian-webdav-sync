import type { Vault } from 'obsidian';
import type { FileStat, WebDAVClient } from 'webdav';
import { localToStatModel, remoteToStatModel } from './to-stat-model';

export async function statWebDAVItem(client: WebDAVClient, path: string) {
	const stat = (await client.stat(path, { details: false })) as FileStat;
	return remoteToStatModel(stat, path);
}

export async function statVaultItem(vault: Vault, path: string) {
	const file = await vault.adapter.stat(path);
	if (!file) return undefined;
	return localToStatModel(file, path);
}
