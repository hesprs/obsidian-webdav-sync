import { Setting } from 'obsidian';
import FilterEditorModal from '~/components/FilterEditorModal';
import t from '~/i18n';
import BaseSettings from './settings.base';

export default class FilterSettings extends BaseSettings {
	display() {
		this.containerEl.empty();
		new Setting(this.containerEl).setName(t('settings.sections.filters')).setHeading();

		// Inclusion
		new Setting(this.containerEl)
			.setName(t('settings.filters.include.name'))
			.setDesc(t('settings.filters.include.desc'))
			.addButton((button) => {
				button.setButtonText(t('settings.filters.edit')).onClick(() => {
					new FilterEditorModal(
						this.plugin,
						(filters) => {
							this.plugin.settings.filterRules.inclusionRules = filters;
							this.display();
							void this.plugin.saveSettings();
						},
						FilterEditorModal.FilterType.Include,
						this.plugin.settings.filterRules.inclusionRules,
					).open();
				});
			});

		// Exclusion
		new Setting(this.containerEl)
			.setName(t('settings.filters.exclude.name'))
			.setDesc(t('settings.filters.exclude.desc'))
			.addButton((button) => {
				button.setButtonText(t('settings.filters.edit')).onClick(() => {
					new FilterEditorModal(
						this.plugin,
						(filters) => {
							this.plugin.settings.filterRules.exclusionRules = filters;
							this.display();
							void this.plugin.saveSettings();
						},
						FilterEditorModal.FilterType.Exclude,
						this.plugin.settings.filterRules.exclusionRules,
					).open();
				});
			});
	}
}
