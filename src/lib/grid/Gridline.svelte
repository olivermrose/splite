<script lang="ts" module>
	import type { PartProps } from "@ui-sdk/svelte/primitive";
	import type { GridlineProps as PrimitiveGridlineProps } from "./grid";

	interface GridlineState {
		/**
		 * `"vertical"` for a column gridline and `"horizontal"` for a row
		 * gridline.
		 */
		orientation: "horizontal" | "vertical";

		/**
		 * Whether a pointer is dragging the boundary that the gridline sits on.
		 */
		dragging: boolean;

		/**
		 * Whether the pointer is over the boundary that the gridline sits on,
		 * on this gridline or on another part of the same boundary.
		 */
		hovering: boolean;

		/**
		 * Whether the gridline is disabled, by its own `disabled` prop or by
		 * the grid's.
		 */
		disabled: boolean;
	}

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
