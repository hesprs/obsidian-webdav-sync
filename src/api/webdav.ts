import type { FileStat } from 'webdav';
import { XMLParser } from 'fast-xml-parser';
import { isNil } from 'lodash-es';
import { basename, join } from 'path-browserify';
import { is503Error } from '~/utils/is-503-error';
import logger from '~/utils/logger';
import requestUrl from '~/utils/request-url';
import sleep from '~/utils/sleep';

interface WebDAVResponse {
	multistatus: {
		response: Array<{
			href: string;
			propstat: {
				prop: {
					displayname: string;
					resourcetype: { collection?: unknown };
					getlastmodified?: string;
					getcontentlength?: string;
					getcontenttype?: string;
				};
				status: string;
			};
		}>;
	};
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
	if (normalized === '' || normalized === '/') {
		return '/';
	}
	return normalized.endsWith('/') ? normalized.slice(0, -1) : normalized;
}

function buildStripPrefixes(serverUrl: string, targetPath: string): string[] {
	const endpointPath = normalizePathForMatch(new URL(serverUrl).pathname);
	const requestedPath = normalizePathForMatch(targetPath);

	if (requestedPath === '/') {
		return [endpointPath];
	}

	const endpointWithRequest = normalizePathForMatch(join(endpointPath, requestedPath));
	return [endpointWithRequest, requestedPath];
}

function convertToFileStat(
	stripPrefixes: string[],
	item: WebDAVResponse['multistatus']['response'][number],
): FileStat {
	const props = item.propstat.prop;
	const isDir = !isNil(props.resourcetype?.collection);
	const hrefPathname = hrefToPathname(item.href);

	let relativePath = hrefPathname;
	for (const prefix of stripPrefixes) {
		if (prefix !== '/' && hrefPathname.startsWith(prefix)) {
			relativePath = hrefPathname.slice(prefix.length);
			break;
		}
	}

	const filename = join('/', relativePath || '/');

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
	if (!endpoint) {
		throw new Error('WebDAV server URL is not configured');
	}

	const contents: FileStat[] = [];
	const normalizedPath = path.startsWith('/') ? path : `/${path}`;
	const encodedPath = normalizedPath.split('/').map(encodeURIComponent).join('/');
	const stripPrefixes = buildStripPrefixes(endpoint, normalizedPath).sort(
		(a, b) => b.length - a.length,
	);
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

			contents.push(...items.slice(1).map((item) => convertToFileStat(stripPrefixes, item)));

			const linkHeader = response.headers['link'] || response.headers['Link'];
			if (!linkHeader) {
				break;
			}

			const nextLink = extractNextLink(linkHeader);
			if (!nextLink) {
				break;
			}
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
