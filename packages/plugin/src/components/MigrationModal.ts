import type { Events } from '@';
import type { App, ToggleComponent } from 'obsidian';
import { Modal, Notice, Setting } from 'obsidian';
import type { ExistingMemoryDB } from '@/modules/Bootstrap';
import type { Dispatch, On } from '@/modules/EventBus';
import type { Translate } from '@/modules/I18n';
import type { Infras } from '@/modules/Registrar';
import type { SyncTerminateReason } from '@/modules/Sync';
import type { MaybePromise, Progress } from '@/types';
import renderProgress from '@/components/render-progress';
import roundPercent from '@/utils/round-percent';
import toErrorMessage from '@/utils/to-error-message';

export type MigrationModalTranslations = {
	cancel: string;
	remoteMigration: string;
	migrationProcess: string;
	startMigration: string;
	migrationDescription: string;
	migrationPhase1Description: string;
	migrationPhase2Description: string;
	migrationPhase3Description: string;
	toggleWithoutMigration: string;
	migrationFailed: string;
	completed: string;
	hide: string;
	done: string;
};

type MigrationEvents = {
	migrationProgress: Progress;
	migrationFailed: string;
};

type MigrationContext = {
	app: App;
	on: On<MigrationEvents>;
	dispatch: Dispatch<MigrationEvents & Events>;
	translate: Translate<MigrationModalTranslations>;
	requestSync: (trigger: string) => Promise<SyncTerminateReason>;
	initializeSync: () => Infras;
	memoryDB: ExistingMemoryDB;
};

class MigrationModal extends Modal {
	private readonly cleanupCallbacks: Array<() => void> = [];

	constructor(
		private readonly ctx: MigrationContext,
		private readonly options: {
			content: string | DocumentFragment;
			apply: () => MaybePromise<void>;
		},
	) {
		super(ctx.app);
	}

	onOpen() {
		const {
			contentEl,
			options: { content, apply },
		} = this;
		const { translate } = this.ctx;

		contentEl.empty();
		contentEl.addClass('markdown-rendered');
		this.setTitle(translate('remoteMigration'));

		if (typeof content === 'string')
			contentEl.createEl('p', { cls: 'whitespace-pre-wrap', text: content });
		else contentEl.append(content);
		contentEl.createEl('p', {
			cls: 'whitespace-pre-wrap',
			text: translate('migrationDescription'),
		});

		new Setting(contentEl)
			.addButton((button) =>
				button.setButtonText(translate('cancel')).onClick(this.close.bind(this)),
			)
			.addButton((button) =>
				button.setButtonText(translate('toggleWithoutMigration')).onClick(async () => {
					await apply();
					this.close();
				}),
			)
			.addButton((button) =>
				button
					.setButtonText(translate('startMigration'))
					.setCta()
					.onClick(this.handleMigration),
			);
	}

	private readonly handleMigration = () => {
		const { on, translate, dispatch } = this.ctx;
		this.contentEl.empty();
		this.setTitle(translate('migrationProcess'));
		const { left, right, bar } = renderProgress(this.contentEl, 'mb-3');

		let controls: HTMLElement | undefined;
		const renderControls = (text: 'hide' | 'done') => {
			controls?.remove();
			controls = new Setting(this.contentEl).addButton((button) =>
				button.setButtonText(translate(text)).onClick(this.close.bind(this)),
			).settingEl;
		};
		renderControls('hide');

		this.cleanupCallbacks.push(
			on('migrationProgress', ({ total, completed, current }) => {
				if (completed === 0) dispatch('logGeneral', 'Migration started.');
				const percent = roundPercent(completed, total);
				right.setText(`${completed}/${total} ${translate('completed')}`);
				if (current) left.setText(current);
				bar.setValue(percent);
				if (percent === 100) renderControls('done');
			}),
			on('migrationFailed', () => {
				dispatch('errorGeneral', 'Migration failed.');
				left.setText(translate('migrationFailed'));
				renderControls('done');
			}),
		);

		void this.migrate();
	};

	private readonly migrate = async () => {
		const { dispatch, requestSync, initializeSync, translate, memoryDB } = this.ctx;
		dispatch('migrationProgress', {
			completed: 0,
			current: translate('migrationPhase1Description'),
			total: 3,
		});
		const phase1 = (await requestSync('migration')).result;
		if (phase1 === 'cancelled' || phase1 === 'failed') {
			dispatch('migrationFailed', 'phase 1 failed');
			return;
		}
		dispatch('migrationProgress', {
			completed: 1,
			current: translate('migrationPhase2Description'),
			total: 3,
		});
		try {
			const { record, remoteFs } = initializeSync();
			await Promise.all([
				record.clear(),
				this.options.apply(),
				...memoryDB
					.getStore('remoteContext20000')
					.entries()
					.sort(([a], [b]) => b.length - a.length)
					.map(([key]) => remoteFs.delete(key)),
			]);
		} catch (error) {
			const message = toErrorMessage(error);
			new Notice(`${translate('migrationFailed')}: ${message}`);
			dispatch('migrationFailed', message);
			return;
		}
		dispatch('migrationProgress', {
			completed: 2,
			current: translate('migrationPhase3Description'),
			total: 3,
		});
		const phase3 = (await requestSync('migration')).result;
		if (phase3 === 'cancelled' || phase3 === 'failed') {
			dispatch('migrationFailed', 'phase 3 failed');
			return;
		}
		dispatch('migrationProgress', {
			completed: 3,
			current: translate('completed'),
			total: 3,
		});
	};

	onClose() {
		this.cleanupCallbacks.splice(0).forEach((fn) => fn());
		this.contentEl.empty();
	}
}

export default function setNeedMigration(
	ctx: MigrationContext,
	{
		toggle,
		needMigration,
		content,
		apply,
	}: {
		toggle: ToggleComponent;
		needMigration?: (value: boolean) => MaybePromise<boolean>;
		content: (value: boolean) => string | DocumentFragment;
		apply: (value: boolean) => MaybePromise<void>;
	},
) {
	let selfTrigger = false;
	toggle.onChange((value) => {
		if (selfTrigger) {
			selfTrigger = false;
			return;
		}
		const showMigration = async (need: boolean) => {
			if (need) {
				selfTrigger = true;
				toggle.setValue(!value); // Revert UI back, not migrated yet
				new MigrationModal(ctx, {
					apply: async () => {
						await apply(value);
						selfTrigger = true;
						toggle.setValue(value);
					},
					content: content(value),
				}).open();
			} else await apply(value);
		};
		const need = needMigration?.(value) ?? true;
		if (need instanceof Promise) void need.then(showMigration);
		else void showMigration(need);
	});
}
