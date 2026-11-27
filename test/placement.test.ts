import { describe, expect, test } from "vite-plus/test";
import {
	cellPlacement,
	crossPlacement,
	gutterPlacement,
	hitRegions,
	placementErrors,
	regionAt,
	type CellPlacement,
	type GridlinePlacement,
} from "#lib/grid/placement.ts";

function box(left: number, top: number, width: number, height: number) {
	const el = document.createElement("div");

	el.getBoundingClientRect = () =>
		({
			left,
			top,
			width,
			height,
			right: left + width,
			bottom: top + height,
		}) as DOMRect;

	return el;
}

function cell(column: number, row: number, columnSpan = 1, rowSpan = 1): CellPlacement {
	return {
		column,
		row,
		columnSpan,
		rowSpan,
	};
}

function line(type: "column" | "row", index: number, disabled = false): GridlinePlacement {
	return {
		type,
		index,
		crossStart: 0,
		crossSpan: undefined,
		disabled,
	};
}

// A 2×2 grid of 50px cells with 10px gaps.
function at(column: number, row: number, columnSpan = 1, rowSpan = 1) {
	return {
		el: box(column * 60, row * 60, columnSpan * 60 - 10, rowSpan * 60 - 10),
		placement: cell(column, row, columnSpan, rowSpan),
	};
}

type Options = Partial<Parameters<typeof hitRegions>[1]>;

function regions(axis: "columns" | "rows", cells: ReturnType<typeof at>[], extra: Options = {}) {
	return hitRegions(axis, {
		trackDisabled: [false, false],
		crossCount: 2,
		cells,
		gridlines: [],
		min: 0,
		...extra,
	}).map(({ segment }) => [segment.start, segment.crossStart, segment.end, segment.crossEnd]);
}

const square = () => [at(0, 0), at(1, 0), at(0, 1), at(1, 1)];

describe("placement", () => {
	test("cells and gridlines land on the right lines", () => {
		expect(cellPlacement(1, 1, false)).toBe("2 / span 1");
		expect(cellPlacement(0, 2, false)).toBe("1 / span 2");
		expect(cellPlacement(1, 1, true)).toBe("3 / span 1");

		expect(gutterPlacement(1)).toBe("2 / span 1");
		expect(gutterPlacement(2)).toBe("4 / span 1");

		expect(crossPlacement(0, undefined, 2, true)).toBe("1 / -1");
		expect(crossPlacement(0, 1, 2, true)).toBe("1 / 3");
		expect(crossPlacement(1, 1, 3, true)).toBe("2 / 5");
		expect(crossPlacement(1, undefined, 3, true)).toBe("2 / 6");
	});

	test("a boundary between cells merges across gaps", () => {
		expect(regions("columns", square())).toEqual([[50, 0, 60, 110]]);
		expect(regions("rows", square())).toEqual([[50, 0, 60, 110]]);
	});

	test("a cell that spans a boundary blocks it", () => {
		expect(regions("columns", [at(0, 0), at(1, 0), at(0, 1, 2)])).toEqual([[50, 0, 60, 50]]);
	});

	test("empty slots beside a cell still make a boundary", () => {
		expect(regions("columns", [at(0, 0), at(1, 1)])).toEqual([[50, 0, 60, 110]]);
		expect(regions("columns", [])).toEqual([]);
	});

	test("thin boundaries grow to the minimum size, centered", () => {
		expect(regions("columns", square(), { min: 20 })).toEqual([[45, 0, 65, 110]]);
	});

	test("a gridline takes over its boundary, and a disabled one blocks it", () => {
		const el = box(52, 0, 6, 110);

		expect(
			regions("columns", square(), {
				gridlines: [{ el, placement: line("column", 1) }],
			}),
		).toEqual([[52, 0, 58, 110]]);

		expect(
			regions("columns", square(), {
				gridlines: [{ el, placement: line("column", 1, true) }],
			}),
		).toEqual([]);
	});

	test("a gridline region skips a cell that spans across it", () => {
		const el = box(52, 0, 6, 110);
		const cells = [at(0, 0), at(1, 0), at(0, 1, 2)];

		expect(
			regions("columns", cells, {
				gridlines: [{ el, placement: line("column", 1) }],
			}),
		).toEqual([[52, 0, 58, 60]]);
	});

	test("boundaries outside the enabled tracks are left out", () => {
		expect(
			regions("columns", [at(0, 0), at(1, 0)], {
				trackDisabled: [true, false],
			}),
		).toEqual([]);
	});

	test("regionAt picks the region under the point", () => {
		const found = hitRegions("columns", {
			trackDisabled: [false, false],
			crossCount: 2,
			cells: square(),
			gridlines: [],
			min: 0,
		});

		expect(regionAt(found, 55, 20)?.boundary).toBe(1);
		expect(regionAt(found, 20, 20)).toBeUndefined();
	});

	test("placement errors describe what's wrong", () => {
		expect(placementErrors(2, 2, [cell(1, 0, 2)], [])).toEqual([
			"Invalid Cell column placement (column: 1, columnSpan: 2); Grid has 2 columns",
		]);
		expect(placementErrors(2, 2, [cell(0, -1)], [])).toEqual([
			"Invalid Cell row placement (row: -1, rowSpan: 1); Grid has 2 rows",
		]);
		expect(placementErrors(2, 3, [], [line("column", 2)])).toEqual([
			"Invalid column Gridline column (2); must be between 1 and 1",
		]);

		expect(
			placementErrors(
				3,
				3,
				[],
				[
					{
						...line("row", 1),
						crossStart: 1,
						crossSpan: 3,
					},
				],
			),
		).toEqual(["Invalid row Gridline columnSpan (3); Grid has 3 columns"]);

		expect(placementErrors(2, 2, [cell(0, 1, 2)], [line("column", 1)])[0]).toContain(
			"overlaps a Cell that spans across it",
		);
		expect(placementErrors(2, 2, [], [line("column", 1), line("column", 1)])).toEqual([
			'<Gridline type="column" column={1} /> overlaps <Gridline type="column" column={1} />',
		]);
	});
});
