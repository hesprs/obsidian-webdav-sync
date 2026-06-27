import { ObsidianMock } from '@repo/shared';
import { mock } from 'bun:test';

void mock.module('obsidian', () => ObsidianMock);
