import type { InterpolationValues, KeyOfObject } from '~/types';
import en from './enold';
import ru from './ru';
import zhHans from './zh-Hans';

type Language = keyof typeof resources;
export type TranslationResource = typeof en;
type TranslationKey = KeyOfObject<TranslationResource>;

const fallbackLanguage: Language = 'en';
const resources = {
	'zh-Hans': zhHans,
	en,
	ru,
} as const satisfies Record<string, TranslationResource>;
let currentLanguage: Language = resolveLanguage(window.localStorage.getItem('language'));

function getValue(resource: TranslationResource, key: string): string | undefined {
	const value = key.split('.').reduce<unknown>((current, segment) => {
		if (current === null || typeof current !== 'object') return undefined;
		return (current as Record<string, unknown>)[segment];
	}, resource);

	return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, params?: InterpolationValues): string {
	if (params === undefined) return template;

	return template.replace(/\{\{\s*([^{}\s]+)\s*\}\}/g, (match, key: string) => {
		const value = params[key];
		return value === undefined ? match : String(value);
	});
}

function isLanguage(key: string): key is Language {
	return key in resources;
}

function resolveLanguage(code: string | null | undefined): Language {
	if (!code) return fallbackLanguage;

	const segments = code.split('-');
	if (segments[0] === 'zh') {
		return 'zh-Hans';
	}

	return isLanguage(segments[0]) ? segments[0] : fallbackLanguage;
}

export default function t(key: TranslationKey, params?: InterpolationValues): string {
	const template =
		getValue(resources[currentLanguage], key) ?? getValue(resources.en, key) ?? key;
	return interpolate(template, params);
}
