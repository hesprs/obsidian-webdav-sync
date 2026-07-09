import type WebDAVSyncPlugin from '~';
import { getStatWithEtag } from '~/fs/webdav/api';
import { normalizePathToAbsolute } from '~/platform/path';
import { resolveRemoteExecutionPath } from '~/utils/encryption';

export type RemoteUidStat = {
	isDir: boolean;
	mtime?: number;
	size?: number;
	etag?: string;
};

export async function getRemoteUidStat(
	plugin: WebDAVSyncPlugin,
	path: string,
): Promise<RemoteUidStat> {
	const virtualPath = normalizePathToAbsolute(
		plugin.settings.remoteDir,
		path,
		path.endsWith('/'),
	);
	const executionPath = await resolveRemoteExecutionPath(virtualPath);
	const { stat, etag } = await getStatWithEtag(
		plugin.settings.serverUrl,
		plugin.getToken(),
		executionPath,
		plugin.settings.customHeaders,
	);

	if (stat.isDir) return { isDir: true };

	return {
		etag,
		isDir: false,
		mtime: stat.mtime,
		size: stat.size,
	};
}
