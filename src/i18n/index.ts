import { getLanguage } from 'obsidian';
import createI18n from '~/composable/i18n';
import en from './en';
import ru from './ru';
import zhHans from './zh-Hans';
import zhHant from './zh-Hant';

const resources = {
	en,
	ru,
	'zh-Hans': zhHans,
	'zh-Hant': zhHant,
} as const;
type Languages = keyof typeof resources;
export type TranslationShape = typeof en;

export default createI18n<TranslationShape>({
	current: resolveLanguage(),
	resources,
}).translation;

function isLanguage(key: string): key is Languages {
	return key in resources;
}

function resolveLanguage(): Languages {
	const segments = getLanguage().split('-');
	if (segments[0] === 'zh') {
		if (['Hant', 'HK', 'TW', 'MO'].includes(segments[1])) return 'zh-Hant';
		return 'zh-Hans';
	}
	return isLanguage(segments[0]) ? segments[0] : 'en';
}
