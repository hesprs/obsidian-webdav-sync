const RETRYABLE_STATUS_CODES = new Set([401, 408, 425, 429, 502, 503, 504]);

const RETRYABLE_MESSAGE_PATTERNS = [
	/\bnet::ERR_CONNECTION_CLOSED\b/i,
	/\bnet::ERR_CONNECTION_RESET\b/i,
	/\bnet::ERR_CONNECTION_ABORTED\b/i,
	/\bnet::ERR_CONNECTION_TIMED_OUT\b/i,
	/\bnet::ERR_NETWORK_CHANGED\b/i,
	/\bnet::ERR_INTERNET_DISCONNECTED\b/i,
	/\bECONNRESET\b/i,
	/\bECONNABORTED\b/i,
	/\bECONNREFUSED\b/i,
	/\bETIMEDOUT\b/i,
	/\bEAI_AGAIN\b/i,
	/\bsocket hang up\b/i,
	/\bconnection closed\b/i,
	/\bconnection reset\b/i,
	/\bconnection aborted\b/i,
	/\bconnection refused\b/i,
	/\btemporarily unavailable\b/i,
	/\btimed out\b/i,
];

type ErrorLike = {
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

function getStatusCode(error: ErrorLike): number | undefined {
	const candidates = [error.status, error.res?.status, error.response?.status];
	for (const candidate of candidates) if (typeof candidate === 'number') return candidate;
}

function hasRetryableMessage(message: string): boolean {
	return RETRYABLE_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export default function isRetryableError(error: unknown): boolean {
	const queue: Array<unknown> = [error];
	const visited = new Set<object>();

	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) continue;

		if (typeof current === 'string') {
			if (hasRetryableMessage(current)) return true;
			continue;
		}

		if (typeof current !== 'object') continue;
		if (visited.has(current)) continue;
		visited.add(current);

		const errorLike = current as ErrorLike;
		const statusCode = getStatusCode(errorLike);
		if (statusCode && RETRYABLE_STATUS_CODES.has(statusCode)) return true;

		if (typeof errorLike.message === 'string')
			if (hasRetryableMessage(errorLike.message)) return true;

		if (errorLike.cause) queue.push(errorLike.cause);
		if (errorLike.error) queue.push(errorLike.error);
	}

	return false;
}
