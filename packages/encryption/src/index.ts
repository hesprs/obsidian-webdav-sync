import type {
	Context,
	ObsidianLanguageCode,
	FsWrapperEntry,
	SelectFromContext,
	SettingEntry,
	TranslationResource,
} from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import type { EncryptionDB } from '@/wrapper';
import encryptionWrapper from '@/wrapper';
import { en, zh, ru, zhTW } from './i18n';
import encryptionSetting from './setting';

export type EncryptionSettings = {
	enabled: boolean;
	password: string;
};

export default class Encryption {
	private readonly cleanup: Array<() => void> = [];

	constructor(
		private readonly ctx: SelectFromContext<{
			registerRemoteFsWrapper: (entry: FsWrapperEntry) => () => void;
			app: App;
			memoryDB: EncryptionDB;
			registerSetting: (entry: SettingEntry) => () => void;
			registerI18n: (locale: ObsidianLanguageCode, resource: TranslationResource) => void;
		}>,
	) {
		ctx.registerI18n('en', en);
		ctx.registerI18n('zh', zh);
		ctx.registerI18n('ru', ru);
		ctx.registerI18n('zh-TW', zhTW);
	}

	moduleSettings: EncryptionSettings = {
		enabled: false,
		password: '',
	};

	readonly start = () => {
		const { app, memoryDB, registerRemoteFsWrapper, registerSetting } = this.ctx;
		this.cleanup.push(
			registerRemoteFsWrapper({
				apply: (fs) => {
					if (!this.moduleSettings.enabled) return;
					const { password: pwd } = this.moduleSettings;
					const password = app.secretStorage.getSecret(pwd);
					if (!password) throw new Error('Please configure encryption password!');
					return encryptionWrapper(fs, { memoryDB, password });
				},
				priority: 7919,
			}),
			registerSetting({
				apply: (el) => encryptionSetting(el, this.ctx as Context, this.moduleSettings),
				priority: 1355,
			}),
		);
	};

	readonly dispose = () => this.cleanup.splice(0).forEach((fn) => fn());
}
