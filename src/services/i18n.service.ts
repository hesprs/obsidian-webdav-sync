import i18n, { languages } from '~/i18n';
import { useSettings } from '~/settings';
import logger from '~/utils/logger';
import type WebDAVSyncPlugin from '..';

export default class I18nService {
	constructor(_plugin: WebDAVSyncPlugin) {
		void this.update();
	}

	update = async () => {
		try {
			const settings = await useSettings();
			if (settings.language in languages) void i18n.changeLanguage(settings.language);
			else {
				const code = normalizeLanguage(navigator.language);
				if (settings.language in languages) void i18n.changeLanguage(code);
				else void i18n.changeLanguage('en');
			}
		} catch (e) {
			logger.error('Failed to update i18n', e);
		}
	};
}

function normalizeLanguage(code: string): string {
	const segments = code.split('-');
	if (segments.length === 0) return 'en';
	if (segments[0] === 'zh') {
		if (segments.length === 1) return 'zh-Hans';
		const region = segments[1];
		return region === 'TW' || region === 'HK' || region === 'Hant' ? 'zh-Hant' : 'zh-Hans';
	}
	return segments[0];
}
