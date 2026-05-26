import type { DAVResult } from 'webdav';
import type { StatModel } from '~/types';
import parseXML from '~/composable/parse-xml';
import { normalizeRemotePath } from '~/platform/path';
import { useSettings } from '~/settings';
import { isNil } from '~/utils/fns';
import isRetryableError from '~/utils/is-retryable-error';
import logger from '~/utils/logger';
import requestUrl from '~/utils/request-url';
import sleep from '~/utils/sleep';

type WebDAVProp = {
	displayname?: string;
	resourcetype?: { collection?: unknown } | string;
	getlastmodified?: string;
	getcontentlength?: string;
	getcontenttype?: string;
};

type WebDAVPropstat = {
	prop?: WebDAVProp;
	status?: string;
};

type WebDAVResponseItem = {
	href: string;
	propstat?: WebDAVPropstat | Array<WebDAVPropstat>;
};

function normalizePath(path: string) {
	return normalizeRemotePath(decodeURIComponent(path));
}

function isSuccessStatus(status?: string): boolean {
	if (!status) return true;
	const match = /\s(\d{3})(?:\s|$)/.exec(status);
	if (!match) return false;
	const code = Number.parseInt(match[1], 10);
	return code >= 200 && code < 300;
}

function getValidProps(item: WebDAVResponseItem): WebDAVProp | undefined {
	if (!item.propstat) return undefined;

	const propstats = Array.isArray(item.propstat) ? item.propstat : [item.propstat];

	for (const propstat of propstats) {
		if (!isSuccessStatus(propstat.status)) continue;
		if (propstat.prop) return propstat.prop;
	}

	return undefined;
}

function isCollectionResource(resourcetype: WebDAVProp['resourcetype']): boolean {
	if (!resourcetype) return false;
	if (typeof resourcetype === 'string') return resourcetype.toLowerCase() === 'collection';
	return !isNil(resourcetype.collection);
}

function extractNextLink(linkHeader: string): string | undefined {
	const matches = /<([^>]+)>;\s*rel="next"/.exec(linkHeader);
	return matches ? matches[1] : undefined;
}

function extractPathname(href: string): string {
	if (href.startsWith('http://') || href.startsWith('https://'))
		return decodeURIComponent(new URL(href).pathname);
	return decodeURIComponent(href);
}

function buildStripPrefixes(serverUrl: string): Array<string> {
	const endpointPath = extractPathname(serverUrl);
	return [endpointPath];
}

function buildDirectoryUrl(serverUrl: string, _path: string): string {
	const normalized = normalizeRemotePath(_path);
	const path = normalized === '/' ? '/' : `${normalized}/`;
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	return `${serverUrl}${encodedPath}`;
}

function buildItemUrl(serverUrl: string, _path: string): string {
	const normalizedPath = normalizeRemotePath(_path);
	const path =
		normalizedPath !== '/' && _path.endsWith('/') ? `${normalizedPath}/` : normalizedPath;
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	return `${serverUrl}${encodedPath}`;
}

function convertToFileStat(
	stripPrefixes: Array<string>,
	item: WebDAVResponseItem,
): StatModel | undefined {
	const props = getValidProps(item);
	if (!props) return undefined;

	const isDir = isCollectionResource(props.resourcetype);

	let path = normalizePath(item.href);
	for (const prefix of stripPrefixes)
		if (prefix !== '/' && path.startsWith(prefix)) {
			path = path.slice(prefix.length);
			break;
		}

	const filename = isDir ? `${path}/` : path;
	const lastModResp = props.getlastmodified;

	// https://github.com/hesprs/obsidian-webdav-sync/issues/119#issuecomment-4467822635
	const lastMod =
		typeof lastModResp === 'string'
			? lastModResp
			: typeof lastModResp === 'object'
				? (lastModResp as { '#text': string })['#text']
				: '';

	return isDir
		? { isDir, path: filename }
		: {
				isDir,
				mtime: new Date(lastMod).valueOf(),
				path: filename,
				size: props.getcontentlength ? parseInt(props.getcontentlength) : 0,
			};
}

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <displayname/>
    <resourcetype/>
    <getlastmodified/>
    <getcontentlength/>
    <getcontenttype/>
  </prop>
</propfind>`;

async function propfind(
	endpoint: string,
	token: string,
	url: string,
	depth: '0' | '1' | 'infinity',
) {
	const settings = await useSettings();
	const maxRetries401 = settings.retry401.enabled ? settings.retry401.value : 10;
	const retry401WaitMs = (settings.retry401Interval.enabled ? settings.retry401Interval.value : 30) * 1000;
	const MAX_RETRIES = maxRetries401;
	let retryCount = 0;
	while (retryCount < MAX_RETRIES)
		try {
			const response = await requestUrl({
				body: PROPFIND_BODY,
				headers: {
					Authorization: `Basic ${token}`,
					'Content-Type': 'application/xml',
					Depth: depth,
				},
				method: 'PROPFIND',
				url,
			});

			const result: DAVResult = parseXML(response.text);
			const stripPrefixes = buildStripPrefixes(endpoint).sort((a, b) => b.length - a.length);
			const items = Array.isArray(result.multistatus.response)
				? result.multistatus.response
				: [result.multistatus.response];

			return {
				items,
				response,
				stripPrefixes,
			};
		} catch (error) {
			if (isRetryableError(error)) {
				retryCount++;
				const err = error as { status?: number; res?: { status?: number } };
				const statusCode = err.status ?? err.res?.status;
				const waitMs = statusCode === 401 ? retry401WaitMs : 5000;
				logger.error(
					`WebDAV ${statusCode === 401 ? '401 Unauthorized' : 'connection'} error (attempt ${retryCount}/${MAX_RETRIES}), retrying in ${waitMs / 1000}s...`,
					error,
				);
				await sleep(waitMs);
				continue;
			}
			throw error;
		}

	throw new Error(`WebDAV PROPFIND failed after ${MAX_RETRIES} retries`);
}

export async function getStat(endpoint: string, token: string, path: string): Promise<StatModel> {
	const { items, stripPrefixes } = await propfind(
		endpoint,
		token,
		buildItemUrl(endpoint, path),
		'0',
	);
	const normalizedTargetPath = normalizeRemotePath(path);

	for (const item of items) {
		const stat = convertToFileStat(stripPrefixes, item);
		if (!stat) continue;
		if (normalizeRemotePath(stat.path) === normalizedTargetPath) return stat;
	}

	throw new Error(`WebDAV stat not found for ${path}`);
}

export async function getDirectoryContents(
	endpoint: string,
	token: string,
	path: string,
	infinity = false,
): Promise<Array<StatModel>> {
	const settings = await useSettings();
	const maxRetries401 = settings.retry401.enabled ? settings.retry401.value : 10;
	const retry401WaitMs = (settings.retry401Interval.enabled ? settings.retry401Interval.value : 30) * 1000;
	const contents: Array<StatModel> = [];
	let currentUrl = buildDirectoryUrl(endpoint, path);

	let retryCount = 0;
	const MAX_RETRIES = maxRetries401;
	while (retryCount < MAX_RETRIES)
		try {
			const { items, response, stripPrefixes } = await propfind(
				endpoint,
				token,
				currentUrl,
				infinity ? 'infinity' : '1',
			);

			const parsedItems = items
				.slice(1)
				.map((item) => convertToFileStat(stripPrefixes, item))
				.filter((item): item is StatModel => item !== undefined);

			contents.push(...parsedItems);

			const linkHeader = response.headers.link || response.headers.Link;
			if (!linkHeader) break;

			const nextLink = extractNextLink(linkHeader);
			if (!nextLink) break;
			const nextUrl = new URL(nextLink);

			const pathName = normalizePath(nextUrl.pathname);
			nextUrl.pathname = `${pathName}/`;
			currentUrl = nextUrl.toString();

			// Reset retry count on successful pagination step
			retryCount = 0;
		} catch (error) {
			if (isRetryableError(error)) {
				retryCount++;
				const err = error as { status?: number; res?: { status?: number } };
				const statusCode = err.status ?? err.res?.status;
				const waitMs = statusCode === 401 ? retry401WaitMs : 5000;
				logger.error(
					`WebDAV ${statusCode === 401 ? '401 Unauthorized' : 'connection'} error (attempt ${retryCount}/${MAX_RETRIES}), retrying in ${waitMs / 1000}s...`,
					error,
				);
				await sleep(waitMs);
				continue;
			}
			throw error;
		}

	if (retryCount >= MAX_RETRIES)
		throw new Error(`WebDAV directory listing failed after ${MAX_RETRIES} retries`);

	return contents;
}
