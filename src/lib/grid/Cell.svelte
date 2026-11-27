<script lang="ts" module>
	import type { PartProps } from "@ui-sdk/svelte/primitive";
	import type { CellProps as PrimitiveCellProps } from "./types";

	export type CellProps = PartProps<"div"> & PrimitiveCellProps;
</script>

<script lang="ts">
	import { Part, usePart } from "@ui-sdk/svelte/primitive";
	import { grid } from "./grid";

	let { id: givenId, column, row, columnSpan, rowSpan, ...props }: CellProps = $props();

	const defaultId = $props.id();

	const id = $derived(givenId ?? defaultId);

	const cell = usePart(grid, "cell", () => ({
		id,
		column,
		row,
		columnSpan,
		rowSpan,
	}));
</script>

{#if cell.present}
	<Part tag="div" part={cell} {props} />
{/if}
