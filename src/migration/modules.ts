export type V3ModuleMeta = {
	name: string;
	version: string;
	description: string;
	main: string;
};

export type ResolveMigrationModulesOptions = {
	catalog: Array<V3ModuleMeta>;
	encryptionEnabled: boolean;
	locale: string;
	smartMergeEnabled: boolean;
};

const OBSIDIAN_LANGUAGE_CODES = new Set([
	'en',
	'af',
	'am',
	'ar',
	'az',
	'be',
	'bg',
	'bn',
	'ca',
	'cs',
	'da',
	'de',
	'dv',
	'el',
	'en-GB',
	'eo',
	'es',
	'eu',
	'fa',
	'fi',
	'fr',
	'ga',
	'gl',
	'he',
	'hi',
	'hr',
	'hu',
	'id',
	'it',
	'ja',
	'ka',
	'kh',
	'kn',
	'ko',
	'ky',
	'la',
	'lt',
	'lv',
	'ml',
	'ms',
	'nan-TW',
	'ne',
	'nl',
	'nn',
	'no',
	'oc',
	'or',
	'pl',
	'pt',
	'pt-BR',
	'ro',
	'ru',
	'sa',
	'si',
	'sk',
	'sl',
	'sq',
	'sr',
	'sv',
	'sw',
	'ta',
	'te',
	'th',
	'tl',
	'tr',
	'tt',
	'uk',
	'ur',
	'uz',
	'vi',
	'zh',
	'zh-TW',
]);

const REQUIRED_MODULE_NAMES = ['WebDAV'] as const;

const LOCALE_NATIVE_NAMES: Record<string, string> = {
	af: 'Afrikaans',
	am: 'አማርኛ',
	ar: 'العربية',
	az: 'Azərbaycanca',
	be: 'Беларуская',
	bg: 'Български',
	bn: 'বাংলা',
	ca: 'Català',
	cs: 'Čeština',
	da: 'Dansk',
	de: 'Deutsch',
	dv: 'ދިވެހި',
	el: 'Ελληνικά',
	'en-GB': 'British English',
	eo: 'Esperanto',
	es: 'Español',
	eu: 'Euskara',
	fa: 'فارسی',
	fi: 'Suomi',
	fr: 'Français',
	ga: 'Gaeilge',
	gl: 'Galego',
	he: 'עברית',
	hi: 'हिन्दी',
	hr: 'Hrvatski',
	hu: 'Magyar',
	id: 'Bahasa Indonesia',
	it: 'Italiano',
	ja: '日本語',
	ka: 'ქართული',
	kh: 'ភាសាខ្មែរ',
	kn: 'ಕನ್ನಡ',
	ko: '한국어',
	ky: 'Кыргызча',
	la: 'Latina',
	lt: 'Lietuvių',
	lv: 'Latviešu',
	ml: 'മലയാളം',
	ms: 'Bahasa Melayu',
	'nan-TW': '臺灣話',
	ne: 'नेपाली',
	nl: 'Nederlands',
	nn: 'Norsk nynorsk',
	no: 'Norsk',
	oc: 'Occitan',
	or: 'ଓଡ଼ିଆ',
	pl: 'Polski',
	pt: 'Português',
	'pt-BR': 'Português do Brasil',
	ro: 'Română',
	ru: 'Русский',
	sa: 'संस्कृतम्',
	si: 'සිංහල',
	sk: 'Slovenčina',
	sl: 'Slovenščina',
	sq: 'Shqip',
	sr: 'Српски',
	sv: 'Svenska',
	sw: 'Kiswahili',
	ta: 'தமிழ்',
	te: 'తెలుగు',
	th: 'ไทย',
	tl: 'Tagalog',
	tr: 'Türkçe',
	tt: 'Татарча',
	uk: 'Українська',
	ur: 'اردو',
	uz: 'Oʻzbekcha',
	vi: 'Tiếng Việt',
	zh: '简体中文',
	'zh-TW': '繁體中文',
};

function normalizeLocaleCode(locale: string): string {
	const normalized = locale.trim().replaceAll('_', '-');
	if (normalized === '') return '';

	const [language, ...segments] = normalized.split('-');
	return [language.toLowerCase(), ...segments.map((segment) => segment.toUpperCase())].join('-');
}

function getLocaleCandidateCodes(locale: string): Array<string> {
	const normalized = normalizeLocaleCode(locale);
	if (normalized === '' || normalized === 'en') return [];

	if (OBSIDIAN_LANGUAGE_CODES.has(normalized)) return [normalized];

	const [language] = normalized.split('-');
	if (language !== 'en' && OBSIDIAN_LANGUAGE_CODES.has(language)) return [language];
	return [];
}

function getLocaleNativeName(code: string): string | undefined {
	return LOCALE_NATIVE_NAMES[code];
}

function getRequiredModule(catalog: Map<string, V3ModuleMeta>, name: string): V3ModuleMeta {
	const moduleMeta = catalog.get(name.normalize('NFC'));
	if (!moduleMeta) throw new Error(`Required module not found: ${name}`);
	return moduleMeta;
}

export function resolveMigrationModules({
	catalog,
	encryptionEnabled,
	locale,
	smartMergeEnabled,
}: ResolveMigrationModulesOptions): Array<V3ModuleMeta> {
	const catalogByName = new Map<string, V3ModuleMeta>();
	for (const moduleMeta of catalog) {
		const normalizedName = moduleMeta.name.normalize('NFC');
		if (!catalogByName.has(normalizedName))
			catalogByName.set(normalizedName, { ...moduleMeta, name: normalizedName });
	}

	const resolvedModules: Array<V3ModuleMeta> = [];
	for (const requiredModuleName of REQUIRED_MODULE_NAMES)
		resolvedModules.push(getRequiredModule(catalogByName, requiredModuleName));

	if (encryptionEnabled) resolvedModules.push(getRequiredModule(catalogByName, 'Encryption'));
	if (smartMergeEnabled) resolvedModules.push(getRequiredModule(catalogByName, 'Smart Merge'));

	for (const localeCode of getLocaleCandidateCodes(locale)) {
		const nativeName = getLocaleNativeName(localeCode);
		if (!nativeName) throw new Error(`Failed to resolve locale module name: ${localeCode}`);
		const moduleName = `I18n ${nativeName}`.normalize('NFC');
		const localeModule = catalogByName.get(moduleName);
		if (localeModule) resolvedModules.push(localeModule);
	}

	return resolvedModules;
}
