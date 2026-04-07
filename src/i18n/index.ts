import i18n from 'i18next';
import en from './enold';
import ru from './ru';
import zhHans from './zh-Hans';

const defaultNS = 'translation';
export const languages = {
	en: 'English',
	'zh-Hans': '简体中文',
	ru: 'Русский',
} as const;
const resources: Record<keyof typeof languages, { translation: typeof en }> = {
	'zh-Hans': { translation: zhHans },
	en: { translation: en },
	ru: { translation: ru },
} as const;

declare module 'i18next' {
	interface CustomTypeOptions {
		defaultNS: 'translation';
		resources: (typeof resources)['en'];
	}
}

void i18n.init({
	ns: ['translation'],
	defaultNS,
	resources,
	fallbackLng: 'en',
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
