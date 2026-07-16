<script lang="ts" module>
	export interface DragOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
		children?: Snippet<[tabId: string, fromPane: Pane]>;
	}
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Pane } from "../pane.svelte.js";
	import { getSpliteContext, type DragState } from "./context.svelte.js";

	const { children, ...rest }: DragOverlayProps = $props();

	const context = getSpliteContext();

	const drag = $derived(context.drag);

	function dragOverlayProps(drag: DragState) {
		return mergeProps(rest, {
			class: "splite-drag-overlay",
			style: {
				position: "fixed",
				zIndex: "calc(infinity)",
				pointerEvents: "none",
				top: `${drag.y + 6}px`,
				left: `${drag.x + 6}px`,
			},
		});
	}
</script>

{#if drag}
	<div {...dragOverlayProps(drag)}>
		{@render children?.(drag.tabId, drag.fromPane)}
	</div>
{/if}
