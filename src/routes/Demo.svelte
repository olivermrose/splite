<script lang="ts">
	import { Splite } from "$lib/index.js";
	import { persisted, save } from "./demo.svelte.js";
	import DemoView from "./DemoView.svelte";

	const trafficLights = ["bg-red-400", "bg-amber-400", "bg-green-400"];
</script>

<div class="flex gap-1.5 p-2">
	{#each trafficLights as light}
		<div class="size-2.5 rounded-full {light}"></div>
	{/each}
</div>

<Splite.Provider
	tabBarHeight={40}
	snapshot={persisted?.layout}
	onLayoutChange={(splite) => save(splite.toJSON())}
>
	<DemoView />
</Splite.Provider>
