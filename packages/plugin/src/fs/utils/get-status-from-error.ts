import type { ErrorLike } from './is-retryable-error';

export default function getStatusFromError(error: unknown): number | undefined {
	const err = error as ErrorLike;
	const candidates = [err.status, err.res?.status, err.response?.status];
	for (const candidate of candidates) if (typeof candidate === 'number') return candidate;
}
