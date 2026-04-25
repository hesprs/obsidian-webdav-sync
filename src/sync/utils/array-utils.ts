export function getLast<T>(arr: Array<T>): T {
	return arr[arr.length - 1];
}

export function getAndDeleteAt<T>(arr: Array<T>, index: number): T {
	return arr.splice(index, 1)[0];
}
