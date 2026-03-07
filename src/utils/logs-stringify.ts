import deepStringify from './deep-stringify';

// oxlint-disable-next-line typescript/no-explicit-any
export default function (logs: any) {
	if (typeof logs === 'string') {
		return logs;
	}
	try {
		return JSON.stringify(logs);
	} catch {
		try {
			return deepStringify(logs);
		} catch {}
	}
}
