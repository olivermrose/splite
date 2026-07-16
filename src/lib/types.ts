import type { SpliteController } from "./controller.svelte.js";
import type { Pane } from "./pane.svelte.js";

export type SplitOrientation = "horizontal" | "vertical";

export type Side = "left" | "right" | "top" | "bottom";

export type Direction = "left" | "right" | "up" | "down";

export interface Rect {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface Tab {
	/**
	 * The pane that contains the tab.
	 */
	readonly pane: Pane;

	/**
	 * The index of the tab in its pane's {@link Pane.tabs tabs}.
	 */
	readonly index: number;
}

export interface SpliteEvent {
	/**
	 * Indicates whether the event is cancelable and therefore if
	 * {@link preventDefault} will have any effect.
	 */
	readonly cancelable: boolean;

	/**
	 * Indicates whether {@link preventDefault} canceled the event.
	 */
	readonly defaultPrevented: boolean;

	/**
	 * Signals that the event's default action should not be taken. If the event
	 * is non-cancelable, this has no effect.
	 */
	preventDefault(): void;
}

export interface TabEvent extends SpliteEvent {
	/**
	 * The id of the tab that triggered the event.
	 */
	readonly tabId: string;

	/**
	 * The id of the pane that holds the tab that triggered the event.
	 */
	readonly paneId: string;
}

export interface TabMoveLocation {
	/**
	 * The id of the pane that the tab is moving from or to.
	 */
	readonly paneId: string;

	/**
	 * The index of the tab in the pane's {@link Pane.tabs tabs}.
	 */
	readonly index: number;
}

export interface TabMoveEvent extends SpliteEvent {
	/**
	 * The id of the tab that is moving.
	 */
	readonly tabId: string;

	/**
	 * The location that the tab is moving from.
	 */
	readonly from: TabMoveLocation;

	/**
	 * The location that the tab is moving to.
	 */
	readonly to: TabMoveLocation;
}

export interface PaneEvent extends SpliteEvent {
	/**
	 * The id of the pane that triggered the event.
	 */
	readonly paneId: string;
}

export interface PaneSplitEvent extends PaneEvent {
	/**
	 * The side of the pane that is being split.
	 */
	readonly side: Side;

	/**
	 * The id of the tab that is being moved to the new pane if any.
	 */
	readonly tabId?: string;

	/**
	 * The id of the created split.
	 */
	readonly splitId: string;

	/**
	 * The orientation of the created split.
	 */
	readonly orientation: SplitOrientation;

	/**
	 * The id of the created pane.
	 */
	readonly newPaneId: string;
}

export interface PaneCloseEvent extends PaneEvent {
	/**
	 * The reason the pane was closed.
	 *
	 * - `"close"` if the pane was closed by the user
	 * - `"collapse"` if the pane was closed because it was empty and the
	 * controller is configured to collapse empty panes.
	 */
	readonly reason: "close" | "collapse";
}

export interface LayoutChangeEvent extends SpliteEvent {
	/**
	 * The splite instance.
	 */
	readonly splite: SpliteController;
}

export interface SpliteEvents {
	tabCreate: TabEvent;
	tabClose: TabEvent;
	tabSelect: TabEvent;
	tabMove: TabMoveEvent;
	paneSplit: PaneSplitEvent;
	paneClose: PaneCloseEvent;
	paneFocus: PaneEvent;
	layoutChange: LayoutChangeEvent;
}

export type SpliteEventPayload<K extends keyof SpliteEvents> = Omit<
	SpliteEvents[K],
	keyof SpliteEvent
>;

export type SpliteEventHandler<K extends keyof SpliteEvents> = (event: SpliteEvents[K]) => unknown;
