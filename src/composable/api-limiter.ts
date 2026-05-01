/**
 * A simple rate limiter for API calls.
 * @param options.maxConcurrent - The maximum number of concurrent requests.
 * @param options.minTime - The minimum time between requests.
 */
class ApiLimiter {
	private activeCount = 0;
	private lastStartTime = 0;
	private readonly queue: Array<() => void> = [];
	private timer: number | undefined;
	maxConcurrency: number;
	minInterval: number;

	constructor({ maxConcurrency = Infinity, minInterval = 0 } = {}) {
		this.maxConcurrency = maxConcurrency;
		this.minInterval = minInterval;
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

	wrap<TArgs extends Array<unknown>, TResult>(
		fn: (...args: TArgs) => TResult | Promise<TResult>,
	): (...args: TArgs) => Promise<TResult> {
		return (...args: TArgs) => this.schedule(() => fn(...args));
	}

	private processQueue() {
		if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) return;

		const now = Date.now();
		const nextAllowed = this.lastStartTime + this.minInterval;
		if (now < nextAllowed) {
			if (this.timer) return;
			this.timer = window.setTimeout(() => {
				this.timer = undefined;
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

const apiLimiter = new ApiLimiter();
export default apiLimiter;
