import type WebDAVSyncPlugin from '~';
import { Modal, ProgressBarComponent, Setting } from 'obsidian';
import type { V3MigrationProgress, V3MigrationResult } from '~/migration';
import t from '~/i18n';

type V3MigrationModalCallbacks = {
	onDontShowAgain: () => Promise<void>;
	onProceed: (onProgress: (progress: V3MigrationProgress) => void) => Promise<V3MigrationResult>;
};

function normalizeError(error: unknown): Error {
	if (error instanceof Error) return error;
	return new Error(String(error));
}

export default class V3MigrationModal extends Modal {
	private progressBar?: ProgressBarComponent;
	private progressDetail?: HTMLParagraphElement;
	private progressStats?: HTMLParagraphElement;
	private currentProgress?: V3MigrationProgress;

	constructor(
		private readonly plugin: WebDAVSyncPlugin,
		private readonly callbacks: V3MigrationModalCallbacks,
	) {
		super(plugin.app);
	}

	renderPrompt(): void {
		this.currentProgress = undefined;
		this.progressBar = undefined;
		this.progressDetail = undefined;
		this.progressStats = undefined;
		this.contentEl.empty();
		this.setTitle(t('settings.v3Migration.prompt.title'));
		this.contentEl.appendChild(t('settings.v3Migration.prompt.top'));
		this.contentEl.appendChild(
			t(
				this.plugin.settings.encryption.enabled
					? 'settings.v3Migration.prompt.middleEncrypted'
					: 'settings.v3Migration.prompt.middleNormal',
			),
		);
		this.contentEl.createEl('p', {
			cls: 'whitespace-pre-wrap',
			text: t('settings.v3Migration.prompt.bottom'),
		});

		new Setting(this.contentEl)
			.addButton((button) =>
				button
					.setButtonText(t('settings.v3Migration.prompt.cancel'))
					.onClick(() => this.close()),
			)
			.addButton((button) =>
				button
					.setButtonText(t('settings.v3Migration.prompt.dontShowAgain'))
					.onClick(() => void this.handleDontShowAgain()),
			)
			.addButton((button) =>
				button
					.setButtonText(t('settings.v3Migration.prompt.proceed'))
					.setCta()
					.onClick(() => void this.handleProceed()),
			);
	}

	renderProgress(progress?: V3MigrationProgress): void {
		this.currentProgress = progress ??
			this.currentProgress ?? {
				completed: 0,
				detail: t('settings.v3Migration.steps.prepSync'),
				step: 'prepSync',
				total: 8,
			};
		const currentProgress = this.currentProgress;
		if (!this.progressBar || !this.progressDetail || !this.progressStats) {
			this.contentEl.empty();
			this.setTitle(t('settings.v3Migration.progress.title'));
			const container = this.contentEl.createDiv({ cls: 'flex flex-col gap-3 pt-3' });
			this.progressDetail = container.createEl('p', {
				cls: 'whitespace-pre-wrap mb-0',
				text: currentProgress.detail ?? t('settings.v3Migration.progress.step'),
			});
			const barContainer = container.createDiv({ cls: 'pt-1' });
			this.progressBar = new ProgressBarComponent(barContainer);
			this.progressStats = container.createEl('p', {
				cls: 'text-xs text-[var(--text-muted)] mb-0',
				text: '',
			});
		}

		const percent = Math.max(
			0,
			Math.min(100, (currentProgress.completed / currentProgress.total) * 100),
		);
		this.progressBar?.setValue(percent);
		if (this.progressDetail)
			this.progressDetail.setText(
				currentProgress.detail ?? t('settings.v3Migration.progress.step'),
			);
		if (this.progressStats)
			this.progressStats.setText(
				t('settings.v3Migration.progress.stats', {
					completed: currentProgress.completed,
					total: currentProgress.total,
				}),
			);
	}

	renderSuccess(encryptionEnabled: boolean): void {
		this.progressBar = undefined;
		this.progressDetail = undefined;
		this.progressStats = undefined;
		this.contentEl.empty();
		this.setTitle(t('settings.v3Migration.success.title'));
		this.contentEl.append(
			t(
				encryptionEnabled
					? 'settings.v3Migration.success.bodyEncrypted'
					: 'settings.v3Migration.success.bodyNormal',
			),
		);
		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText(t('settings.v3Migration.success.close'))
				.setCta()
				.onClick(() => this.close()),
		);
	}

	renderFailure(error: Error, rolledBack: boolean): void {
		this.progressBar = undefined;
		this.progressDetail = undefined;
		this.progressStats = undefined;
		this.contentEl.empty();
		this.setTitle(t('settings.v3Migration.failure.title'));
		this.contentEl.createEl('p', {
			cls: 'whitespace-pre-wrap',
			text: t('settings.v3Migration.failure.body', { error: error.message }),
		});
		this.contentEl.createEl('p', {
			cls: 'whitespace-pre-wrap',
			text: rolledBack
				? t('settings.v3Migration.failure.rolledBack')
				: t('settings.v3Migration.failure.partialCleanup'),
		});
		new Setting(this.contentEl).addButton((button) =>
			button
				.setButtonText(t('settings.v3Migration.failure.close'))
				.setCta()
				.onClick(() => this.close()),
		);
	}

	onOpen(): void {
		this.renderPrompt();
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async handleDontShowAgain(): Promise<void> {
		try {
			await this.callbacks.onDontShowAgain();
			this.close();
		} catch (error) {
			this.renderFailure(normalizeError(error), false);
		}
	}

	private async handleProceed(): Promise<void> {
		this.renderProgress({
			completed: 0,
			detail: t('settings.v3Migration.steps.prepSync'),
			step: 'prepSync',
			total: 8,
		});
		try {
			const result = await this.callbacks.onProceed((progress) =>
				this.renderProgress(progress),
			);
			if (result.ok) this.renderSuccess(result.encryptionEnabled);
			else this.renderFailure(result.error, result.rolledBack);
		} catch (error) {
			this.renderFailure(normalizeError(error), false);
		}
	}
}
