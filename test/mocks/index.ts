import { mock } from 'bun:test';
import * as ObsidianMock from './obsidian';

void mock.module('obsidian', () => ObsidianMock);
if (typeof window === 'undefined')
	globalThis.window = { clearInterval, clearTimeout, setInterval, setTimeout } as never;
