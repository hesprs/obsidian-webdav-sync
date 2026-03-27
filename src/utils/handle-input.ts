import type { TextComponent } from 'obsidian';
import type { PluginSettings } from '~/settings';
import type WebDAVSyncPlugin from '..';

export default function handleInput(
	text: TextComponent,
	plugin: WebDAVSyncPlugin,
	field: keyof PluginSettings,
	processValue: (value: string) => unknown = (value) => value,
) {
	const value = processValue(text.getValue().trim());
	if (plugin.settings[field] !== value) {
		plugin.settings[field] = value as never;
		void plugin.saveSettings();
	}
}
