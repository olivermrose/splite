<script lang="ts" module>
	export interface ContentProps extends HTMLAttributes<HTMLDivElement> {
		tabId: string;
		pane: Pane;

		/**
		 * Keep the content mounted (hidden) while another tab is selected, so
		 * state survives tab switches.
		 *
		 * @default true
		 */
		forceMount?: boolean;
	}
</script>

<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Pane } from "../pane.svelte.js";
	import { getSpliteContext } from "./context.svelte.js";

	const { tabId, pane, forceMount = true, children, ...rest }: ContentProps = $props();

	const context = getSpliteContext();

	const selected = $derived(pane.selected === tabId);

	const contentProps = $derived(
		mergeProps(rest, {
			class: "splite-content",
			hidden: !selected,
			tabindex: -1,
			role: "tabpanel",
			style: {
				flex: "1 1 0",
				minWidth: "0",
				minHeight: "0",
			},
			onpointerdown: () => context.splite.focusPane(pane.id),
		}),
	);
</script>

{#if forceMount || selected}
	<div {...contentProps}>
		{@render children?.()}
	</div>
{/if}
