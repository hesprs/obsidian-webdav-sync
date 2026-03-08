import { App } from 'obsidian';
import { SyncSettingTab } from '.';
import WebDAVSyncPlugin from '..';

export default abstract class BaseSettings {
	constructor(
		protected app: App,
		protected plugin: WebDAVSyncPlugin,
		protected settings: SyncSettingTab,
		protected containerEl: HTMLElement,
	) {}

	abstract display(): void;
}
