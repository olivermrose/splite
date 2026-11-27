import type { ChangeDetails, CommitDetails, PrimitiveOptions } from "@ui-sdk/core";

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

/**
 * Whether each axis reserves a gutter track between its tracks for gridlines.
 */
export interface GutterOptions {
	columns?: boolean;
	rows?: boolean;
}

export interface GridOptions extends PrimitiveOptions {
	/**
	 * The columns of the grid. This can be either:
	 * - a number, which creates that many columns that share the grid evenly,
	 * or
	 * - an array of tracks, which creates a column for each track with its
	 * id, sizes, and behavior.
	 */
	columns: number | GridTrack[];

	/**
	 * The rows of the grid. This can be either:
	 * - a number, which creates that many rows that share the grid evenly, or
	 * - an array of tracks, which creates a row for each track with its id,
	 * sizes, and behavior.
	 */
	rows: number | GridTrack[];

	/**
	 * The size of each column and row as a percentage of the grid. Set it to
	 * control the layout.
	 */
	layout?: GridLayout;

	/**
	 * The starting layout when `layout` is not set. Each axis applies only
	 * when it has a size for every track on that axis. Otherwise, the tracks
	 * on that axis start at their `defaultSize`.
	 *
	 * A layout saved under `autoSaveId` takes priority over this one.
	 */
	defaultLayout?: Partial<GridLayout>;

	/**
	 * Fires each time the layout is about to change: on each pointer move of a
	 * drag, on each key press, on each controller call, and when the grid or
	 * its tracks change size.
	 *
	 * Call `details.cancel()` to keep the current layout.
	 */
	onLayoutChange?: (layout: GridLayout, details: GridLayoutChangeDetails) => void;

	/**
	 * Fires once when an interaction that changed the layout ends: when the
	 * pointer lifts after a drag, when a key is released, after a collapse or
	 * an expand, and after each controller call that changes the layout. It
	 * does not fire when the grid changes size.
	 *
	 * Use it to save the layout.
	 */
	onLayoutCommit?: (layout: GridLayout, details: GridLayoutCommitDetails) => void;

	/**
	 * Prevents all gridlines and boundaries from being dragged or moved with
	 * the keyboard, and removes the gridlines from the tab order.
	 *
	 * @default false
	 */
	disabled?: boolean;

	/**
	 * How far an arrow key moves a gridline, as a percentage of the grid.
	 *
	 * @default 1
	 */
	step?: number;

	/**
	 * How far Shift with an arrow key moves a gridline, as a percentage of
	 * the grid.
	 *
	 * @default 10
	 */
	largeStep?: number;

	/**
	 * Saves the layout under this id when an interaction ends, and restores it
	 * when the grid next mounts. The grid saves one layout for each set of
	 * track ids, so a layout never restores onto different tracks.
	 *
	 * Has no effect when `layout` is set.
	 */
	autoSaveId?: string;

	/**
	 * Where `autoSaveId` saves layouts.
	 *
	 * @default localStorage
	 */
	storage?: GridStorage;

	/**
	 * Reserves a gutter track between each pair of tracks on an axis, for its
	 * gridlines.
	 *
	 * A gridline registers with the grid only when it mounts, so a grid
	 * rendered on the server has no gutters until hydration, and its layout
	 * shifts. Set an axis to `true` when it has gridlines to reserve the
	 * gutters from the first render. An axis that is not set gets gutters
	 * when a gridline of its type mounts.
	 */
	gutters?: GutterOptions;

	/**
	 * A controller to resize and inspect the grid from outside it. Create one
	 * with `createGridController`.
	 */
	controller?: GridController;
}

export interface CellProps {
	/**
	 * The id of the cell. Each gridline lists the cells it resizes by this id
	 * in its `aria-controls`.
	 */
	id?: string;

	/**
	 * The zero-based index of the column that the cell starts in.
	 */
	column: number;

	/**
	 * The zero-based index of the row that the cell starts in.
	 */
	row: number;

	/**
	 * How many columns the cell covers.
	 *
	 * @default 1
	 */
	columnSpan?: number;

	/**
	 * How many rows the cell covers.
	 *
	 * @default 1
	 */
	rowSpan?: number;
}

export interface GridlineProps {
	/**
	 * The id of the gridline.
	 */
	id?: string;

	/**
	 * - `"column"` places a vertical gridline between two columns.
	 * - `"row"` places a horizontal gridline between two rows.
	 */
	type: GridlineType;

	/**
	 * - For a column gridline, the index of the column after the gridline,
	 * from 1 to the number of columns minus 1. A column gridline needs it.
	 * - For a row gridline, the zero-based index of the first column that the
	 * gridline crosses.
	 *
	 * @default 0
	 */
	column?: number;

	/**
	 * - For a row gridline, the index of the row after the gridline, from 1
	 * to the number of rows minus 1. A row gridline needs it.
	 * - For a column gridline, the zero-based index of the first row that the
	 * gridline crosses.
	 *
	 * @default 0
	 */
	row?: number;

	/**
	 * For a row gridline, how many columns the gridline crosses. A column
	 * gridline ignores it.
	 *
	 * @default all columns from `column` to the last
	 */
	columnSpan?: number;

	/**
	 * For a column gridline, how many rows the gridline crosses. A row
	 * gridline ignores it.
	 *
	 * @default all rows from `row` to the last
	 */
	rowSpan?: number;

	/**
	 * Prevents the gridline from being dragged or moved with the keyboard,
	 * and removes it from the tab order.
	 *
	 * @default false
	 */
	disabled?: boolean;

	/**
	 * Stops a double-click from collapsing or expanding a track beside the
	 * gridline. A double-click toggles the track before the gridline when it
	 * is collapsible, and otherwise the track after it.
	 *
	 * @default false
	 */
	disableDoubleClick?: boolean;
}

/**
 * - `"column"` places a vertical gridline between two columns.
 * - `"row"` places a horizontal gridline between two rows.
 */
export type GridlineType = "column" | "row";
