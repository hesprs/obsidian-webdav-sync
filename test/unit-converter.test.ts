import { expect, test } from 'bun:test';
import createUnitConverter from '~/composable/unit-converter';

const converter = createUnitConverter({
	defaultUnit: 's',
	// oxlint-disable-next-line sort-keys
	units: { ms: 1, s: 1000, min: 60_000 },
});

test('parses values with and without explicit units', () => {
	expect(converter.parse('2500ms')).toBe(2500);
	expect(converter.parse('2.5 s')).toBe(2500);
	expect(converter.parse('3')).toBe(3000);
});

test('rejects invalid or negative input', () => {
	expect(converter.parse('-1s')).toBeUndefined();
	expect(converter.parse('abc')).toBeUndefined();
	expect(converter.parse('1fortnight')).toBeUndefined();
});

test('formats using the largest matching unit', () => {
	expect(converter.format(2500)).toBe('2.5 s');
	expect(converter.format(120_000)).toBe('2 min');
});

test('falls back to the smallest unit for sub-unit values', () => {
	expect(converter.format(0.4)).toBe('0.4 ms');
});
