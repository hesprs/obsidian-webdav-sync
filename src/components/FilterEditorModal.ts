import type WebDAVSyncPlugin from '~';
import { Modal, Setting } from 'obsidian';
import type { GlobMatchOptions } from '~/settings';
import t from '~/i18n';

enum FilterType {
	Include = 'include',
	Exclude = 'exclude',
}

export default class FilterEditorModal extends Modal {
	static readonly FilterType = FilterType;

	filters: Array<GlobMatchOptions>;

	constructor(
		plugin: WebDAVSyncPlugin,
		private readonly onSave: (filters: Array<GlobMatchOptions>) => void,
		private readonly filterType: FilterType = FilterType.Exclude,
		filters: Array<GlobMatchOptions> = [],
	) {
		super(plugin.app);
		this.filters = structuredClone(filters);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		const titleKey =
			this.filterType === FilterType.Include
				? 'settings.filters.include.name'
				: 'settings.filters.exclude.name';
		const descKey =
			this.filterType === FilterType.Include
				? 'settings.filters.include.desc'
				: 'settings.filters.exclude.desc';

		contentEl.createEl('h2', { text: t(titleKey) });
		contentEl.createEl('p', {
			cls: 'setting-item-description',
			text: t(descKey),
		});

		const listContainer = contentEl.createDiv({
			cls: 'flex flex-col gap-2 pb-2',
		});

		const updateList = () => {
			listContainer.empty();
			this.filters.forEach((filter, index) => {
				const itemContainer = listContainer.createDiv({
					cls: 'flex gap-2',
				});
				const input = listContainer.createEl('input', {
					cls: 'flex-1',
					placeholder: t('settings.filters.placeholder'),
					type: 'text',
					value: filter.expr,
				});
				input.spellcheck = false;
				input.addEventListener('input', () => {
					filter.expr = input.value;
					this.filters[index] = filter;
				});
				const forceCaseBtn = listContainer.createEl('button', {
					cls: 'shadow-none!',
					text: 'Aa',
				});
				function updateButtonStatus() {
					const activeCls = ['bg-[var(--interactive-accent)]!'];
					const inactiveCls = ['background-none!', 'hover:bg-[--interactive-normal]!'];
					if (filter.options.caseSensitive) {
						forceCaseBtn.classList.add(...activeCls);
						forceCaseBtn.classList.remove(...inactiveCls);
					} else {
						forceCaseBtn.classList.remove(...activeCls);
						forceCaseBtn.classList.add(...inactiveCls);
					}
				}
				updateButtonStatus();
				forceCaseBtn.addEventListener('click', () => {
					filter.options.caseSensitive = !filter.options.caseSensitive;
					updateButtonStatus();
				});
				const trash = listContainer.createEl('button', {
					text: t('settings.filters.remove'),
				});
				let confirmDelete = false;
				trash.addEventListener('click', () => {
					if (!confirmDelete) {
						confirmDelete = true;
						trash.setText(t('settings.filters.confirmRemove'));
						trash.addClass('mod-warning');
					} else {
						this.filters.splice(index, 1);
						updateList();
					}
				});
				trash.addEventListener('blur', () => {
					confirmDelete = false;
					trash.setText(t('settings.filters.remove'));
					trash.removeClass('mod-warning');
				});
				itemContainer.appendChild(input);
				itemContainer.appendChild(forceCaseBtn);
				itemContainer.appendChild(trash);
			});
		};

		updateList();

		new Setting(contentEl).addButton((button) => {
			button.setButtonText(t('settings.filters.add')).onClick(() => {
				this.filters.push({
					expr: '',
					options: {
						caseSensitive: false,
					},
				});
				updateList();
			});
		});

		new Setting(contentEl)
			.addButton((button) => {
				button
					.setButtonText(t('settings.filters.save'))
					.setCta()
					.onClick(() => {
						this.onSave(this.filters);
						this.close();
					});
			})
			.addButton((button) => {
				button.setButtonText(t('settings.filters.cancel')).onClick(() => {
					this.close();
				});
			});
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
