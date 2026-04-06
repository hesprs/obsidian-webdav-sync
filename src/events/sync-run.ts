import { BehaviorSubject } from 'rxjs';
import type { BaseTask } from '~/sync/tasks/task.interface';
import { SyncRunKind } from '~/types';

export type SyncTrigger = 'manual' | 'startup' | 'interval' | 'realtime';
export type SyncRunMode = 'manual' | 'auto';
export type SyncRunStage =
	| 'queued'
	| 'planning'
	| 'awaiting_confirmation'
	| 'executing'
	| 'completed'
	| 'completed_noop'
	| 'cancelled'
	| 'failed';

export enum SyncPlanningSubStage {
	preConnecting = 'preConnecting',
	walkingRemote = 'walkingRemote',
	deciding = 'deciding',
}

export interface SyncPlanningProgress {
	subStage: SyncPlanningSubStage;
	totalWorkUnits: number;
	completedWorkUnits: number;
	currentItem?: string;
}

export interface SyncRunWarning {
	code: 'delete_confirmation';
	messageKey: 'deleteConfirm.warningNotice';
}

export interface SyncPlanSummary {
	totalTasks: number;
	requiresConfirmation: boolean;
	requiresDeleteConfirmation: boolean;
	warnings: SyncRunWarning[];
}

export interface SyncProgressSummary {
	totalTasks: number;
	completedTasks: number;
	completed: BaseTask[];
}

export interface SyncFailedTaskInfo {
	taskName: string;
	localPath: string;
	errorMessage: string;
}

export interface SyncResultSummary {
	totalTasks: number;
	succeededTasks: number;
	failedTasks: number;
	failed: SyncFailedTaskInfo[];
}

export interface SyncErrorSummary {
	message: string;
	name?: string;
}

export interface SyncRunTimestamps {
	queuedAt: number;
	planningStartedAt?: number;
	confirmationStartedAt?: number;
	executionStartedAt?: number;
	endedAt?: number;
	updatedAt: number;
	durationMs?: number;
}

export interface SyncRunSnapshot {
	runId: string;
	trigger: SyncTrigger;
	sources: SyncTrigger[];
	mode: SyncRunMode;
	runKind: SyncRunKind;
	stage: SyncRunStage;
	timestamps: SyncRunTimestamps;
	planningProgress?: SyncPlanningProgress;
	planSummary?: SyncPlanSummary;
	progressSummary: SyncProgressSummary;
	resultSummary?: SyncResultSummary;
	errorSummary?: SyncErrorSummary;
}

const syncRun = new BehaviorSubject<SyncRunSnapshot | null>(null);

export const onSyncRun = () => syncRun.asObservable();
export const getCurrentSyncRun = () => syncRun.getValue();
export const emitSyncRun = (snapshot: SyncRunSnapshot) => syncRun.next(snapshot);

export function createQueuedSyncRunSnapshot(input: {
	runId: string;
	trigger: SyncTrigger;
	sources: SyncTrigger[];
	mode: SyncRunMode;
	runKind: SyncRunKind;
	queuedAt?: number;
}): SyncRunSnapshot {
	const queuedAt = input.queuedAt ?? Date.now();
	return {
		runId: input.runId,
		trigger: input.trigger,
		sources: input.sources,
		mode: input.mode,
		runKind: input.runKind,
		stage: 'queued',
		timestamps: {
			queuedAt,
			updatedAt: queuedAt,
		},
		progressSummary: {
			totalTasks: 0,
			completedTasks: 0,
			completed: [],
		},
	};
}

export function updateSyncRunSnapshot(
	snapshot: SyncRunSnapshot,
	patch: Partial<Omit<SyncRunSnapshot, 'timestamps'>> & {
		timestamps?: Partial<SyncRunTimestamps>;
	},
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
