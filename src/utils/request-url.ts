import { requestUrl as req, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import logger from './logger';

// TODO: delete
function toDebugHeaders(headers?: Record<string, string>) {
	if (!headers) return undefined;

	return Object.fromEntries(
		Object.entries(headers).map(([key, value]) => {
			if (key.toLowerCase() === 'authorization') return [key, '<retracted>'];
			return [key, value];
		}),
	);
}

// TODO: delete
function getResponsePreview(res: RequestUrlResponse) {
	return res.text.slice(0, 300);
}

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

	// const res = await req(params);

	// TODO: delete
	logger.debug(
		'requestUrl request started',
		{
			url: params.url,
			method: params.method ?? 'GET',
			contentType: params.contentType,
			headers: toDebugHeaders(params.headers),
			bodyType:
				params.body instanceof ArrayBuffer
					? 'arrayBuffer'
					: typeof params.body === 'string'
						? 'string'
						: params.body === undefined
							? 'undefined'
							: typeof params.body,
			bodyLength:
				typeof params.body === 'string'
					? params.body.length
					: params.body instanceof ArrayBuffer
						? params.body.byteLength
						: undefined,
		},
		{ category: 'network.request' },
	);
	// TODO: delete
	let res: RequestUrlResponse;
	try {
		res = await req(params);
	} catch (error) {
		// TODO: delete
		logger.debug(
			'requestUrl request threw before response',
			{
				url: params.url,
				method: params.method ?? 'GET',
				error,
			},
			{ category: 'network.request' },
		);
		throw error;
	}
	// TODO: delete
	logger.debug(
		'requestUrl response received',
		{
			url: params.url,
			method: params.method ?? 'GET',
			status: res.status,
			headers: toDebugHeaders(res.headers),
			textLength: res.text.length,
			textPreview: getResponsePreview(res),
		},
		{ category: 'network.request' },
	);

	if (res.status >= 400) {
		if (!isExpectedNotFoundResponse(p, res))
			logger.error(`Received unexpected status code ${res.status}`, res);
		if (typeof p === 'string' || p.throw !== false) throw new RequestUrlError(res);
	}

	return res;
}
