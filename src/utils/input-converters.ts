import createUnitConverter from '~/composable/unit-converter';

const fileSizeConverter = createUnitConverter({
	// This is academically inaccurate since the following units are actually KiB, MiB, GiB, etc.
	defaultUnit: 'MB',
	units: { B: 1, GB: 2 ** 30, KB: 2 ** 10, MB: 2 ** 20, TB: 2 ** 40 },
});
export const parseFileSize = fileSizeConverter.parse;
export const formatFileSize = fileSizeConverter.format;

const timeConverter = createUnitConverter({
	defaultUnit: 's',
	units: { d: 8.64e7, h: 3.6e6, min: 6e4, ms: 1, s: 1e3 },
});
export const parseTime = timeConverter.parse;
export const formatTime = timeConverter.format;
