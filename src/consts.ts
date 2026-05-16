import { Platform, requireApiVersion } from 'obsidian';

export const API_VER_REQURL = '0.13.26'; // Desktop ver 0.13.26, iOS ver 1.1.1
export const API_VER_REQURL_ANDROID = '0.14.6'; // Android ver 1.2.1

export const VALID_REQURL =
	(!Platform.isAndroidApp && requireApiVersion(API_VER_REQURL)) ||
	(Platform.isAndroidApp && requireApiVersion(API_VER_REQURL_ANDROID));

export const VERSION = process.env.VERSION ?? '2.1.0';
