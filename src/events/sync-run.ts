import type { TaskNames } from '~/sync/tasks/task.interface';
import type { SyncRunKind } from '~/types';
import { hook, ref } from '.';

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
	totalTasks: number;
	requiresConfirmation: boolean;
	requiresDeleteConfirmation: boolean;
	warnings: Array<SyncRunWarning>;
};

export type RemoteWalkSummary = {
	totalItems: number;
	completedItems: number;
	currentItem: string;
};

export type SyncProgressSummary = {
	totalTasks: number;
	completedTasks: number;
	completed: Array<{
		taskName: TaskNames;
		path: string;
	}>;
};

export type SyncFailedTaskInfo = {
	name: TaskNames;
	localPath: string;
	errorMessage: string;
};

export type SyncResultSummary = {
	totalTasks: number;
	succeededTasks: number;
	failedTasks: number;
	failed: Array<SyncFailedTaskInfo>;
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
			completed: [],
			completedTasks: 0,
			totalTasks: 0,
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
