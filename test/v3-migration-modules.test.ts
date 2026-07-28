import { expect, test } from 'bun:test';
import { resolveMigrationModules } from '../src/migration/modules';

const catalog = [
	{
		description: 'webdav',
		id: 'webdav',
		main: 'https://cdn.example.com/webdav.js',
		name: 'WebDAV',
		version: '1.0.0',
	},
	{
		description: 'encryption',
		id: 'encryption',
		main: 'https://cdn.example.com/encryption.js',
		name: 'Encryption',
		version: '1.0.0',
	},
	{
		description: 'smart merge',
		id: 'smart-merge',
		main: 'https://cdn.example.com/smart-merge.js',
		name: 'Smart Merge',
		version: '1.0.0',
	},
	{
		description: 'british',
		id: 'i18n-en-GB',
		main: 'https://cdn.example.com/en-GB.js',
		name: 'I18n British English',
		version: '1.0.0',
	},
	{
		description: 'simplified',
		id: 'i18n-zh',
		main: 'https://cdn.example.com/zh.js',
		name: 'I18n 简体中文',
		version: '1.0.0',
	},
	{
		description: 'traditional',
		id: 'i18n-zh-TW',
		main: 'https://cdn.example.com/zh-TW.js',
		name: 'I18n 繁體中文',
		version: '1.0.0',
	},
	{
		description: 'portuguese',
		id: 'i18n-pt-BR',
		main: 'https://cdn.example.com/pt-BR.js',
		name: 'I18n Português do Brasil',
		version: '1.0.0',
	},
	{
		description: 'nan',
		id: 'i18n-nan-TW',
		main: 'https://cdn.example.com/nan-TW.js',
		name: 'I18n 臺灣話',
		version: '1.0.0',
	},
	{
		description: 'khmer',
		id: 'i18n-kh',
		main: 'https://cdn.example.com/kh.js',
		name: 'I18n ភាសាខ្មែរ',
		version: '1.0.0',
	},
];

test('resolveMigrationModules requires webdav, optional encryption, and gated smart-merge', () => {
	expect(
		resolveMigrationModules({
			catalog,
			encryptionEnabled: true,
			locale: 'en',
			smartMergeEnabled: true,
		}).map((module) => module.id),
	).toStrictEqual(['webdav', 'encryption', 'smart-merge']);

	expect(
		resolveMigrationModules({
			catalog: catalog.slice(0, 1),
			encryptionEnabled: false,
			locale: 'en',
			smartMergeEnabled: false,
		}).map((module) => module.id),
	).toStrictEqual(['webdav']);

	expect(
		resolveMigrationModules({
			catalog,
			encryptionEnabled: false,
			locale: 'en',
			smartMergeEnabled: false,
		}).map((module) => module.id),
	).toStrictEqual(['webdav']);

	expect(() =>
		resolveMigrationModules({
			catalog: catalog.slice(1),
			encryptionEnabled: false,
			locale: 'en',
			smartMergeEnabled: false,
		}),
	).toThrow('Required module not found: webdav');
});

test('resolveMigrationModules selects locale modules by i18n-id', () => {
	const cases = [
		{ expected: ['webdav', 'i18n-zh'], locale: 'zh' },
		{ expected: ['webdav', 'i18n-zh-TW'], locale: 'zh-TW' },
		{ expected: ['webdav', 'i18n-pt-BR'], locale: 'pt-BR' },
		{ expected: ['webdav', 'i18n-en-GB'], locale: 'en-GB' },
		{ expected: ['webdav', 'i18n-nan-TW'], locale: 'nan-TW' },
		{ expected: ['webdav', 'i18n-kh'], locale: 'kh' },
		{ expected: ['webdav'], locale: 'en' },
		{ expected: ['webdav'], locale: 'fr' },
		// Falls back to base language when full code is absent
		{ expected: ['webdav', 'i18n-zh'], locale: 'zh-CN' },
	];

	for (const { expected, locale } of cases)
		expect(
			resolveMigrationModules({
				catalog,
				encryptionEnabled: false,
				locale,
				smartMergeEnabled: false,
			}).map((module) => module.id),
		).toStrictEqual(expected);
});
