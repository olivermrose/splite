import type { ChangeDetails, CommitDetails } from "@ui-sdk/core";

/**
 * The size of a track. A number is a percentage of the grid, like `30`. A
 * string has a unit: `"30%"`, `"240px"`, or `"16rem"`.
 *
 * Pixel and rem sizes convert to percentages once the grid is measured.
 */
export type GridSize = number | `${number}%` | `${number}px` | `${number}rem`;

/**
 * An axis of the grid: its columns or its rows.
 */
export type GridAxis = "columns" | "rows";

/**
 * One column or row of the grid.
 */
export interface GridTrack {
	/**
	 * The id of the track. The controller accepts it in place of the track's
	 * index, and saved layouts use it to match sizes to tracks.
	 *
	 * @default The track's index as a string
	 */
	id?: string;

	/**
	 * The size of the track when the grid first renders. Tracks without a
	 * default size share the remaining space evenly.
	 */
	defaultSize?: GridSize;

	/**
	 * The smallest size of the track while it is expanded.
	 *
	 * @default 0
	 */
	minSize?: GridSize;

	/**
	 * The largest size of the track.
	 *
	 * @default 100
	 */
	maxSize?: GridSize;

	/**
	 * Lets the track collapse to `collapsedSize` when a drag goes past its
	 * `minSize`, or when its gridline is double-clicked or receives Enter.
	 *
	 * @default false
	 */
	collapsible?: boolean;

	/**
	 * The size of the track while it is collapsed.
	 *
	 * @default 0
	 */
	collapsedSize?: GridSize;

	/**
	 * How far past `minSize` a drag must go before the track collapses. A
	 * collapsed track expands again when a drag goes the same distance past
	 * `collapsedSize`.
	 *
	 * @default half the distance between `minSize` and `collapsedSize`
	 */
	collapsedThreshold?: GridSize;

	/**
	 * Prevents gridlines from resizing the track, by pointer or by keyboard.
	 * The controller can still resize it.
	 *
	 * @default false
	 */
	disabled?: boolean;

	/**
	 * - `"preserve-relative-size"` keeps the track at its share of the grid.
	 * - `"preserve-pixel-size"` keeps the track at its width or height in
	 * pixels.
	 *
	 * @default "preserve-relative-size"
	 */
	groupResizeBehavior?: "preserve-relative-size" | "preserve-pixel-size";
}

/**
 * The size of each column and each row as a percentage of the grid, in track
 * order. The sizes on each axis add up to 100.
 */
export type GridLayout = { columns: number[]; rows: number[] };

/**
 * What caused a layout change:
 * - `"drag"`: a pointer drags a gridline or the space between cells.
 * - `"step-key"`: an arrow key, Home, or End moves a gridline.
 * - `"collapse"`: a double-click or Enter collapses or expands a track.
 * - `"resize"`: the grid or its tracks change size.
 * - `"imperative"`: a controller method runs without a `reason`.
 */
export type GridLayoutChangeReason = "drag" | "step-key" | "collapse" | "resize" | "imperative";

/**
 * The details received by `onLayoutChange`.
 */
export type GridLayoutChangeDetails = ChangeDetails<GridLayoutChangeReason>;

/**
 * The details received by `onLayoutCommit`.
 */
export type GridLayoutCommitDetails = CommitDetails<GridLayoutChangeReason>;

export type GridChangeOptions = {
	/**
	 * The reason that `onLayoutChange` and `onLayoutCommit` receive.
	 *
	 * @default "imperative"
	 */
	reason?: GridLayoutChangeReason;

	/**
	 * The event that caused the change, which `onLayoutChange` and
	 * `onLayoutCommit` receive.
	 */
	event?: Event;
};

/**
 * Where a grid saves its layouts: anything with `getItem` and `setItem`, like
 * `localStorage`.
 */
export interface GridStorage {
	getItem: (key: string) => string | null;
	setItem: (key: string, value: string) => void;
}

/**
 * A track's id, or its zero-based index on its axis. The controller methods
 * throw an error when no track matches.
 */
export type TrackRef = string | number;

export interface TrackSize {
	/**
	 * The size of the track as a percentage of the grid.
	 */
	percentage: number;

	/**
	 * The size of the track in pixels. It is `0` until the grid is measured.
	 */
	pixels: number;
}

export type GridController = {
	/**
	 * Returns the size of each column and row as a percentage of the grid.
	 */
	getLayout: () => GridLayout;

	/**
	 * Sets the sizes of one axis or both, as percentages. Each axis is scaled
	 * to add up to 100 and fitted to the minimum and maximum sizes of its
	 * tracks.
	 *
	 * Returns whether the layout changed.
	 */
	setLayout: (layout: Partial<GridLayout>, options?: GridChangeOptions) => boolean;

	/**
	 * Collapses a collapsible track to its `collapsedSize`.
	 *
	 * Returns `false` when the track is not collapsible, is already collapsed,
	 * or `onLayoutChange` cancels the change.
	 */
	collapse: (axis: GridAxis, track: TrackRef, options?: GridChangeOptions) => boolean;

	/**
	 * Expands a collapsed track to the size it had before it collapsed through
	 * the controller, a double-click, or Enter. Otherwise, the track expands to
	 * its `minSize`.
	 *
	 * Returns `false` when the track is not collapsible, is not collapsed, or
	 * `onLayoutChange` cancels the change.
	 */
	expand: (axis: GridAxis, track: TrackRef, options?: GridChangeOptions) => boolean;

	/**
	 * Resizes one track to `size`. The tracks after it give or take the
	 * difference first, then the tracks before it.
	 *
	 * Pixel and rem sizes need the grid to be measured, so before that the
	 * call does nothing and returns `false`. Otherwise, returns whether the
	 * layout changed.
	 */
	resize: (
		axis: GridAxis,
		track: TrackRef,
		size: GridSize,
		options?: GridChangeOptions,
	) => boolean;

	/**
	 * Returns whether a collapsible track is at its `collapsedSize`.
	 */
	isCollapsed: (axis: GridAxis, track: TrackRef) => boolean;

	/**
	 * Returns the size of a track as a percentage of the grid and in pixels.
	 */
	getSize: (axis: GridAxis, track: TrackRef) => TrackSize;
};
