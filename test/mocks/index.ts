import { mock } from 'bun:test';
import * as ObsidianMock from './obsidian';
import settings from './runtime';

void mock.module('obsidian', () => ObsidianMock);
void mock.module('~/settings', () => settings);
void mock.module('~/utils/is-retryable-error', () => ({
	default: mock(() => false),
}));
