<script lang="ts">
	import { getParentGrid, type ParentGrid } from "#lib/grid/context.ts";

	interface Props {
		onParent: (grid: ParentGrid) => void;
	}

	const { onParent }: Props = $props();

	const parent = getParentGrid();

	// svelte-ignore state_referenced_locally
	onParent(parent);
</script>
