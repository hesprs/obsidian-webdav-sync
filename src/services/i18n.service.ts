import i18n from '~/i18n';
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
			if (settings.language) void i18n.changeLanguage(settings.language.toLowerCase());
			else {
				const code = navigator.language.split('-')[0];
				void i18n.changeLanguage(code.toLowerCase());
			}
		} catch (e) {
			logger.error(e);
		}
	};
}
