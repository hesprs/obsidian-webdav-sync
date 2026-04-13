import { throttle } from 'lodash-es';
import { Notice } from 'obsidian';
import WebDAVSyncPlugin from '~';
import type { SyncPlanningProgress, SyncProgressSummary, SyncRunSnapshot } from '~/events';
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

	public showProgressModal() {
		if (!this.hasActiveRun()) {
			new Notice(t('sync.notSyncing'));
			return;
		}
		this.closeProgressModal();
		this.progressModal = new SyncProgressModal(this.plugin);
		this.progressModal.open();
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
