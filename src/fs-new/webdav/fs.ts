import type { Ref } from 'synthkernel';
import { requestUrl } from 'obsidian';
import parseXML from '~/composable/parse-xml';
import { normalizeRemotePath } from '~/platform/path';
import { isNil } from '~/utils/fns';
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

function normalizeEndpoint(endpoint: string) {
	return endpoint.replace(/\/+$/, '');
}

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

function extractPathname(href: string) {
	return decodeURIComponent(
		href.startsWith('http://') || href.startsWith('https://') ? new URL(href).pathname : href,
	);
}

function buildRemotePath(key: string, isDir: boolean) {
	if (key === '/') return '/';
	const normalized = normalizeRemotePath(key);
	return isDir ? `${normalized}/` : normalized;
}

function buildUrl(endpoint: string, key: string, isDir: boolean) {
	const path = buildRemotePath(key, isDir);
	const encodedPath = path.split('/').map(encodeURIComponent).join('/');
	return `${normalizeEndpoint(endpoint)}${encodedPath}`;
}

function getRequestStatus(error: unknown) {
	if (typeof error !== 'object' || error === null) return undefined;
	const res = (error as { res?: { status?: unknown } }).res;
	return typeof res?.status === 'number' ? res.status : undefined;
}

function getRecursiveDirectoryKeys(key: string) {
	const normalized = buildRemotePath(key, true);
	if (normalized === '/') return [];

	const keys: Array<string> = [];
	let current = '';
	for (const segment of normalized.slice(1, -1).split('/')) {
		current = current === '' ? segment : `${current}/${segment}`;
		keys.push(`${current}/`);
	}
	return keys;
}

function getTargetRemotePath(key: string) {
	return key === '/' ? '/' : normalizeRemotePath(key);
}

function stripEndpointPath(endpoint: string, href: string) {
	const endpointPath = normalizeRemotePath(new URL(endpoint).pathname);
	const path = normalizeRemotePath(extractPathname(href));
	if (endpointPath === '/') return path;
	if (path === endpointPath) return '/';
	if (!path.startsWith(`${endpointPath}/`)) return path;
	return path.slice(endpointPath.length);
}

function toStat(endpoint: string, item: WebDAVResponseItem): Stat | undefined {
	const propstats = item.propstat ? asArray(item.propstat) : [];
	const validPropstat = propstats.find(
		(propstat) => isSuccessStatus(propstat.status) && propstat.prop,
	);
	if (!validPropstat?.prop) return undefined;

	const remotePath = stripEndpointPath(endpoint, item.href);
	const isDir = isCollectionResource(validPropstat.prop.resourcetype);
	if (remotePath === '/') return { isDir: true, key: '/' };

	const key = remotePath.slice(1);
	if (isDir) return { isDir: true, key: `${key}/` };

	const mtime = new Date(getDavText(validPropstat.prop.getlastmodified) ?? '').valueOf();
	const size = Number.parseInt(getDavText(validPropstat.prop.getcontentlength) ?? '0', 10);
	const uid = getDavText(validPropstat.prop.getetag) ?? String(mtime);

	return {
		isDir: false,
		key,
		mtime,
		size,
		uid,
	};
}

type PropfindOptions = {
	depth: '0' | '1' | 'infinity';
	isDir: boolean;
	key: string;
};

async function propfind(
	request: typeof requestUrl,
	options: WebdavFsOptions,
	propfindOptions: PropfindOptions,
) {
	const response = await request({
		body: PROPFIND_BODY,
		headers: {
			Authorization: getAuthorization(options.username, options.password),
			'Content-Type': 'application/xml',
			Depth: propfindOptions.depth,
		},
		method: 'PROPFIND',
		url: buildUrl(options.endpoint, propfindOptions.key, propfindOptions.isDir),
	});

	const parsed = parseXML(response.text) as WebDAVMultistatus;
	return asArray(parsed.multistatus.response);
}

function isTargetItem(key: string, endpoint: string, item: WebDAVResponseItem) {
	return stripEndpointPath(endpoint, item.href) === getTargetRemotePath(key);
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

	constructor(options: WebdavFsOptions, request?: typeof requestUrl) {
		super(options, request);
		this.auth = getAuthorization(this.options.username, this.options.password);
	}

	getUid() {
		return `${this.options.endpoint}~${this.options.username}`;
	}

	async checkConnection() {
		try {
			const response = await this.request({
				body: '<D:propfind xmlns:D="DAV:"/>',
				headers: { Authorization: this.auth, Depth: '0' },
				method: 'PROPFIND',
				url: buildUrl(this.options.endpoint, '/', true),
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
			url: buildUrl(this.options.endpoint, key, false),
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
					url: buildUrl(this.options.endpoint, key, false),
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
			url: buildUrl(this.options.endpoint, key, false),
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
				url: buildUrl(this.options.endpoint, key, false),
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
		const directoryKeys = recursive ? getRecursiveDirectoryKeys(key) : [key];

		for (const directoryKey of directoryKeys)
			try {
				await this.request({
					headers: { Authorization: this.auth },
					method: 'MKCOL',
					url: buildUrl(this.options.endpoint, directoryKey, true),
				});
			} catch (error) {
				if (recursive && getRequestStatus(error) === 405) continue;
				throw error;
			}
	}

	async stat(key: string): Promise<Stat> {
		if (key === '/') return { isDir: true, key: '/' } satisfies FolderStat;

		const items = await propfind(this.request, this.options, {
			depth: '0',
			isDir: key.endsWith('/'),
			key,
		});
		const item = items.find((candidate) => isTargetItem(key, this.options.endpoint, candidate));
		if (!item) throw new Error(`WebDAV stat not found for ${key}`);

		const stat = toStat(this.options.endpoint, item);
		if (!stat) throw new Error(`WebDAV stat not found for ${key}`);
		return stat;
	}

	async list(key: string) {
		const items = await propfind(this.request, this.options, {
			depth: '1',
			isDir: true,
			key,
		});
		return toDescendantStats(key, this.options.endpoint, items);
	}

	async listAll(key: string, progress?: Ref<Progress>) {
		if (this.options.useInfinity) {
			const items = await propfind(this.request, this.options, {
				depth: 'infinity',
				isDir: true,
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
