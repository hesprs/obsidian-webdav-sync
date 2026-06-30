import type { MaybePromise, Progress } from '@/types';
import type {
	BatchOptimizer,
	DeleteAtom,
	InputAtom,
	LocalFs,
	MkdirAtom,
	MoveAtom,
	RemoteFs,
	WrappedLocalFs,
	WrappedRemoteFs,
	WriteAtom,
} from '../interface';

type OptimizationOptions<Fs extends RemoteFs | LocalFs> = {
	remotePool: Array<string>;
	localPool: Array<string>;
	batchOptimizer: BatchOptimizer<Fs>;
};

class OptimizationRemoteFs implements WrappedRemoteFs {
	private scheduled = false;
	private readonly queue: Array<InputAtom> = [];
	private readonly pendingWrites = new Map<
		string,
		(write: () => MaybePromise<string>) => Promise<string>
	>();

	constructor(
		public readonly original: RemoteFs,
		private readonly options: OptimizationOptions<RemoteFs>,
	) {}

	checkConnection() {
		return this.original.checkConnection();
	}

	getUid() {
		return this.original.getUid();
	}

	private enqueueExecution({ execute: e, ...rest }: MoveAtom | DeleteAtom | MkdirAtom) {
		const { defer, execute } = createCachedPromise(e);
		this.queue.push({ ...rest, execute });
		this.scheduleFlush();
		return defer;
	}

	read(key: string, size?: number) {
		this.options.remotePool.push(key);
		return this.original.read(key, size);
	}

	readStream(key: string, size?: number) {
		this.options.remotePool.push(key);
		return this.original.readStream(key, size);
	}

	delete(key: string) {
		return this.enqueueExecution({
			execute: () => this.original.delete(key),
			key,
			type: 'delete',
		});
	}

	mkdir(key: string, recursive?: boolean) {
		return this.enqueueExecution({
			execute: () => this.original.mkdir(key, recursive),
			key,
			type: 'mkdir',
		});
	}

	write(key: string, value: ArrayBuffer) {
		const anticipated = this.pendingWrites.get(key);
		if (anticipated) return anticipated(() => this.original.write(key, value));
		return this.original.write(key, value);
	}

	move(oldKey: string, newKey: string) {
		return this.enqueueExecution({
			execute: () => this.original.move(oldKey, newKey),
			newKey,
			oldKey,
			type: 'move',
		});
	}

	stat(key: string) {
		return this.original.stat(key);
	}

	exists(key: string) {
		return this.original.exists(key);
	}

	list(key: string, progress?: (progress: Progress) => void) {
		return this.original.list(key, progress);
	}

	private scheduleFlush() {
		if (this.scheduled) return;
		this.scheduled = true;
		queueMicrotask(() => {
			void this.flush();
			this.scheduled = false;
		});
	}

	private async flush() {
		if (this.queue.length === 1) await (this.queue.pop() as InputAtom).execute();
		else {
			const writeAtoms = this.options.localPool.splice(0).map((key): WriteAtom => {
				const anticipateWrite = new Promise<() => MaybePromise<string>>((resolve) => {
					this.pendingWrites.set(key, (write: () => MaybePromise<string>) => {
						this.pendingWrites.delete(key);
						const { execute, defer } = createCachedPromise(write);
						resolve(execute);
						return defer;
					});
				});
				return {
					execute: () => anticipateWrite.then((write) => write()),
					key,
					type: 'write',
				};
			});
			const atoms = [...this.queue.splice(0), ...writeAtoms];
			const optimizedAtoms = this.options.batchOptimizer({
				atoms,
				executeAtom: (atom) => atom.execute(),
				fs: this.original,
			});
			await Promise.all(optimizedAtoms.map((atom) => atom.execute()));
		}
	}
}

class OptimizationLocalFs implements WrappedLocalFs {
	private scheduled = false;
	private readonly queue: Array<InputAtom> = [];
	private readonly pendingWrites = new Map<
		string,
		(write: () => MaybePromise<string>) => Promise<string>
	>();

	constructor(
		public readonly original: LocalFs,
		private readonly options: OptimizationOptions<LocalFs>,
	) {}

	getUid(): string {
		return this.original.getUid();
	}

	private enqueueExecution({ execute: e, ...rest }: MoveAtom | DeleteAtom | MkdirAtom) {
		const { defer, execute } = createCachedPromise(e);
		this.queue.push({ ...rest, execute });
		this.scheduleFlush();
		return defer;
	}

	read(key: string, size?: number) {
		this.options.localPool.push(key);
		return this.original.read(key, size);
	}

	delete(key: string) {
		return this.enqueueExecution({
			execute: () => this.original.delete(key),
			key,
			type: 'delete',
		});
	}

	mkdir(key: string) {
		return this.enqueueExecution({
			execute: () => this.original.mkdir(key),
			key,
			type: 'mkdir',
		});
	}

	move(oldKey: string, newKey: string) {
		return this.enqueueExecution({
			execute: () => this.original.move(oldKey, newKey),
			newKey,
			oldKey,
			type: 'move',
		});
	}

	write(key: string, value: ArrayBuffer) {
		const anticipated = this.pendingWrites.get(key);
		if (anticipated) return anticipated(() => this.original.write(key, value));
		return this.original.write(key, value);
	}

	writeStream(key: string, value: ReadableStream<ArrayBuffer>) {
		const anticipated = this.pendingWrites.get(key);
		if (anticipated) return anticipated(() => this.original.writeStream(key, value));
		return this.original.writeStream(key, value);
	}

	stat(key: string) {
		return this.original.stat(key);
	}

	list(key: string) {
		return this.original.list(key);
	}

	private scheduleFlush(): void {
		if (this.scheduled) return;
		this.scheduled = true;
		queueMicrotask(() => {
			void this.flush();
			this.scheduled = false;
		});
	}

	private async flush(): Promise<void> {
		if (this.queue.length === 1) await (this.queue.pop() as InputAtom).execute();
		else {
			const writeAtoms = this.options.remotePool.splice(0).map((key): WriteAtom => {
				const anticipateWrite = new Promise<() => MaybePromise<string>>((resolve) => {
					this.pendingWrites.set(key, (write: () => MaybePromise<string>) => {
						this.pendingWrites.delete(key);
						const { execute, defer } = createCachedPromise(write);
						resolve(execute);
						return defer;
					});
				});
				return {
					execute: () => anticipateWrite.then((write) => write()),
					key,
					type: 'write',
				};
			});
			const atoms = [...this.queue.splice(0), ...writeAtoms];
			const optimizedAtoms = this.options.batchOptimizer({
				atoms,
				executeAtom: (atom) => atom.execute() as never,
				fs: this.original,
			});
			await Promise.all(optimizedAtoms.map((atom) => atom.execute()));
		}
	}
}

function createCachedPromise<T>(fn: () => MaybePromise<T>) {
	// oxlint-disable-next-line unicorn/no-null
	let promise: MaybePromise<T> | null = null;
	let resolve: (value: T) => void;
	let reject: (reason: unknown) => void;
	const defer = new Promise<T>(
		(resolver, rejector) => ((resolve = resolver), (reject = rejector)),
	);
	const execute = () => {
		if (promise !== null) return promise;
		promise = fn();
		if (promise instanceof Promise) promise.then(resolve, reject);
		else resolve(promise);
		return promise;
	};
	return { defer, execute };
}

function remoteOptimizationWrapper(
	original: RemoteFs,
	options: OptimizationOptions<RemoteFs>,
): WrappedRemoteFs {
	return new OptimizationRemoteFs(original, options);
}

function localOptimizationWrapper(
	original: LocalFs,
	options: OptimizationOptions<LocalFs>,
): WrappedLocalFs {
	return new OptimizationLocalFs(original, options);
}

export { remoteOptimizationWrapper, localOptimizationWrapper };
