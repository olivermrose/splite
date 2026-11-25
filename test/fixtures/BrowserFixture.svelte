<script lang="ts">
	import type { ComponentProps } from "svelte";
	import Group from "#lib/flex/Group.svelte";
	import Panel from "#lib/flex/Panel.svelte";
	import Separator from "#lib/flex/Separator.svelte";

	interface Props {
		width?: number;
		group?: Partial<ComponentProps<typeof Group>>;
		first?: Partial<ComponentProps<typeof Panel>>;
		third?: boolean;
	}

	let { width = 604, group = {}, first = {}, third = false }: Props = $props();
</script>

<div style:width="{width}px" style:height="200px">
	<Group id="group" style="height: 100%" {...group}>
		<Panel id="a" defaultSize={50} minSize={10} {...first}>A</Panel>

		<Separator aria-label="Resize A" style="width: 4px; background: black" />

		<Panel id="b" minSize={10}>B</Panel>

		{#if third}
			<Separator aria-label="Resize B" style="width: 4px; background: black" />
			<Panel id="c" defaultSize={20} minSize={10}>C</Panel>
		{/if}
	</Group>
</div>
