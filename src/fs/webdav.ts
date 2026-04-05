import { useSettings } from '~/settings';
import type { OnProgress } from './fs.interface';
import postTraversal from './post-traversal';
import { traverseWebDAV } from './traverse-webdav';

export class RemoteWebDAVFileSystem {
	constructor(private token: string) {}

	async walk(onProgress: OnProgress) {
		const { serverUrl, remoteDir, filterRules, skipLargeFiles } = await useSettings();
		const stats = await traverseWebDAV({
			serverUrl,
			token: this.token,
			remoteBaseDir: remoteDir,
			onProgress,
		});

		return postTraversal(stats, filterRules, skipLargeFiles.bytes);
	}
}
