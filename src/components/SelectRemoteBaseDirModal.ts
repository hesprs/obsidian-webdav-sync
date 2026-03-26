import { App, Modal } from 'obsidian';
import { getDirectoryContents } from '~/api';
import { normalizeRemoteDir } from '~/platform/path/remote-path';
import { fileStatToStatModel } from '~/utils/file-stat-to-stat-model';
import { mkdirsWebDAV } from '~/utils/mkdirs-webdav';
import WebDAVSyncPlugin from '..';
import { mount as mountWebDAVExplorer } from './explorer';

export default class SelectRemoteBaseDirModal extends Modal {
	constructor(
		app: App,
		private plugin: WebDAVSyncPlugin,
		private onConfirm: (path: string) => void,
	) {
		super(app);
	}

	async onOpen() {
		const { contentEl } = this;

		const explorer = document.createElement('div');
		contentEl.appendChild(explorer);

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
					return items.map(fileStatToStatModel);
				},
				mkdirs: async (path) => {
					await mkdirsWebDAV(webdav, path);
				},
			},
			onClose: () => {
				explorer.remove();
				this.close();
			},
			onConfirm: async (path) => {
				await Promise.resolve(this.onConfirm(normalizeRemoteDir(path)));
				explorer.remove();
				this.close();
			},
		});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
