import { describe, expect, it } from 'vitest';
import {
	joinRemotePath,
	normalizeRemoteDir,
	normalizeRemotePath,
	remoteBasename,
	remotePathToLocalRelative,
} from '~/platform/path/remote-path';
import {
	joinVaultPath,
	normalizeVaultPath,
	vaultBasename,
	vaultDirname,
} from '~/platform/path/vault-path';

describe('remote path helpers', () => {
	it('normalizes root and nested remote paths', () => {
		expect(normalizeRemotePath('/')).toBe('/');
		expect(normalizeRemotePath('/base//child/../file.md')).toBe('/base/file.md');
		expect(normalizeRemoteDir('/base')).toBe('/base/');
	});

	it('joins remote paths without losing absoluteness', () => {
		expect(joinRemotePath('/base/', 'nested', 'note.md')).toBe('/base/nested/note.md');
		expect(joinRemotePath('/', '空间', '文件.md')).toBe('/空间/文件.md');
	});

	it('maps absolute remote paths to vault-relative paths', () => {
		expect(remotePathToLocalRelative('/base/', '/base/Folder/Note.md')).toBe('Folder/Note.md');
		expect(remotePathToLocalRelative('/', '/Folder/Sub.md')).toBe('Folder/Sub.md');
		expect(remotePathToLocalRelative('/base/', '/base/')).toBe('');
	});

	it('keeps spaces and non-ascii names stable', () => {
		expect(remoteBasename('/base/空 格.md')).toBe('空 格.md');
		expect(remotePathToLocalRelative('/base/', '/base/空 格.md')).toBe('空 格.md');
	});
});

describe('vault path helpers', () => {
	it('normalizes relative vault paths', () => {
		expect(normalizeVaultPath('')).toBe('');
		expect(normalizeVaultPath('/folder//nested/../note.md')).toBe('folder/note.md');
	});

	it('returns dirname and basename with vault semantics', () => {
		expect(vaultDirname('note.md')).toBe('.');
		expect(vaultDirname('folder/note.md')).toBe('folder');
		expect(vaultBasename('folder/note.md')).toBe('note.md');
	});

	it('joins nested vault segments', () => {
		expect(joinVaultPath('folder', 'nested', 'note.md')).toBe('folder/nested/note.md');
		expect(joinVaultPath('folder//', './nested', 'note.md')).toBe('folder/nested/note.md');
	});
});
