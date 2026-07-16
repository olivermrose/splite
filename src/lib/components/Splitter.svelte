<script lang="ts" module>
	export interface SplitterProps extends HTMLAttributes<HTMLDivElement> {
		/**
		 * The split the splitter belongs to.
		 */
		split: Split;

		/**
		 * The index of the splitter.
		 */
		index: number;

		/**
		 * The height/width of the splitter in px.
		 */
		size?: number;
	}
</script>

<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Split } from "../split.svelte.js";
	import { getSpliteContext } from "./context.svelte.js";

	const { split, index, size = 4, children, ...rest }: SplitterProps = $props();

	const context = getSpliteContext();

	const horizontal = $derived(split.orientation === "horizontal");

	const splitterProps = $derived(
		mergeProps(rest, {
			class: "splite-splitter",
			role: "separator",
			"aria-orientation": horizontal ? "vertical" : "horizontal",
			"data-split-id": split.id,
			"data-splitter-index": index,
			"data-resizing":
				context.resizing?.splitId === split.id && context.resizing.index === index,
			style: {
				"--splite-splitter-size": `${size}px`,
				position: "absolute",
				touchAction: "none",
				cursor: horizontal ? "col-resize" : "row-resize",
				...(horizontal
					? { top: "0", height: "100%", left: "50%", translate: "-50% 0" }
					: { left: "0", width: "100%", top: "50%", translate: "0 -50%" }),
			},
			onpointerdown: (event: PointerEvent) =>
				context.onResizerPointerDown(event, split.id, index),
		}),
	);
</script>

<div {...splitterProps}>
	{@render children?.()}
</div>

<style>
	:global(:where(.splite-splitter[aria-orientation="vertical"])) {
		width: var(--splite-splitter-size);
	}

	:global(:where(.splite-splitter[aria-orientation="horizontal"])) {
		height: var(--splite-splitter-size);
	}
</style>
