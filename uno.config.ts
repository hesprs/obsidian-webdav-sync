import { defineConfig } from 'unocss';
import { presetWind3 } from 'unocss/preset-wind3';

export default defineConfig({
	content: {
		filesystem: ['src/**/*.{html,js,ts,jsx,tsx,vue,svelte,astro}'],
	},
	rules: [[/^background-none$/, () => ({ background: 'none' })]],
	presets: [presetWind3()],
});
