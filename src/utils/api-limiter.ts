/**
 * A simple rate limiter for API calls.
 * @param options.maxConcurrent - The maximum number of concurrent requests.
 * @param options.minTime - The minimum time between requests.
 */
class ApiLimiter {
	private maxConcurrent: number;
	private minTime: number;
	private activeCount = 0;
	private lastStartTime = 0;
	private readonly queue: Array<() => void> = [];
	private timer: number | null = null;

	constructor({ maxConcurrent, minTime }: { maxConcurrent?: number; minTime?: number }) {
		this.maxConcurrent = maxConcurrent ?? 0;
		this.minTime = minTime ?? 0;
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

	set(field: 'minTimeBetweenWebDAVCalls' | 'maxConcurrentWebDAVCalls', value: number) {
		if (field === 'minTimeBetweenWebDAVCalls') this.minTime = value;
		else if (field === 'maxConcurrentWebDAVCalls') this.maxConcurrent = value;
		return this;
	}

	private processQueue() {
		if (
			(this.maxConcurrent !== 0 && this.activeCount >= this.maxConcurrent) ||
			this.queue.length === 0
		)
			return;

		const now = Date.now();
		const nextAllowed = this.lastStartTime + this.minTime;
		if (now < nextAllowed) {
			if (this.timer) return;
			this.timer = window.setTimeout(() => {
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
	maxConcurrent: 0,
	minTime: 0,
});
