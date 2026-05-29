import type { App } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import { Modal } from 'obsidian';
import { getDirectoryContents } from '~/fs/webdav/api';
import { mkdirsWebDAV } from '~/fs/webdav/utils';
import { normalizeBaseDir, remoteBasename } from '~/platform/path';
import mountWebDAVExplorer from './explorer';

export default class SelectRemoteBaseDirModal extends Modal {
	constructor(
		app: App,
		private readonly plugin: WebDAVSyncPlugin,
		private readonly onConfirm: (path: string) => void,
	) {
		super(app);
	}

	onOpen() {
		const explorer = this.contentEl.createDiv();
		const webdav = this.plugin.webDAVService.createWebDAVClient();

		mountWebDAVExplorer(explorer, {
			fs: {
				ls: async (target) => {
					const token = this.plugin.getToken();
					const items = await getDirectoryContents(
						this.plugin.settings.serverUrl,
						token,
						target,
					);
					return items.map((stat) => ({
						basename: remoteBasename(stat.path),
						isDir: stat.isDir,
						path: stat.path,
					}));
				},
				mkdirs: async (path) => {
					await mkdirsWebDAV(webdav, path);
				},
			},
			onClose: () => {
				this.close();
			},
			onConfirm: (path) => {
				this.onConfirm(normalizeBaseDir(path));
				this.close();
			},
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
