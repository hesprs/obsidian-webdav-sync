import { App, Modal } from 'obsidian';
import WebDAVSyncPlugin from '~';
import { getDirectoryContents } from '~/api';
import { mkdirsWebDAV } from '~/fs/webdav/utils';
import { normalizeBaseDir, normalizePathToAbsolute, remoteBasename } from '~/platform/path';
import { mount as mountWebDAVExplorer } from './explorer';

export default class SelectRemoteBaseDirModal extends Modal {
	constructor(
		app: App,
		private plugin: WebDAVSyncPlugin,
		private onConfirm: (path: string) => void,
	) {
		super(app);
	}

	onOpen() {
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
					return items.map((fileStat) => {
						const isDir = fileStat.type === 'directory';
						const path = normalizePathToAbsolute(
							this.plugin.settings.remoteDir,
							fileStat.filename,
							isDir,
						);
						return { path, isDir, basename: remoteBasename(path) };
					});
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
