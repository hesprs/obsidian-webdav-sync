function pad2(value: number): string {
	return value.toString().padStart(2, '0');
}

function getDateParts(input: number | Date) {
	const date = input instanceof Date ? input : new Date(input);
	return {
		day: pad2(date.getDate()),
		hour: pad2(date.getHours()),
		minute: pad2(date.getMinutes()),
		month: pad2(date.getMonth() + 1),
		second: pad2(date.getSeconds()),
		year: date.getFullYear(),
	};
}

export default function formatDateTime(input: number | Date): string {
	const { year, month, day, hour, minute, second } = getDateParts(input);
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}
