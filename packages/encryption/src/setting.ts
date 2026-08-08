import type { EncryptionSettings } from '@';
import type { Context, Fragment, MaybePromise, Translate } from '@hesprs/sync-engine-sdk';
import type { App } from 'obsidian';
import { setNeedMigration } from '@hesprs/sync-engine-sdk';
import { SecretComponent, Setting } from 'obsidian';

export type EncryptionTranslations = {
	encryption: string;
	encryptionDescription: string;
	encryptionMigration: Fragment<'enable' | 'disable'>;
};

export default function encryptionSetting(
	el: HTMLElement,
	ctx: {
		translate: Translate<EncryptionTranslations>;
		app: App;
		saveSettings: () => Promise<void>;
		recordStoreExists: () => MaybePromise<boolean>;
	},
	settings: EncryptionSettings,
) {
	const { translate, app, saveSettings, recordStoreExists } = ctx;

	new Setting(el)
		.setName(translate('encryption'))
		.setDesc(translate('encryptionDescription'))
		.addComponent((element) =>
			new SecretComponent(app, element).setValue(settings.password).onChange((value) => {
				settings.password = value;
				void saveSettings();
			}),
		)
		.addToggle((toggle) =>
			setNeedMigration(ctx as Context, {
				apply: (value) => {
					settings.enabled = value;
					void saveSettings();
				},
				content: (value) => translate('encryptionMigration', value ? 'enable' : 'disable'),
				needMigration: recordStoreExists,
				toggle: toggle.setValue(settings.enabled),
			}),
		);
}
