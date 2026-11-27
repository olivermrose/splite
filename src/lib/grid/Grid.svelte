<script lang="ts" module>
	import type { PartProps } from "@ui-sdk/svelte/primitive";
	import type { GridOptions } from "./grid";
	import type { GridLayout } from "./types";

	interface GridState {
		/**
		 * The size of each column and row as a percentage of the grid.
		 */
		layout: GridLayout;

		/**
		 * Whether a pointer is dragging a boundary of the grid.
		 */
		dragging: boolean;

		/**
		 * Whether the grid is disabled.
		 */
		disabled: boolean;
	}

	export type GridProps = PartProps<"div", GridState> & Omit<GridOptions, "id">;
</script>

<script lang="ts">
	import { Part, usePart, usePrimitive } from "@ui-sdk/svelte/primitive";
	import { setContext } from "svelte";
	import { setGrid } from "./context";
	import { createGridController, grid } from "./grid";

	let {
		columns,
		rows,
		controller: givenController,
		layout = $bindable(),
		defaultLayout,
		disabled,
		step,
		largeStep,
		autoSaveId,
		storage,
		gutters,
		debug,
		onLayoutChange,
		onLayoutCommit,
		...props
	}: GridProps = $props();

	const id = $props.id();

	const defaultController = createGridController();

	const controller = $derived(givenController ?? defaultController);

	const handle = usePrimitive(grid, () => ({
		id,
		columns,
		rows,
		layout,
		defaultLayout,
		disabled,
		step,
		largeStep,
		autoSaveId,
		storage,
		gutters,
		controller,
		debug,
		onLayoutChange(next, details) {
			onLayoutChange?.(next, details);

			if (!details.canceled) {
				layout = next;
			}
		},
		onLayoutCommit,
	}));

	// `Cell` and `Gridline` find this grid through `usePart(grid, ...)`, which
	// reads the context under the `grid` key.
	setContext(grid, handle);

	setGrid({
		get id() {
			return (props.id as string | undefined) ?? id;
		},
		get controller() {
			return controller;
		},
	});

	const root = usePart(handle, "root");

	$effect(() => {
		if (layout === undefined) {
			layout = handle.state.layout;
		}
	});
</script>

{#if root.present}
	<Part tag="div" part={root} {props} />
{/if}
