const INVALID_CHARS_LIST = [':', '*', '?', '"', '<', '>', '|'];

export function hasInvalidChar(str: string) {
	return INVALID_CHARS_LIST.some((c) => str.includes(c));
}

export function getInvalidChars(str: string): Array<string> {
	return INVALID_CHARS_LIST.filter((c) => str.includes(c));
}
