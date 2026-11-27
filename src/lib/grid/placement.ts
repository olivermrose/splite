import type { GridAxis } from "./types";

export interface CellPlacement {
	column: number;
	row: number;
	columnSpan: number;
	rowSpan: number;
}

export type GridlineType = "column" | "row";

/**
 * A gridline on the boundary before track `index` of its axis, across `crossStart`
 * and `crossSpan` tracks of the other.
 */
export interface GridlinePlacement {
	type: GridlineType;
	index: number;
	crossStart: number;
	crossSpan: number | undefined;
	disabled: boolean;
}

/**
 * A rectangle in viewport pixels, given relative to an axis: `start` and `end`
 * along the axis, and `crossStart` and `crossEnd` across it.
 */
export interface Segment {
	start: number;
	end: number;
	crossStart: number;
	crossEnd: number;
}

export interface HitRegion {
	axis: GridAxis;

	/**
	 * The track after the boundary: dragging it resizes tracks `boundary - 1`
	 * and `boundary`.
	 */
	boundary: number;
	segment: Segment;

	/**
	 * The gridline that the region belongs to, or `undefined` for a region in
	 * the space between cells.
	 */
	gridline: HTMLElement | undefined;
}

export function axisOf(type: GridlineType): GridAxis {
	return type === "column" ? "columns" : "rows";
}

export function crossOf(axis: GridAxis): GridAxis {
	return axis === "columns" ? "rows" : "columns";
}

// With gutters, the CSS grid alternates track and gutter. Track `index` starts
// at line `index * 2 + 1`, and the gutter before it at line `index * 2`.
function trackLine(index: number, gutters: boolean) {
	return gutters ? index * 2 + 1 : index + 1;
}

/**
 * A cell's `grid-column` or `grid-row`.
 */
export function cellPlacement(start: number, span: number, gutters: boolean) {
	return `${trackLine(start, gutters)} / span ${gutters ? span * 2 - 1 : span}`;
}

/**
 * A gridline's placement along its own axis: the gutter before track `index`.
 */
export function gutterPlacement(index: number) {
	return `${index * 2} / span 1`;
}

/**
 * A gridline's placement across the other axis, reaching into the gutters
 * beside it.
 */
export function crossPlacement(
	start: number,
	span: number | undefined,
	count: number,
	gutters: boolean,
): string {
	const end = span === undefined ? count : start + span;

	if (start === 0 && end === count) {
		return "1 / -1";
	}

	let first = trackLine(start, gutters);
	let last = trackLine(end - 1, gutters) + 1;

	if (gutters) {
		if (start > 0) first -= 1;
		if (end < count) last += 1;
	}

	return `${first} / ${last}`;
}

/**
 * `[start, span, crossStart, crossSpan]` of a cell along `axis`.
 */
export function rangeOf(cell: CellPlacement, axis: GridAxis) {
	return axis === "columns"
		? [cell.column, cell.columnSpan, cell.row, cell.rowSpan]
		: [cell.row, cell.rowSpan, cell.column, cell.columnSpan];
}

function segmentOf(el: Element, axis: GridAxis): Segment {
	const rect = el.getBoundingClientRect();

	return axis === "columns"
		? {
				start: rect.left,
				end: rect.right,
				crossStart: rect.top,
				crossEnd: rect.bottom,
			}
		: {
				start: rect.top,
				end: rect.bottom,
				crossStart: rect.left,
				crossEnd: rect.right,
			};
}

function expand(segment: Segment, min: number): Segment {
	const size = segment.end - segment.start;
	if (size >= min) return segment;

	const grow = (min - size) / 2;

	return {
		...segment,
		start: segment.start - grow,
		end: segment.end + grow,
	};
}

interface PlacedCell {
	el: HTMLElement;
	placement: CellPlacement;
}

interface PlacedGridline {
	el: HTMLElement;
	placement: GridlinePlacement;
}

/**
 * Cuts the cross ranges of cells that span across `boundary` out of `segment`.
 */
function excludeSpanning(
	segment: Segment,
	boundary: number,
	axis: GridAxis,
	cells: readonly PlacedCell[],
	bounds: (cell: PlacedCell) => Segment,
): Segment[] {
	let pieces = [segment];

	for (const cell of cells) {
		const [start, span] = rangeOf(cell.placement, axis);

		if (!(start < boundary && boundary < start + span)) {
			continue;
		}

		const { crossStart, crossEnd } = bounds(cell);

		pieces = pieces.flatMap((piece) => {
			if (crossEnd <= piece.crossStart || crossStart >= piece.crossEnd) {
				return [piece];
			}

			const kept: Segment[] = [];

			if (crossStart > piece.crossStart) {
				kept.push({ ...piece, crossEnd: crossStart });
			}

			if (crossEnd < piece.crossEnd) {
				kept.push({ ...piece, crossStart: crossEnd });
			}

			return kept;
		});
	}

	return pieces;
}

/**
 * Where a press resizes `axis`: each enabled gridline, and where no gridline
 * sits on a boundary, the space between the cells on either side of it. Cells
 * that span a boundary block it. Each region is at least `min` pixels across.
 */
export function hitRegions(
	axis: GridAxis,
	{
		trackDisabled,
		crossCount,
		cells,
		gridlines,
		min,
	}: {
		trackDisabled: readonly boolean[];
		crossCount: number;
		cells: readonly PlacedCell[];
		gridlines: readonly PlacedGridline[];
		min: number;
	},
): HitRegion[] {
	const count = trackDisabled.length;
	const enabled = trackDisabled.flatMap((disabled, index) => (disabled ? [] : [index]));

	if (enabled.length < 2) return [];

	function resizable(boundary: number) {
		return boundary > enabled[0] && boundary <= enabled[enabled.length - 1];
	}

	const measured = new Map<PlacedCell, Segment>();

	function bounds(cell: PlacedCell) {
		let segment = measured.get(cell);

		if (!segment) {
			measured.set(cell, (segment = segmentOf(cell.el, axis)));
		}

		return segment;
	}

	const regions: HitRegion[] = [];

	function emit(segment: Segment, boundary: number, gridline?: HTMLElement) {
		for (const piece of excludeSpanning(expand(segment, min), boundary, axis, cells, bounds)) {
			regions.push({
				axis,
				boundary,
				segment: piece,
				gridline,
			});
		}
	}

	const lined = new Set<number>();

	for (const { el, placement } of gridlines) {
		if (axisOf(placement.type) !== axis) {
			continue;
		}

		if (!Number.isInteger(placement.index) || placement.index < 1 || placement.index >= count) {
			continue;
		}

		lined.add(placement.index);

		if (placement.disabled || !resizable(placement.index)) {
			continue;
		}

		emit(segmentOf(el, axis), placement.index, el);
	}

	const slots: (PlacedCell | undefined)[][] = Array.from({ length: crossCount }, () => []);

	for (const cell of cells) {
		const [start, span, crossStart, crossSpan] = rangeOf(cell.placement, axis);

		for (
			let cross = Math.max(0, crossStart);
			cross < Math.min(crossCount, crossStart + crossSpan);
			cross++
		) {
			for (let index = Math.max(0, start); index < Math.min(count, start + span); index++) {
				slots[cross][index] ??= cell;
			}
		}
	}

	for (let boundary = 1; boundary < count; boundary++) {
		if (lined.has(boundary) || !resizable(boundary)) continue;

		let pending: Segment | undefined;

		for (let cross = 0; cross < crossCount; cross++) {
			const before = slots[cross][boundary - 1];
			const after = slots[cross][boundary];

			if ((before || after) && before !== after) {
				const b = before && bounds(before);
				const a = after && bounds(after);

				const from = b?.end ?? a!.start;
				const to = a?.start ?? b!.end;

				const crossStart = Math.max(b?.crossStart ?? -Infinity, a?.crossStart ?? -Infinity);
				const crossEnd = Math.min(b?.crossEnd ?? Infinity, a?.crossEnd ?? Infinity);

				const segment = {
					start: Math.min(from, to),
					end: Math.max(from, to),
					crossStart,
					crossEnd: Math.max(crossStart, crossEnd),
				};

				pending = pending
					? {
							start: Math.min(pending.start, segment.start),
							end: Math.max(pending.end, segment.end),
							crossStart: Math.min(pending.crossStart, segment.crossStart),
							crossEnd: Math.max(pending.crossEnd, segment.crossEnd),
						}
					: segment;
			} else if (pending) {
				emit(pending, boundary);
				pending = undefined;
			}
		}

		if (pending) {
			emit(pending, boundary);
		}
	}

	return regions;
}

/**
 * The region of `regions` under a point, closest to it along the axis, if any.
 */
export function regionAt(
	regions: readonly HitRegion[],
	x: number,
	y: number,
): HitRegion | undefined {
	let best: HitRegion | undefined;
	let distance = Infinity;

	for (const region of regions) {
		const [main, cross] = region.axis === "columns" ? [x, y] : [y, x];
		const { start, end, crossStart, crossEnd } = region.segment;

		if (main < start || main > end || cross < crossStart || cross > crossEnd) {
			continue;
		}

		const away = Math.abs(main - (start + end) / 2);

		if (away <= distance) {
			best = region;
			distance = away;
		}
	}
	return best;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

function describeGridline({ type, index, crossStart, crossSpan, disabled }: GridlinePlacement) {
	const cross = type === "column" ? "row" : "column";

	let text = `<Gridline type="${type}" ${type}={${index}}`;

	if (crossStart !== 0 || crossSpan !== undefined) {
		text += ` ${cross}={${crossStart}}`;
	}

	if (crossSpan !== undefined) {
		text += ` ${cross}Span={${crossSpan}}`;
	}

	return `${text}${disabled ? " disabled" : ""} />`;
}

export function placementErrors(
	columns: number,
	rows: number,
	cells: readonly CellPlacement[],
	gridlines: readonly GridlinePlacement[],
): string[] {
	const errors: string[] = [];
	const counts = { column: columns, row: rows };

	for (const cell of cells) {
		for (const name of ["column", "row"] as const) {
			const start = cell[name];
			const span = cell[`${name}Span`];

			if (
				!Number.isInteger(start) ||
				!Number.isInteger(span) ||
				start < 0 ||
				span < 1 ||
				start + span > counts[name]
			) {
				errors.push(
					`Invalid Cell ${name} placement (${name}: ${start}, ${name}Span: ${span}); Grid has ${count(counts[name], name)}`,
				);
			}
		}
	}

	const valid: GridlinePlacement[] = [];

	for (const line of gridlines) {
		const cross = line.type === "column" ? "row" : "column";

		const n = counts[line.type];
		const crossN = counts[cross];

		let ok = true;

		if (!Number.isInteger(line.index) || line.index < 1 || line.index >= n) {
			errors.push(
				`Invalid ${line.type} Gridline ${line.type} (${line.index}); must be between 1 and ${n - 1}`,
			);

			ok = false;
		}

		if (
			!Number.isInteger(line.crossStart) ||
			line.crossStart < 0 ||
			line.crossStart >= crossN
		) {
			errors.push(
				`Invalid ${line.type} Gridline ${cross} (${line.crossStart}); must be between 0 and ${crossN - 1}`,
			);

			ok = false;
		} else if (
			line.crossSpan !== undefined &&
			(!Number.isInteger(line.crossSpan) ||
				line.crossSpan < 1 ||
				line.crossStart + line.crossSpan > crossN)
		) {
			errors.push(
				`Invalid ${line.type} Gridline ${cross}Span (${line.crossSpan}); Grid has ${count(crossN, cross)}`,
			);

			ok = false;
		}

		if (ok) {
			valid.push(line);
		}
	}

	valid.forEach((line, position) => {
		const axis = axisOf(line.type);

		const cross = line.type === "column" ? "row" : "column";
		const crossEnd =
			line.crossSpan === undefined ? counts[cross] : line.crossStart + line.crossSpan;

		for (const cell of cells) {
			const [start, span, cellCross, cellCrossSpan] = rangeOf(cell, axis);

			if (!(start < line.index && line.index < start + span)) {
				continue;
			}

			if (cellCross >= crossEnd || cellCross + cellCrossSpan <= line.crossStart) {
				continue;
			}

			errors.push(
				`${describeGridline(line)} overlaps a Cell that spans across it (${line.type}: ${start}, ${line.type}Span: ${span}, ${cross}: ${cellCross}, ${cross}Span: ${cellCrossSpan}); use the ${cross} and ${cross}Span props to render gridlines beside the Cell instead`,
			);
		}

		for (const other of valid.slice(position + 1)) {
			if (other.type !== line.type || other.index !== line.index) continue;

			const otherEnd =
				other.crossSpan === undefined ? counts[cross] : other.crossStart + other.crossSpan;

			if (other.crossStart < crossEnd && line.crossStart < otherEnd) {
				errors.push(`${describeGridline(line)} overlaps ${describeGridline(other)}`);
			}
		}
	});
	return errors;
}
