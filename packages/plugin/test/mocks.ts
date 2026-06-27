import { ObsidianMock } from '@repo/shared';
import { mock } from 'bun:test';

void mock.module('obsidian', () => ObsidianMock);
if (typeof window === 'undefined')
	globalThis.window = { clearInterval, clearTimeout, setInterval, setTimeout } as never;
