import { describe, expect, it } from 'vitest';
import { normalizeRemoteWalkPath } from '../src/fs/utils/normalize-remote-walk-path';

describe('normalizeRemoteWalkPath', () => {
	it('keeps base-relative traversal paths when remote base is non-root', () => {
		expect(normalizeRemoteWalkPath('/Welcome.md', '/test/')).toBe('Welcome.md');
	});

	it('normalizes base-prefixed absolute traversal paths', () => {
		expect(normalizeRemoteWalkPath('/test/Welcome.md', '/test/')).toBe('Welcome.md');
		expect(normalizeRemoteWalkPath('/test/Folder/', '/test/')).toBe('Folder');
	});

	it('normalizes root-base traversal paths', () => {
		expect(normalizeRemoteWalkPath('/Folder/Sub.md', '/')).toBe('Folder/Sub.md');
	});
});
