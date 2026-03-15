import { subtle } from 'node:crypto';
import { normalizePath } from 'obsidian';
import { hash } from 'ohash';
import { stdRemotePath } from './std-remote-path';

export function getDBKey(vaultName: string, remoteBaseDir: string) {
	return hash({
		vaultName,
		remoteBaseDir: stdRemotePath(remoteBaseDir),
	});
}

function arrayBufferToHex(buffer: ArrayBuffer): string {
	return Array.from(new Uint8Array(buffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export async function getTraversalWebDAVDBKey(
	token: string,
	remoteBaseDir: string,
): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);
	const hashBuffer = await subtle.digest('SHA-256', data);
	const hash = arrayBufferToHex(hashBuffer);
	remoteBaseDir = normalizePath(remoteBaseDir);
	return `${hash}:${remoteBaseDir}`;
}
