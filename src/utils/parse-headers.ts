const HEADER_NAME = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

export default function parseHeaders(raw: string) {
	const headers: Record<string, string> = {};

	for (const line of raw.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed === '') continue;
		const colon = trimmed.indexOf(':');
		if (colon === -1) return false;
		const name = trimmed.slice(0, colon).trim();
		const value = trimmed.slice(colon + 1).trim();
		if (!HEADER_NAME.test(name)) return false;
		headers[name] = value;
	}

	return headers;
}
