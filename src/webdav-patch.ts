/**
 * Patch webdav request to use obsidian's requestUrl
 *
 * reference: https://github.com/remotely-save/remotely-save/blob/34db181af002f8d71ea0a87e7965abc57b294914/src/fsWebdav.ts#L25
 */
import type { RequestOptionsWithState } from 'webdav';
import { type RequestUrlParam } from 'obsidian';
import { getPatcher } from 'webdav';
import { VALID_REQURL } from '~/consts';
import requestUrl from './utils/request-url';

/**
 * https://stackoverflow.com/questions/12539574/
 * @param obj
 * @returns
 */
function objKeyToLower(obj: Record<string, string>) {
	return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k.toLowerCase(), v]));
}

const STATUS_TEXTS: Record<number, string> = {
	100: 'Continue',
	101: 'Switching Protocols',
	200: 'OK',
	201: 'Created',
	204: 'No Content',
	301: 'Moved Permanently',
	302: 'Found',
	304: 'Not Modified',
	400: 'Bad Request',
	401: 'Unauthorized',
	403: 'Forbidden',
	404: 'Not Found',
	405: 'Method Not Allowed',
	409: 'Conflict',
	412: 'Precondition Failed',
	423: 'Locked',
	500: 'Internal Server Error',
	502: 'Bad Gateway',
	503: 'Service Unavailable',
};

function onlyAscii(str: string) {
	return !/[^\x20-\x7E]/g.test(str);
}

if (VALID_REQURL) {
	getPatcher().patch('request', async (options: unknown): Promise<Response> => {
		const requestOptions = options as RequestOptionsWithState;
		const transformedHeaders = objKeyToLower({ ...requestOptions.headers });
		delete transformedHeaders['host'];
		delete transformedHeaders['content-length'];

		const reqContentType = transformedHeaders['accept'] ?? transformedHeaders['content-type'];

		const retractedHeaders = { ...transformedHeaders };
		if ('authorization' in retractedHeaders) retractedHeaders['authorization'] = '<retracted>';

		const p: RequestUrlParam = {
			url: requestOptions.url,
			method: requestOptions.method,
			body: requestOptions.data as string | ArrayBuffer,
			headers: transformedHeaders,
			contentType: reqContentType,
			throw: false,
		};

		let r = await requestUrl(p);

		const rspHeaders = objKeyToLower({ ...r.headers });
		for (const key in rspHeaders) {
			if (key in rspHeaders) {
				if (!onlyAscii(rspHeaders[key])) {
					rspHeaders[key] = encodeURIComponent(rspHeaders[key]);
				}
			}
		}

		let r2: Response | undefined = undefined;
		const statusText = STATUS_TEXTS[r.status] ?? 'Unknown';
		if ([101, 103, 204, 205, 304].includes(r.status)) {
			r2 = new Response(null, {
				status: r.status,
				statusText: statusText,
				headers: rspHeaders,
			});
		} else {
			r2 = new Response(r.arrayBuffer, {
				status: r.status,
				statusText: statusText,
				headers: rspHeaders,
			});
		}

		return r2;
	});
}
