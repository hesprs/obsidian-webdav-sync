import { type FileStat } from 'webdav';
import parseXML from '../../composable/parse-xml';
import { normalizeRemotePath, remoteBasename } from '../../platform/path';
import { isNil } from '../../utils/fns';
import isRetryableError from '../../utils/is-retryable-error';
import logger from '../../utils/logger';
import requestUrl from '../../utils/request-url';
import sleep from '../../utils/sleep';

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

type WebDAVResponse = {
	multistatus: {
		response: WebDAVResponseItem | Array<WebDAVResponseItem>;
	};
};

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

function hrefToPathname(href: string): string {
	if (href.startsWith('http://') || href.startsWith('https://'))
		return decodeURIComponent(new URL(href).pathname);
	return decodeURIComponent(href);
}

function normalizePathForMatch(pathname: string): string {
	return normalizeRemotePath(hrefToPathname(pathname || '/'));
}

function buildStripPrefixes(serverUrl: string): Array<string> {
	const endpointPath = normalizePathForMatch(new URL(serverUrl).pathname);
	return [endpointPath];
}

function buildDirectoryUrl(serverUrl: string, _path: string): string {
	const path = `${normalizeRemotePath(_path)}/`;
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	return `${serverUrl}${encodedPath}`;
}

function convertToFileStat(
	stripPrefixes: Array<string>,
	item: WebDAVResponseItem,
): FileStat | undefined {
	const props = getValidProps(item);
	if (!props) return undefined;

	const isDir = isCollectionResource(props.resourcetype);
	const hrefPathname = normalizePathForMatch(item.href);

	let relativePath = hrefPathname;
	for (const prefix of stripPrefixes)
		if (prefix !== '/' && hrefPathname.startsWith(prefix)) {
			relativePath = hrefPathname.slice(prefix.length);
			break;
		}

	const path = normalizeRemotePath(relativePath);
	const filename = isDir ? `${path}/` : path;

	return {
		basename: remoteBasename(filename),
		filename,
		lastmod: props.getlastmodified || '',
		mime: props.getcontenttype,
		size: props.getcontentlength ? parseInt(props.getcontentlength, 10) : 0,
		type: isDir ? 'directory' : 'file',
	};
}

export default async function getDirectoryContents(
	serverUrl: string,
	token: string,
	path: string,
	infinity = false,
): Promise<Array<Omit<FileStat, 'etag'>>> {
	const endpoint = serverUrl.trim().replace(/\/+$/, '');
	if (!endpoint) throw new Error('WebDAV server URL is not configured');

	const contents: Array<Omit<FileStat, 'etag'>> = [];
	const stripPrefixes = buildStripPrefixes(endpoint).sort((a, b) => b.length - a.length);
	let currentUrl = buildDirectoryUrl(endpoint, path);

	while (true)
		try {
			const response = await requestUrl({
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
				headers: {
					Authorization: `Basic ${token}`,
					'Content-Type': 'application/xml',
					Depth: infinity ? 'infinity' : '1',
				},
				method: 'PROPFIND',
				url: currentUrl,
			});

			const result: WebDAVResponse = parseXML(response.text);

			const items = Array.isArray(result.multistatus.response)
				? result.multistatus.response
				: [result.multistatus.response];

			const parsedItems = items
				.slice(1)
				.map((item) => convertToFileStat(stripPrefixes, item))
				.filter((item): item is FileStat => item !== undefined);

			contents.push(...parsedItems);

			const linkHeader = response.headers.link || response.headers.Link;
			if (!linkHeader) break;

			const nextLink = extractNextLink(linkHeader);
			if (!nextLink) break;
			const nextUrl = new URL(nextLink);

			const pathName = normalizeRemotePath(hrefToPathname(nextUrl.pathname));
			nextUrl.pathname = `${pathName}/`;
			currentUrl = nextUrl.toString();
		} catch (error) {
			if (isRetryableError(error)) {
				logger.error('WebDAV connection error, retrying...', error);
				await sleep(5000);
				continue;
			}
			throw error;
		}

	return contents;
}
