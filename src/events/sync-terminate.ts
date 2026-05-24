import logger from '~/utils/logger';
import type { SyncErrorSummary, SyncRunSnapshot, SyncRunStage, SyncRunTimestamps } from '.';
import { syncRun, updateSyncRunSnapshot } from '.';

type SyncTerminalStage = Extract<
	SyncRunStage,
	'completed' | 'completed_noop' | 'cancelled' | 'failed'
>;

type FinalizeSyncRunOptions = {
	stage: SyncTerminalStage;
	error?: unknown;
	patch?: Partial<Omit<SyncRunSnapshot, 'timestamps'>> & {
		timestamps?: Partial<SyncRunTimestamps>;
	};
};

export default function finalizeSyncRun(
	run: SyncRunSnapshot,
	{ stage, error, patch }: FinalizeSyncRunOptions,
): SyncRunSnapshot {
	const normalizedError = error instanceof Error ? error : undefined;
	const nextRun = updateSyncRunSnapshot(run, {
		...patch,
		errorSummary: createSyncErrorSummary(normalizedError, patch?.errorSummary),
		stage,
		timestamps: {
			...patch?.timestamps,
			endedAt: patch?.timestamps?.endedAt ?? Date.now(),
		},
	});
	syncRun(nextRun);
	logTerminalRun(nextRun, normalizedError);
	return nextRun;
}

function createSyncErrorSummary(
	error: Error | undefined,
	errorSummary: SyncErrorSummary | undefined,
): SyncErrorSummary | undefined {
	if (errorSummary !== undefined) return errorSummary;
	if (!error) return undefined;
	return {
		message: error.message,
		name: error.name,
	};
}

function logTerminalRun(run: SyncRunSnapshot, error?: Error) {
	const metadata = {
		error,
		errorSummary: run.errorSummary,
		progressSummary: run.progressSummary,
		remoteWalkSummary: run.remoteWalkSummary,
		resultSummary: run.resultSummary,
		timestamps: run.timestamps,
	};

	if (run.stage === 'failed') logger.error('Sync failed', metadata);
	else if (run.stage === 'cancelled') logger.warn('Sync cancelled', metadata);
	else if (run.stage === 'completed_noop')
		logger.info('Sync completed with no changes', metadata);
	else logger.info('Sync completed', metadata);
}
