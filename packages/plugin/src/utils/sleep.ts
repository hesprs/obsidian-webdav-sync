export async function sleep(ms: number) {
	await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function waitUntil<T>(condition: () => T, duration = 100) {
	while (true) {
		const result = await Promise.resolve(condition());
		if (result) return result;
		await sleep(duration);
	}
}
