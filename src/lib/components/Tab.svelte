<script lang="ts" module>
	export interface TabProps extends HTMLAttributes<HTMLDivElement> {
		tabId: string;
		pane: Pane;

		/**
		 * Fires when the tab is selected.
		 */
		onSelect?: SpliteEventHandler<"tabSelect">;

		/**
		 * Fires when the tab is moved (reorder or cross-pane).
		 */
		onMove?: SpliteEventHandler<"tabMove">;

		/**
		 * Fires when the tab closes.
		 */
		onClose?: SpliteEventHandler<"tabClose">;
	}
</script>

<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Pane } from "../pane.svelte.js";
	import type { SpliteEventHandler } from "../types.js";
	import { getSpliteContext } from "./context.svelte.js";

	const { tabId, pane, onSelect, onMove, onClose, children, ...rest }: TabProps = $props();

	const context = getSpliteContext();

	const tabProps = $derived(
		mergeProps(rest, {
			class: "splite-tab",
			role: "tab",
			tabindex: -1,
			"aria-selected": pane.selected === tabId,
			"data-tab-id": tabId,
			"data-state": getTabState(),
			style: {
				touchAction: "none",
			},
			onpointerdown: (event: PointerEvent) => context.onTabPointerDown(event, tabId, pane),
			onauxclick: (event: MouseEvent) => context.onTabAuxClick(event, tabId),
		}),
	);

	$effect(() => {
		const offs = [
			context.splite.on("tabSelect", (event) => {
				if (event.tabId === tabId) onSelect?.(event);
			}),
			context.splite.on("tabMove", (event) => {
				if (event.tabId === tabId) onMove?.(event);
			}),
			context.splite.on("tabClose", (event) => {
				if (event.tabId === tabId) onClose?.(event);
			}),
		];

		return () => offs.forEach((off) => off());
	});

	function getTabState() {
		if (pane.selected === tabId) {
			return "active";
		}

		if (context.drag?.tabId === tabId) {
			return "dragging";
		}

		return "inactive";
	}
</script>

<div {...tabProps}>
	{@render children?.()}
</div>
