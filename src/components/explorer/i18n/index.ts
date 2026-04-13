import { translator, flatten } from '@solid-primitives/i18n';
import { createResource, createSignal } from 'solid-js';
import en from './en';
import ru from './ru';
import zh from './zh';

type Locale = 'zh' | 'en' | 'ru';

export function toLocale(language: string) {
	switch (language.split('-')[0].toLowerCase()) {
		case 'zh':
			return 'zh';
		case 'ru':
			return 'ru';
		default:
			return 'en';
	}
}

export const [locale, setLocale] = createSignal<Locale>(toLocale(navigator.language));

const [dict] = createResource(locale, (locale) => {
	switch (locale) {
		case 'zh':
			return flatten(zh);
		case 'ru':
			return flatten(ru);
		default:
			return flatten(en);
	}
});

export const t = translator(dict);
