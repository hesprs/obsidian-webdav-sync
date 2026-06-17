import type { Progress, RemoteFs, WrappedRemoteFs } from '../../interface';
import {
	collapseDeleteGroups,
	countQueuedJobs,
	groupMkdirGroupsByDepth,
	runGroupedJobs,
	runSingleQueuedJob,
} from './helpers';

type DeleteJob = {
	key: string;
	resolve: () => void;
	reject: (error: unknown) => void;
};

type MkdirJob = {
	key: string;
	recursive?: boolean;
	resolve: () => void;
	reject: (error: unknown) => void;
};

type WriteJob = {
	key: string;
	value: ArrayBuffer;
	resolve: (uid: string) => void;
	reject: (error: unknown) => void;
};

class CommonOptimizationRemoteFs implements WrappedRemoteFs {
	private readonly deleteQueue: Array<DeleteJob> = [];
	private readonly mkdirQueue: Array<MkdirJob> = [];
	private readonly writeQueue: Array<WriteJob> = [];
	private flushScheduled = false;
	private flushing = false;

	constructor(public readonly original: RemoteFs) {}

	checkConnection() {
		return this.original.checkConnection();
	}

	getUid() {
		return this.original.getUid();
	}

	read(key: string, size?: number) {
		return this.original.read(key, size);
	}

	readStream(key: string, size?: number) {
		return this.original.readStream(key, size);
	}

	delete(key: string) {
		const promise = new Promise<void>((resolve, reject) => {
			this.deleteQueue.push({ key, reject, resolve });
		});
		this.scheduleFlush();
		return promise;
	}

	mkdir(key: string, recursive?: boolean) {
		const promise = new Promise<void>((resolve, reject) => {
			this.mkdirQueue.push({ key, recursive, reject, resolve });
		});
		this.scheduleFlush();
		return promise;
	}

	write(key: string, value: ArrayBuffer) {
		const promise = new Promise<string>((resolve, reject) => {
			this.writeQueue.push({ key, reject, resolve, value });
		});
		this.scheduleFlush();
		return promise;
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

	listAll(key: string, progress?: (progress: Progress) => void) {
		return this.original.listAll(key, progress);
	}

	private scheduleFlush() {
		if (this.flushing || this.flushScheduled) return;
		this.flushScheduled = true;
		queueMicrotask(() => {
			this.flushScheduled = false;
			void this.flush();
		});
	}

	private async flush() {
		if (this.flushing) return;
		this.flushing = true;
		try {
			while (this.hasQueuedJobs()) {
				if (countQueuedJobs(this.deleteQueue, this.mkdirQueue, this.writeQueue) === 1) {
					await this.flushSingleJob();
					continue;
				}

				await this.flushStructuralJobs();
				await this.flushWriteJobs();
			}
		} finally {
			this.flushing = false;
			if (this.hasQueuedJobs()) this.scheduleFlush();
		}
	}

	private async runDeleteJobs(jobs: Array<DeleteJob>) {
		await runGroupedJobs(
			collapseDeleteGroups(jobs),
			async (key) => await this.original.delete(key),
			(job) => job.resolve(),
			(job, error) => job.reject(error),
		);
	}

	private async runMkdirJobs(jobs: Array<MkdirJob>) {
		for (const depthGroup of groupMkdirGroupsByDepth(jobs))
			await runGroupedJobs(
				depthGroup,
				async (key) => await this.original.mkdir(key),
				(job) => job.resolve(),
				(job, error) => job.reject(error),
			);
	}

	private async runWriteJobs(jobs: Array<WriteJob>) {
		await Promise.all(
			jobs.map(async (job) => {
				try {
					const uid = await this.original.write(job.key, job.value);
					job.resolve(uid);
				} catch (error) {
					job.reject(error);
				}
			}),
		);
	}

	private hasQueuedJobs() {
		return countQueuedJobs(this.deleteQueue, this.mkdirQueue, this.writeQueue) > 0;
	}

	private async flushSingleJob() {
		if (
			await runSingleQueuedJob(this.deleteQueue, async (job) => {
				try {
					await this.original.delete(job.key);
					job.resolve();
				} catch (error) {
					job.reject(error);
				}
			})
		)
			return;

		if (
			await runSingleQueuedJob(this.mkdirQueue, async (job) => {
				try {
					await this.original.mkdir(job.key, job.recursive);
					job.resolve();
				} catch (error) {
					job.reject(error);
				}
			})
		)
			return;

		await runSingleQueuedJob(this.writeQueue, async (job) => {
			try {
				const uid = await this.original.write(job.key, job.value);
				job.resolve(uid);
			} catch (error) {
				job.reject(error);
			}
		});
	}

	private async flushStructuralJobs() {
		while (this.deleteQueue.length > 0 || this.mkdirQueue.length > 0) {
			while (this.deleteQueue.length > 0) {
				const deleteJobs = this.deleteQueue.splice(0, this.deleteQueue.length);
				await this.runDeleteJobs(deleteJobs);
			}

			const mkdirJobs = this.mkdirQueue.splice(0, this.mkdirQueue.length);
			if (mkdirJobs.length > 0) await this.runMkdirJobs(mkdirJobs);
		}
	}

	private async flushWriteJobs() {
		while (
			this.writeQueue.length > 0 &&
			this.deleteQueue.length === 0 &&
			this.mkdirQueue.length === 0
		) {
			const writeJobs = this.writeQueue.splice(0, this.writeQueue.length);
			await this.runWriteJobs(writeJobs);
		}
	}
}

function commonOptimizationWrapper(original: RemoteFs): WrappedRemoteFs {
	return new CommonOptimizationRemoteFs(original);
}

export default commonOptimizationWrapper;
