import UnoCSS from '@unocss/postcss';
import { builtinModules } from 'node:module';
import postcssMergeRules from 'postcss-merge-rules';
import { defineConfig } from 'tsdown';
import solid from 'unplugin-solid/rolldown';
import pkg from './package.json' with { type: 'json' };

const dev = process.env.MODE === 'dev';

export default defineConfig({
	entry: 'src/index.ts',
	minify: !dev,
	define: {
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || ''),
		'process.env.PLUGIN_VERSION': String(pkg.version),
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
			...builtinModules,
		],
	},
	outputOptions: {
		file: 'dist/main.js',
		codeSplitting: false,
	},
	sourcemap: false,
	format: 'cjs',
	copy: [
		{
			from: 'manifest.json',
			to: 'dist',
		},
	],
	logLevel: 'error',
	target: 'es2018',
	platform: 'browser',
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
		minify: dev,
		fileName: 'styles.css',
	},
    clean: !dev,
});
