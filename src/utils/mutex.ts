export class Mutex {
	private currentLock: Promise<void> = Promise.resolve();

	async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		const previousLock = this.currentLock;
		let release: () => void;
		this.currentLock = new Promise<void>((resolve) => {
			release = resolve;
		});

		try {
			await previousLock;
			return await fn();
		} finally {
			// oxlint-disable-next-line typescript/no-non-null-assertion
			release!();
		}
	}
}
