import type WebDAVSyncPlugin from '~';
import waitUntil from '~/utils/wait-until';

let pluginInstance: WebDAVSyncPlugin | undefined;

export function setPluginInstance(plugin?: WebDAVSyncPlugin) {
	pluginInstance = plugin;
}

export async function usePlugin() {
	await waitUntilPluginInstance();
	return pluginInstance as WebDAVSyncPlugin;
}

function waitUntilPluginInstance() {
	return waitUntil(() => Boolean(pluginInstance), 100);
}

export async function useSettings() {
	await waitUntilPluginInstance();
	return (pluginInstance as WebDAVSyncPlugin).settings;
}
