import { hook, ref } from 'synthkernel';
import type { TaskNames } from '~/sync/tasks/task.interface';
import type { SyncRunKind } from '~/types';

export type SyncTrigger = 'manual' | 'startup' | 'interval' | 'realtime';
export type SyncRunStage =
	| 'queued'
	| 'pre_connecting'
	| 'walking_remote'
	| 'awaiting_confirmation'
	| 'executing'
	| 'completed'
	| 'completed_noop'
	| 'cancelled'
	| 'failed';

export type SyncRunWarning = {
	code: 'delete_confirmation';
	messageKey: 'deleteConfirm.warningNotice';
};

export type SyncPlanSummary = {
	total: number;
	requiresConfirmation: boolean;
	requiresDeleteConfirmation: boolean;
	warnings: Array<SyncRunWarning>;
};

export type RemoteWalkSummary = {
	total: number;
	completed: number;
};

export type SyncProgressSummary = {
	total: number;
	completed: number;
	completedTasks: Array<{
		taskName: TaskNames;
		path: string;
	}>;
};

export type SyncFailedTaskInfo = {
	name: TaskNames;
	key: string;
	errorMessage: string;
};

export type SyncResultSummary = {
	total: number;
	completed: number;
	failed: number;
	failedTasks: Array<SyncFailedTaskInfo>;
};

export type SyncErrorSummary = {
	message: string;
	name?: string;
};

export type SyncRunTimestamps = {
	queuedAt: number;
	planningStartedAt?: number;
	confirmationStartedAt?: number;
	executionStartedAt?: number;
	endedAt?: number;
	updatedAt: number;
	durationMs?: number;
};

export type SyncRunSnapshot = {
	runId: string;
	trigger: SyncTrigger;
	sources: Array<SyncTrigger>;
	runKind: SyncRunKind;
	stage: SyncRunStage;
	timestamps: SyncRunTimestamps;
	planSummary?: SyncPlanSummary;
	remoteWalkSummary?: RemoteWalkSummary;
	serverUrl?: string;
	progressSummary: SyncProgressSummary;
	resultSummary?: SyncResultSummary;
	errorSummary?: SyncErrorSummary;
};

export const syncRun = ref<SyncRunSnapshot | undefined>(undefined);

export function createQueuedSyncRunSnapshot(input: {
	runId: string;
	trigger: SyncTrigger;
	sources: Array<SyncTrigger>;
	runKind: SyncRunKind;
	queuedAt?: number;
}): SyncRunSnapshot {
	const queuedAt = input.queuedAt ?? Date.now();
	return {
		progressSummary: {
			completed: 0,
			completedTasks: [],
			total: 0,
		},
		runId: input.runId,
		runKind: input.runKind,
		sources: input.sources,
		stage: 'queued',
		timestamps: {
			queuedAt,
			updatedAt: queuedAt,
		},
		trigger: input.trigger,
	};
}

export type ProgressPatch = Partial<Omit<SyncRunSnapshot, 'timestamps'>> & {
	timestamps?: Partial<SyncRunTimestamps>;
};

export function updateSyncRunSnapshot(
	snapshot: SyncRunSnapshot,
	patch: ProgressPatch,
): SyncRunSnapshot {
	const updatedAt = patch.timestamps?.updatedAt ?? Date.now();
	const timestamps: SyncRunTimestamps = {
		...snapshot.timestamps,
		...patch.timestamps,
		updatedAt,
	};

	if (timestamps.endedAt !== undefined)
		timestamps.durationMs = timestamps.endedAt - timestamps.queuedAt;

	return {
		...snapshot,
		...patch,
		timestamps,
	};
}

export const syncCancel = hook();
