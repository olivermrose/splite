<script lang="ts" module>
	import type { PartProps } from "@ui-sdk/svelte/primitive";
	import type { GridlineState } from "./grid";
	import type { GridlineProps as PrimitiveGridlineProps } from "./types";

	export type GridlineProps = PartProps<"div", GridlineState> & PrimitiveGridlineProps;
</script>

<script lang="ts">
	import { Part, usePart } from "@ui-sdk/svelte/primitive";
	import { grid } from "./grid";

	let {
		id: givenId,
		type,
		column,
		row,
		columnSpan,
		rowSpan,
		disabled,
		disableDoubleClick,
		...props
	}: GridlineProps = $props();

	const defaultId = $props.id();

	const id = $derived(givenId ?? defaultId);

	const gridline = usePart(grid, "gridline", () => ({
		id,
		type,
		column,
		row,
		columnSpan,
		rowSpan,
		disabled,
		disableDoubleClick,
	}));
</script>

{#if gridline.present}
	<Part tag="div" part={gridline} {props} />
{/if}
