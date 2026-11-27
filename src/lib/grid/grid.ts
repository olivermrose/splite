import {
	bindDrag,
	createChange,
	createCommit,
	createController,
	css,
	definePrimitive,
	isRTL,
	type PrimitiveOptions,
} from "@ui-sdk/core";
import {
	adjustLayout,
	boundaryValues,
	fitLayout,
	initialLayout,
	isCollapsed,
	preserveFixed,
	resizeTrack,
	sameLayout,
	type TrackConstraints,
} from "./axis";
import {
	axisOf,
	cellPlacement,
	crossOf,
	crossPlacement,
	gutterPlacement,
	hitRegions,
	placementErrors,
	rangeOf,
	regionAt,
	type CellPlacement,
	type GridlinePlacement,
	type GridlineType,
	type HitRegion,
} from "./placement";
import { constraintsOf, initialTemplate, normalizeTracks, toPercent, type Track } from "./tracks";
import type {
	GridAxis,
	GridChangeOptions,
	GridController,
	GridLayout,
	GridLayoutChangeDetails,
	GridLayoutChangeReason,
	GridLayoutCommitDetails,
	GridSize,
	GridStorage,
	GridTrack,
	TrackRef,
} from "./types";

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
	 * with {@linkcode createGridController}.
	 */
	controller?: GridController;
}

interface Boundaries {
	columns: number | null;
	rows: number | null;
}

interface GridState {
	columns: Track[];
	rows: Track[];
	layout: GridLayout;
	requested: GridLayout;
	requestedSpace: { columns: number; rows: number };
	space: { columns: number; rows: number };
	measured: boolean;

	/**
	 * Whether the layout was given, so the server renders it rather than each
	 * track's default size.
	 */
	explicit: boolean;
	disabled: boolean;
	cells: Record<string, CellPlacement>;
	gridlines: Record<string, GridlinePlacement>;
	gutters: Required<GutterOptions>;
	dragging: Boundaries | null;
	hovering: Boundaries | null;
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

const AXES = ["columns", "rows"] as const;
const STORAGE_PREFIX = "splite-grid:";

// The smallest hit region across a boundary, in CSS pixels, for each pointer
// type. 24 is the minimum target size of WCAG 2.2 (success criterion 2.5.8).
const MIN_TARGET = { fine: 10, coarse: 24 };

/**
 * Returns the storage key that a grid with the given `autoSaveId` saves its
 * layouts under. Use it to read or clear the saved layouts.
 */
export function gridStorageKey(autoSaveId: string) {
	return STORAGE_PREFIX + autoSaveId;
}

function storageOf(options: GridOptions): GridStorage | undefined {
	if (options.storage) return options.storage;

	// Reading `localStorage` throws when the browser blocks storage, such as
	// in a sandboxed iframe.
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

// Saved layouts are keyed by track ids so that a layout saved for one set of
// tracks does not restore onto a different set under the same `autoSaveId`.
function layoutKey(state: Pick<GridState, "columns" | "rows">) {
	return `${state.columns.map((track) => track.id).join(",")}|${state.rows.map((track) => track.id).join(",")}`;
}

function sameGridLayout(a: GridLayout, b: GridLayout) {
	return sameLayout(a.columns, b.columns) && sameLayout(a.rows, b.rows);
}

function gridlinePlacement(props: GridlineProps): GridlinePlacement {
	const column = props.type === "column";

	return {
		type: props.type,
		index: (column ? props.column : props.row) ?? 0,
		crossStart: (column ? props.row : props.column) ?? 0,
		crossSpan: column ? props.rowSpan : props.columnSpan,
		disabled: props.disabled ?? false,
	};
}

function cellOf(props: CellProps): CellPlacement {
	return {
		column: props.column,
		row: props.row,
		columnSpan: props.columnSpan ?? 1,
		rowSpan: props.rowSpan ?? 1,
	};
}

function remSize(el?: Element) {
	const root = el?.ownerDocument.documentElement;
	if (!root) return 16;

	return parseFloat(getComputedStyle(root).fontSize) || 16;
}

function constraints(state: GridState, axis: GridAxis, rem?: number): TrackConstraints[] {
	return state[axis].map((track) => constraintsOf(track, state.space[axis], rem));
}

function startLayout(options: GridOptions, columns: Track[], rows: Track[]): GridLayout {
	if (options.layout) return options.layout;

	function pick(axis: GridAxis, tracks: Track[]) {
		const given = options.defaultLayout?.[axis];
		const fitted = tracks.map((track) => constraintsOf(track, 0));

		return given?.length === tracks.length
			? fitLayout(given, fitted)
			: fitLayout(initialLayout(fitted), fitted);
	}

	return {
		columns: pick("columns", columns),
		rows: pick("rows", rows),
	};
}

/**
 * The headless primitive that `Grid`, `Cell`, and `Gridline` are built on.
 * Use it with ui-sdk's `usePrimitive` and `usePart` to build your own grid
 * components.
 */
export const grid = definePrimitive({
	name: "grid",
	options: {
		columns: "value",
		rows: "value",
		layout: "value",
		defaultLayout: "value",
		onLayoutChange: "callback",
		onLayoutCommit: "callback",
		disabled: "boolean",
		step: "number",
		largeStep: "number",
		autoSaveId: "string",
		storage: "value",
		gutters: "value",
		controller: "value",
	},
	controlled: ["layout"],
	commits: ["layout"],
	state(options: GridOptions): GridState {
		const columns = normalizeTracks(options.columns);
		const rows = normalizeTracks(options.rows);
		const layout = startLayout(options, columns, rows);

		return {
			columns,
			rows,
			layout,
			requested: layout,
			requestedSpace: {
				columns: 0,
				rows: 0,
			},
			space: {
				columns: 0,
				rows: 0,
			},
			measured: false,
			explicit: options.layout !== undefined || options.defaultLayout !== undefined,
			disabled: options.disabled ?? false,
			cells: {},
			gridlines: {},
			gutters: {
				columns: options.gutters?.columns ?? false,
				rows: options.gutters?.rows ?? false,
			},
			dragging: null,
			hovering: null,
		};
	},
	sync(options) {
		return options.layout === undefined ? {} : { layout: options.layout };
	},
	api(context) {
		const { store } = context;

		const change = createChange(context);
		const commit = createCommit(context);

		let root: HTMLElement | undefined;
		let keyCommit: GridLayoutChangeReason | undefined;

		let stopDrag: (() => void) | undefined;

		const logged = new Set<string>();
		const expanded: Record<GridAxis, Record<string, number>> = {
			columns: {},
			rows: {},
		};

		const rem = () => remSize(root);
		const tracksOf = (axis: GridAxis) => constraints(store.get(), axis, rem());

		function refreshGutters() {
			const { gridlines } = store.get();

			const given = context.options().gutters;
			const lines = Object.values(gridlines);

			const gutters = {
				columns: given?.columns ?? lines.some((line) => line.type === "column"),
				rows: given?.rows ?? lines.some((line) => line.type === "row"),
			};

			const current = store.get().gutters;

			if (gutters.columns !== current.columns || gutters.rows !== current.rows) {
				store.set({ gutters });
			}
		}

		function reportPlacement() {
			if (!import.meta.env?.DEV) return;

			const state = store.get();
			const errors = placementErrors(
				state.columns.length,
				state.rows.length,
				Object.values(state.cells),
				Object.values(state.gridlines),
			);

			// Each error logs once while it stays true, so that each new cell or
			// gridline does not repeat it. An error that is fixed and then comes
			// back logs again.
			for (const message of logged) {
				if (!errors.includes(message)) {
					logged.delete(message);
				}
			}

			for (const message of errors) {
				if (logged.has(message)) continue;

				logged.add(message);
				console.error(message);
			}
		}

		context.onOptions((options) => {
			const state = store.get();

			const columns = normalizeTracks(options.columns);
			const rows = normalizeTracks(options.rows);

			const next: Partial<GridState> = { disabled: options.disabled ?? false };

			const changedTracks =
				JSON.stringify(columns) !== JSON.stringify(state.columns) ||
				JSON.stringify(rows) !== JSON.stringify(state.rows);

			if (changedTracks) {
				next.columns = columns;
				next.rows = rows;
			}

			store.set(next);

			if (changedTracks) {
				function fitted(axis: GridAxis, tracks: Track[]) {
					const previous = state[axis];
					const ids = tracks.map((track) => track.id);

					const same =
						previous.length === tracks.length &&
						previous.every((t, i) => t.id === ids[i]);

					const source = same
						? state.requested[axis]
						: startLayout(options, columns, rows)[axis];

					return fitLayout(source, tracksOf(axis));
				}

				const layout = {
					columns: fitted("columns", columns),
					rows: fitted("rows", rows),
				};

				if (!sameGridLayout(layout, state.layout)) {
					apply(layout, { reason: "resize" });
				}

				reportPlacement();
			}

			refreshGutters();
		});

		// A change that the grid's size forces passes `remember` as false. It
		// leaves `requested` as it was, so the layout that the user chose comes
		// back when the grid has room for it again.
		function apply(
			layout: GridLayout,
			details: GridChangeOptions & { event?: Event },
			remember = true,
		) {
			const state = store.get();

			if (sameGridLayout(layout, state.layout)) {
				return false;
			}

			const accepted = change("layout", layout, {
				reason: details.reason ?? "imperative",
				event: details.event,
			});

			if (accepted && remember) {
				store.set({
					requested: layout,
					requestedSpace: { ...state.space },
					explicit: true,
				});
			}

			return accepted;
		}

		function save() {
			const { autoSaveId } = context.options();
			if (!autoSaveId) return;

			const storage = storageOf(context.options());
			if (!storage) return;

			const key = gridStorageKey(autoSaveId);

			try {
				const saved = JSON.parse(storage.getItem(key) ?? "{}") as Record<
					string,
					GridLayout
				>;

				saved[layoutKey(store.get())] = store.get().requested;
				storage.setItem(key, JSON.stringify(saved));
			} catch (error) {
				console.error(error);
			}
		}

		function load(): GridLayout | undefined {
			const options = context.options();

			if (!options.autoSaveId || options.layout) {
				return undefined;
			}

			try {
				const raw = storageOf(options)?.getItem(gridStorageKey(options.autoSaveId));

				const layout = raw
					? (JSON.parse(raw) as Record<string, GridLayout>)[layoutKey(store.get())]
					: undefined;

				const state = store.get();

				if (
					layout?.columns?.length === state.columns.length &&
					layout.rows?.length === state.rows.length
				) {
					return layout;
				}
			} catch {
				return undefined;
			}

			return undefined;
		}

		function finish(reason: GridLayoutChangeReason, event?: Event) {
			commit("layout", store.get().layout, { reason, event });
			save();
		}

		function measure(el: HTMLElement) {
			const style = getComputedStyle(el);
			const { gutters } = store.get();

			const space = { columns: 0, rows: 0 };

			// The computed template gives each track in pixels, with a gutter
			// between each pair of tracks when the axis has gutters. The sum of
			// the tracks alone leaves the gutters out of the space that the
			// percentages refer to. The client size is the fallback for when the
			// template does not resolve to pixels.
			for (const axis of AXES) {
				const count = store.get()[axis].length;
				const template =
					axis === "columns" ? style.gridTemplateColumns : style.gridTemplateRows;
				const tokens = template.split(" ").filter(Boolean);
				const expected = gutters[axis] ? count * 2 - 1 : count;

				if (
					tokens.length === expected &&
					tokens.every((token) => /^-?[\d.]+px$/.test(token))
				) {
					space[axis] = tokens
						.filter((_, index) => !gutters[axis] || index % 2 === 0)
						.reduce((sum, token) => sum + parseFloat(token), 0);
				} else {
					space[axis] = axis === "columns" ? el.clientWidth : el.clientHeight;
				}
			}

			return space;
		}

		function resized(el: HTMLElement) {
			const space = measure(el);
			const state = store.get();

			if (space.columns <= 0 || space.rows <= 0) return;

			if (
				state.measured &&
				space.columns === state.space.columns &&
				space.rows === state.space.rows
			) {
				return;
			}

			store.set({ space });

			if (!state.measured) {
				const options = context.options();
				const saved = load();

				let start = saved ?? state.layout;

				if (!saved && !options.layout && !options.defaultLayout) {
					start = {
						columns: initialLayout(tracksOf("columns")),
						rows: initialLayout(tracksOf("rows")),
					};
				}

				const layout = {
					columns: fitLayout(start.columns, tracksOf("columns")),
					rows: fitLayout(start.rows, tracksOf("rows")),
				};

				store.set({
					measured: true,
					requested: layout,
					requestedSpace: space,
				});

				apply(layout, { reason: "resize" }, false);

				return;
			}

			const layout = {
				columns: fitLayout(
					preserveFixed(
						state.requested.columns,
						tracksOf("columns"),
						state.requestedSpace.columns,
						space.columns,
					),
					tracksOf("columns"),
				),
				rows: fitLayout(
					preserveFixed(
						state.requested.rows,
						tracksOf("rows"),
						state.requestedSpace.rows,
						space.rows,
					),
					tracksOf("rows"),
				),
			};

			const fixed = AXES.some((axis) => tracksOf(axis).some((track) => track.fixed));
			apply(layout, { reason: "resize" }, false);

			if (fixed) {
				store.set({
					requested: store.get().layout,
					requestedSpace: space,
				});
			}
		}

		function indexOf(axis: GridAxis, ref: TrackRef) {
			const tracks = store.get()[axis];

			if (typeof ref === "number") {
				if (!Number.isInteger(ref) || ref < 0 || ref >= tracks.length) {
					throw new Error(
						`Grid has no ${axis.slice(0, -1)} at index ${ref}; it has ${tracks.length}`,
					);
				}

				return ref;
			}

			const index = tracks.findIndex((track) => track.id === ref);

			if (index < 0) {
				throw new Error(
					`Grid has no ${axis.slice(0, -1)} with id "${ref}"; its ids are ${tracks.map((track) => `"${track.id}"`).join(", ")}`,
				);
			}

			return index;
		}

		function setAxis(axis: GridAxis, values: readonly number[], details: GridChangeOptions) {
			const layout = {
				...store.get().layout,
				[axis]: fitLayout(values, tracksOf(axis)),
			};

			return apply(layout, details);
		}

		function collapseTrack(axis: GridAxis, index: number, details: GridChangeOptions) {
			const tracks = tracksOf(axis);

			const track = tracks[index];
			const sizes = store.get().layout[axis];

			if (!track.collapsible || isCollapsed(track, sizes[index])) {
				return false;
			}

			expanded[axis][store.get()[axis][index].id] = sizes[index];

			return setAxis(axis, resizeTrack(sizes, tracks, index, track.collapsed), details);
		}

		function expandTrack(axis: GridAxis, index: number, details: GridChangeOptions) {
			const tracks = tracksOf(axis);

			const track = tracks[index];
			const sizes = store.get().layout[axis];

			if (!track.collapsible || !isCollapsed(track, sizes[index])) {
				return false;
			}

			const target = expanded[axis][store.get()[axis][index].id] ?? track.min;

			// A track with no remembered size and a `min` of 0 would stay at 0,
			// so it expands to 1% instead.
			return setAxis(axis, resizeTrack(sizes, tracks, index, target || 1), details);
		}

		function toggleBoundary(axis: GridAxis, boundary: number, event?: Event) {
			const tracks = tracksOf(axis);
			const index = tracks[boundary - 1]?.collapsible
				? boundary - 1
				: tracks[boundary]?.collapsible
					? boundary
					: -1;

			if (index < 0) return false;

			const details = {
				reason: "collapse" as const,
				event,
			};

			const sizes = store.get().layout[axis];

			const done = isCollapsed(tracks[index], sizes[index])
				? expandTrack(axis, index, details)
				: collapseTrack(axis, index, details);

			if (done) {
				finish("collapse", event);
			}

			return done;
		}

		function hitsAt(x: number, y: number): Partial<Record<GridAxis, HitRegion>> {
			const state = store.get();
			if (!root || state.disabled) return {};

			const cells = Object.entries(state.cells).flatMap(([id, placement]) => {
				const el = context.element("cell", id);
				return el ? [{ el, placement }] : [];
			});

			const gridlines = Object.entries(state.gridlines).flatMap(([id, placement]) => {
				const el = context.element("gridline", id);
				return el ? [{ el, placement }] : [];
			});

			const coarse =
				root.ownerDocument.defaultView?.matchMedia?.("(pointer: coarse)").matches;

			const hits: Partial<Record<GridAxis, HitRegion>> = {};

			for (const axis of AXES) {
				const regions = hitRegions(axis, {
					trackDisabled: state[axis].map((track) => track.disabled ?? false),
					crossCount: state[crossOf(axis)].length,
					cells,
					gridlines,
					min: coarse ? MIN_TARGET.coarse : MIN_TARGET.fine,
				});

				const region = regionAt(regions, x, y);

				if (region) {
					hits[axis] = region;
				}
			}

			return hits;
		}

		function boundariesOf(hits: Partial<Record<GridAxis, HitRegion>>): Boundaries | null {
			return hits.columns || hits.rows
				? {
						columns: hits.columns?.boundary ?? null,
						rows: hits.rows?.boundary ?? null,
					}
				: null;
		}

		function sameBoundaries(a: Boundaries | null, b: Boundaries | null) {
			return a === b || (!!a && !!b && a.columns === b.columns && a.rows === b.rows);
		}

		let cursorSheet: HTMLStyleElement | undefined;

		function setCursor(boundaries: Boundaries | null) {
			if (!root) return;

			let cursor: string | undefined;

			if (!boundaries) {
				cursor = undefined;
			} else if (boundaries.columns !== null && boundaries.rows !== null) {
				cursor = "move";
			} else if (boundaries.columns !== null) {
				cursor = "ew-resize";
			} else if (boundaries.rows !== null) {
				cursor = "ns-resize";
			}

			if (!cursor) {
				cursorSheet?.remove();
				cursorSheet = undefined;
				return;
			}

			// A style sheet sets the cursor on every element, so the resize
			// cursor stays while the pointer passes over cells that set their
			// own cursor.
			cursorSheet ??= root.ownerDocument.createElement("style");
			cursorSheet.textContent = `*, *:hover { cursor: ${cursor} !important; }`;

			if (!cursorSheet.isConnected) {
				root.ownerDocument.head.append(cursorSheet);
			}
		}

		context.onDestroy(() => {
			stopDrag?.();
			cursorSheet?.remove();
		});

		const api = {
			getLayout: (): GridLayout => store.get().layout,
			setLayout(
				layout: Partial<GridLayout>,
				{ reason = "imperative", event }: GridChangeOptions = {},
			) {
				const current = store.get().layout;

				const next = {
					columns: layout.columns
						? fitLayout(layout.columns, tracksOf("columns"))
						: current.columns,
					rows: layout.rows ? fitLayout(layout.rows, tracksOf("rows")) : current.rows,
				};

				const done = apply(next, { reason, event });

				if (done) {
					finish(reason, event);
				}

				return done;
			},
			collapse(
				axis: GridAxis,
				track: TrackRef,
				{ reason = "imperative", event }: GridChangeOptions = {},
			) {
				const done = collapseTrack(axis, indexOf(axis, track), { reason, event });

				if (done) {
					finish(reason, event);
				}

				return done;
			},
			expand(
				axis: GridAxis,
				track: TrackRef,
				{ reason = "imperative", event }: GridChangeOptions = {},
			) {
				const done = expandTrack(axis, indexOf(axis, track), { reason, event });

				if (done) {
					finish(reason, event);
				}

				return done;
			},
			resize(
				axis: GridAxis,
				track: TrackRef,
				size: GridSize,
				{ reason = "imperative", event }: GridChangeOptions = {},
			) {
				const index = indexOf(axis, track);
				const target = toPercent(size, store.get().space[axis], rem());

				if (target === undefined) {
					return false;
				}

				const done = setAxis(
					axis,
					resizeTrack(store.get().layout[axis], tracksOf(axis), index, target),
					{ reason, event },
				);

				if (done) {
					finish(reason, event);
				}

				return done;
			},
			isCollapsed(axis: GridAxis, track: TrackRef) {
				const index = indexOf(axis, track);
				return isCollapsed(tracksOf(axis)[index], store.get().layout[axis][index]);
			},
			getSize(axis: GridAxis, track: TrackRef) {
				const index = indexOf(axis, track);
				const percentage = store.get().layout[axis][index];

				return {
					percentage,
					pixels: (percentage / 100) * store.get().space[axis],
				};
			},
			internal: {
				bindRoot(el: HTMLElement) {
					root = el;

					const observer = new ResizeObserver(() => resized(el));
					observer.observe(el);

					resized(el);

					return () => {
						observer.disconnect();

						if (root === el) {
							root = undefined;
						}
					};
				},
				registerCell(key: string, props: CellProps) {
					store.set({
						cells: {
							...store.get().cells,
							[key]: cellOf(props),
						},
					});

					reportPlacement();

					return () => {
						const { [key]: _removed, ...cells } = store.get().cells;
						store.set({ cells });

						reportPlacement();
					};
				},
				registerGridline(key: string, props: GridlineProps) {
					store.set({
						gridlines: {
							...store.get().gridlines,
							[key]: gridlinePlacement(props),
						},
					});

					refreshGutters();
					reportPlacement();

					return () => {
						const { [key]: _removed, ...gridlines } = store.get().gridlines;
						store.set({ gridlines });

						refreshGutters();
						reportPlacement();
					};
				},
				pointerdown(event: PointerEvent) {
					if (event.defaultPrevented || event.button !== 0 || !root || stopDrag) {
						return;
					}

					const hits = hitsAt(event.clientX, event.clientY);
					const boundaries = boundariesOf(hits);
					if (!boundaries) return;

					event.preventDefault();

					(hits.columns?.gridline ?? hits.rows?.gridline)?.focus({
						preventScroll: true,
					});

					const rtl = isRTL(root);

					const startX = event.clientX;
					const startY = event.clientY;

					const initial = store.get().layout;

					store.set({
						dragging: boundaries,
						hovering: boundaries,
					});

					setCursor(boundaries);

					const el = root;

					stopDrag = bindDrag(el, event, {
						cancelOnEscape: true,
						onMove({ x, y, event: move }) {
							const state = store.get();
							const next = { ...state.layout };

							for (const axis of AXES) {
								const boundary = boundaries[axis];
								if (boundary === null || state.space[axis] <= 0) continue;

								const moved =
									axis === "columns"
										? rtl
											? startX - x
											: x - startX
										: y - startY;

								next[axis] = [
									...adjustLayout(
										(moved / state.space[axis]) * 100,
										initial[axis],
										state.layout[axis],
										tracksOf(axis),
										[boundary - 1, boundary],
										"pointer",
									),
								];
							}

							apply(next, { reason: "drag", event: move });
						},
						onEnd(end, canceled) {
							stopDrag = undefined;

							if (canceled) {
								apply(initial, { reason: "drag", event: end });
							}

							store.set({
								dragging: null,
								hovering: null,
							});

							setCursor(null);

							if (!canceled && !sameGridLayout(initial, store.get().layout)) {
								finish("drag", end);
							}
						},
					});
				},
				pointermove(event: PointerEvent) {
					if (stopDrag || event.buttons !== 0) return;

					const hovering = boundariesOf(hitsAt(event.clientX, event.clientY));
					if (sameBoundaries(hovering, store.get().hovering)) return;

					store.set({ hovering });

					setCursor(hovering);
				},
				pointerleave() {
					if (stopDrag || !store.get().hovering) return;

					store.set({ hovering: null });
					setCursor(null);
				},
				keydown(event: KeyboardEvent, key: string, el: HTMLElement) {
					const state = store.get();
					const placement = state.gridlines[key];

					if (!placement || state.disabled || placement.disabled) return;

					const axis = axisOf(placement.type);
					const boundary = placement.index;

					if (
						!Number.isInteger(boundary) ||
						boundary < 1 ||
						boundary >= state[axis].length
					) {
						return;
					}

					if (event.key === "F6") {
						const lines = Object.entries(state.gridlines)
							.filter(([, line]) => line.type === placement.type && !line.disabled)
							.map(([id]) => context.element("gridline", id))
							.filter((line): line is HTMLElement => !!line)
							.sort((a, b) =>
								a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING
									? -1
									: 1,
							);

						const at = lines.indexOf(el);
						const next =
							lines[(at + (event.shiftKey ? -1 : 1) + lines.length) % lines.length];

						if (next && next !== el) {
							event.preventDefault();
							next.focus();
						}

						return;
					}

					if (event.key === "Enter") {
						event.preventDefault();
						toggleBoundary(axis, boundary, event);
						return;
					}

					const { step = 1, largeStep = 10 } = context.options();
					const amount = event.shiftKey ? largeStep : step;

					const forward =
						axis === "columns" ? (isRTL(el) ? "ArrowLeft" : "ArrowRight") : "ArrowDown";
					const back =
						axis === "columns" ? (isRTL(el) ? "ArrowRight" : "ArrowLeft") : "ArrowUp";

					const delta =
						event.key === forward
							? amount
							: event.key === back
								? -amount
								: event.key === "Home"
									? -100
									: event.key === "End"
										? 100
										: undefined;

					if (delta === undefined) return;
					event.preventDefault();

					const sizes = state.layout[axis];
					const tracks = tracksOf(axis);
					const next = fitLayout(
						adjustLayout(
							delta,
							sizes,
							sizes,
							tracks,
							[boundary - 1, boundary],
							"keyboard",
						),
						tracks,
					);

					if (setAxis(axis, next, { reason: "step-key", event })) {
						keyCommit = "step-key";
					}
				},
				keyup(event: KeyboardEvent) {
					if (!keyCommit) return;

					const reason = keyCommit;
					keyCommit = undefined;

					finish(reason, event);
				},
				dblclick(event: MouseEvent, key: string) {
					const state = store.get();
					const placement = state.gridlines[key];

					const props = context.props<GridlineProps>("gridline", key);

					if (
						!placement ||
						state.disabled ||
						placement.disabled ||
						props?.disableDoubleClick
					) {
						return;
					}

					const axis = axisOf(placement.type);

					if (toggleBoundary(axis, placement.index, event)) {
						event.preventDefault();
					}
				},
			},
		};

		return api;
	},
	slots(slot) {
		return {
			root: slot<
				object,
				{
					layout: GridLayout;
					dragging: boolean;
					disabled: boolean;
				}
			>({
				state: (state) => ({
					layout: state.layout,
					dragging: state.dragging !== null,
					disabled: state.disabled,
				}),
				attrs(state) {
					function template(axis: GridAxis) {
						const sizes =
							state.measured || state.explicit
								? state.layout[axis].map((size) => `minmax(0, ${size}fr)`)
								: initialTemplate(state[axis], undefined);

						return sizes.join(state.gutters[axis] ? " auto " : " ");
					}

					return {
						"data-dragging": state.dragging ? "" : undefined,
						"data-disabled": state.disabled ? "" : undefined,
						style: css({
							display: "grid",
							"grid-template-columns": template("columns"),
							"grid-template-rows": template("rows"),
							"touch-action": "none",
						}),
					};
				},
				on: {
					pointerdown(event, { api }) {
						api.internal.pointerdown(event as PointerEvent);
					},
					pointermove(event, { api }) {
						api.internal.pointermove(event as PointerEvent);
					},
					pointerleave(_event, { api }) {
						api.internal.pointerleave();
					},
				},
				bind(el, part) {
					part.api.internal.bindRoot(el);
				},
			}),
			cell: slot<CellProps>({
				props: {
					id: "id",
					column: "number",
					row: "number",
					columnSpan: "number",
					rowSpan: "number",
				},
				attrs(state, { props, key }) {
					const cell = cellOf(props);

					return {
						id: key,
						style: css({
							"grid-column": cellPlacement(
								cell.column,
								cell.columnSpan,
								state.gutters.columns,
							),
							"grid-row": cellPlacement(cell.row, cell.rowSpan, state.gutters.rows),
							"min-width": "0",
							"min-height": "0",
						}),
					};
				},
				bind(_el, part) {
					part.api.internal.registerCell(part.key, part.props);
				},
			}),
			gridline: slot<
				GridlineProps,
				{
					orientation: "horizontal" | "vertical";
					dragging: boolean;
					hovering: boolean;
					disabled: boolean;
				}
			>({
				props: {
					id: "id",
					type: "string",
					column: "number",
					row: "number",
					columnSpan: "number",
					rowSpan: "number",
					disabled: "boolean",
					disableDoubleClick: "boolean",
				},
				role: "separator",
				focus(state, { props }) {
					return state.disabled || props.disabled
						? { none: "A disabled gridline leaves the tab order." }
						: "tab-stop";
				},
				keys: [
					"ArrowLeft",
					"ArrowRight",
					"ArrowUp",
					"ArrowDown",
					"Home",
					"End",
					"Enter",
					"F6",
				],
				state(state, { props }) {
					const line = gridlinePlacement(props);
					const axis = axisOf(line.type);

					return {
						orientation: line.type === "column" ? "vertical" : "horizontal",
						dragging: state.dragging?.[axis] === line.index,
						hovering: state.hovering?.[axis] === line.index,
						disabled: state.disabled || line.disabled,
					};
				},
				attrs(state, { props, key }) {
					const line = gridlinePlacement(props);

					const axis = axisOf(line.type);
					const cross = crossOf(axis);

					const count = state[axis].length;
					const valid =
						Number.isInteger(line.index) && line.index >= 1 && line.index < count;
					const disabled = state.disabled || line.disabled || !valid;

					const values = valid
						? boundaryValues(
								state.layout[axis],
								state[axis].map((track) => constraintsOf(track, state.space[axis])),
								line.index,
							)
						: { now: 0, min: 0, max: 0 };

					// A boundary can have several gridlines along it. Only the
					// first enabled one is a tab stop, so each boundary takes one
					// stop in the tab order.
					const first = !Object.entries(state.gridlines).some(
						([id, other]) =>
							id !== key &&
							other.type === line.type &&
							other.index === line.index &&
							!other.disabled &&
							other.crossStart < line.crossStart,
					);

					const controls = Object.entries(state.cells)
						.filter(([, cell]) => {
							const [start, span] = rangeOf(cell, axis);
							return start <= line.index - 1 && line.index - 1 < start + span;
						})
						.map(([id]) => id)
						.join(" ");

					return {
						id: key,
						"aria-orientation": line.type === "column" ? "vertical" : "horizontal",
						"aria-valuenow": String(Math.round(values.now)),
						"aria-valuemin": String(Math.round(values.min)),
						"aria-valuemax": String(Math.round(values.max)),
						"aria-controls": controls || undefined,
						"aria-disabled": disabled ? "true" : undefined,
						tabindex: disabled ? undefined : first ? "0" : "-1",
						"data-orientation": line.type === "column" ? "vertical" : "horizontal",
						"data-disabled": disabled ? "" : undefined,
						"data-dragging": state.dragging?.[axis] === line.index ? "" : undefined,
						"data-hovering": state.hovering?.[axis] === line.index ? "" : undefined,
						style: css({
							[axis === "columns" ? "grid-column" : "grid-row"]: gutterPlacement(
								line.index,
							),
							[axis === "columns" ? "grid-row" : "grid-column"]: crossPlacement(
								line.crossStart,
								line.crossSpan,
								state[cross].length,
								state.gutters[cross],
							),
							"touch-action": "none",
						}),
					};
				},
				on: {
					keydown(event, { el, key, api }) {
						if (el) {
							api.internal.keydown(event as KeyboardEvent, key, el);
						}
					},
					keyup(event, { api }) {
						api.internal.keyup(event as KeyboardEvent);
					},
					dblclick(event, { key, api }) {
						api.internal.dblclick(event as MouseEvent, key);
					},
				},
				bind(_el, part) {
					part.api.internal.registerGridline(part.key, part.props);
				},
			}),
		};
	},
	agent: {
		actions: ["setLayout", "collapse", "expand", "resize"],
	},
});

/**
 * Creates a controller that resizes and inspects a grid from outside it. Pass
 * it to the grid's `controller` option.
 */
export function createGridController() {
	return createController<GridController>();
}
