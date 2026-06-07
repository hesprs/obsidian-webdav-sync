type UnitMap = Record<string, number>;
type UnitConfig<T extends UnitMap> = {
	units: T;
	defaultUnit: keyof T;
};

function round(value: number, precision: number): number {
	const power = 10 ** precision;
	return Math.round(value * power) / power;
}

export default function createUnitConverter<T extends UnitMap>({
	units,
	defaultUnit,
}: UnitConfig<T>) {
	const entries = Object.entries(units);
	const unitMap: Record<string, number> = {};
	entries.forEach(([u, multiplier]) => {
		unitMap[u.toLowerCase()] = multiplier;
	});
	return {
		format: (value: number): string => {
			const entry = entries[entries.findLastIndex(([, v]) => value >= v)] || entries[0];
			const scaled = value / entry[1];
			return `${round(scaled, 2)} ${entry[0]}`;
		},
		parse: (input: string): number | undefined => {
			const match = /^(?<value>-?\d+(?:\.\d+)?)\s*(?<unit>[a-z]*)$/i.exec(input.trim());
			if (!match?.groups) return undefined;
			const num = parseFloat(match.groups.value);
			if (!Number.isFinite(num) || num < 0) return undefined;
			const rawUnit = (match.groups.unit || (defaultUnit as string)).toLowerCase();
			return rawUnit in unitMap ? num * unitMap[rawUnit] : undefined;
		},
	};
}
