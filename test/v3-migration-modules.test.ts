import { expect, test } from 'bun:test';
import { resolveMigrationModules } from '../src/migration/modules';

const catalog = [
	{
		description: 'webdav',
		main: 'https://cdn.example.com/webdav.js',
		name: 'WebDAV',
		version: '1.0.0',
	},
	{
		description: 'encryption',
		main: 'https://cdn.example.com/encryption.js',
		name: 'Encryption',
		version: '1.0.0',
	},
	{
		description: 'smart merge',
		main: 'https://cdn.example.com/smart-merge.js',
		name: 'Smart Merge',
		version: '1.0.0',
	},
	{
		description: 'british',
		main: 'https://cdn.example.com/en-GB.js',
		name: 'I18n British English',
		version: '1.0.0',
	},
	{
		description: 'simplified',
		main: 'https://cdn.example.com/zh.js',
		name: 'I18n 简体中文',
		version: '1.0.0',
	},
	{
		description: 'traditional',
		main: 'https://cdn.example.com/zh-TW.js',
		name: 'I18n 繁體中文',
		version: '1.0.0',
	},
	{
		description: 'portuguese',
		main: 'https://cdn.example.com/pt-BR.js',
		name: 'I18n Português do Brasil',
		version: '1.0.0',
	},
	{
		description: 'nan',
		main: 'https://cdn.example.com/nan-TW.js',
		name: 'I18n 臺灣話',
		version: '1.0.0',
	},
	{
		description: 'khmer',
		main: 'https://cdn.example.com/kh.js',
		name: 'I18n ភាសាខ្មែរ',
		version: '1.0.0',
	},
];

test('resolveMigrationModules requires WebDAV, optional Encryption, and gated Smart Merge', () => {
	expect(
		resolveMigrationModules({
			catalog,
			encryptionEnabled: true,
			locale: 'en',
			smartMergeEnabled: true,
		}).map((module) => module.name),
	).toStrictEqual(['WebDAV', 'Encryption', 'Smart Merge']);

	expect(
		resolveMigrationModules({
			catalog: catalog.slice(0, 1),
			encryptionEnabled: false,
			locale: 'en',
			smartMergeEnabled: false,
		}).map((module) => module.name),
	).toStrictEqual(['WebDAV']);

	expect(
		resolveMigrationModules({
			catalog,
			encryptionEnabled: false,
			locale: 'en',
			smartMergeEnabled: false,
		}).map((module) => module.name),
	).toStrictEqual(['WebDAV']);

	expect(() =>
		resolveMigrationModules({
			catalog: catalog.slice(1),
			encryptionEnabled: false,
			locale: 'en',
			smartMergeEnabled: false,
		}),
	).toThrow('Required module not found: WebDAV');
});

test('resolveMigrationModules selects locale modules from native-name catalog entries', () => {
	const cases = [
		{ expected: ['WebDAV', 'I18n 简体中文'], locale: 'zh' },
		{ expected: ['WebDAV', 'I18n 繁體中文'], locale: 'zh-TW' },
		{ expected: ['WebDAV', 'I18n Português do Brasil'], locale: 'pt-BR' },
		{ expected: ['WebDAV', 'I18n British English'], locale: 'en-GB' },
		{ expected: ['WebDAV', 'I18n 臺灣話'], locale: 'nan-TW' },
		{ expected: ['WebDAV', 'I18n ភាសាខ្មែរ'], locale: 'kh' },
		{ expected: ['WebDAV'], locale: 'en' },
		{ expected: ['WebDAV'], locale: 'fr' },
	];

	for (const { expected, locale } of cases)
		expect(
			resolveMigrationModules({
				catalog,
				encryptionEnabled: false,
				locale,
				smartMergeEnabled: false,
			}).map((module) => module.name),
		).toStrictEqual(expected);
});
