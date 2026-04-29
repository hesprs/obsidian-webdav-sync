import UnoCSS from '@unocss/postcss';
import postcssMergeRules from 'postcss-merge-rules';
import { defineConfig } from 'tsdown';
import solid from 'unplugin-solid/rolldown';
import pkg from './package.json' with { type: 'json' };

const mode = process.env.MODE;
const dev = mode === 'dev';
const inspect = mode === 'inspect';

export default defineConfig({
	entry: 'src/index.ts',
	platform: 'browser',
	minify: !dev,
	define: {
		'process.env.MODE': JSON.stringify(mode) ?? '"prod"',
		'process.env.VERSION': JSON.stringify(pkg.version),
	},
	plugins: [solid()],
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
	outputOptions: {
		file: 'dist/main.js',
		codeSplitting: false,
	},
	format: 'cjs',
	copy: [
		{
			from: 'manifest.json',
			to: 'dist',
		},
	],
	//logLevel: 'error',
	target: 'es2018',
	inputOptions: {
		resolve: {
			// Obsidian plugins run in Electron with a DOM, but CJS resolution can still
			// select Solid's server runtime. Force the browser runtime explicitly.
			alias: {
				'solid-js/web': 'solid-js/web/dist/web.js',
			},
			conditionNames: ['browser', 'import', 'module', 'default'],
		},
	},
	css: {
		postcss: {
			plugins: [UnoCSS(), postcssMergeRules()],
		},
		transformer: 'postcss',
		minify: !dev,
		fileName: 'styles.css',
	},
	clean: !dev && !inspect,
	devtools: inspect,
});
