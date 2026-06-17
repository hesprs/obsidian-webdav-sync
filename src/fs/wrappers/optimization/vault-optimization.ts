import type { LocalFs, LocalFsWrapper, WrappedLocalFs } from '../../interface';
import {
	collapseDeleteGroups,
	countQueuedJobs,
	groupMkdirGroupsByDepth,
	runGroupedJobs,
	runSingleQueuedJob,
} from './helpers';

type DeleteTask = {
	key: string;
	resolve: () => void;
	reject: (reason: unknown) => void;
};

type MkdirTask = {
	key: string;
	resolve: () => void;
	reject: (reason: unknown) => void;
};

type WriteTask = {
	key: string;
	value: ArrayBuffer;
	resolve: (uid: string) => void;
	reject: (reason: unknown) => void;
};

type WriteStreamTask = {
	key: string;
	value: ReadableStream<ArrayBuffer>;
	resolve: (uid: string) => void;
	reject: (reason: unknown) => void;
};

class VaultOptimizationFs implements WrappedLocalFs {
	private readonly deleteQueue: Array<DeleteTask> = [];
	private readonly mkdirQueue: Array<MkdirTask> = [];
	private readonly writeQueue: Array<WriteTask> = [];
	private readonly writeStreamQueue: Array<WriteStreamTask> = [];
	private flushScheduled = false;
	private flushing = false;

	constructor(public readonly original: LocalFs) {}

	getUid(): string {
		return this.original.getUid();
	}

	read(key: string, size?: number) {
		return this.original.read(key, size);
	}

	delete(key: string) {
		return new Promise<void>((resolve, reject) => {
			this.deleteQueue.push({ key, reject, resolve });
			this.scheduleFlush();
		});
	}

	mkdir(key: string) {
		return new Promise<void>((resolve, reject) => {
			this.mkdirQueue.push({ key, reject, resolve });
			this.scheduleFlush();
		});
	}

	write(key: string, value: ArrayBuffer) {
		return new Promise<string>((resolve, reject) => {
			this.writeQueue.push({ key, reject, resolve, value });
			this.scheduleFlush();
		});
	}

	writeStream(key: string, value: ReadableStream<ArrayBuffer>) {
		return new Promise<string>((resolve, reject) => {
			this.writeStreamQueue.push({ key, reject, resolve, value });
			this.scheduleFlush();
		});
	}

	move(oldKey: string, newKey: string) {
		return this.original.move(oldKey, newKey);
	}

	stat(key: string) {
		return this.original.stat(key);
	}

	listAll(key: string) {
		return this.original.listAll(key);
	}

	private scheduleFlush(): void {
		if (this.flushing || this.flushScheduled) return;
		this.flushScheduled = true;
		queueMicrotask(() => {
			this.flushScheduled = false;
			void this.flush();
		});
	}

	private async flush(): Promise<void> {
		if (this.flushing) return;
		this.flushing = true;
		try {
			while (this.hasQueuedJobs()) {
				if (
					countQueuedJobs(
						this.deleteQueue,
						this.mkdirQueue,
						this.writeQueue,
						this.writeStreamQueue,
					) === 1
				) {
					await this.flushSingleTask();
					continue;
				}

				await this.flushStructuralQueues();
				await this.flushWriteQueues();
			}
		} finally {
			this.flushing = false;
			if (this.hasQueuedJobs()) this.scheduleFlush();
		}
	}

	private hasQueuedJobs() {
		return (
			countQueuedJobs(
				this.deleteQueue,
				this.mkdirQueue,
				this.writeQueue,
				this.writeStreamQueue,
			) > 0
		);
	}

	private async flushSingleTask(): Promise<void> {
		if (
			await runSingleQueuedJob(
				this.deleteQueue,
				async (task) => await this.runDeleteTask(task),
			)
		)
			return;
		if (
			await runSingleQueuedJob(this.mkdirQueue, async (task) => await this.runMkdirTask(task))
		)
			return;
		if (
			await runSingleQueuedJob(this.writeQueue, async (task) => await this.runWriteTask(task))
		)
			return;
		await runSingleQueuedJob(
			this.writeStreamQueue,
			async (task) => await this.runWriteStreamTask(task),
		);
	}

	private async flushStructuralQueues(): Promise<void> {
		while (this.deleteQueue.length > 0 || this.mkdirQueue.length > 0) {
			while (this.deleteQueue.length > 0) {
				const deleteTasks = this.deleteQueue.splice(0, this.deleteQueue.length);
				await this.runDeleteTasks(deleteTasks);
			}

			const mkdirTasks = this.mkdirQueue.splice(0, this.mkdirQueue.length);
			if (mkdirTasks.length > 0) await this.runMkdirTasks(mkdirTasks);
		}
	}

	private async flushWriteQueues(): Promise<void> {
		while (
			(this.writeQueue.length > 0 || this.writeStreamQueue.length > 0) &&
			this.deleteQueue.length === 0 &&
			this.mkdirQueue.length === 0
		) {
			const writeTasks = this.writeQueue.splice(0, this.writeQueue.length);
			const writeStreamTasks = this.writeStreamQueue.splice(0, this.writeStreamQueue.length);
			await Promise.all([
				...writeTasks.map((task) => this.runWriteTask(task)),
				...writeStreamTasks.map((task) => this.runWriteStreamTask(task)),
			]);
		}
	}

	private async runDeleteTasks(tasks: Array<DeleteTask>): Promise<void> {
		await runGroupedJobs(
			collapseDeleteGroups(tasks),
			async (key) => await this.original.delete(key),
			(task) => task.resolve(),
			(task, error) => task.reject(error),
		);
	}

	private async runMkdirTasks(tasks: Array<MkdirTask>): Promise<void> {
		for (const depthGroup of groupMkdirGroupsByDepth(tasks))
			await runGroupedJobs(
				depthGroup,
				async (key) => await this.original.mkdir(key),
				(task) => task.resolve(),
				(task, error) => task.reject(error),
			);
	}

	private async runDeleteTask(task: DeleteTask): Promise<void> {
		try {
			await this.original.delete(task.key);
			task.resolve();
		} catch (error) {
			task.reject(error);
		}
	}

	private async runMkdirTask(task: MkdirTask): Promise<void> {
		try {
			await this.original.mkdir(task.key);
			task.resolve();
		} catch (error) {
			task.reject(error);
		}
	}

	private async runWriteTask(task: WriteTask): Promise<void> {
		try {
			const uid = await this.original.write(task.key, task.value);
			task.resolve(uid);
		} catch (error) {
			task.reject(error);
		}
	}

	private async runWriteStreamTask(task: WriteStreamTask): Promise<void> {
		try {
			const uid = await this.original.writeStream(task.key, task.value);
			task.resolve(uid);
		} catch (error) {
			task.reject(error);
		}
	}
}

function localOptimizationWrapper(original: LocalFs): WrappedLocalFs {
	return new VaultOptimizationFs(original);
}

export default localOptimizationWrapper satisfies LocalFsWrapper;
