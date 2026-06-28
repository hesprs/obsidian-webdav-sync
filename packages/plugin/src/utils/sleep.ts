import type { Ref } from 'synthkernel';

export async function sleep(ms: number) {
	await new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function untilTrue(ref: Ref<boolean>) {
	if (ref()) return;
	return new Promise<void>((resolve) => {
		const unsub = ref.subscribe((isTrue) => {
			if (isTrue) {
				unsub();
				resolve();
			}
		});
	});
}
