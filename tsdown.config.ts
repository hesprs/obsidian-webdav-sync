import UnoCSS from '@unocss/postcss';
import postcssMergeRules from 'postcss-merge-rules';
import { defineConfig } from 'tsdown';
import solid from 'unplugin-solid/rolldown';
import man from './manifest.json' with { type: 'json' };

const mode = process.env.MODE;
const dev = mode === 'dev';
const inspect = mode === 'inspect';

export default defineConfig({
	clean: !dev && !inspect,
	copy: [
		{
			from: 'manifest.json',
			to: 'dist',
		},
	],
	css: {
		fileName: 'styles.css',
		minify: true,
		postcss: {
			plugins: [UnoCSS(), postcssMergeRules()],
		},
		transformer: 'postcss',
	},
	define: {
		'Bun.env.VERSION': JSON.stringify(man.version),
	},
	deps: {
		neverBundle: [
			'obsidian',
			'electron',
			'@codemirror/autocomplete',
			'@codemirror/collab',
			'@codemirror/commands',
			'@codemirror/language',
			'@codemirror/lint',
			'@codemirror/search',
			'@codemirror/state',
			'@codemirror/view',
		],
		onlyBundle: false,
	},
	devtools: inspect,
	entry: 'src/index.ts',
	format: 'cjs',
	inputOptions: {
		resolve: {
			// Obsidian plugins run in Electron with a DOM, but CJS resolution can still
			// Select Solid's server runtime. Force the browser runtime explicitly.
			alias: {
				'hash-wasm': 'hash-wasm/dist/index.esm.js',
				'solid-js/web': 'solid-js/web/dist/web.js',
			},
			conditionNames: ['browser', 'import', 'module', 'default'],
		},
	},
	minify: true,
	outputOptions: {
		codeSplitting: false,
		file: 'dist/main.js',
	},
	platform: 'browser',
	plugins: [solid()],
	target: 'es2024',
});
