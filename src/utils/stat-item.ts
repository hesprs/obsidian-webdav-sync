import type { Vault } from 'obsidian';
import type { FileStat, WebDAVClient } from 'webdav';
import type { StatModel } from '~/types';
import { localToStatModel, remoteToStatModel } from './to-stat-model';

export async function statWebDAVItem(client: WebDAVClient, path: string) {
	const stat = (await client.stat(path, { details: false })) as FileStat;
	// use dummy here since we've already known the remote dir
	return Object.assign(remoteToStatModel(stat, 'dummy'), { path });
}

export function statVaultItem(vault: Vault, path: string): StatModel | undefined {
	const file = vault.getAbstractFileByPath(path);
	if (!file) return undefined;
	return localToStatModel(file);
}
