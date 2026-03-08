function pad2(value: number): string {
	return value.toString().padStart(2, '0');
}

function getDateParts(input: number | Date) {
	const date = input instanceof Date ? input : new Date(input);
	return {
		year: date.getFullYear(),
		month: pad2(date.getMonth() + 1),
		day: pad2(date.getDate()),
		hour: pad2(date.getHours()),
		minute: pad2(date.getMinutes()),
		second: pad2(date.getSeconds()),
	};
}

export function formatDateTime(input: number | Date): string {
	const { year, month, day, hour, minute, second } = getDateParts(input);
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function formatTime(input: number | Date): string {
	const { hour, minute, second } = getDateParts(input);
	return `${hour}:${minute}:${second}`;
}

export function formatFilenameDateTime(input: number | Date): string {
	const { year, month, day, hour, minute, second } = getDateParts(input);
	return `${year}-${month}-${day} ${hour}_${minute}_${second}`;
}
