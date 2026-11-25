<script lang="ts">
	import { getParentGroup, getParentPanel } from "#lib/flex/context.ts";
	import type { ParentGroup } from "#lib/flex/types.ts";

	interface Props {
		onGroup?: (group: ParentGroup) => void;
	}

	let { onGroup }: Props = $props();

	const panel = getParentPanel();
	const group = getParentGroup();

	// svelte-ignore state_referenced_locally
	onGroup?.(group);
</script>

<button type="button" onclick={() => panel.collapse()}>
	Collapse {panel.id} in {panel.groupId}
</button>

<button type="button" onclick={() => panel.resize(50)}>Half</button>
