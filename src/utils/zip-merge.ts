export default function zipMerge<T>(arr1: T[][], arr2: T[][]): T[][] {
	const length = Math.max(arr1.length, arr2.length);
	const result: T[][] = [];

	for (let i = 0; i < length; i++) {
		const sub1 = arr1[i] || [];
		const sub2 = arr2[i] || [];
		result.push([...sub1, ...sub2]);
	}

	return result;
}
