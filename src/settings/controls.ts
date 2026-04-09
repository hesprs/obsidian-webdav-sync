import { parse as bytesParse } from 'bytes-iec';
import { isNil } from 'lodash-es';
import { Notice, Setting, TextComponent } from 'obsidian';
import i18n from '~/i18n';
import { apiLimiter } from '~/utils/api-limiter';
import { isNumeric } from '~/utils/is-numeric';
import BaseSettings from './settings.base';

const MAX_FILE_SIZE = '500MB';
const MAX_BYTES = bytesParse(MAX_FILE_SIZE, { mode: 'jedec' }) ?? 524288000;

export default class ControlsSettings extends BaseSettings {
	display() {
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

				text.inputEl.addEventListener('blur', () => void this.handleMaxFileSizeBlur(text));
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.realtimeSyncDelay.name'))
			.setDesc(i18n.t('settings.realtimeSyncDelay.desc'))
			.addText((text) => {
				const currentValue = (this.plugin.settings.realtimeSyncDelay / 1000).toString();
				text.setPlaceholder(i18n.t('settings.realtimeSyncDelay.placeholder')).setValue(
					currentValue,
				);
				text.inputEl.addEventListener(
					'blur',
					() => void this.handleRealtimeSyncDelayBlur(text),
				);
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.maxConcurrentWebDAVCalls.name'))
			.setDesc(i18n.t('settings.maxConcurrentWebDAVCalls.desc'))
			.addText((text) => {
				const currentValue = this.plugin.settings.maxConcurrentWebDAVCalls.toString();
				text.setPlaceholder(
					i18n.t('settings.maxConcurrentWebDAVCalls.placeholder'),
				).setValue(currentValue);
				text.inputEl.addEventListener(
					'blur',
					() =>
						void this.handleNumericBlur(text, 'maxConcurrentWebDAVCalls', (max) =>
							apiLimiter.setMaxConcurrent(max),
						),
				);
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.maxConcurrentSyncTasks.name'))
			.setDesc(i18n.t('settings.maxConcurrentSyncTasks.desc'))
			.addText((text) => {
				const currentValue = this.plugin.settings.maxConcurrentSyncTasks.toString();
				text.setPlaceholder(i18n.t('settings.maxConcurrentSyncTasks.placeholder')).setValue(
					currentValue,
				);
				text.inputEl.addEventListener(
					'blur',
					() => void this.handleNumericBlur(text, 'maxConcurrentSyncTasks'),
				);
			});

		new Setting(this.containerEl)
			.setName(i18n.t('settings.minTimeBetweenWebDAVCalls.name'))
			.setDesc(i18n.t('settings.minTimeBetweenWebDAVCalls.desc'))
			.addText((text) => {
				const currentValue = this.plugin.settings.minTimeBetweenWebDAVCalls.toString();
				text.setPlaceholder(
					i18n.t('settings.minTimeBetweenWebDAVCalls.placeholder'),
				).setValue(currentValue);
				text.inputEl.addEventListener(
					'blur',
					() =>
						void this.handleNumericBlur(text, 'minTimeBetweenWebDAVCalls', (interval) =>
							apiLimiter.setMinTime(interval),
						),
				);
			});
	}

	private async handleRealtimeSyncDelayBlur(component: TextComponent) {
		const rawInterval = component.getValue();
		const interval = parseFloat(rawInterval) * 1000;
		const original = this.plugin.settings.realtimeSyncDelay;
		if (isNaN(interval) || interval < 0) {
			new Notice(i18n.t('settings.realtimeSyncDelay.invalidValue'));
			component.setValue((original / 1000).toString());
			return;
		}

		if (interval !== original) {
			this.plugin.settings.realtimeSyncDelay = interval;
			await this.plugin.saveSettings();
		}
	}

	private async handleNumericBlur(
		component: TextComponent,
		field: 'maxConcurrentWebDAVCalls' | 'minTimeBetweenWebDAVCalls' | 'maxConcurrentSyncTasks',
		callback?: (interval: number) => void,
	) {
		const rawInterval = component.getValue();
		const interval = parseInt(rawInterval);
		const original = this.plugin.settings[field];
		if (isNaN(interval) || interval < 0) {
			new Notice(i18n.t(`settings.${field}.invalidValue`));
			component.setValue(original.toString());
			return;
		}
		component.setValue(interval.toString());

		if (interval !== original) {
			this.plugin.settings[field] = interval;
			callback?.(interval);
			await this.plugin.saveSettings();
		}
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
			this.plugin.settings.skipLargeFiles = {
				maxSize: value,
				bytes: parsedBytes,
			};
			await this.plugin.saveSettings();
		}
	}
}
