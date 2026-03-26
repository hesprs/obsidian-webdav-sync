import { isFinite } from 'lodash-es';

export function isNumeric(val: string) {
	return !isNaN(parseFloat(val)) && isFinite(Number(val));
}
