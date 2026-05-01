// oxlint-disable import/no-nodejs-modules
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			obsidian: fileURLToPath(new URL('tests/mocks/obsidian.ts', import.meta.url)),
			'~': fileURLToPath(new URL('src', import.meta.url)),
		},
	},
	test: {},
});
