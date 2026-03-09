export async function requestUrl() {
	return {
		status: 200,
		text: '',
		headers: {},
	};
}

export const Platform = {
	isDesktop: true,
	isMobile: false,
};

export function normalizePath(path: string) {
	return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export class Notice {
	constructor(_message: string) {}
}

export class Vault {}
export class Plugin {}
export class App {}
export class Modal {}
export class Setting {}
export class PluginSettingTab {}
export class TextComponent {}
export class ButtonComponent {}

export function setIcon() {}
export function requireApiVersion() {
	return true;
}
