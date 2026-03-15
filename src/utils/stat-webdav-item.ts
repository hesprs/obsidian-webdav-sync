import type { FileStat, WebDAVClient } from 'webdav';
import { isAbsoluteRemotePath } from '~/platform/path/remote-path';
import { fileStatToStatModel } from './file-stat-to-stat-model';

export async function statWebDAVItem(client: WebDAVClient, path: string) {
	if (!isAbsoluteRemotePath(path)) {
		throw new Error('stat WebDAV item, path must be absolute: ' + path);
	}
	const stat = (await client.stat(path, {
		details: false,
	})) as FileStat;
	return fileStatToStatModel(stat);
}
