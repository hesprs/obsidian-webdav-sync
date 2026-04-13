import type { App } from 'obsidian';
import type WebDAVSyncPlugin from '~';
import type { SyncSettingTab } from '.';

export default abstract class BaseSettings {
	constructor(
		protected app: App,
		protected plugin: WebDAVSyncPlugin,
		protected settings: SyncSettingTab,
		protected containerEl: HTMLElement,
	) {}

	abstract display(): void;
}
