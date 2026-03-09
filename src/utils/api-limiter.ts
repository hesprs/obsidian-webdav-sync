class ApiLimiter {
	private readonly maxConcurrent: number;
	private readonly minTime: number;
	private activeCount = 0;
	private lastStartTime = 0;
	private readonly queue: Array<() => void> = [];
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor({ maxConcurrent, minTime }: { maxConcurrent: number; minTime: number }) {
		this.maxConcurrent = maxConcurrent;
		this.minTime = minTime;
	}

	schedule<T>(fn: () => T | Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			this.queue.push(() => {
				Promise.resolve()
					.then(fn)
					.then(resolve)
					.catch(reject)
					.finally(() => {
						this.activeCount--;
						this.processQueue();
					});
			});
			this.processQueue();
		});
	}

	wrap<TArgs extends unknown[], TResult>(
		fn: (...args: TArgs) => TResult | Promise<TResult>,
	): (...args: TArgs) => Promise<TResult> {
		return (...args: TArgs) => this.schedule(() => fn(...args));
	}

	private processQueue() {
		if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) return;

		const now = Date.now();
		const nextAllowed = this.lastStartTime + this.minTime;
		if (now < nextAllowed) {
			if (this.timer) return;
			this.timer = setTimeout(() => {
				this.timer = null;
				this.processQueue();
			}, nextAllowed - now);
			return;
		}

		const task = this.queue.shift();
		if (!task) return;

		this.activeCount++;
		this.lastStartTime = now;

		task();

		this.processQueue();
	}
}

export const apiLimiter = new ApiLimiter({
	maxConcurrent: 4,
	minTime: 100,
});
