import type { GeneralArray, Hook } from '~/events';

export default function breakableSleep<T extends GeneralArray>(ob: Hook<T>, ms: number) {
	return new Promise<void>((resolve) => {
		const unsubscribe = ob.subscribe(finish);

		function finish() {
			window.clearTimeout(timer);
			unsubscribe();
			resolve();
		}

		const timer = window.setTimeout(finish, ms);
	});
}
