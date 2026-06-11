import type { App } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import { Modal } from 'obsidian';
import mountWebDAVExplorer from '~/components/explorer';
import { normalizeBaseDir } from '~/platform/path';
import { createWebdavFs } from '~/utils/fs-factory';

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
		const webdav = createWebdavFs(this.plugin, false);

		mountWebDAVExplorer(explorer, {
			fs: webdav,
			onClose: this.close.bind(this),
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
