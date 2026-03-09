import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	resolve: {
		alias: {
			'~': fileURLToPath(new URL('./src', import.meta.url)),
			obsidian: fileURLToPath(new URL('./tests/mocks/obsidian.ts', import.meta.url)),
		},
	},
	test: {},
});
