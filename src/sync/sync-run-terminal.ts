import {
	emitSyncRun,
	type SyncErrorSummary,
	type SyncRunSnapshot,
	type SyncRunStage,
	type SyncRunTimestamps,
	updateSyncRunSnapshot,
} from '~/events';
import logger from '~/utils/logger';

type SyncTerminalStage = Extract<
	SyncRunStage,
	'completed' | 'completed_noop' | 'cancelled' | 'failed'
>;

interface FinalizeSyncRunOptions {
	stage: SyncTerminalStage;
	error?: unknown;
	patch?: Partial<Omit<SyncRunSnapshot, 'timestamps'>> & {
		timestamps?: Partial<SyncRunTimestamps>;
	};
}

export function finalizeSyncRun(
	run: SyncRunSnapshot,
	{ stage, error, patch }: FinalizeSyncRunOptions,
): SyncRunSnapshot {
	const normalizedError = error instanceof Error ? error : undefined;
	const nextRun = updateSyncRunSnapshot(run, {
		...patch,
		stage,
		errorSummary: createSyncErrorSummary(normalizedError, patch?.errorSummary),
		timestamps: {
			...patch?.timestamps,
			endedAt: patch?.timestamps?.endedAt ?? Date.now(),
		},
	});

	emitSyncRun(nextRun);
	logTerminalRun(nextRun, normalizedError);
	return nextRun;
}

function createSyncErrorSummary(
	error: Error | undefined,
	errorSummary: SyncErrorSummary | undefined,
): SyncErrorSummary | undefined {
	if (errorSummary !== undefined) {
		return errorSummary;
	}

	if (!error) {
		return undefined;
	}

	return {
		message: error.message,
		name: error.name,
	};
}

function logTerminalRun(run: SyncRunSnapshot, error?: Error) {
	const metadata = {
		event: 'terminal_outcome',
		trigger: run.trigger,
		sources: run.sources,
		mode: run.mode,
		runKind: run.runKind,
		stage: run.stage,
		timestamps: run.timestamps,
		planSummary: run.planSummary,
		progressSummary: run.progressSummary,
		resultSummary: run.resultSummary,
		errorSummary: run.errorSummary,
		error,
	};

	if (run.stage === 'failed') {
		logger.error('Sync failed', metadata, { category: 'sync.lifecycle' });
		return;
	}

	if (run.stage === 'cancelled') {
		logger.warn('Sync cancelled', metadata, { category: 'sync.lifecycle' });
		return;
	}

	if (run.stage === 'completed_noop') {
		logger.info('Sync completed with no changes', metadata, { category: 'sync.lifecycle' });
		return;
	}

	logger.info('Sync completed', metadata, { category: 'sync.lifecycle' });
}
