<script lang="ts">
	import "./layout.css";

	const { children } = $props();
</script>

<svelte:head>
	<title>Splite - Tilable pane layouts for Svelte</title>
	<meta
		name="description"
		content="A headless, tabbed split-pane layout library for Svelte 5. Drag tabs, split panes, persist layouts."
	/>
</svelte:head>

<div class="min-h-screen bg-neutral-950 font-mono text-neutral-100">
	{@render children()}
</div>
