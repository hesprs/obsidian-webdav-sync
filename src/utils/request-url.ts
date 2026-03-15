import { requestUrl as req, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import logger from './logger';

class RequestUrlError extends Error {
	constructor(public res: RequestUrlResponse) {
		super(`${res.status}: ${res.text}`);
	}
}

function isExpectedNotFoundResponse(
	input: RequestUrlParam | string,
	res: RequestUrlResponse,
): boolean {
	return typeof input !== 'string' && input.throw === false && res.status === 404;
}

export default async function requestUrl(p: RequestUrlParam | string) {
	const params: RequestUrlParam =
		typeof p === 'string'
			? {
					url: p,
					throw: false,
				}
			: {
					...p,
					throw: false,
					headers: {
						...p.headers,
					},
				};

	const res = await req(params);

	if (res.status >= 400) {
		if (!isExpectedNotFoundResponse(p, res)) logger.error(res);
		if (typeof p === 'string' || p.throw !== false) throw new RequestUrlError(res);
	}

	return res;
}
