<script lang="ts">
	import type { ComponentProps } from "svelte";
	import Group from "#lib/flex/Group.svelte";
	import Panel from "#lib/flex/Panel.svelte";
	import Separator from "#lib/flex/Separator.svelte";
	import PanelControls from "./PanelControls.svelte";
	import type { PanelSize, ParentGroup } from "#lib/flex/types.ts";

	interface Props {
		group?: Partial<ComponentProps<typeof Group>>;
		first?: Partial<ComponentProps<typeof Panel>>;
		separator?: Partial<ComponentProps<typeof Separator>>;
		onResize?: (id: string, size: PanelSize, previous: PanelSize | undefined) => void;
		onGroup?: (group: ParentGroup) => void;
	}

	let { group = {}, first = {}, separator = {}, onResize, onGroup }: Props = $props();

	let layout = $state<number[]>();
</script>

<Group id="group" {...group} bind:layout>
	<Panel id="files" defaultSize={30} minSize={10} collapsible {onResize} {...first}>
		<PanelControls {onGroup} />
	</Panel>

	<Separator aria-label="Resize files" {...separator} />
	<Panel id="editor" minSize={10}>Editor</Panel>
</Group>

<output data-testid="layout">{layout?.join(",") ?? ""}</output>
