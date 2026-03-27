import type { App } from 'obsidian';
import runAsync from '~/utils/run-async';
import type { SyncSettingTab } from '.';
import type WebDAVSyncPlugin from '..';

export default abstract class BaseSettings {
	constructor(
		protected app: App,
		protected plugin: WebDAVSyncPlugin,
		protected settings: SyncSettingTab,
		protected containerEl: HTMLElement,
	) {}

	protected runAsyncTask(task: () => Promise<void>, context: string): void {
		runAsync(task, context);
	}

	protected saveSettingsTask(
		mutate: () => void,
		context: string,
		followUp?: () => Promise<void> | void,
	): void {
		this.runAsyncTask(async () => {
			mutate();
			await this.plugin.saveSettings();
			await followUp?.();
		}, context);
	}

	abstract display(): void;
}
