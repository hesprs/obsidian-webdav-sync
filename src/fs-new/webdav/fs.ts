import type { Ref } from 'synthkernel';
import { requestUrl } from 'obsidian';
import parseXML from '~/composable/parse-xml';
import { dirname, normalizeChar, normalizeKey, normalizeUrl, stripEndSlash } from '~/platform/path';
import { isNil } from '~/utils/fns';
import getStatusFromError from '~/utils/get-status-from-error';
import type { FolderStat, Progress, Stat } from '../interface';
import { RemoteFs } from '../interface';
import { createWebDAVReadStream } from './read-stream';

export type WebdavFsOptions = {
	endpoint: string;
	username: string;
	password: string;
	useInfinity?: boolean;
};

type WebDAVPropValue = string | { '#text'?: string } | undefined;

type WebDAVProp = {
	displayname?: WebDAVPropValue;
	getcontentlength?: WebDAVPropValue;
	getetag?: WebDAVPropValue;
	getlastmodified?: WebDAVPropValue;
	resourcetype?: { collection?: unknown } | string;
};

type WebDAVPropstat = {
	prop?: WebDAVProp;
	status?: string;
};

type WebDAVResponseItem = {
	href: string;
	propstat?: WebDAVPropstat | Array<WebDAVPropstat>;
};

type WebDAVMultistatus = {
	multistatus: {
		response: WebDAVResponseItem | Array<WebDAVResponseItem>;
	};
};

const PROPFIND_BODY = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <displayname/>
    <resourcetype/>
    <getlastmodified/>
    <getcontentlength/>
    <getetag/>
  </prop>
</propfind>`;

const READ_CHUNK_SIZE = 2 * 1024 * 1024;
const READ_MAX_CONCURRENT = 8;

function getAuthorization(username: string, password: string) {
	return `Basic ${btoa(`${username}:${password}`)}`;
}

function getHeader(headers: Record<string, string | undefined>, name: string) {
	const entry = Object.entries(headers).find(
		([headerName]) => headerName.toLowerCase() === name.toLowerCase(),
	);
	return entry?.[1];
}

function getDavText(value: WebDAVPropValue) {
	if (typeof value === 'string') return value;
	if (!value || typeof value !== 'object') return undefined;
	const text = value['#text'];
	return typeof text === 'string' ? text : undefined;
}

function isCollectionResource(resourcetype: WebDAVProp['resourcetype']) {
	if (!resourcetype) return false;
	if (typeof resourcetype === 'string') return resourcetype.toLowerCase() === 'collection';
	return 'collection' in resourcetype;
}

function isSuccessStatus(status: string | undefined) {
	if (!status) return true;
	const match = /\s(?<code>\d{3})(?:\s|$)/.exec(status);
	if (!match) return false;
	const code = Number.parseInt(match.groups?.code ?? '', 10);
	return code >= 200 && code < 300;
}

function asArray<T>(value: T | Array<T>) {
	return Array.isArray(value) ? value : [value];
}

function prependSlash(key: string) {
	if (key === '/') return '/';
	return `/${key}`;
}

function buildUrl(endpoint: string, key: string) {
	const encodedPath = key.split('/').map(encodeURIComponent).join('/');
	return `${endpoint}${prependSlash(encodedPath)}`;
}

function getRecursiveKeys(key: string) {
	const keys: Array<string> = [];
	while (key !== '/') {
		keys.push(key);
		key = dirname(key);
	}
	return keys.reverse();
}

function stripEndpoint(endpoint: string, href: string) {
	if (href.startsWith(endpoint)) href = href.slice(endpoint.length);
	return href.slice(1);
}

function toStat(endpoint: string, item: WebDAVResponseItem): Stat | undefined {
	const propstats = item.propstat ? asArray(item.propstat) : [];
	const validPropstat = propstats.find(
		(propstat) => isSuccessStatus(propstat.status) && propstat.prop,
	);
	if (!validPropstat?.prop) return;

	const remotePath = stripEndpoint(endpoint, item.href);
	const isDir = isCollectionResource(validPropstat.prop.resourcetype);
	if (remotePath === '') return { isDir: true, key: '/' };

	const key = normalizeKey(normalizeChar(remotePath), isDir);
	if (isDir) return { isDir: true, key };

	const mtime = new Date(getDavText(validPropstat.prop.getlastmodified) ?? '').valueOf();
	const size = Number.parseInt(getDavText(validPropstat.prop.getcontentlength) ?? '0', 10);
	const uid = getDavText(validPropstat.prop.getetag) ?? mtime.toString();

	return { isDir: false, key, mtime, size, uid };
}

type PropfindOptions = {
	depth: '0' | '1' | 'infinity';
	key: string;
};

async function propfind(
	request: typeof requestUrl,
	auth: string,
	endpoint: string,
	propfindOptions: PropfindOptions,
) {
	const response = await request({
		body: PROPFIND_BODY,
		headers: {
			Authorization: auth,
			'Content-Type': 'application/xml',
			Depth: propfindOptions.depth,
		},
		method: 'PROPFIND',
		url: buildUrl(endpoint, propfindOptions.key),
	});

	const parsed = parseXML(response.text) as WebDAVMultistatus;
	return asArray(parsed.multistatus.response);
}

function isTargetItem(key: string, endpoint: string, item: WebDAVResponseItem) {
	return normalizeChar(stripEndSlash(stripEndpoint(endpoint, item.href))) === stripEndSlash(key);
}

function toDescendantStats(key: string, endpoint: string, items: Array<WebDAVResponseItem>) {
	return items
		.filter((item) => !isTargetItem(key, endpoint, item))
		.map((item) => toStat(endpoint, item))
		.filter((item): item is Stat => item !== undefined);
}

function getFileUid(stat: Stat, key: string) {
	if (stat.isDir) throw new Error(`WebDAV write returned a folder stat for ${key}`);
	return stat.uid;
}

export default class WebdavFs extends RemoteFs<WebdavFsOptions> {
	private readonly auth: string;
	private readonly endpoint: string;

	constructor(options: WebdavFsOptions, request?: typeof requestUrl) {
		super(options, request);
		this.auth = getAuthorization(this.options.username, this.options.password);
		this.endpoint = normalizeUrl(this.options.endpoint);
	}

	getUid() {
		return `webdav~${this.options.endpoint}~${this.options.username}`;
	}

	async checkConnection() {
		try {
			const response = await this.request({
				body: '<D:propfind xmlns:D="DAV:"/>',
				headers: { Authorization: this.auth, Depth: '0' },
				method: 'PROPFIND',
				url: buildUrl(this.endpoint, '/'),
			});
			if (response.status === 200 || response.status === 207)
				return { success: true } as const;
			return { reason: response.status.toString(), success: false } as const;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			return {
				reason: errorMessage,
				success: false,
			} as const;
		}
	}

	async read(key: string) {
		const response = await this.request({
			headers: { Authorization: this.auth },
			method: 'GET',
			url: buildUrl(this.endpoint, key),
		});

		return response.arrayBuffer;
	}

	async readStream(key: string, totalSize?: number) {
		let size: number;
		if (!isNil(totalSize)) size = totalSize;
		else {
			const stat = await this.stat(key);
			if (stat.isDir) throw new Error('Cannot stream a folder');
			size = stat.size;
		}

		return createWebDAVReadStream({
			chunkSize: READ_CHUNK_SIZE,
			maxConcurrent: READ_MAX_CONCURRENT,
			requestRange: async (start, endInclusive) => {
				const response = await this.request({
					headers: {
						Authorization: this.auth,
						Range: `bytes=${start}-${endInclusive}`,
					},
					method: 'GET',
					url: buildUrl(this.endpoint, key),
				});

				return response.arrayBuffer;
			},
			size,
		});
	}

	async write(key: string, value: ArrayBuffer) {
		const response = await this.request({
			body: value,
			headers: { Authorization: this.auth },
			method: 'PUT',
			url: buildUrl(this.endpoint, key),
		});

		const etag = getHeader(response.headers, 'etag');
		if (etag) return etag;

		return getFileUid(await this.stat(key), key);
	}

	async delete(key: string) {
		try {
			await this.request({
				headers: { Authorization: this.auth },
				method: 'DELETE',
				url: buildUrl(this.endpoint, key),
			});
		} catch (error) {
			const status =
				error && typeof error === 'object' && 'res' in error
					? (error as { res?: { status?: number } }).res?.status
					: undefined;
			if (status === 404) return;
			throw error;
		}
	}

	async mkdir(key: string, recursive = false) {
		const directoryKeys = recursive ? getRecursiveKeys(key) : [key];

		for (const directoryKey of directoryKeys)
			try {
				await this.request({
					headers: { Authorization: this.auth },
					method: 'MKCOL',
					url: buildUrl(this.endpoint, directoryKey),
				});
			} catch (error) {
				if (recursive && getStatusFromError(error) === 405) continue;
				throw error;
			}
	}

	async stat(key: string): Promise<Stat> {
		if (key === '/') return { isDir: true, key: '/' } satisfies FolderStat;

		const items = await propfind(this.request, this.auth, this.endpoint, { depth: '0', key });
		const item = items.find((candidate) => isTargetItem(key, this.options.endpoint, candidate));
		if (!item) throw new Error(`WebDAV stat not found for ${key}`);

		const stat = toStat(this.options.endpoint, item);
		if (!stat) throw new Error(`WebDAV stat not found for ${key}`);
		return stat;
	}

	async exists(key: string): Promise<boolean> {
		try {
			const items = await propfind(this.request, this.auth, this.endpoint, {
				depth: '0',
				key,
			});
			const item = items.find((candidate) =>
				isTargetItem(key, this.options.endpoint, candidate),
			);
			return Boolean(item);
		} catch (error: unknown) {
			if (getStatusFromError(error) === 404) return false;
			throw error;
		}
	}

	async list(key: string) {
		const items = await propfind(this.request, this.auth, this.endpoint, { depth: '1', key });
		return toDescendantStats(key, this.options.endpoint, items);
	}

	async listAll(key: string, progress?: Ref<Progress>) {
		if (this.options.useInfinity) {
			const items = await propfind(this.request, this.auth, this.endpoint, {
				depth: 'infinity',
				key,
			});
			const result = toDescendantStats(key, this.options.endpoint, items);

			progress?.({ completed: 1, total: 1 });
			return result;
		}

		const result: Array<Stat> = [];
		const queue = [key];
		let completed = 0;

		progress?.({ completed: 0, total: 1 });

		while (queue.length > 0) {
			const currentLevelKeys = queue.splice(0);
			const nextLevelKeysByIndex: Array<Array<string>> = currentLevelKeys.map(() => []);
			let discoveredCount = 0;
			let remainingCurrentLevelCount = currentLevelKeys.length;

			const currentLevelResults = await Promise.all(
				currentLevelKeys.map(async (currentKey, index) => {
					const items = await this.list(currentKey);
					const nextLevelKeys: Array<string> = [];
					for (const item of items) if (item.isDir) nextLevelKeys.push(item.key);

					nextLevelKeysByIndex[index] = nextLevelKeys;
					discoveredCount += nextLevelKeys.length;
					completed++;
					remainingCurrentLevelCount--;
					progress?.({
						completed,
						total: completed + discoveredCount + remainingCurrentLevelCount,
					});

					return items;
				}),
			);

			for (const items of currentLevelResults) for (const item of items) result.push(item);
			for (const nextLevelKeys of nextLevelKeysByIndex) queue.push(...nextLevelKeys);
		}

		return result;
	}
}
