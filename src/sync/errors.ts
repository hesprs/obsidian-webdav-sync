export class SyncCancelledError extends Error {
	constructor(message = 'Sync cancelled') {
		super(message);
		this.name = 'SyncCancelledError';
	}
}

export function isSyncCancelledError(error: unknown): error is SyncCancelledError {
	return error instanceof SyncCancelledError;
}
