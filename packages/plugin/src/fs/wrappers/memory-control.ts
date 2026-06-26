import type { LocalFs, RemoteFs, WrappedLocalFs, WrappedRemoteFs } from '../interface';

type HangingOperation = {
	size: number;
	resume: () => void;
};

export type MemoryControlSharedState = {
	memoryConsumption: number;
	hangingOperations: Array<HangingOperation>;
	maxMemory: number;
};

const STREAM_RESERVATION_SIZE = 4 * 1024 * 1024;

function canReserve(state: MemoryControlSharedState, size: number) {
	return state.memoryConsumption + size <= state.maxMemory;
}

function insertHangingOperation(state: MemoryControlSharedState, operation: HangingOperation) {
	const { hangingOperations } = state;
	let index = 0;
	while (index < hangingOperations.length && hangingOperations[index].size <= operation.size)
		index += 1;
	hangingOperations.splice(index, 0, operation);
}

function resumeHangingOperations(state: MemoryControlSharedState) {
	while (state.hangingOperations.length > 0) {
		const operation = state.hangingOperations[0];
		if (!canReserve(state, operation.size)) return;
		state.hangingOperations.shift();
		state.memoryConsumption += operation.size;
		operation.resume();
	}
}

function reserveMemory(state: MemoryControlSharedState, size: number) {
	if (canReserve(state, size)) {
		state.memoryConsumption += size;
		return Promise.resolve();
	}

	return new Promise<void>((resolve) => {
		insertHangingOperation(state, {
			resume: () => resolve(),
			size,
		});
	});
}

function releaseMemory(state: MemoryControlSharedState, size: number) {
	state.memoryConsumption = Math.max(0, state.memoryConsumption - size);
	resumeHangingOperations(state);
}

async function readThroughMemory(
	fs: RemoteFs | LocalFs,
	state: MemoryControlSharedState,
	key: string,
	size?: number,
) {
	const readSize = await resolveReadSize(fs, key, size);
	await reserveMemory(state, readSize);
	try {
		return await fs.read(key, readSize);
	} catch (error) {
		releaseMemory(state, readSize);
		throw error;
	}
}

async function writeThroughMemory(
	fs: RemoteFs | LocalFs,
	state: MemoryControlSharedState,
	key: string,
	value: ArrayBuffer,
) {
	try {
		return await fs.write(key, value);
	} finally {
		releaseMemory(state, value.byteLength);
	}
}

function createReleasingReadableStream(source: ReadableStream<ArrayBuffer>, release: () => void) {
	let reader: ReadableStreamDefaultReader<ArrayBuffer> | undefined;
	let released = false;

	const releaseOnce = () => {
		if (released) return;
		released = true;
		release();
	};

	return new ReadableStream<ArrayBuffer>({
		async cancel(reason) {
			releaseOnce();
			if (!reader) {
				await source.cancel(reason);
				return;
			}
			try {
				await reader.cancel(reason);
			} finally {
				reader.releaseLock();
			}
		},
		async pull(controller) {
			const currentReader = reader;
			if (!currentReader) return;
			try {
				const { value, done } = await currentReader.read();
				if (done) {
					releaseOnce();
					currentReader.releaseLock();
					controller.close();
					return;
				}
				controller.enqueue(value);
			} catch (error) {
				releaseOnce();
				currentReader.releaseLock();
				controller.error(error);
			}
		},
		start() {
			reader = source.getReader();
		},
	});
}

async function resolveReadSize(fs: RemoteFs | LocalFs, key: string, size?: number) {
	if (typeof size === 'number') return size;
	const stat = await fs.stat(key);
	if (stat.isDir) throw new Error('Cannot read a folder');
	return stat.size;
}

class MemoryControlRemoteFs implements WrappedRemoteFs {
	constructor(
		public readonly original: RemoteFs,
		private readonly state: MemoryControlSharedState,
	) {}

	checkConnection() {
		return this.original.checkConnection();
	}

	getUid() {
		return this.original.getUid();
	}

	async read(key: string, size?: number) {
		return await readThroughMemory(this.original, this.state, key, size);
	}

	async readStream(key: string, size?: number) {
		await reserveMemory(this.state, STREAM_RESERVATION_SIZE);
		try {
			const source = await this.original.readStream(key, size);
			return createReleasingReadableStream(source, () =>
				releaseMemory(this.state, STREAM_RESERVATION_SIZE),
			);
		} catch (error) {
			releaseMemory(this.state, STREAM_RESERVATION_SIZE);
			throw error;
		}
	}

	async write(key: string, value: ArrayBuffer) {
		return await writeThroughMemory(this.original, this.state, key, value);
	}

	delete(key: string) {
		return this.original.delete(key);
	}

	mkdir(key: string, recursive?: boolean) {
		return this.original.mkdir(key, recursive);
	}

	stat(key: string) {
		return this.original.stat(key);
	}

	exists(key: string) {
		return this.original.exists(key);
	}

	list(key: string) {
		return this.original.list(key);
	}

	listAll(key: string, progress?: Parameters<RemoteFs['listAll']>[1]) {
		return this.original.listAll(key, progress);
	}
}

class MemoryControlVaultFs implements WrappedLocalFs {
	constructor(
		public readonly original: LocalFs,
		private readonly state: MemoryControlSharedState,
	) {}

	getUid() {
		return this.original.getUid();
	}

	async read(key: string, size?: number) {
		return await readThroughMemory(this.original, this.state, key, size);
	}

	async write(key: string, value: ArrayBuffer) {
		return await writeThroughMemory(this.original, this.state, key, value);
	}

	async writeStream(key: string, value: ReadableStream<ArrayBuffer>) {
		let consumedBytes = 0;
		const relayedValue = value.pipeThrough(
			new TransformStream<ArrayBuffer, ArrayBuffer>({
				transform(chunk, controller) {
					consumedBytes += chunk.byteLength;
					controller.enqueue(chunk);
				},
			}),
		);

		try {
			return await this.original.writeStream(key, relayedValue);
		} finally {
			releaseMemory(this.state, consumedBytes);
		}
	}

	delete(key: string) {
		return this.original.delete(key);
	}

	move(oldKey: string, newKey: string) {
		return this.original.move(oldKey, newKey);
	}

	mkdir(key: string) {
		return this.original.mkdir(key);
	}

	stat(key: string) {
		return this.original.stat(key);
	}

	listAll(key: string) {
		return this.original.listAll(key);
	}
}

export function remoteMemoryControlWrapper(
	original: RemoteFs,
	state: MemoryControlSharedState,
): WrappedRemoteFs {
	return new MemoryControlRemoteFs(original, state);
}

export function localMemoryControlWrapper(
	original: LocalFs,
	state: MemoryControlSharedState,
): WrappedLocalFs {
	return new MemoryControlVaultFs(original, state);
}
