<script lang="ts">
	import { useSplite } from "$lib/index.js";
	import type { Pane } from "$lib/pane.svelte.js";
	import plus from "../assets/plus.svg?raw";
	import splitHorizontal from "../assets/split-horizontal.svg?raw";
	import splitVertical from "../assets/split-vertical.svg?raw";
	import { files, meta } from "./demo.svelte.js";

	interface Props {
		pane: Pane;
	}

	const { pane }: Props = $props();

	const splite = useSplite();

	const buttons = [
		{
			icon: plus,
			title: "New tab",
			action: () => newTab(pane.id),
		},
		{
			icon: splitHorizontal,
			title: "Split right",
			action: () => splite.splitPane(pane.id, "right"),
		},
		{
			icon: splitVertical,
			title: "Split down",
			action: () => splite.splitPane(pane.id, "bottom"),
		},
	];

	function newTab(paneId?: string) {
		const id = `file-${++meta.counter}`;

		files.set(id, {
			title: `scratch-${meta.counter}.js`,
			lang: "javascript",
			code: "// new file\n",
		});

		splite.createTab(id, paneId);
	}
</script>

<div class="ml-auto flex flex-none items-center gap-1 pr-2 pl-3">
	{#each buttons as btn}
		<button
			class="flex cursor-pointer items-center justify-center rounded p-1 text-neutral-600 hover:bg-neutral-800 hover:text-neutral-400 [&>svg]:size-4"
			title={btn.title}
			aria-label={btn.title}
			onclick={btn.action}
		>
			{@html btn.icon}
		</button>
	{/each}
</div>
