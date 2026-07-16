<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";

	const { children, ...rest }: HTMLAttributes<HTMLDivElement> = $props();

	const tabBarProps = $derived(
		mergeProps(rest, {
			class: "splite-tab-bar",
			role: "tablist",
			style: {
				height: "var(--splite-tab-bar-height)",
				userSelect: "none",
			},
		}),
	);
</script>

<div {...tabBarProps}>
	{@render children?.()}
</div>
