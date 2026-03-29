import i18n from 'i18next';
import en from './enold';
import zhHans from './zh-Hans';

const defaultNS = 'translation';
const resources = {
	'zh-Hans': {
		translation: zhHans,
	},
	en: {
		translation: en,
	},
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
