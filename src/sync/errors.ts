export class SyncCancelledError extends Error {
	constructor(message = 'Sync cancelled') {
		super(message);
		this.name = 'SyncCancelledError';
	}
}

export class SyncRetryExhaustedError extends Error {
	constructor(
		message = 'WebDAV connection failed after retries',
		readonly cause?: Error,
	) {
		super(message);
		this.name = 'SyncRetryExhaustedError';
	}
}

export function isSyncCancelledError(error: unknown): error is SyncCancelledError {
	return error instanceof SyncCancelledError;
}

export function toError(error: unknown, fallbackMessage: string): Error {
	if (error instanceof Error) return error;
	return new Error(typeof error === 'string' ? error : fallbackMessage);
}
