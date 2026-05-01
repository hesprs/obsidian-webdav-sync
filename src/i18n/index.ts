import createI18n from '~/composable/i18n';
import en from './enold';
import ru from './ru';
import zhHans from './zh-Hans';

const resources = {
	en,
	ru,
	'zh-Hans': zhHans,
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
	const code = window.localStorage.getItem('language') ?? navigator.language;
	const segments = code.split('-');
	if (segments[0] === 'zh') return 'zh-Hans';
	return isLanguage(segments[0]) ? segments[0] : 'en';
}
