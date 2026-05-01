import logger from '~/utils/logger';
import {
	syncRun,
	updateSyncRunSnapshot,
	type SyncErrorSummary,
	type SyncRunSnapshot,
	type SyncRunStage,
	type SyncRunTimestamps,
} from '.';

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
		event: 'terminal_outcome',
		mode: run.mode,
		progressSummary: run.progressSummary,
		remoteWalkSummary: run.remoteWalkSummary,
		resultSummary: run.resultSummary,
		runKind: run.runKind,
		sources: run.sources,
		stage: run.stage,
		timestamps: run.timestamps,
		trigger: run.trigger,
	};

	if (run.stage === 'failed')
		logger.error('Sync failed', metadata, { category: 'sync.lifecycle' });
	else if (run.stage === 'cancelled')
		logger.warn('Sync cancelled', metadata, { category: 'sync.lifecycle' });
	else if (run.stage === 'completed_noop')
		logger.info('Sync completed with no changes', metadata, { category: 'sync.lifecycle' });
	else logger.info('Sync completed', metadata, { category: 'sync.lifecycle' });
}
