import type { requestUrl } from 'obsidian';
import { syncCancelledError } from '~/sync';
import type { LocalFs, RemoteFs, WrappedLocalFs, WrappedRemoteFs } from '../interface';
import digOriginal from '../utils/dig-original';

function assertNotCancelled(isCancelled: () => boolean) {
	if (isCancelled()) throw syncCancelledError;
}

async function guardCancellation<T>(
	isCancelled: () => boolean,
	when: 'pre' | 'post' | 'both',
	operation: () => Promise<T> | T,
) {
	if (when !== 'post') assertNotCancelled(isCancelled);
	const result = await operation();
	if (when !== 'pre') assertNotCancelled(isCancelled);
	return result;
}

class CancellationRemoteFs implements WrappedRemoteFs {
	constructor(
		public readonly original: RemoteFs,
		private readonly isCancelled: () => boolean,
	) {}

	checkConnection() {
		return this.original.checkConnection();
	}

	getUid() {
		return this.original.getUid();
	}

	read(key: string, size?: number) {
		return guardCancellation(this.isCancelled, 'pre', () => this.original.read(key, size));
	}

	readStream(key: string, size?: number) {
		return guardCancellation(this.isCancelled, 'pre', () =>
			this.original.readStream(key, size),
		);
	}

	write(key: string, value: ArrayBuffer) {
		return guardCancellation(this.isCancelled, 'post', () => this.original.write(key, value));
	}

	delete(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.delete(key));
	}

	mkdir(key: string, recursive?: boolean) {
		return guardCancellation(this.isCancelled, 'both', () =>
			this.original.mkdir(key, recursive),
		);
	}

	stat(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.stat(key));
	}

	exists(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.exists(key));
	}

	list(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.list(key));
	}

	listAll(key: string, progress?: Parameters<RemoteFs['listAll']>[1]) {
		return guardCancellation(this.isCancelled, 'both', () =>
			this.original.listAll(key, progress),
		);
	}
}

class CancellationLocalFs implements WrappedLocalFs {
	constructor(
		public readonly original: LocalFs,
		private readonly isCancelled: () => boolean,
	) {}

	getUid() {
		return this.original.getUid();
	}

	read(key: string, size?: number) {
		return guardCancellation(this.isCancelled, 'pre', () => this.original.read(key, size));
	}

	write(key: string, value: ArrayBuffer) {
		return guardCancellation(this.isCancelled, 'post', () => this.original.write(key, value));
	}

	writeStream(key: string, value: ReadableStream<ArrayBuffer>) {
		return guardCancellation(this.isCancelled, 'post', () =>
			this.original.writeStream(key, value),
		);
	}

	delete(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.delete(key));
	}

	move(oldKey: string, newKey: string) {
		return guardCancellation(this.isCancelled, 'both', () =>
			this.original.move(oldKey, newKey),
		);
	}

	mkdir(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.mkdir(key));
	}

	stat(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.stat(key));
	}

	listAll(key: string) {
		return guardCancellation(this.isCancelled, 'both', () => this.original.listAll(key));
	}
}

export function remoteCancellationWrapper(
	original: RemoteFs,
	isCancelled: () => boolean,
): WrappedRemoteFs {
	const root = digOriginal(original);
	const request = root.request;
	root.request = (async (...args: Parameters<typeof requestUrl>) => {
		assertNotCancelled(isCancelled);
		const response = await request(...args);
		assertNotCancelled(isCancelled);
		return response;
	}) as typeof requestUrl;
	return new CancellationRemoteFs(original, isCancelled);
}

export function localCancellationWrapper(
	original: LocalFs,
	isCancelled: () => boolean,
): WrappedLocalFs {
	return new CancellationLocalFs(original, isCancelled);
}
