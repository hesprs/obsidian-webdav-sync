import { isFinite } from 'lodash-es';

// oxlint-disable-next-line typescript/no-explicit-any
export function isNumeric(val: any) {
	return !isNaN(parseFloat(val)) && isFinite(Number(val));
}
