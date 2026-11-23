import type { ResizableController, ResizableSize } from "@ui-sdk/svelte/resizable";
import type { Snippet } from "svelte";
// oxlint-disable-next-line no-unused-vars - used for jsdoc
import type { Group, Panel, getParentGroup, getParentPanel } from "./index.ts";

export type Orientation = "horizontal" | "vertical";

export interface PanelSize {
	/**
	 * The size of the panel as a percentage of its group.
	 */
	percentage: number;

	/**
	 * The size of the panel in pixels.
	 */
	pixels: number;
}

/**
 * The state received by a separator's preview snippet while `resizePreviewMode`
 * is `"separator"`.
 */
export interface SeparatorPreviewState {
	/**
	 * Whether this is the separator being dragged, rather than one it pushes.
	 */
	active: boolean;

	/**
	 * The orientation of the separator.
	 */
	orientation: Orientation;

	/**
	 * How far the separator will move when the pointer lifts, in pixels.
	 */
	offset: number;
}

export type SeparatorPreview = Snippet<[SeparatorPreviewState]>;

/**
 * The nearest {@linkcode Group} returned by {@linkcode getParentGroup()}.
 */
export interface ParentGroup extends ResizableController {
	/**
	 * The id of the group.
	 */
	readonly id: string;

	/**
	 * The orientation of the group.
	 */
	readonly orientation: Orientation;
}

/**
 * The nearest {@linkcode Panel} returned by {@linkcode getParentPanel()}.
 */
export interface ParentPanel {
	/**
	 * The id of the panel.
	 */
	readonly id: string;

	/**
	 * The id of the group that contains the panel.
	 */
	readonly groupId: string;
	collapse: () => boolean;
	expand: () => boolean;
	isCollapsed: () => boolean;
	resize: (size: ResizableSize) => boolean;
	getSize: () => PanelSize;
}
