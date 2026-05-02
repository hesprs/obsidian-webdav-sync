import type WebDAVSyncPlugin from '~';
import logger from '~/utils/logger';

// TODO: remove migration in May 2026
export default function processSettings(plugin: WebDAVSyncPlugin): void {
	let changed = false;
	const settings = plugin.settings;

	// Remove at 1 May 2026
	if ('credential' in settings)
		try {
			const credential = settings.credential;
			if (credential && typeof credential === 'string') {
				plugin.app.secretStorage.setSecret('webdav-token', credential);
				settings.token = 'webdav-token';
			}
			delete settings.credential;
			changed = true;
			logger.info('Migrated user WebDAV token to secret storage.');
		} catch (error) {
			logger.error('Failed to migrate WebDAV token!', error);
			throw error;
		}

	// Remove at 10 May 2026
	if ('bytes' in settings.skipLargeFiles && typeof settings.skipLargeFiles.bytes === 'number') {
		const enabled = settings.skipLargeFiles.bytes !== 0;
		settings.skipLargeFiles = {
			enabled,
			value: enabled ? settings.skipLargeFiles.bytes : 31_457_280,
		};
		changed = true;
	}

	if (
		typeof settings.realtimeSync === 'boolean' &&
		'realtimeSyncDelay' in settings &&
		typeof settings.realtimeSyncDelay === 'number'
	) {
		settings.realtimeSync = {
			enabled: settings.realtimeSync,
			value: settings.realtimeSyncDelay,
		};
		delete settings.realtimeSyncDelay;
		changed = true;
	}

	if (
		'maxConcurrentWebDAVCalls' in settings &&
		typeof settings.maxConcurrentWebDAVCalls === 'number'
	) {
		const enabled = settings.maxConcurrentWebDAVCalls !== 0;
		settings.maxWebDAVConcurrency = {
			enabled,
			value: enabled ? settings.maxConcurrentWebDAVCalls : 100,
		};
		delete settings.maxConcurrentWebDAVCalls;
		changed = true;
	}

	if (
		'maxConcurrentSyncTasks' in settings &&
		typeof settings.maxConcurrentSyncTasks === 'number'
	) {
		const enabled = settings.maxConcurrentSyncTasks !== 0;
		settings.maxSyncTaskConcurrency = {
			enabled,
			value: enabled ? settings.maxConcurrentSyncTasks : 100,
		};
		delete settings.maxConcurrentSyncTasks;
		changed = true;
	}

	if (
		'minTimeBetweenWebDAVCalls' in settings &&
		typeof settings.minTimeBetweenWebDAVCalls === 'number'
	) {
		const enabled = settings.minTimeBetweenWebDAVCalls !== 0;
		settings.minWebDAVRequestInterval = {
			enabled,
			value: enabled ? settings.minTimeBetweenWebDAVCalls : 0,
		};
		delete settings.minTimeBetweenWebDAVCalls;
		changed = true;
	}

	if (
		'startupSyncDelaySeconds' in settings &&
		typeof settings.startupSyncDelaySeconds === 'number'
	) {
		const enabled = settings.startupSyncDelaySeconds !== 0;
		settings.startupSync = {
			enabled,
			value: enabled ? settings.startupSyncDelaySeconds * 1000 : 5000,
		};
		delete settings.startupSyncDelaySeconds;
		changed = true;
	}

	if (
		'scheduledSyncIntervalSeconds' in settings &&
		typeof settings.scheduledSyncIntervalSeconds === 'number'
	) {
		const enabled = settings.scheduledSyncIntervalSeconds !== 0;
		settings.scheduledSync = {
			enabled,
			value: enabled ? settings.scheduledSyncIntervalSeconds * 1000 : 1000 * 60 * 10,
		};
		delete settings.scheduledSyncIntervalSeconds;
		changed = true;
	}

	if ('syncMode' in settings) {
		delete settings.syncMode;
		changed = true;
	}

	if (
		'useFastSyncOnLocalChange' in settings &&
		typeof settings.useFastSyncOnLocalChange === 'boolean'
	) {
		settings.fastRealtimeSync = settings.useFastSyncOnLocalChange;
		delete settings.useFastSyncOnLocalChange;
		changed = true;
	}

	const UrlError = new Error('Invalid server URL, please check your settings');
	let parsedUrl: URL;
	try {
		parsedUrl = new URL(settings.serverUrl);
	} catch {
		throw UrlError;
	}
	if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw UrlError;
	const newUrl = parsedUrl.toString().replace(/\/+$/, '');
	if (newUrl !== settings.serverUrl) {
		settings.serverUrl = newUrl;
		changed = true;
	}

	if (changed) void plugin.saveSettings();
}
