import t from '~/i18n';

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

export function formatDateTime(input: number | Date): string {
	const { year, month, day, hour, minute, second } = getDateParts(input);
	return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

export function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diffMs = now - timestamp;
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffSeconds < 60) return t('time.justNow');
	else if (diffMinutes < 60) return t('time.minutesAgo', { count: diffMinutes });
	else if (diffHours < 24) return t('time.hoursAgo', { count: diffHours });
	else if (diffDays < 30) return t('time.daysAgo', { count: diffDays });
	else return t('time.longAgo');
}
