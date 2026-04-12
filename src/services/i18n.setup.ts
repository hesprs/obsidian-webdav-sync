import i18n, { languages } from '~/i18n';
import logger from '~/utils/logger';

export function setupI18n() {
	try {
		// https://forum.obsidian.md/t/a-way-to-get-obsidian-s-currently-set-language/17829
		const code = normalizeLanguage(window.localStorage.getItem('language'));
		if (code in languages) void i18n.changeLanguage(code);
		else void i18n.changeLanguage('en');
	} catch (e) {
		logger.error('Failed to update i18n', e);
	}
}

function normalizeLanguage(code: string | null): string {
	if (!code) return 'en';
	const segments = code.split('-');
	if (segments[0] === 'zh') {
		if (segments.length === 1) return 'zh-Hans';
		const region = segments[1];
		return region === 'TW' || region === 'HK' || region === 'Hant' ? 'zh-Hant' : 'zh-Hans';
	}
	return segments[0];
}
