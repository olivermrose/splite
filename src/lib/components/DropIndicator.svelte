<script lang="ts" module>
	export interface DropIndicatorProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
		children?: Snippet<[kind: DropTarget["kind"]]>;
	}
</script>

<script lang="ts">
	import type { Snippet } from "svelte";
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import { getSpliteContext, type DropTarget } from "./context.svelte.js";

	const { children, ...rest }: DropIndicatorProps = $props();

	const context = getSpliteContext();

	const target = $derived(context.drag?.target);

	function dropIndicatorProps(target: DropTarget) {
		return mergeProps(rest, {
			class: "splite-drop-indicator",
			"data-target": target.kind,
			style: {
				position: "absolute",
				zIndex: 3,
				pointerEvents: "none",
				boxSizing: "border-box",
				top: 0,
				left: 0,
				width: `${target.indicator.width}px`,
				height: `${target.indicator.height}px`,
				translate: `${target.indicator.x}px ${target.indicator.y}px`,
				willChange: "translate",
			},
		});
	}
</script>

{#if target}
	<div {...dropIndicatorProps(target)}>
		{@render children?.(target.kind)}
	</div>
{/if}
