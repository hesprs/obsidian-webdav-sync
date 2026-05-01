import { defineConfig, presetIcons } from 'unocss';
import { presetWind3 } from 'unocss/preset-wind3';

export default defineConfig({
	content: {
		filesystem: ['src/**/*.{html,js,ts,jsx,tsx,vue,svelte,astro}'],
	},
	presets: [
		presetIcons({
			collections: {
				custom: {
					file: '<svg viewBox="0 0 1024 1024"><path d="M186.9 64c-18.4 0-33.4 14.7-33.4 32.6v830.8c0 17.9 15 32.6 33.4 32.6h650.2c18.4 0 33.4-14.7 33.4-32.6V259.5L669.9 64Zm0 0" style="fill:#e3ecff"/><path d="M669.9 64v162.9c0 17.9 15 32.6 33.4 32.6h167.2ZM479.2 619.9h50v48.57h-50zm39.7-256.5h-6.1c-56.3 0-91.3 27.4-104 81.3l-1.3 5.6 42.5 14 1.3-7.1c6.9-36.9 25.7-54.1 59.3-54.1h4.6c28.1 2.6 42.8 15.6 46.2 40.6 2.6 20.4-10.1 40.2-37.7 58.9s-41.2 44-40.1 72.9v20.7h42.8v-19.3c-.9-17.7 7.9-32.8 26.1-45 38.3-26.2 56.7-55.7 54.6-87.8-4.2-50.5-33.8-77.6-88.2-80.7" style="fill:#95a7cd"/></svg>',
					folder: '<svg viewBox="0 0 1024 1024"><path d="m396.5 185.7 22.7 27.2a36.1 36.1 0 0 0 27.7 12.7h459.9c29.4 0 53.2 22.8 53.2 50.9v523.6c0 28.1-23.8 50.9-53.2 50.9H117.2C87.8 851 64 828.2 64 800.1V223.9c0-28.1 23.8-50.9 53.2-50.9h251.6a36.1 36.1 0 0 1 27.7 12.7" style="fill:#9fddff"/><path d="M64 342.5v455.3c0 29.4 24 53.2 53.6 53.2h788.8c29.6 0 53.6-23.8 53.6-53.2V342.5Z" style="fill:#74c6ff"/></svg>',
				},
			},
		}),
		presetWind3(),
	],
	rules: [
		[
			/^scrollbar-hide$/,
			([_]) => `.scrollbar-hide{scrollbar-width:none}
  .scrollbar-hide::-webkit-scrollbar{display:none}`,
		],
		[
			/^scrollbar-default$/,
			([_]) => `.scrollbar-default{scrollbar-width:auto}
  .scrollbar-default::-webkit-scrollbar{display:block}`,
		],
		[/^background-none$/, () => ({ background: 'none' })],
	],
});
