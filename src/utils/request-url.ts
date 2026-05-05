import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';
import { requestUrl as req } from 'obsidian';
import logger from './logger';

class RequestUrlError extends Error {
	name = 'RequestUrlError';
	constructor(public res: RequestUrlResponse) {
		super(`${res.status}: ${res.text}`);
	}
}

function getSafeResponseMetadata(res: RequestUrlResponse) {
	return {
		headers: { ...res.headers },
		status: res.status,
		text: res.text,
	};
}

export default async function requestUrl(p: RequestUrlParam | string) {
	const params: RequestUrlParam =
		typeof p === 'string'
			? { throw: false, url: p }
			: { ...p, headers: { ...p.headers }, throw: false };

	const res = await req(params);

	if (res.status >= 400) {
		logger.error(`Received unexpected status code ${res.status}`, getSafeResponseMetadata(res));
		if (typeof p === 'string' || p.throw !== false) throw new RequestUrlError(res);
	}

	return res;
}
