import type { Translations } from '@';

// https://github.com/obsidianmd/obsidian-translations
export type ObsidianLanguageCode =
	| 'en'
	| 'af'
	| 'am'
	| 'ar'
	| 'az'
	| 'be'
	| 'bg'
	| 'bn'
	| 'ca'
	| 'cs'
	| 'da'
	| 'de'
	| 'dv'
	| 'el'
	| 'en-GB'
	| 'eo'
	| 'es'
	| 'eu'
	| 'fa'
	| 'fi'
	| 'fr'
	| 'ga'
	| 'gl'
	| 'he'
	| 'hi'
	| 'hr'
	| 'hu'
	| 'id'
	| 'it'
	| 'ja'
	| 'ka'
	| 'kh'
	| 'kn'
	| 'ko'
	| 'ky'
	| 'la'
	| 'lt'
	| 'lv'
	| 'ml'
	| 'ms'
	| 'nan-TW'
	| 'ne'
	| 'nl'
	| 'nn'
	| 'no'
	| 'oc'
	| 'or'
	| 'pl'
	| 'pt'
	| 'pt-BR'
	| 'ro'
	| 'ru'
	| 'sa'
	| 'si'
	| 'sk'
	| 'sl'
	| 'sq'
	| 'sr'
	| 'sv'
	| 'sw'
	| 'ta'
	| 'te'
	| 'th'
	| 'tl'
	| 'tr'
	| 'tt'
	| 'uk'
	| 'ur'
	| 'uz'
	| 'vi'
	| 'zh'
	| 'zh-TW';

const DEFAULT_LANGUAGE: ObsidianLanguageCode = 'en';
type Primitive = string | number | boolean | null | undefined;
type InterpolationValues = Record<string, Primitive>;
export type Translate = I18n['translate'];

export default class I18n {
	private readonly i18nRegistry: Partial<
		Record<ObsidianLanguageCode, Set<Record<string, string>>>
	> = {};

	declare i18n: {};

	private readonly registerI18n = (
		code: ObsidianLanguageCode,
		resource: Record<string, string>,
	) => {
		this.i18nRegistry[code] ??= new Set<Record<string, string>>();
		this.i18nRegistry[code].add(resource);
		return () => this.i18nRegistry[code]?.delete(resource);
	};

	private readonly loadI18n = (target: ObsidianLanguageCode) => {
		const langs: Array<ObsidianLanguageCode> = [
			DEFAULT_LANGUAGE,
			target.split('-')[0] as ObsidianLanguageCode,
			target,
		];
		for (const lang of langs) {
			if (!this.i18nRegistry[lang]) continue;
			for (const version of this.i18nRegistry[lang]) Object.assign(this.i18n, version);
		}
	};

	private readonly translate = (key: keyof Translations, params?: InterpolationValues) => {
		const i18n = this.i18n as Record<string, string>;
		if (params) return interpolate(i18n[key], params);
		return i18n[key];
	};

	root = { loadI18n: this.loadI18n, registerI18n: this.registerI18n, translate: this.translate };
}

function interpolate(template: string, params?: InterpolationValues): string {
	if (params === undefined) return template;
	return template.replace(/\{\{\s*(?<key>[^{}\s]+)\s*\}\}/g, (match, key: string) => {
		const value = params[key];
		return value === undefined ? match : String(value);
	});
}
