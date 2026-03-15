import { normalizeRemotePath } from '~/platform/path/remote-path';
import { normalizeVaultPath } from '~/platform/path/vault-path';

export function getRootFolderName(path: string) {
	path = path.startsWith('/') ? normalizeRemotePath(path).slice(1) : normalizeVaultPath(path);
	return path.split('/')[0];
}
