import { Notice, Setting } from 'obsidian';
import type { Translate } from '@/modules/I18n';
import type { MaybePromise } from '@/sdk';

export type DevelopmentSettingTranslations = {
	development: string;
	clearRecords: string;
	recordsCleared: string;
	clear: string;
	clearRecordsDescription: string;
	export: string;
	exportLogsDescription: string;
	exportLogsToFile: string;
};

export default function developmentSettings(
	el: HTMLElement,
	ctx: {
		translate: Translate<DevelopmentSettingTranslations>;
		deleteRecordStore: (namespace?: string) => MaybePromise<void>;
		exportLogs: () => Promise<void>;
	},
) {
	const { translate, exportLogs, deleteRecordStore } = ctx;
	new Setting(el).setName(translate('development')).setHeading();

	new Setting(el)
		.setName(translate('clearRecords'))
		.setDesc(translate('clearRecordsDescription'))
		.addButton((button) =>
			button
				.setButtonText(translate('clearRecords'))
				.setWarning()
				.onClick(async () => {
					await deleteRecordStore();
					new Notice(translate('recordsCleared'));
				}),
		);

	new Setting(el)
		.setName(translate('exportLogsToFile'))
		.setDesc(translate('exportLogsDescription'))
		.addButton((button) => {
			button.setButtonText(translate('export')).onClick(exportLogs);
		});
}
