<script lang="ts" module>
	import type { ResizableHandleProps, ResizableHandleState } from "@ui-sdk/svelte/resizable";

	export interface SeparatorProps
		extends PartProps<"div", ResizableHandleState>,
			ResizableHandleProps {
		/**
		 * Stops a double-click from collapsing or restoring the panel beside it.
		 */
		disableDoubleClick?: boolean;

		/**
		 * A snippet that renders a preview for only this separator when the
		 * group's `resizePreviewMode` is `"separator"`.
		 *
		 * If you want to render the same preview for all separators, set the
		 * `preview` prop on the `Group` instead.
		 */
		preview?: SeparatorPreview;
		ondblclick?: (event: MouseEvent) => void;
	}
</script>

<script lang="ts">
	import { resizable } from "@ui-sdk/core/resizable";
	import { Part, usePart, type PartProps } from "@ui-sdk/svelte/primitive";
	import { getGroup } from "./context";
	import type { SeparatorPreview } from "./types";

	let {
		id: givenId,
		disabled,
		disableDoubleClick = false,
		preview,
		ondblclick,
		...props
	}: SeparatorProps = $props();

	const defaultId = $props.id();
	const id = $derived(givenId ?? defaultId);

	const group = getGroup();
	const handle = usePart(resizable, "handle", () => ({ id, disabled }));

	$effect(() => group.registerPreview(id, () => preview));

	function dblclick(event: MouseEvent) {
		ondblclick?.(event);

		if (disableDoubleClick) {
			event.preventDefault();
		}
	}
</script>

{#if handle.present}
	<Part tag="div" part={handle} props={{ ...props, id, ondblclick: dblclick }} />
{/if}
