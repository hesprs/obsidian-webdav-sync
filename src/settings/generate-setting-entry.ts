import { Notice, Setting } from 'obsidian';
import type { ToggleNumericSettingsField } from '~/types';
import t from '~/i18n';
import { formatFileSize, formatTime, parseFileSize, parseTime } from '~/utils/input-converters';

export enum UserInputType {
	Number = 'number',
	Time = 'time',
	FileSize = 'fileSize',
}

const MAX_32BIT_VALUE = 2 ** 31 - 1;

export default function generateSettingEntry({
	container,
	name,
	desc,
	placeholder,
	field,
	type,
	saveSettings,
	rejectZero,
	onChange,
	onToggle,
}: {
	container: HTMLElement;
	name: string;
	desc: string;
	placeholder: string;
	field: ToggleNumericSettingsField;
	type: UserInputType;
	saveSettings: () => Promise<void>;
	rejectZero?: boolean;
	onChange?: (value: number) => void;
	onToggle?: (value: boolean) => void;
}) {
	new Setting(container)
		.setClass('numeric-toggle')
		.setName(name)
		.setDesc(desc)
		.addText((text) => {
			text.setPlaceholder(placeholder).setValue(format(field.value, type));
			text.inputEl.addEventListener('blur', () => {
				const value = parse(text.inputEl.value, type);
				if (
					value === undefined ||
					isNaN(value) ||
					value < 0 ||
					value > MAX_32BIT_VALUE ||
					(rejectZero && value === 0)
				) {
					text.inputEl.value = format(field.value, type);
					new Notice(t('settings.invalidValue'));
					return;
				}
				if (value !== field.value) {
					field.value = value;
					onChange?.(value);
					void saveSettings();
				}
				text.inputEl.value = format(field.value, type);
			});
		})
		.addToggle((toggle) => {
			toggle.setValue(field.enabled);
			toggle.onChange((value) => {
				if (value !== field.enabled) {
					field.enabled = value;
					onToggle?.(value);
					void saveSettings();
				}
			});
		});
}

function format(value: number, type: UserInputType): string {
	switch (type) {
		case UserInputType.Number: {
			return value.toString();
		}
		case UserInputType.Time: {
			return formatTime(value);
		}
		case UserInputType.FileSize: {
			return formatFileSize(value);
		}
	}
}

function parse(value: string, type: UserInputType): number | undefined {
	switch (type) {
		case UserInputType.Number: {
			return parseFloat(value);
		}
		case UserInputType.Time: {
			return parseTime(value);
		}
		case UserInputType.FileSize: {
			return parseFileSize(value);
		}
	}
}
