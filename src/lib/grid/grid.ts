import {
	bindDrag,
	createChange,
	createCommit,
	createController,
	css,
	definePrimitive,
	isRTL,
} from "@ui-sdk/core";
import {
	adjustLayout,
	boundaryValues,
	fitLayout,
	isCollapsed,
	preserveFixed,
	resizeTrack,
	sameLayout,
	startAxis,
	type TrackConstraints,
} from "./axis";
import {
	axisOf,
	cellOf,
	gridlinePlacement,
	axisTemplate,
	cellPlacement,
	crossOf,
	crossPlacement,
	gutterPlacement,
	hitRegions,
	isBoundary,
	placementErrors,
	rangeOf,
	regionAt,
	trackPixels,
	typeOf,
	type HitRegion,
} from "./placement";
import { loadLayout, saveLayout } from "./storage";
import {
	constraintsOf,
	fr,
	initialTemplate,
	normalizeTracks,
	toPercent,
	type Track,
} from "./tracks";
import type {
	CellProps,
	GridAxis,
	GridChangeOptions,
	GridController,
	GridLayout,
	GridLayoutChangeReason,
	GridlineProps,
	GridOptions,
	GutterOptions,
	TrackRef,
} from "./types";

interface Boundaries {
	columns: number | null;
	rows: number | null;
}

type Space = Record<GridAxis, number>;

interface GridState {
	columns: Track[];
	rows: Track[];
	layout: GridLayout;

	/**
	 * The layout that the user last chose, at `requestedSpace`, which the
	 * grid returns to when it has room. `undefined` until there is one.
	 */
	requested: GridLayout | undefined;
	requestedSpace: Space;

	/**
	 * The pixels each axis's tracks share, `0` until the grid is measured.
	 */
	space: Space;

	/**
	 * The pixels in a rem, once the grid is measured.
	 */
	rem: number | undefined;

	/**
	 * Whether the layout was given, so the server renders it rather than each
	 * track's default size.
	 */
	explicit: boolean;
	disabled: boolean;

	/**
	 * The keys of the bound cells and gridlines. Their placements come from
	 * their props.
	 */
	cells: string[];
	gridlines: string[];
	gutters: GutterOptions;
	dragging: Boundaries | null;
	hovering: Boundaries | null;
}

export interface GridRootState {
	/**
	 * The size of each column and row as a percentage of the grid.
	 */
	layout: GridLayout;

	/**
	 * Whether a pointer is dragging a boundary of the grid.
	 */
	dragging: boolean;

	/**
	 * Whether the grid is disabled.
	 */
	disabled: boolean;
}

export interface GridlineState {
	/**
	 * `"vertical"` for a column gridline and `"horizontal"` for a row
	 * gridline.
	 */
	orientation: "horizontal" | "vertical";

	/**
	 * Whether a pointer is dragging the boundary that the gridline sits on.
	 */
	dragging: boolean;

	/**
	 * Whether the pointer is over the boundary that the gridline sits on,
	 * on this gridline or on another part of the same boundary.
	 */
	hovering: boolean;

	/**
	 * Whether the gridline is disabled: by its own `disabled` prop, by the
	 * grid's, or by a placement that is not on a boundary.
	 */
	disabled: boolean;
}

type Cause = { reason: GridLayoutChangeReason; event?: Event };

const AXES = ["columns", "rows"] as const;

// The smallest hit region across a boundary, in CSS pixels, for each pointer
// type. 24 is the minimum target size of WCAG 2.2 (success criterion 2.5.8).
const MIN_TARGET = { fine: 10, coarse: 24 };

function sameGridLayout(a: GridLayout, b: GridLayout) {
	return sameLayout(a.columns, b.columns) && sameLayout(a.rows, b.rows);
}

function measured(state: Pick<GridState, "space">) {
	return state.space.columns > 0 && state.space.rows > 0;
}

function gridlineView(state: GridState, props: GridlineProps) {
	const line = gridlinePlacement(props);
	const axis = axisOf(line.type);
	const valid = isBoundary(line.index, state[axis].length);

	return {
		line,
		axis,
		valid,
		orientation: line.type === "column" ? ("vertical" as const) : ("horizontal" as const),
		dragging: state.dragging?.[axis] === line.index,
		hovering: state.hovering?.[axis] === line.index,
		disabled: state.disabled || line.disabled || !valid,
	};
}

function remSize(el: Element) {
	return parseFloat(getComputedStyle(el.ownerDocument.documentElement).fontSize) || undefined;
}

function constraints(
	state: Pick<GridState, GridAxis | "space" | "rem">,
	axis: GridAxis,
): TrackConstraints[] {
	return state[axis].map((track) => constraintsOf(track, state.space[axis], state.rem));
}

/**
 * Where the grid starts: the controlled layout, then `preferred`, then the
 * default layout, then each track's default size, for each axis.
 */
function startLayout(
	state: Pick<GridState, GridAxis | "space" | "rem">,
	options: GridOptions,
	preferred?: GridLayout,
): GridLayout {
	const start = (axis: GridAxis) =>
		startAxis(
			constraints(state, axis),
			options.layout?.[axis] ?? preferred?.[axis] ?? options.defaultLayout?.[axis],
		);

	return { columns: start("columns"), rows: start("rows") };
}

function sameIds(a: readonly Track[], b: readonly Track[]) {
	return a.length === b.length && a.every((track, i) => track.id === b[i].id);
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
		const tracks = {
			columns: normalizeTracks(options.columns),
			rows: normalizeTracks(options.rows),
			space: { columns: 0, rows: 0 },
			rem: undefined,
		};

		return {
			...tracks,
			layout: startLayout(tracks, options),
			requested: undefined,
			requestedSpace: tracks.space,
			explicit: options.layout !== undefined || options.defaultLayout !== undefined,
			disabled: options.disabled ?? false,
			cells: [],
			gridlines: [],
			gutters: { ...options.gutters },
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
		let keyChanged = false;

		let stopDrag: (() => void) | undefined;

		const logged = new Set<string>();
		const expanded: Record<GridAxis, Record<string, number>> = {
			columns: {},
			rows: {},
		};

		const tracksOf = (axis: GridAxis) => constraints(store.get(), axis);

		function placed<Props extends object, Placement>(
			slot: "cell" | "gridline",
			keys: readonly string[],
			place: (props: Props) => Placement,
		) {
			return keys.flatMap((key) => {
				const props = context.props<Props>(slot, key);
				return props ? [{ key, placement: place(props) }] : [];
			});
		}

		const cellsOf = (state: GridState) => placed("cell", state.cells, cellOf);
		const gridlinesOf = (state: GridState) =>
			placed("gridline", state.gridlines, gridlinePlacement);

		function guttersOf(state: GridState): Record<GridAxis, boolean> {
			const lines = gridlinesOf(state);
			const lined = (axis: GridAxis) =>
				lines.some(({ placement }) => placement.type === typeOf(axis));

			return {
				columns: state.gutters.columns ?? lined("columns"),
				rows: state.gutters.rows ?? lined("rows"),
			};
		}

		function reportPlacement() {
			if (!import.meta.env?.DEV) return;

			const state = store.get();
			const errors = placementErrors(
				state.columns.length,
				state.rows.length,
				cellsOf(state).map(({ placement }) => placement),
				gridlinesOf(state).map(({ placement }) => placement),
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

		/**
		 * Changes the tracks, cells, or gridlines, which placement errors check.
		 */
		function setPlacement(patch: Partial<Pick<GridState, GridAxis | "cells" | "gridlines">>) {
			store.set(patch);
			reportPlacement();
		}

		function register(list: "cells" | "gridlines", key: string) {
			setPlacement({ [list]: [...store.get()[list], key] });

			return () => {
				setPlacement({ [list]: store.get()[list].filter((other) => other !== key) });
			};
		}

		context.onOptions((options) => {
			const state = store.get();
			const gutters = options.gutters ?? {};

			store.set({
				disabled: options.disabled ?? false,
				...(gutters.columns !== state.gutters.columns || gutters.rows !== state.gutters.rows
					? { gutters: { ...gutters } }
					: {}),
			});

			const tracks = {
				columns: normalizeTracks(options.columns),
				rows: normalizeTracks(options.rows),
			};

			if (
				JSON.stringify(tracks) ===
				JSON.stringify({ columns: state.columns, rows: state.rows })
			) {
				return;
			}

			setPlacement(tracks);

			const start = startLayout(store.get(), options);

			const fitted = (axis: GridAxis) =>
				sameIds(state[axis], tracks[axis])
					? fitLayout((state.requested ?? state.layout)[axis], tracksOf(axis))
					: start[axis];

			apply({ columns: fitted("columns"), rows: fitted("rows") }, { reason: "resize" });
		});

		// A change that the grid's size forces passes `remember` as false. It
		// leaves `requested` as it was, so the layout that the user chose comes
		// back when the grid has room for it again.
		function apply(layout: GridLayout, cause: Cause, remember = true) {
			const state = store.get();

			if (sameGridLayout(layout, state.layout)) {
				return false;
			}

			const accepted = change("layout", layout, cause);

			if (accepted && remember) {
				store.set({
					requested: layout,
					requestedSpace: { ...state.space },
				});
			}

			return accepted;
		}

		function finish({ reason, event }: Cause) {
			const state = store.get();

			commit("layout", state.layout, { reason, event });
			saveLayout(context.options(), state, state.requested ?? state.layout);
		}

		/**
		 * Runs a change that `options` describe, and commits it when the layout
		 * changed.
		 */
		function committed(
			{ reason = "imperative", event }: GridChangeOptions = {},
			run: (cause: Cause) => boolean,
		) {
			const cause = { reason, event };
			const done = run(cause);

			if (done) {
				finish(cause);
			}

			return done;
		}

		function measure(el: HTMLElement): Space {
			const style = getComputedStyle(el);
			const gutters = guttersOf(store.get());

			// The computed template gives each track in pixels, which leaves out
			// the gutters. The client size is the fallback for when it does not
			// resolve to pixels.
			const space = (axis: GridAxis) =>
				trackPixels(
					axis === "columns" ? style.gridTemplateColumns : style.gridTemplateRows,
					store.get()[axis].length,
					gutters[axis],
				) ?? (axis === "columns" ? el.clientWidth : el.clientHeight);

			return { columns: space("columns"), rows: space("rows") };
		}

		function resized(el: HTMLElement) {
			const space = measure(el);
			const state = store.get();

			if (!measured({ space })) return;

			if (space.columns === state.space.columns && space.rows === state.space.rows) {
				return;
			}

			store.set({ space, rem: remSize(el) });

			if (!measured(state)) {
				const options = context.options();
				const layout = startLayout(
					store.get(),
					options,
					state.requested ?? loadLayout(options, state),
				);

				store.set({
					requested: layout,
					requestedSpace: space,
				});

				apply(layout, { reason: "resize" }, false);

				return;
			}

			const requested = state.requested ?? state.layout;

			const refit = (axis: GridAxis) =>
				fitLayout(
					preserveFixed(
						requested[axis],
						tracksOf(axis),
						state.requestedSpace[axis],
						space[axis],
					),
					tracksOf(axis),
				);

			apply({ columns: refit("columns"), rows: refit("rows") }, { reason: "resize" }, false);
		}

		function indexOf(axis: GridAxis, ref: TrackRef) {
			const tracks = store.get()[axis];
			const noun = typeOf(axis);

			if (typeof ref === "number") {
				if (!Number.isInteger(ref) || ref < 0 || ref >= tracks.length) {
					throw new Error(`Grid has no ${noun} at index ${ref}; it has ${tracks.length}`);
				}

				return ref;
			}

			const index = tracks.findIndex((track) => track.id === ref);

			if (index < 0) {
				throw new Error(
					`Grid has no ${noun} with id "${ref}"; its ids are ${tracks.map((track) => `"${track.id}"`).join(", ")}`,
				);
			}

			return index;
		}

		function setAxis(axis: GridAxis, values: readonly number[], cause: Cause) {
			const layout = {
				...store.get().layout,
				[axis]: fitLayout(values, tracksOf(axis)),
			};

			return apply(layout, cause);
		}

		function collapseTrack(axis: GridAxis, index: number, cause: Cause) {
			const tracks = tracksOf(axis);

			const track = tracks[index];
			const sizes = store.get().layout[axis];

			if (!track.collapsible || isCollapsed(track, sizes[index])) {
				return false;
			}

			expanded[axis][store.get()[axis][index].id] = sizes[index];

			return setAxis(axis, resizeTrack(sizes, tracks, index, track.collapsed), cause);
		}

		function expandTrack(axis: GridAxis, index: number, cause: Cause) {
			const tracks = tracksOf(axis);

			const track = tracks[index];
			const sizes = store.get().layout[axis];

			if (!track.collapsible || !isCollapsed(track, sizes[index])) {
				return false;
			}

			const target = expanded[axis][store.get()[axis][index].id] ?? track.min;

			// A track with no remembered size and a `min` of 0 would stay at 0,
			// so it expands to 1% instead.
			return setAxis(axis, resizeTrack(sizes, tracks, index, target || 1), cause);
		}

		function toggleBoundary(axis: GridAxis, boundary: number, event?: Event) {
			const tracks = tracksOf(axis);
			const index = tracks[boundary - 1]?.collapsible
				? boundary - 1
				: tracks[boundary]?.collapsible
					? boundary
					: -1;

			if (index < 0) return false;

			return committed({ reason: "collapse", event }, (cause) =>
				isCollapsed(tracks[index], store.get().layout[axis][index])
					? expandTrack(axis, index, cause)
					: collapseTrack(axis, index, cause),
			);
		}

		function hitsAt(x: number, y: number): Partial<Record<GridAxis, HitRegion>> {
			const state = store.get();
			if (!root || state.disabled) return {};

			function bound<Placement>(
				slot: "cell" | "gridline",
				list: { key: string; placement: Placement }[],
			) {
				return list.flatMap(({ key, placement }) => {
					const el = context.element(slot, key);
					return el ? [{ el, placement }] : [];
				});
			}

			const cells = bound("cell", cellsOf(state));
			const gridlines = bound("gridline", gridlinesOf(state));

			const coarse =
				root.ownerDocument.defaultView?.matchMedia?.("(pointer: coarse)").matches;

			const hits: Partial<Record<GridAxis, HitRegion>> = {};

			for (const axis of AXES) {
				const regions = hitRegions(axis, {
					trackDisabled: tracksOf(axis).map((track) => track.disabled),
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

		const controller = {
			getLayout: (): GridLayout => store.get().layout,
			setLayout: (layout: Partial<GridLayout>, options?: GridChangeOptions) =>
				committed(options, (cause) => {
					const current = store.get().layout;

					return apply(
						{
							columns: layout.columns
								? fitLayout(layout.columns, tracksOf("columns"))
								: current.columns,
							rows: layout.rows
								? fitLayout(layout.rows, tracksOf("rows"))
								: current.rows,
						},
						cause,
					);
				}),
			collapse: (axis: GridAxis, track: TrackRef, options?: GridChangeOptions) =>
				committed(options, (cause) => collapseTrack(axis, indexOf(axis, track), cause)),
			expand: (axis: GridAxis, track: TrackRef, options?: GridChangeOptions) =>
				committed(options, (cause) => expandTrack(axis, indexOf(axis, track), cause)),
			resize: (
				axis: GridAxis,
				track: TrackRef,
				size: Parameters<GridController["resize"]>[2],
				options?: GridChangeOptions,
			) =>
				committed(options, (cause) => {
					const state = store.get();
					const index = indexOf(axis, track);
					const target = toPercent(size, state.space[axis], state.rem);

					return (
						target !== undefined &&
						setAxis(
							axis,
							resizeTrack(state.layout[axis], tracksOf(axis), index, target),
							cause,
						)
					);
				}),
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
		} satisfies GridController;

		return {
			...controller,
			controller,
			internal: {
				cellsOf,
				gridlinesOf,
				guttersOf,
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
				register,
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

					stopDrag = bindDrag(root, event, {
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
								finish({ reason: "drag", event: end });
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
				keydown(event: KeyboardEvent, el: HTMLElement, props: GridlineProps) {
					const state = store.get();
					const { line, axis, disabled } = gridlineView(state, props);

					if (disabled) return;

					const boundary = line.index;

					if (event.key === "F6") {
						const lines = gridlinesOf(state)
							.filter(
								({ placement }) =>
									placement.type === line.type && !placement.disabled,
							)
							.map(({ key }) => context.element("gridline", key))
							.filter((other): other is HTMLElement => !!other)
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
					const next = adjustLayout(
						delta,
						sizes,
						sizes,
						tracksOf(axis),
						[boundary - 1, boundary],
						"keyboard",
					);

					if (setAxis(axis, next, { reason: "step-key", event })) {
						keyChanged = true;
					}
				},
				keyup(event: KeyboardEvent) {
					if (!keyChanged) return;

					keyChanged = false;
					finish({ reason: "step-key", event });
				},
				dblclick(event: MouseEvent, props: GridlineProps) {
					const { line, axis, disabled } = gridlineView(store.get(), props);

					if (disabled || props.disableDoubleClick) return;

					if (toggleBoundary(axis, line.index, event)) {
						event.preventDefault();
					}
				},
			},
		};
	},
	slots(slot) {
		return {
			root: slot<object, GridRootState>({
				state: (state) => ({
					layout: state.layout,
					dragging: state.dragging !== null,
					disabled: state.disabled,
				}),
				attrs(state, { api }) {
					const gutters = api.internal.guttersOf(state);

					function template(axis: GridAxis) {
						const sizes =
							measured(state) || state.explicit || state.requested
								? state.layout[axis].map(fr)
								: initialTemplate(state[axis]);

						return axisTemplate(sizes, gutters[axis]);
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
				bind: (el, part) => part.api.internal.bindRoot(el),
			}),
			cell: slot<CellProps>({
				props: {
					id: "id",
					column: "number",
					row: "number",
					columnSpan: "number",
					rowSpan: "number",
				},
				attrs(state, { props, key, api }) {
					const cell = cellOf(props);
					const gutters = api.internal.guttersOf(state);

					return {
						id: key,
						style: css({
							"grid-column": cellPlacement(
								cell.column,
								cell.columnSpan,
								gutters.columns,
							),
							"grid-row": cellPlacement(cell.row, cell.rowSpan, gutters.rows),
							"min-width": "0",
							"min-height": "0",
						}),
					};
				},
				bind: (_el, part) => part.api.internal.register("cells", part.key),
			}),
			gridline: slot<GridlineProps, GridlineState>({
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
					return gridlineView(state, props).disabled
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
					const { orientation, dragging, hovering, disabled } = gridlineView(
						state,
						props,
					);
					return { orientation, dragging, hovering, disabled };
				},
				attrs(state, { props, key, api }) {
					const { line, axis, valid, orientation, dragging, hovering, disabled } =
						gridlineView(state, props);
					const cross = crossOf(axis);

					const values = valid
						? boundaryValues(state.layout[axis], constraints(state, axis), line.index)
						: { now: 0, min: 0, max: 0 };

					// A boundary can have several gridlines along it. Only the
					// first enabled one is a tab stop, so each boundary takes one
					// stop in the tab order.
					const first = !api.internal
						.gridlinesOf(state)
						.some(
							({ key: id, placement: other }) =>
								id !== key &&
								other.type === line.type &&
								other.index === line.index &&
								!other.disabled &&
								other.crossStart < line.crossStart,
						);

					const controls = api.internal
						.cellsOf(state)
						.filter(({ placement }) => {
							const [start, span] = rangeOf(placement, axis);
							return start <= line.index - 1 && line.index - 1 < start + span;
						})
						.map(({ key: id }) => id)
						.join(" ");

					return {
						id: key,
						"aria-orientation": orientation,
						"aria-valuenow": String(Math.round(values.now)),
						"aria-valuemin": String(Math.round(values.min)),
						"aria-valuemax": String(Math.round(values.max)),
						"aria-controls": controls || undefined,
						"aria-disabled": disabled ? "true" : undefined,
						tabindex: disabled ? undefined : first ? "0" : "-1",
						"data-orientation": orientation,
						"data-disabled": disabled ? "" : undefined,
						"data-dragging": dragging ? "" : undefined,
						"data-hovering": hovering ? "" : undefined,
						style: css({
							[axis === "columns" ? "grid-column" : "grid-row"]: gutterPlacement(
								line.index,
							),
							[axis === "columns" ? "grid-row" : "grid-column"]: crossPlacement(
								line.crossStart,
								line.crossSpan,
								state[cross].length,
								api.internal.guttersOf(state)[cross],
							),
							"touch-action": "none",
						}),
					};
				},
				on: {
					keydown(event, { el, props, api }) {
						if (el) {
							api.internal.keydown(event as KeyboardEvent, el, props);
						}
					},
					keyup(event, { api }) {
						api.internal.keyup(event as KeyboardEvent);
					},
					dblclick(event, { props, api }) {
						api.internal.dblclick(event as MouseEvent, props);
					},
				},
				bind: (_el, part) => part.api.internal.register("gridlines", part.key),
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
