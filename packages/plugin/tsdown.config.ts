import UnoCSS from '@unocss/postcss';
import postcssMergeRules from 'postcss-merge-rules';
import { defineConfig } from 'tsdown';
import solid from 'unplugin-solid/rolldown';
import pkg from './package.json' with { type: 'json' };

const dev = process.env.MODE === 'dev';
const buildingPlugin = process.env.BUILD === 'plugin';

const sharedConfig = defineConfig({
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
	minify: true,
	outExtensions: () => ({ js: '.js' }),
});

const pluginConfig = defineConfig({
	...sharedConfig,
	clean: !dev,
	copy: [
		{
			from: '../../manifest.json',
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
		'Bun.env.VERSION': JSON.stringify(pkg.version),
	},
	dts: false,
	entry: { main: 'src/index.ts' },
	format: 'cjs',
	inputOptions: {
		resolve: {
			alias: {
				'hash-wasm': 'hash-wasm/dist/index.esm.js',
				'solid-js/web': 'solid-js/web/dist/web.js',
			},
			conditionNames: ['browser', 'import', 'module', 'default'],
		},
	},
	outDir: 'dist',
	outputOptions: {
		codeSplitting: false,
	},
	platform: 'browser',
	plugins: [solid()],
	target: 'es2024',
});

const sdkConfig = defineConfig({
	...sharedConfig,
	clean: false,
	dts: true,
	entry: 'src/module-sdk.ts',
	outDir: 'dist',
});

export default buildingPlugin ? pluginConfig : sdkConfig;
