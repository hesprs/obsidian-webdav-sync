import type { FileStat } from 'webdav';
import { XMLParser } from 'fast-xml-parser';
import { isNil } from 'lodash-es';
import { basename } from 'node:path';
import { is503Error } from './utils/is-503-error';
import logger from './utils/logger';
import requestUrl from './utils/request-url';
import sleep from './utils/sleep';

interface WebDAVProp {
	displayname?: string;
	resourcetype?: { collection?: unknown } | string;
	getlastmodified?: string;
	getcontentlength?: string;
	getcontenttype?: string;
}

interface WebDAVPropstat {
	prop?: WebDAVProp;
	status?: string;
}

interface WebDAVResponseItem {
	href: string;
	propstat?: WebDAVPropstat | WebDAVPropstat[];
}

interface WebDAVResponse {
	multistatus: {
		response: WebDAVResponseItem | WebDAVResponseItem[];
	};
}

function isSuccessStatus(status?: string): boolean {
	if (!status) return true;
	const match = status.match(/\s(\d{3})(?:\s|$)/);
	if (!match) return false;
	const code = Number.parseInt(match[1], 10);
	return code >= 200 && code < 300;
}

function getValidProps(item: WebDAVResponseItem): WebDAVProp | null {
	if (!item.propstat) return null;

	const propstats = Array.isArray(item.propstat) ? item.propstat : [item.propstat];

	for (const propstat of propstats) {
		if (!isSuccessStatus(propstat.status)) continue;
		if (propstat.prop) return propstat.prop;
	}

	return null;
}

function isCollectionResource(resourcetype: WebDAVProp['resourcetype']): boolean {
	if (!resourcetype) return false;
	if (typeof resourcetype === 'string') return resourcetype.toLowerCase() === 'collection';
	return !isNil(resourcetype.collection);
}

function extractNextLink(linkHeader: string): string | null {
	const matches = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
	return matches ? matches[1] : null;
}

function hrefToPathname(href: string): string {
	if (href.startsWith('http://') || href.startsWith('https://')) {
		return decodeURIComponent(new URL(href).pathname);
	}
	return decodeURIComponent(href);
}

function normalizePathForMatch(pathname: string): string {
	const normalized = decodeURIComponent(pathname || '/');
	if (normalized === '' || normalized === '/') return '/';
	return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function buildStripPrefixes(serverUrl: string): string[] {
	const endpointPath = normalizePathForMatch(new URL(serverUrl).pathname);
	return [endpointPath];
}

function convertToFileStat(stripPrefixes: string[], item: WebDAVResponseItem): FileStat | null {
	const props = getValidProps(item);
	if (!props) return null;

	const isDir = isCollectionResource(props.resourcetype);
	const hrefPathname = hrefToPathname(item.href);

	let relativePath = hrefPathname;
	for (const prefix of stripPrefixes) {
		if (prefix !== '/' && hrefPathname.startsWith(prefix)) {
			relativePath = hrefPathname.slice(prefix.length);
			break;
		}
	}

	const filename = `/${(relativePath || '/').replace(/^\/+/, '')}`;

	return {
		filename,
		basename: basename(filename),
		lastmod: props.getlastmodified || '',
		size: props.getcontentlength ? parseInt(props.getcontentlength, 10) : 0,
		type: isDir ? 'directory' : 'file',
		etag: null,
		mime: props.getcontenttype,
	};
}

export async function getDirectoryContents(
	serverUrl: string,
	token: string,
	path: string,
): Promise<FileStat[]> {
	const endpoint = serverUrl.trim().replace(/\/+$/, '');
	if (!endpoint) throw new Error('WebDAV server URL is not configured');

	const contents: FileStat[] = [];
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
	const stripPrefixes = buildStripPrefixes(endpoint).sort((a, b) => b.length - a.length);
	let currentUrl = `${endpoint}${encodedPath}`;

	while (true) {
		try {
			const response = await requestUrl({
				url: currentUrl,
				method: 'PROPFIND',
				headers: {
					Authorization: `Basic ${token}`,
					'Content-Type': 'application/xml',
					Depth: '1',
				},
				body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <displayname/>
    <resourcetype/>
    <getlastmodified/>
    <getcontentlength/>
    <getcontenttype/>
  </prop>
</propfind>`,
			});
			const parseXml = new XMLParser({
				attributeNamePrefix: '',
				removeNSPrefix: true,
				parseTagValue: false,
				numberParseOptions: {
					eNotation: false,
					hex: true,
					leadingZeros: true,
				},
				processEntities: false,
			});
			const result: WebDAVResponse = parseXml.parse(response.text);
			const items = Array.isArray(result.multistatus.response)
				? result.multistatus.response
				: [result.multistatus.response];

			const parsedItems = items
				.slice(1)
				.map((item) => convertToFileStat(stripPrefixes, item))
				.filter((item): item is FileStat => item !== null);

			contents.push(...parsedItems);

			const linkHeader = response.headers['link'] || response.headers['Link'];
			if (!linkHeader) {
				break;
			}

			const nextLink = extractNextLink(linkHeader);
			if (!nextLink) break;
			const nextUrl = new URL(nextLink);
			nextUrl.pathname = decodeURI(nextUrl.pathname);
			currentUrl = nextUrl.toString();
		} catch (e) {
			if (is503Error(e as Error)) {
				logger.error('503 error, retrying...');
				await sleep(60_000);
				continue;
			}
			throw e;
		}
	}

	return contents;
}
