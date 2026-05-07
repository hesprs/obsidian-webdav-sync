import createUnitConverter from '~/composable/unit-converter';

const fileSizeConverter = createUnitConverter({
	// This is academically inaccurate since the following units are actually KiB, MiB, GiB, etc.
	defaultUnit: 'MB',
	// oxlint-disable-next-line sort-keys
	units: { B: 1, KB: 2 ** 10, MB: 2 ** 20, GB: 2 ** 30, TB: 2 ** 40 },
});
export const parseFileSize = fileSizeConverter.parse;
export const formatFileSize = fileSizeConverter.format;

const timeConverter = createUnitConverter({
	defaultUnit: 's',
	// oxlint-disable-next-line sort-keys
	units: { ms: 1, s: 1e3, min: 6e4, h: 3.6e6, d: 8.64e7 },
});
export const parseTime = timeConverter.parse;
export const formatTime = timeConverter.format;
