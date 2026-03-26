import { parse as bytesParse } from 'bytes-iec';
import { isNil } from 'lodash-es';
import { Notice, Setting, TextComponent } from 'obsidian';
import i18n from '~/i18n';
import { isNumeric } from '~/utils/is-numeric';
import BaseSettings from './settings.base';

const MAX_FILE_SIZE = '500MB';
const MAX_BYTES = bytesParse(MAX_FILE_SIZE, { mode: 'jedec' }) ?? 524288000;

export default class ControlsSettings extends BaseSettings {
	async display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(i18n.t('settings.sections.control')).setHeading();

		new Setting(this.containerEl)
			.setName(i18n.t('settings.skipLargeFiles.name'))
			.setDesc(i18n.t('settings.skipLargeFiles.desc'))
			.addText((text) => {
				const currentValue = this.plugin.settings.skipLargeFiles.maxSize.trim();
				text.setPlaceholder(i18n.t('settings.skipLargeFiles.placeholder')).setValue(
					currentValue,
				);

				text.inputEl.addEventListener('blur', () => {
					void this.handleMaxFileSizeBlur(text);
				});
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.realtimeSyncDelay.name'))
			.setDesc(i18n.t('settings.realtimeSyncDelay.desc'))
			.addText((text) => {
				const currentValue = (this.plugin.settings.realtimeSyncDelay / 1000).toString();
				text.setPlaceholder(i18n.t('settings.realtimeSyncDelay.placeholder')).setValue(
					currentValue,
				);
				text.inputEl.addEventListener('blur', async () => {
					const _interval = text.getValue();
					const interval = parseFloat(_interval) * 1000;
					const ori = this.plugin.settings.realtimeSyncDelay;
					if (isNaN(interval) || interval < 0) {
						new Notice(i18n.t('settings.realtimeSyncDelay.invalidValue'));
						text.setValue((ori / 1000).toString());
						return;
					}
					if (interval !== ori) {
						this.plugin.settings.realtimeSyncDelay = interval;
						void this.plugin.saveSettings();
					}
				});
			});
	}

	private async handleMaxFileSizeBlur(component: TextComponent) {
		let value = component.getValue().trim();
		if (!value) value = MAX_FILE_SIZE;
		else if (isNumeric(value) || (isNil(bytesParse(value)) && !isNil(bytesParse(value + 'B'))))
			value += 'B';
		const parsedBytes = bytesParse(value, { mode: 'jedec' });
		if (parsedBytes === null) {
			new Notice(i18n.t('settings.skipLargeFiles.invalidFormat'));
			component.setValue(this.plugin.settings.skipLargeFiles.maxSize);
			return;
		}
		if (parsedBytes > MAX_BYTES) {
			new Notice(i18n.t('settings.skipLargeFiles.exceedsMaxSize'));
			value = MAX_FILE_SIZE;
		}
		component.setValue(value);
		if (this.plugin.settings.skipLargeFiles.maxSize !== value) {
			this.plugin.settings.skipLargeFiles.maxSize = value;
			await this.plugin.saveSettings();
		}
	}
}
