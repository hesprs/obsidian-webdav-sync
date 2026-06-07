import { expect, test } from 'bun:test';
import {
	normalizeBaseDir,
	normalizePathToRelative,
	normalizeRemotePath,
	normalizeVaultPath,
	remoteBasename,
	vaultBasename,
	vaultDirname,
} from '~/platform/path';

test('normalizes remote paths', () => {
	expect(normalizeRemotePath('/')).toBe('/');
	expect(normalizeRemotePath('/base//child/../file.md')).toBe('/base/file.md');
	expect(normalizeBaseDir('/base')).toBe('/base/');
	expect(normalizeBaseDir('/')).toBe('/');
});

test('maps absolute remote paths to vault-relative paths', () => {
	expect(normalizePathToRelative('/base/', '/base/Folder/Note.md')).toBe('Folder/Note.md');
	expect(normalizePathToRelative('/', '/Folder/Sub.md')).toBe('Folder/Sub.md');
	expect(normalizePathToRelative('/base/', '/base/')).toBe('/');
});

test('keeps spaces and non-ascii remote names stable', () => {
	expect(remoteBasename('/base/空 格.md')).toBe('空 格.md');
	expect(normalizePathToRelative('/base/', '/base/空 格.md')).toBe('空 格.md');
});

test('normalizes vault paths', () => {
	expect(normalizeVaultPath('')).toBe('');
	expect(normalizeVaultPath('/folder//nested/../note.md')).toBe('folder/note.md');
});

test('returns vault dirname and basename', () => {
	expect(vaultDirname('note.md')).toBe('.');
	expect(vaultDirname('folder/note.md')).toBe('folder');
	expect(vaultBasename('folder/note.md')).toBe('note.md');
});
