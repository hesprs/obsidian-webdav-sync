import { throttle } from 'lodash-es';
import { Notice } from 'obsidian';
import WebDAVSyncPlugin from '~';
import type { SyncPlanningProgress, SyncProgressSummary, SyncRunSnapshot } from '~/events';
import type { BaseTask } from '~/sync/tasks/task.interface';
import SyncProgressModal from '~/components/SyncProgressModal';
import { syncRun } from '~/events';
import t from '~/i18n';

export class ProgressService {
	private progressModal: SyncProgressModal | null = null;
	private currentRunSnapshot: SyncRunSnapshot | null = null;

	private unsubscribe = syncRun.subscribe((run) => {
		if (!run) return;
		this.currentRunSnapshot = run;
		this.updateModal();
	});

	constructor(private plugin: WebDAVSyncPlugin) {}

	updateModal = throttle(() => {
		if (this.progressModal) {
			this.progressModal.update();
		}
	}, 200);

	get currentRun(): SyncRunSnapshot | null {
		return this.currentRunSnapshot;
	}

	get syncProgress(): SyncProgressSummary {
		return (
			this.currentRunSnapshot?.progressSummary ?? {
				totalTasks: 0,
				completedTasks: 0,
				completed: [],
			}
		);
	}

	get planningProgress(): SyncPlanningProgress | null {
		return this.currentRunSnapshot?.planningProgress ?? null;
	}

	get syncEnd(): boolean {
		return (
			this.currentRunSnapshot !== null &&
			['completed', 'completed_noop', 'cancelled', 'failed'].includes(
				this.currentRunSnapshot.stage,
			)
		);
	}

	private hasActiveRun(): boolean {
		return (
			this.currentRunSnapshot !== null &&
			!['completed', 'completed_noop', 'cancelled', 'failed'].includes(
				this.currentRunSnapshot.stage,
			)
		);
	}

	private createProgressModal() {
		const modal = new SyncProgressModal(this.plugin, () => {
			if (this.progressModal === modal) this.progressModal = null;
		});
		this.progressModal = modal;
		return modal;
	}

	private ensureProgressModal(): { modal: SyncProgressModal; autoOpened: boolean } {
		if (this.progressModal) return { modal: this.progressModal, autoOpened: false };
		const modal = this.createProgressModal();
		modal.open();
		return { modal, autoOpened: true };
	}

	public showProgressModal() {
		if (!this.hasActiveRun()) {
			new Notice(t('sync.notSyncing'));
			return;
		}
		this.closeProgressModal();
		this.createProgressModal().open();
	}

	public confirmManualTasks(tasks: BaseTask[]): Promise<{
		confirmed: boolean;
		selectedTasks: BaseTask[];
	}> {
		const { modal, autoOpened } = this.ensureProgressModal();
		return new Promise((resolve) => {
			const finish = (confirmed: boolean) => {
				const selectedTasks = confirmed ? modal.getSelectedTasks() : [];
				modal.clearTaskConfirmation();
				if (confirmed && autoOpened) this.closeProgressModal();
				resolve({ confirmed, selectedTasks });
			};

			modal.showTaskConfirmation(tasks, {
				onConfirm: () => finish(true),
				onCancel: () => finish(false),
			});
		});
	}

	public closeProgressModal() {
		if (this.progressModal) {
			this.progressModal.close();
			this.progressModal = null;
		}
	}

	public unload() {
		this.unsubscribe();
		this.closeProgressModal();
	}
}
