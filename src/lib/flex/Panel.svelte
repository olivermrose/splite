<script lang="ts" module>
	import type { ResizablePanelProps, ResizablePanelState } from "@ui-sdk/svelte/resizable";

	export type GroupResizeBehavior = "preserve-relative-size" | "preserve-pixel-size";

	// Using an intersection so conflicting key types can get overridden since
	// `extends` doesn't merge fields, and it's cleaner than using `Omit`.
	type BaseProps = PartProps<"div", ResizablePanelState> & ResizablePanelProps;

	export interface PanelProps extends BaseProps {
		/**
		 * Prevents the panel from being resized, collapsed, or expanded.
		 *
		 * @default false
		 */
		disabled?: boolean;

		/**
		 * - `"preserve-relative-size"` keeps the panel at its share of the
		 * group.
		 * - `"preserve-pixel-size"` keeps the panel at its width or height in
		 * pixels.
		 *
		 * @default "preserve-relative-size"
		 */
		groupResizeBehavior?: GroupResizeBehavior;

		/**
		 * Fires when the panel's size changes, including when it mounts.
		 */
		onResize?: (
			/**
			 * The id of the panel that was resized.
			 */
			id: string,

			/**
			 * The new size of the panel.
			 */
			size: PanelSize,

			/**
			 * The previous size of the panel, or `undefined` if this is the
			 * first time the panel has been measured.
			 */
			previous: PanelSize | undefined,
		) => void;
	}
</script>

<script lang="ts">
	import { resizable } from "@ui-sdk/core/resizable";
	import { Part, usePart, type PartProps } from "@ui-sdk/svelte/primitive";
	import { untrack } from "svelte";
	import { createAttachmentKey } from "svelte/attachments";
	import { getGroup, setPanel } from "./context";
	import type { PanelSize } from "./types";

	let {
		id: givenId,
		defaultSize,
		minSize,
		maxSize,
		collapsible,
		collapsedSize,
		disabled = false,
		groupResizeBehavior = "preserve-relative-size",
		onResize,
		...props
	}: PanelProps = $props();

	const defaultId = $props.id();

	const attach = createAttachmentKey();
	const group = getGroup();

	const measured = () => group.controller.getLayout().length > 0;

	let element: HTMLElement | undefined;
	let previous: PanelSize | undefined;

	let locked = $state<number>();

	const id = $derived(givenId ?? defaultId);
	const preservePixels = $derived(groupResizeBehavior === "preserve-pixel-size");

	const panel = usePart(resizable, "panel", () =>
		locked === undefined
			? { id, defaultSize, minSize, maxSize, collapsible, collapsedSize }
			: { id, defaultSize, minSize: locked, maxSize: locked, collapsible: false },
	);

	setPanel({
		get id() {
			return id;
		},
		get groupId() {
			return group.id;
		},
		expand: () => group.controller.expand(id),
		collapse: () => group.controller.collapse(id),
		isCollapsed: () => group.controller.isCollapsed(id),
		resize: (size) => group.controller.resize(id, size),
		getSize: measure,
	});

	$effect.pre(() => {
		if (!disabled) {
			locked = undefined;
			return;
		}

		const size = panel.state.size;

		if (locked === undefined && untrack(measured)) {
			locked = size;
		}
	});

	$effect(() => {
		if (!onResize || !element) return;

		const next = measure();
		if (!untrack(measured)) return;

		if (
			previous &&
			previous.percentage === next.percentage &&
			previous.pixels === next.pixels
		) {
			return;
		}

		const before = previous;
		previous = next;

		untrack(() => onResize(id, next, before));
	});

	$effect(() => {
		if (!preservePixels || !element?.parentElement) return;

		const root = element.parentElement;

		// The panels' total size is right even before ui-sdk applies the layout,
		// and a panel keeps its share as the group grows, so the pixels to keep
		// are that share of the space before the change.
		function space() {
			let total = 0;

			for (const child of root.children) {
				if (child.getAttribute("data-slot") !== "resizable-panel") {
					continue;
				}

				const rect = child.getBoundingClientRect();
				total += group.orientation === "vertical" ? rect.height : rect.width;
			}

			return total;
		}

		let before = untrack(space);

		const observer = new ResizeObserver(() => {
			const total = space();

			if (total <= 0 || Math.abs(total - before) <= 0.5) {
				return;
			}

			const pixels = (untrack(() => panel.state.size) / 100) * before;
			before = total;

			if (untrack(measured)) {
				group.controller.resize(id, (pixels / total) * 100, { reason: "resize" });
			}
		});

		observer.observe(root);

		return () => observer.disconnect();
	});

	function measure(): PanelSize {
		const percentage = panel.state.size;

		if (!element) {
			return { percentage, pixels: 0 };
		}

		const rect = element.getBoundingClientRect();

		return {
			percentage,
			pixels: group.orientation === "vertical" ? rect.height : rect.width,
		};
	}

	function track(node: HTMLElement) {
		element = node;

		return () => {
			element = undefined;
		};
	}
</script>

{#if panel.present}
	<Part tag="div" part={panel} props={{ ...props, [attach]: track }} />
{/if}
