import adapter from "@sveltejs/adapter-auto";
import { sveltekit } from "@sveltejs/kit/vite";
import { svelteTesting } from "@testing-library/svelte/vite";
import { defineConfig, lazyPlugins } from "vite-plus";
import { playwright } from "vite-plus/test/browser-playwright";
import { commands } from "./test/commands";

export default defineConfig({
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					include: ["{src,test}/**/*.test.ts"],
					exclude: ["{src,test}/**/*.browser.test.ts"],
					environment: "happy-dom",
					setupFiles: ["./test/setup.ts"],
					css: false,
				},
			},
			{
				extends: true,
				resolve: { conditions: ["browser"] },
				test: {
					name: "browser",
					include: ["{src,test}/**/*.browser.test.ts"],
					setupFiles: ["./test/browser-setup.ts"],
					browser: {
						enabled: true,
						headless: true,
						viewport: { width: 1280, height: 800 },
						provider: playwright(),
						instances: [{ browser: "chromium" }],
						commands,
					},
				},
			},
		],
	},
	staged: {
		"*": "vp check --fix",
	},
	fmt: {
		tabWidth: 4,
		useTabs: true,
		overrides: [
			{
				files: ["*.yml", "*.yaml"],
				options: {
					tabWidth: 2,
				},
			},
		],
	},
	lint: {
		jsPlugins: [
			{
				name: "vite-plus",
				specifier: "vite-plus/oxlint-plugin",
			},
		],
		rules: {
			"vite-plus/prefer-vite-plus-imports": "error",
		},
		options: {
			typeAware: true,
			typeCheck: true,
		},
	},
	plugins: lazyPlugins(() => [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
			},

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter(),
		}),
		svelteTesting(),
	]),
});
