/**
 * Patch webdav request to use obsidian's requestUrl
 *
 * reference: https://github.com/remotely-save/remotely-save/blob/34db181af002f8d71ea0a87e7965abc57b294914/src/fsWebdav.ts#L25
 */
import type { RequestOptionsWithState } from 'webdav';
import { Platform, type RequestUrlParam } from 'obsidian';
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

/**
 * https://stackoverflow.com/questions/32850898/how-to-check-if-a-string-has-any-non-iso-8859-1-characters-with-javascript
 * @param str
 * @returns true if all are iso 8859 1 chars
 */
function onlyAscii(str: string) {
	// oxlint-disable-next-line no-control-regex
	return !/[^\u0000-\u00ff]/g.test(str);
}

function useSlashedDirectoryUrlOnIos(url: string, method: string): string {
	if (!Platform.isIosApp || method.toUpperCase() !== 'PROPFIND') return url;
	if (url.endsWith('/')) return url;

	const parsedUrl = new URL(url);
	if (parsedUrl.pathname.endsWith('/') || parsedUrl.pathname.endsWith('.md')) return url;

	parsedUrl.pathname = `${parsedUrl.pathname}/`;
	return parsedUrl.toString();
}

if (VALID_REQURL) {
	getPatcher().patch('request', async (options: unknown): Promise<Response> => {
		const requestOptions = options as RequestOptionsWithState;
		const transformedHeaders = objKeyToLower({ ...requestOptions.headers });
		delete transformedHeaders['host'];
		delete transformedHeaders['content-length'];

		const reqContentType = transformedHeaders['accept'] ?? transformedHeaders['content-type'];

		const retractedHeaders = { ...transformedHeaders };
		if (retractedHeaders.hasOwnProperty('authorization')) {
			retractedHeaders['authorization'] = '<retracted>';
		}

		const requestUrlValue = useSlashedDirectoryUrlOnIos(
			requestOptions.url,
			requestOptions.method,
		);

		const p: RequestUrlParam = {
			url: requestUrlValue,
			method: requestOptions.method,
			body: requestOptions.data as string | ArrayBuffer,
			headers: transformedHeaders,
			contentType: reqContentType,
			throw: false,
		};

		let r = await requestUrl(p);

		const rspHeaders = objKeyToLower({ ...r.headers });
		for (const key in rspHeaders) {
			if (rspHeaders.hasOwnProperty(key)) {
				if (!onlyAscii(rspHeaders[key])) {
					rspHeaders[key] = encodeURIComponent(rspHeaders[key]);
				}
			}
		}

		let r2: Response | undefined = undefined;
		const statusText = STATUS_TEXTS[r.status];
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
