<script lang="ts" module>
	import type { SpliteSnippets } from "./Node.svelte";

	export type ViewProps = SpliteSnippets;
</script>

<script lang="ts">
	import { getSpliteContext } from "./context.svelte.js";
	import Node from "./Node.svelte";

	const { pane, tabBar, content, empty, splitter }: ViewProps = $props();

	const context = getSpliteContext();
</script>

<Node
	node={context.splite.root}
	weight={1}
	snippets={{
		pane,
		tabBar,
		content,
		empty,
		splitter,
	}}
/>
