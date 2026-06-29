import type {
	RemoteFsEntry,
	RemoteFsWrapperEntry,
	SelectFromContext,
	Settings,
	Translate,
	Translations,
} from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import baseDirWrapper from './base-dir';
import WebdavFs from './webdav/fs';

type I18nMap = Webdav['i18n'] & Translations;

export default class Webdav {
	private readonly cleanup: Array<() => void> = [];

	constructor(
		private readonly ctx: SelectFromContext<{
			translate: Translate<I18nMap>;
			registerRemoteFs: (id: string, entry: RemoteFsEntry) => () => void;
			app: App;
			registerRemoteFsWrapper: (entry: RemoteFsWrapperEntry) => () => boolean;
		}>,
	) {
		if (!this.moduleSettings.baseDirectory)
			this.moduleSettings.baseDirectory = `${ctx.app.vault.getName()}/`;
	}

	moduleSettings = {
		baseDirectory: '',
		depthInfinity: false,
		endpoint: '',
		password: '',
		username: '',
	};

	declare settings: Settings;

	i18n = { webdav: 'WebDAV' };

	readonly start = () => {
		const {
			translate,
			registerRemoteFs,
			app: { secretStorage },
			registerRemoteFsWrapper,
		} = this.ctx;
		this.cleanup.push(
			registerRemoteFs('webdav', {
				instantiate: () => {
					const {
						endpoint,
						username,
						password: pwd,
						depthInfinity: useInfinity,
					} = this.moduleSettings;
					const password = secretStorage.getSecret(pwd);
					if (password === null || !endpoint)
						throw new Error('Please configure WebDAV account!');
					return new WebdavFs({ endpoint, password, useInfinity, username });
				},
				prettyName: translate('webdav'),
			}),
			registerRemoteFsWrapper({
				apply: (fs) => baseDirWrapper(fs, this.moduleSettings.baseDirectory),
				fsBind: 'webdav',
				order: 6318,
			}),
		);
	};

	readonly dispose = () => {
		this.cleanup.forEach((fn) => fn());
		this.cleanup.length = 0;
	};
}
