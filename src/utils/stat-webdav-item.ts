import type { FileStat, WebDAVClient } from 'webdav';
import { fileStatToStatModel } from './file-stat-to-stat-model';

export async function statWebDAVItem(client: WebDAVClient, path: string) {
	const stat = (await client.stat(path, {
		details: false,
	})) as FileStat;
	return { ...fileStatToStatModel(stat), path };
}
