import { describe, expect, it } from 'vitest';
import {
	normalizeBaseDir,
	normalizePathToRelative,
	normalizeRemotePath,
	normalizeVaultPath,
	remoteBasename,
	vaultBasename,
	vaultDirname,
} from '~/platform/path';

describe('remote path helpers', () => {
	it('normalizes root and nested remote paths', () => {
		expect(normalizeRemotePath('/')).toBe('/');
		expect(normalizeRemotePath('/base//child/../file.md')).toBe('/base/file.md');
		expect(normalizeBaseDir('/base')).toBe('/base/');
		expect(normalizeBaseDir('/')).toBe('/');
	});

	it('maps absolute remote paths to vault-relative paths', () => {
		expect(normalizePathToRelative('/base/', '/base/Folder/Note.md')).toBe('Folder/Note.md');
		expect(normalizePathToRelative('/', '/Folder/Sub.md')).toBe('Folder/Sub.md');
		expect(normalizePathToRelative('/base/', '/base/')).toBe('/');
	});

	it('keeps spaces and non-ascii names stable', () => {
		expect(remoteBasename('/base/空 格.md')).toBe('空 格.md');
		expect(normalizePathToRelative('/base/', '/base/空 格.md')).toBe('空 格.md');
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
});
