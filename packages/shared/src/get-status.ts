export type ErrorLike = {
	message?: unknown;
	status?: unknown;
	res?: {
		status?: unknown;
	};
	response?: {
		status?: unknown;
	};
	cause?: unknown;
	error?: unknown;
};

export function getStatus(error: unknown): number | undefined {
	const err = error as ErrorLike;
	const candidates = [err.status, err.res?.status, err.response?.status];
	for (const candidate of candidates) if (typeof candidate === 'number') return candidate;
}
