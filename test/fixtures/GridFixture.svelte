<script lang="ts">
	import type { ComponentProps } from "svelte";
	import Cell from "#lib/grid/Cell.svelte";
	import Grid from "#lib/grid/Grid.svelte";
	import Gridline from "#lib/grid/Gridline.svelte";
	import ParentGridProbe from "./ParentGridProbe.svelte";
	import type { ParentGrid } from "#lib/grid/context.ts";
	import type { GridLayout } from "#lib/grid/types.ts";

	interface CellSpec extends ComponentProps<typeof Cell> {
		id: string;
	}

	interface GridlineSpec extends ComponentProps<typeof Gridline> {
		id: string;
		label?: string;
	}

	interface Props {
		grid?: Partial<ComponentProps<typeof Grid>>;
		columns?: ComponentProps<typeof Grid>["columns"];
		rows?: ComponentProps<typeof Grid>["rows"];
		cells?: CellSpec[];
		gridlines?: GridlineSpec[];
		size?: number;
		bound?: boolean;
		dir?: "ltr" | "rtl";
		onParent?: (grid: ParentGrid) => void;
	}

	let {
		grid = {},
		columns = 2,
		rows = 2,
		cells = [
			{ id: "cell-0-0", column: 0, row: 0 },
			{ id: "cell-1-0", column: 1, row: 0 },
			{ id: "cell-0-1", column: 0, row: 1 },
			{ id: "cell-1-1", column: 1, row: 1 },
		],
		gridlines = [],
		size = 100,
		bound = false,
		dir,
		onParent,
	}: Props = $props();

	let layout = $state<GridLayout>();
</script>

<div {dir} style:width="{size}px" style:height="{size}px">
	{#if bound}
		<Grid
			id="grid"
			aria-label="Dashboard"
			{columns}
			{rows}
			{...grid}
			style="height: 100%"
			bind:layout
		>
			{@render body()}
		</Grid>
	{:else}
		<Grid id="grid" aria-label="Dashboard" {columns} {rows} {...grid} style="height: 100%">
			{@render body()}
		</Grid>
	{/if}
</div>

<output data-testid="layout">{layout ? JSON.stringify(layout) : ""}</output>

{#snippet body()}
	{#each cells as cell (cell.id)}
		<Cell {...cell}>{cell.id}</Cell>
	{/each}

	{#each gridlines as { label, ...gridline } (gridline.id)}
		<Gridline
			aria-label={label ?? gridline.id}
			style={gridline.type === "column"
				? "background: black; width: 10px"
				: "background: black; height: 10px"}
			{...gridline}
		/>
	{/each}

	{#if onParent}
		<ParentGridProbe {onParent} />
	{/if}
{/snippet}
