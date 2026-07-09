import { request, requestUrl } from 'obsidian';

export default async function v3Exists(): Promise<boolean> {
	try {
		const response = await requestUrl({
			method: 'HEAD',
			url: `https://api.github.com/repos/hesprs/sync-engine`,
		});
		return response.status === 200;
	} catch {
		// Fallback to community.obsidian.md for regions without GitHub access
		try {
			const response = await request(`https://community.obsidian.md/sync-engine`);
			if (!response.includes('Obsidian Community')) return false;
			return !response.includes('NEXT_HTTP_ERROR_FALLBACK;404');
		} catch {
			return false;
		}
	}
}
