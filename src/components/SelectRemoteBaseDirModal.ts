import { App, Modal } from 'obsidian';
import { mount as mountWebDAVExplorer } from '~/explorer';
import { getDirectoryContents } from '~/api';
import { fileStatToStatModel } from '~/utils/file-stat-to-stat-model';
import { mkdirsWebDAV } from '~/utils/mkdirs-webdav';
import { stdRemotePath } from '~/utils/std-remote-path';
import WebDAVSyncPlugin from '..';

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

		const webdav = await this.plugin.webDAVService.createWebDAVClient();

		mountWebDAVExplorer(explorer, {
			fs: {
				ls: async (target) => {
					const token = await this.plugin.getToken();
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
				await Promise.resolve(this.onConfirm(stdRemotePath(path)));
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
