import type { DatabaseSync, StoreSync } from 'uni-kv';
import type { MemoryDBMeta, MemoryDBSchema } from '@/modules/Registrar';
import type { Progress, Stat } from '@/types';
import generateAnchor from '@/fs/utils/generate-anchor';
import type { RemoteFs, RemoteFsWrapper, WrappedRemoteFs } from '../interface';

const ROOT_KEY = '/';
const ROOT_ANCHOR = '00000';
const EMPTY_BUFFER = new ArrayBuffer(0);

type DB = DatabaseSync<MemoryDBSchema, MemoryDBMeta>;
type ParsedFlatKey =
	| { isDir: false; basename: string; parentAnchor: string }
	| { isDir: true; anchor: string; basename: string; parentAnchor: string };

function isRootKey(key: string) {
	return key === ROOT_KEY;
}

function isFolderKey(key: string) {
	return key.endsWith('/');
}

function getBaseName(key: string) {
	const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
	const segments = trimmed.split('/');
	return segments[segments.length - 1] ?? '';
}

function getParentFolderKey(key: string) {
	if (isRootKey(key)) return ROOT_KEY;
	const trimmed = key.endsWith('/') ? key.slice(0, -1) : key;
	const lastSlash = trimmed.lastIndexOf('/');
	if (lastSlash === -1) return ROOT_KEY;
	return trimmed.slice(0, lastSlash + 1);
}

function joinFolderKey(parentKey: string, basename: string) {
	return parentKey === ROOT_KEY ? `${basename}/` : `${parentKey}${basename}/`;
}

function joinFileKey(parentKey: string, basename: string) {
	return parentKey === ROOT_KEY ? basename : `${parentKey}${basename}`;
}

function isDescendantOrSelf(key: string, parentKey: string) {
	return parentKey === ROOT_KEY || key === parentKey || key.startsWith(parentKey);
}

function parseFlattenedKey(key: string): ParsedFlatKey | undefined {
	if (key === ROOT_KEY || key.includes('/')) return undefined;
	if (key.length > 6 && key[5] === '~') {
		const basename = key.slice(6);
		if (!basename) return undefined;
		return { basename, isDir: false, parentAnchor: key.slice(0, 5) };
	}
	if (key.length > 11 && key[10] === '~') {
		const basename = key.slice(11);
		if (!basename) return undefined;
		return {
			anchor: key.slice(5, 10),
			basename,
			isDir: true,
			parentAnchor: key.slice(0, 5),
		};
	}
	return undefined;
}

class AsymmetricStorageRemoteFs implements WrappedRemoteFs {
	private readonly statStore: StoreSync<Stat>;
	private readonly keyToAnchor = new Map<string, string>([[ROOT_KEY, ROOT_ANCHOR]]);
	private readonly anchorToKey = new Map<string, string>([[ROOT_ANCHOR, ROOT_KEY]]);
	private readonly knownAnchors = new Set<string>([ROOT_ANCHOR]);
	private bootstrapped = false;

	constructor(
		public readonly original: RemoteFs,
		DB: DB,
	) {
		this.statStore = DB.getStore('remoteStatContext');
	}

	checkConnection() {
		return this.original.checkConnection();
	}

	getUid() {
		return this.original.getUid();
	}

	async read(key: string, size?: number) {
		return await this.original.read(this.flattenKey(key), size);
	}

	async readStream(key: string, size?: number) {
		return await this.original.readStream(this.flattenKey(key), size);
	}

	async write(key: string, value: ArrayBuffer) {
		return await this.original.write(this.flattenKey(key), value);
	}

	async delete(key: string) {
		await this.original.delete(this.flattenKey(key));
		if (isFolderKey(key)) this.deleteMapping(key, this.ensureAnchor(key));
	}

	async move(oldKey: string, newKey: string) {
		const bothFolder = isFolderKey(oldKey) && isFolderKey(newKey);
		const flattenedOldKey = this.flattenKey(oldKey);
		const flattenedNewKey = bothFolder
			? this.flattenFolderKey(newKey, this.ensureAnchor(oldKey))
			: this.flattenKey(newKey);
		if (flattenedOldKey === flattenedNewKey) return;
		await this.original.move(flattenedOldKey, flattenedNewKey);
		if (!bothFolder) return;
		const oldAnchor = this.ensureAnchor(oldKey);
		this.deleteMapping(oldKey, oldAnchor);
		this.registerMapping(newKey, oldAnchor);
	}

	async mkdir(key: string, recursive?: boolean) {
		if (isRootKey(key)) {
			await this.original.mkdir(key, recursive);
			return;
		}
		await this.original.write(this.flattenKey(key), EMPTY_BUFFER);
	}

	async stat(key: string) {
		if (isRootKey(key)) return await this.original.stat(key);
		const stat = await this.original.stat(this.flattenKey(key));
		return this.inflateStat(stat) ?? stat;
	}

	exists(key: string) {
		return this.original.exists(this.flattenKey(key));
	}

	async list(key: string, progress?: (prog: Progress) => void) {
		const stats = await this.original.list(this.flattenKey(key), progress);
		const seen = new Set<string>();
		const result: Array<Stat> = [];
		for (const stat of stats) {
			const inflated = this.inflateStat(stat);
			if (!inflated || !isDescendantOrSelf(inflated.key, key) || seen.has(inflated.key))
				continue;
			seen.add(inflated.key);
			result.push(inflated);
		}
		return result;
	}

	private flattenKey(key: string) {
		if (isRootKey(key)) return ROOT_KEY;
		return isFolderKey(key) ? this.flattenFolderKey(key) : this.flattenFileKey(key);
	}

	private flattenFileKey(key: string) {
		const parentAnchor = this.ensureAnchor(getParentFolderKey(key));
		return `${parentAnchor}~${getBaseName(key)}`;
	}

	private flattenFolderKey(key: string, folderAnchor = this.ensureAnchor(key)) {
		const parentAnchor = this.ensureAnchor(getParentFolderKey(key));
		return `${parentAnchor}${folderAnchor}~${getBaseName(key)}`;
	}

	private inflateStat(stat: Stat): Stat | undefined {
		if (stat.key === ROOT_KEY) return { isDir: true, key: ROOT_KEY };
		this.bootstrapMaps();
		const parsed = parseFlattenedKey(stat.key);
		if (!parsed) return undefined;
		const parentKey = this.anchorToKey.get(parsed.parentAnchor);
		if (!parentKey) return undefined;
		if (parsed.isDir) {
			const folderKey = joinFolderKey(parentKey, parsed.basename);
			if (!this.registerMapping(folderKey, parsed.anchor)) return undefined;
			return { isDir: true, key: folderKey };
		}
		if (stat.isDir) return undefined;
		return { ...stat, key: joinFileKey(parentKey, parsed.basename) };
	}

	private ensureAnchor(folderKey: string): string {
		this.bootstrapMaps();
		const existing = this.keyToAnchor.get(folderKey);
		if (existing) return existing;
		if (isRootKey(folderKey)) return ROOT_ANCHOR;
		const parentAnchor = this.ensureAnchor(getParentFolderKey(folderKey));
		const anchor = generateAnchor(
			`${parentAnchor}~${getBaseName(folderKey)}`,
			this.knownAnchors,
		);
		this.registerMapping(folderKey, anchor);
		return anchor;
	}

	private bootstrapMaps() {
		if (this.bootstrapped) return;
		this.bootstrapped = true;
		const candidates: Array<{ anchor: string; basename: string; parentAnchor: string }> = [];
		for (const stat of this.statStore.values()) {
			const parsed = parseFlattenedKey(stat.key);
			if (parsed?.isDir)
				candidates.push({
					anchor: parsed.anchor,
					basename: parsed.basename,
					parentAnchor: parsed.parentAnchor,
				});
		}
		const pending = new Set(candidates.keys());
		let changed = true;
		while (changed && pending.size > 0) {
			changed = false;
			// oxlint-disable-next-line unicorn/no-useless-spread
			for (const index of [...pending]) {
				const candidate = candidates[index];
				const parentKey = this.anchorToKey.get(candidate.parentAnchor);
				if (!parentKey) continue;
				const folderKey = joinFolderKey(parentKey, candidate.basename);
				this.registerMapping(folderKey, candidate.anchor);
				pending.delete(index);
				changed = true;
			}
		}
	}

	private registerMapping(folderKey: string, anchor: string) {
		const currentAnchor = this.keyToAnchor.get(folderKey);
		if (currentAnchor) return currentAnchor === anchor;
		const currentFolderKey = this.anchorToKey.get(anchor);
		if (currentFolderKey) return currentFolderKey === folderKey;
		this.keyToAnchor.set(folderKey, anchor);
		this.anchorToKey.set(anchor, folderKey);
		this.knownAnchors.add(anchor);
		return true;
	}

	private deleteMapping(folderKey: string, anchor: string) {
		this.keyToAnchor.delete(folderKey);
		this.anchorToKey.delete(anchor);
		this.knownAnchors.delete(anchor);
	}
}

function asymmetricStorageWrapper(original: RemoteFs, options: DB): WrappedRemoteFs {
	return new AsymmetricStorageRemoteFs(original, options);
}

export default asymmetricStorageWrapper satisfies RemoteFsWrapper<DB>;
