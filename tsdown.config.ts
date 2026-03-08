import UnoCSS from '@unocss/postcss';
import { builtinModules } from 'node:module';
import postcssMergeRules from 'postcss-merge-rules';
import postcss from 'rollup-plugin-postcss';
import { defineConfig } from 'tsdown';
import pkg from './package.json' with { type: 'json' };

const dev = process.env.MODE === 'dev';

export default defineConfig({
	entry: 'src/index.ts',
	minify: !dev,
	define: {
		'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || ''),
		'process.env.PLUGIN_VERSION': String(pkg.version),
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
			...builtinModules,
		],
	},
	outputOptions: {
		file: 'dist/main.js',
		codeSplitting: false,
	},
	sourcemap: dev ? 'inline' : false,
	format: 'cjs',
	copy: [
		{
			from: 'manifest.json',
			to: 'dist',
		},
	],
	logLevel: 'error',
	target: 'es2018',
	plugins: [
		postcss({
			plugins: [UnoCSS(), postcssMergeRules()],
		}),
	],
	platform: 'browser',
});
