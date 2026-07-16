<script lang="ts">
	import { createMarkdownExit } from "markdown-exit";
	import { codeToHtml } from "shiki";
	import Demo from "./Demo.svelte";
	import docs from "./docs.md?raw";

	const md = createMarkdownExit({
		highlight(code, lang) {
			return codeToHtml(code, {
				lang: lang || "text",
				theme: "github-dark-default",
			});
		},
	});

	const rendered = md.renderAsync(docs);
</script>

<header class="mx-auto max-w-5xl px-6 pt-16 pb-10">
	<h1 class="text-4xl/normal font-bold tracking-tight">splite</h1>

	<a
		class="text-blue-400/80 hover:text-blue-400 text-sm"
		href="https://github.com/olivermrose/splite"
	>
		View source
	</a>

	<p class="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
		A headless, tiling layout library for Svelte 5. Drag tabs between panes, split in any
		direction, resize with pointer or keyboard, and persist the layout while you keep full
		control of the markup and styling.
	</p>

	<p class="mt-4 text-xs text-neutral-500">
		Try it: drag the tabs below, drop them on pane edges to split, or grab a divider to resize.
		The layout persists to localStorage.
	</p>
</header>

<div class="mx-auto max-w-6xl px-6">
	<div class="h-180 overflow-hidden border border-neutral-800">
		<Demo />
	</div>
</div>

<main class="prose-splite mx-auto max-w-5xl px-6 pb-16">
	{#await rendered then html}
		{@html html}
	{/await}
</main>
