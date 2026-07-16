<script lang="ts" module>
	import type { Snippet } from "svelte";
	import type { Pane } from "../pane.svelte.js";
	import { Split, type SplitNode } from "../split.svelte.js";

	export interface SpliteSnippets {
		pane?: Snippet<[pane: Pane, children: Snippet]>;
		tabBar: Snippet<[pane: Pane]>;
		content: Snippet<[tabId: string, pane: Pane]>;
		empty?: Snippet<[pane: Pane]>;
		splitter?: Snippet<[split: Split, index: number]>;
	}
</script>

<script lang="ts">
	import { getSpliteContext } from "./context.svelte.js";
	import Node from "./Node.svelte";
	import PaneView from "./Pane.svelte";
	import Splitter from "./Splitter.svelte";

	interface Props {
		node: SplitNode;
		weight: number;
		snippets: SpliteSnippets;
	}

	const { node, weight, snippets }: Props = $props();

	const context = getSpliteContext();
</script>

{#if node instanceof Split}
	<div
		class="splite-node splite-split"
		data-node-id={node.id}
		data-orientation={node.orientation}
		style:flex="{weight} 1 0"
		style:display="flex"
		style:flex-direction={node.orientation === "horizontal" ? "row" : "column"}
		style:min-width="0"
		style:min-height="0"
	>
		{#each node.children as child, i (child.id)}
			{#if i > 0}
				<div
					class="splite-splitter-track"
					data-split-id={node.id}
					data-splitter-index={i - 1}
					style:flex="0 0 {context.gap}px"
					style:align-self="stretch"
					style:position="relative"
					style:z-index="10"
				>
					{#if snippets.splitter}
						{@render snippets.splitter(node, i - 1)}
					{:else}
						<Splitter split={node} index={i - 1} />
					{/if}
				</div>
			{/if}

			<Node node={child} weight={node.weights[i]} {snippets} />
		{/each}
	</div>
{:else}
	{#snippet inner()}
		{@render snippets.tabBar(node)}

		{#each node.tabs as tabId (tabId)}
			{@render snippets.content(tabId, node)}
		{:else}
			{@render snippets.empty?.(node)}
		{/each}
	{/snippet}

	<div
		class="splite-node"
		data-node-id={node.id}
		style:flex="{weight} 1 0"
		style:display="flex"
		style:min-width="0"
		style:min-height="0"
	>
		{#if snippets.pane}
			{@render snippets.pane(node, inner)}
		{:else}
			<PaneView pane={node}>
				{@render inner()}
			</PaneView>
		{/if}
	</div>
{/if}

<style>
	:global(:where(.splite-node)) {
		transition-property: flex-grow;
		transition-duration: var(--splite-transition-duration, 0);
		transition-timing-function: var(--splite-transition-easing, ease);
	}
</style>
