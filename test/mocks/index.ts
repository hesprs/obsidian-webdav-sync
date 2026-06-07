import { mock } from 'bun:test';
import * as ObsidianMock from './obsidian';

void mock.module('obsidian', () => ObsidianMock);
