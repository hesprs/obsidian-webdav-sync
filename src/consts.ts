import { requireApiVersion } from 'obsidian';

export const VALID_REQURL = requireApiVersion('1.12.3');

export const VERSION = Bun.env.VERSION ?? '2.1.0';
