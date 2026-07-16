<script lang="ts">
	import type { Highlighter } from "shiki/bundle/web";
	import type { File } from "./demo.svelte.ts";

	interface Props {
		highlighter: Highlighter;
		file: File;
	}

	const { highlighter, file }: Props = $props();
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -->
<div
	class="h-full min-h-full text-xs/relaxed focus-visible:outline-0 overflow-y-auto scrollbar-none"
	contenteditable="plaintext-only"
	spellcheck="false"
>
	{@html highlighter.codeToHtml(file.code, {
		lang: file.lang,
		theme: "github-dark-default",
	})}
</div>
