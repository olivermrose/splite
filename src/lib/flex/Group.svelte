<script lang="ts" module>
	export type ResizePreviewMode = "panel" | "separator";

	export interface GroupProps extends ComponentProps<typeof Resizable> {
		/**
		 * - `"panel"` resizes panels as the pointer moves.
		 * - `"separator"` shows where each separator will land and resizes the panels
		 * once the pointer lifts.
		 *
		 * @default "panel"
		 */
		resizePreviewMode?: ResizePreviewMode;

		/**
		 * A snippet that renders a preview for all separators.
		 *
		 * If you want to render a different preview for each separator, set
		 * the `preview` prop on each `Separator` individually.
		 */
		preview?: SeparatorPreview;
	}
</script>

<script lang="ts">
	import {
		createResizableController,
		Resizable,
		type ResizableLayoutChangeDetails,
		type ResizableLayoutCommitDetails,
	} from "@ui-sdk/svelte/resizable";
	import type { ComponentProps } from "svelte";
	import { SvelteMap } from "svelte/reactivity";
	import { setGroup } from "./context";
	import { cloneSeparator, previewBoxes, type PreviewBox } from "./preview";
	import type { SeparatorPreview } from "./types";

	let {
		id: givenId,
		controller: givenController,
		orientation = "horizontal",
		resizePreviewMode = "panel",
		layout = $bindable(),
		preview,
		onLayoutChange,
		children: content,
		style,
		...rest
	}: GroupProps = $props();

	const defaultId = $props.id();
	const defaultController = createResizableController();

	const separatorPreviews = new SvelteMap<string, () => SeparatorPreview | undefined>();

	let pending: number[] | null = null;
	let applying = false;
	let stopListening: (() => void) | undefined;

	let boxes = $state<PreviewBox[]>([]);

	const id = $derived(givenId ?? defaultId);
	const controller = $derived(givenController ?? defaultController);

	setGroup({
		get id() {
			return id;
		},
		get orientation() {
			return orientation;
		},
		get controller() {
			return controller;
		},
		registerPreview(separatorId, read) {
			separatorPreviews.set(separatorId, read);
			return () => separatorPreviews.delete(separatorId);
		},
	});

	$effect(() => () => stopListening?.());

	function rootOf(event: Event | undefined) {
		const doc = (event?.target as Node | null)?.ownerDocument ?? document;
		return doc.getElementById(id);
	}

	function endPreview(apply: boolean, event?: Event) {
		stopListening?.();
		stopListening = undefined;

		const next = pending;
		pending = null;
		boxes = [];

		if (!apply || !next) return;

		applying = true;

		try {
			controller.setLayout(next, { reason: "drag", event });
		} finally {
			applying = false;
		}
	}

	// ui-sdk keeps the drag's pointerup to itself, so the drag's end shows as
	// the group losing data-dragging.
	function startPreview(root: HTMLElement) {
		const win = root.ownerDocument.defaultView ?? window;
		let escaped = false;

		function keyDown(event: KeyboardEvent) {
			if (event.key === "Escape") escaped = true;
		}

		const observer = new MutationObserver(() => {
			if (!root.hasAttribute("data-dragging")) {
				endPreview(!escaped);
			}
		});

		observer.observe(root, {
			attributes: true,
			attributeFilter: ["data-dragging"],
		});

		win.addEventListener("keydown", keyDown, true);

		stopListening = () => {
			observer.disconnect();
			win.removeEventListener("keydown", keyDown, true);
		};
	}

	function handleChange(next: number[], details: ResizableLayoutChangeDetails) {
		onLayoutChange?.(next, details);

		if (
			details.canceled ||
			applying ||
			resizePreviewMode !== "separator" ||
			details.reason !== "drag"
		) {
			return;
		}

		details.cancel();

		const root = rootOf(details.event);
		if (!root) return;

		if (!stopListening) {
			startPreview(root);
		}

		pending = next;
		boxes = previewBoxes(root, next, orientation === "vertical");
	}

	function clone(handle: HTMLElement) {
		return (node: HTMLElement) => {
			const copy = cloneSeparator(handle);
			node.append(copy);

			return () => copy.remove();
		};
	}
</script>

<Resizable
	{...rest}
	{id}
	{controller}
	{orientation}
	onLayoutChange={handleChange}
	style={resizePreviewMode === "separator" ? `position: relative; ${style ?? ""}` : style}
	bind:layout
>
	{#snippet children(state)}
		{@render content?.(state)}

		{#each boxes as box (box.handle)}
			{const customPreview = $derived(separatorPreviews.get(box.handle.id)?.() ?? preview)}

			<div
				aria-hidden="true"
				data-slot="resizable-preview"
				data-active={box.active ? "" : undefined}
				style:position="absolute"
				style:pointer-events="none"
				style:left="{box.left}px"
				style:top="{box.top}px"
				style:width="{box.width}px"
				style:height="{box.height}px"
				style:transform={orientation === "vertical"
					? `translateY(${box.offset}px)`
					: `translateX(${box.offset}px)`}
			>
				{#if customPreview}
					{@render customPreview({
						active: box.active,
						orientation,
						offset: box.offset,
					})}
				{:else}
					<div style:display="contents" {@attach clone(box.handle)}></div>
				{/if}
			</div>
		{/each}
	{/snippet}
</Resizable>
