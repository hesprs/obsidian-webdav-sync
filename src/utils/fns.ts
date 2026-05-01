export function isNil(value: unknown): value is null | undefined {
	return value === null || value === undefined;
}

export function chunk<T>(arr: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
	return chunks;
}

export function zipMerge<T>(arr1: T[][], arr2: T[][]): T[][] {
	const length = Math.max(arr1.length, arr2.length);
	const result: T[][] = [];

	for (let i = 0; i < length; i++) {
		const sub1 = arr1[i] || [];
		const sub2 = arr2[i] || [];
		result.push([...sub1, ...sub2]);
	}

	return result;
}
