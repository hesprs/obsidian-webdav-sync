import { round } from './fns';

interface UnitConfig<T extends string = string> {
	units: readonly T[];
	multipliers: readonly number[];
	defaultUnit: T;
}

function createUnitConverter<T extends string>(config: UnitConfig<T>) {
	const { units, multipliers, defaultUnit } = config;
	const unitMap = new Map<string, number>();
	units.forEach((u, i) => unitMap.set(u.toLowerCase(), multipliers[i]));
	return {
		parse: (input: string): number | undefined => {
			const match = input.trim().match(/^(-?\d+(?:\.\d+)?)\s*([a-z]*)$/i);
			if (!match) return undefined;
			const num = parseFloat(match[1]);
			if (!Number.isFinite(num) || num < 0) return undefined;
			const rawUnit = match[2].toLowerCase() || defaultUnit.toLowerCase();
			if (!unitMap.has(rawUnit)) return undefined;
			return num * (unitMap.get(rawUnit) as number);
		},
		format: (value: number): string => {
			let idx = units.length - 1;
			while (idx > 0 && value < multipliers[idx]) idx--;
			const scaled = value / multipliers[idx];
			return `${round(scaled, 2)} ${units[idx]}`;
		},
	};
}

const fileSizeConverter = createUnitConverter({
	units: ['B', 'KB', 'MB', 'GB', 'TB', 'PB'] as const,
	multipliers: [1, 2 ** 10, 2 ** 20, 2 ** 30, 2 ** 40, 2 ** 50],
	defaultUnit: 'MB',
});
export const parseFileSize = fileSizeConverter.parse;
export const formatFileSize = fileSizeConverter.format;

const timeConverter = createUnitConverter({
	units: ['ms', 's', 'min', 'h', 'd'] as const,
	multipliers: [1, 1e3, 6e4, 3.6e6, 8.64e7],
	defaultUnit: 's',
});
export const parseTime = timeConverter.parse;
export const formatTime = timeConverter.format;
