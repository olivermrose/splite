<script lang="ts" module>
	export interface PaneProps extends HTMLAttributes<HTMLDivElement> {
		pane: Pane;

		/**
		 * Fires when the pane gains focus.
		 */
		onFocus?: SpliteEventHandler<"paneFocus">;

		/**
		 * Fires when the pane is split.
		 */
		onSplit?: SpliteEventHandler<"paneSplit">;

		/**
		 * Fires when the pane closes.
		 */
		onClose?: SpliteEventHandler<"paneClose">;
	}
</script>

<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Pane } from "../pane.svelte.js";
	import type { SpliteEventHandler } from "../types.js";
	import { getSpliteContext } from "./context.svelte.js";

	const { pane, onFocus, onSplit, onClose, children, ...rest }: PaneProps = $props();

	const context = getSpliteContext();

	$effect(() => {
		const offs = [
			context.splite.on("paneFocus", (event) => {
				if (event.paneId === pane.id) onFocus?.(event);
			}),
			context.splite.on("paneSplit", (event) => {
				if (event.paneId === pane.id) onSplit?.(event);
			}),
			context.splite.on("paneClose", (event) => {
				if (event.paneId === pane.id) onClose?.(event);
			}),
		];

		return () => offs.forEach((off) => off());
	});

	const paneProps = $derived(
		mergeProps(rest, {
			class: "splite-pane",
			role: "group",
			"aria-current": context.splite.focusedPane === pane,
			"data-pane-id": pane.id,
			style: {
				position: "relative",
				zIndex: 1,
				"box-sizing": "border-box",
				display: "flex",
				flexDirection: "column",
				flex: "1 1 auto",
				minWidth: 0,
				minHeight: 0,
			},
			onpointerdown: () => context.splite.focusPane(pane.id),
		}),
	);
</script>

<div {...paneProps}>
	{@render children?.()}
</div>

<style>
	:global(:where(.splite-pane)) {
		transition-property: opacity, scale;
		transition-duration: var(--splite-transition-duration, 0);
		transition-timing-function: var(--splite-transition-easing, ease);
	}
</style>
