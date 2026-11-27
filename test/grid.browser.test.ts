import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, test, vi } from "vite-plus/test";
import { mouseMove, mouseUp } from "./mouse";
import { commands } from "vite-plus/test/browser";
import type { ParentGrid } from "#lib/grid/context.ts";
import type { GridLayout } from "#lib/grid/types.ts";
import GridFixture from "./fixtures/GridFixture.svelte";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const root = () => document.getElementById("grid")!;
const layout = () => JSON.parse(screen.getByTestId("layout").textContent!);

const EVEN = {
	columns: [50, 50],
	rows: [50, 50],
};

async function dragFrom(x: number, y: number, toX: number, toY: number) {
	await mouseMove(x, y);
	await commands.mouse("down");
	await mouseMove(toX, toY);
	await mouseUp();
	await frame();
}

async function mount(props: Parameters<typeof render<typeof GridFixture>>[1] = {}) {
	const result = render(GridFixture, props);

	await frame();
	await frame();

	return result;
}

describe("Grid in a browser", () => {
	test("lays out tracks and cells with CSS grid", async () => {
		await mount({
			cells: [
				{ id: "a", column: 0, row: 0 },
				{ id: "b", column: 1, row: 0 },
				{ id: "c", column: 0, row: 1, columnSpan: 2 },
			],
		});

		expect(root().style.display).toBe("grid");
		expect(root().style.gridTemplateColumns).toBe("minmax(0px, 50fr) minmax(0px, 50fr)");

		expect(document.getElementById("b")!.style.gridColumn).toBe("2 / span 1");
		expect(document.getElementById("c")!.style.gridColumn).toBe("1 / span 2");

		expect(document.getElementById("c")!.getBoundingClientRect().width).toBeCloseTo(100, 0);
	});

	test("starts from default sizes and shares the rest", async () => {
		const commits: GridLayout[] = [];
		let parent: ParentGrid | undefined;

		await mount({
			columns: 3,
			rows: [
				{
					id: "top",
					defaultSize: "20%",
				},
				{
					id: "bottom",
				},
			],
			cells: [],
			grid: {
				onLayoutCommit: (layout: GridLayout) => commits.push(layout),
			},
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		expect(parent!.getLayout()).toEqual({ columns: [33.334, 33.333, 33.333], rows: [20, 80] });
		expect(root().style.gridTemplateRows).toBe("minmax(0px, 20fr) minmax(0px, 80fr)");

		expect(commits).toEqual([]);
	});

	test("dragging the space between cells resizes columns, rows, or both", async () => {
		const onLayoutCommit = vi.fn();

		await mount({
			bound: true,
			grid: { onLayoutCommit },
		});

		await dragFrom(50, 25, 60, 25);

		expect(layout()).toEqual({
			columns: [60, 40],
			rows: [50, 50],
		});

		expect(onLayoutCommit).toHaveBeenCalledOnce();
		expect(onLayoutCommit.mock.calls[0][1].reason).toBe("drag");

		await dragFrom(75, 50, 75, 30);
		expect(layout().rows).toEqual([30, 70]);

		await dragFrom(60, 30, 50, 50);
		expect(layout()).toEqual({
			columns: [50, 50],
			rows: [50, 50],
		});

		expect(onLayoutCommit).toHaveBeenCalledTimes(3);
	});

	test("Escape during a drag puts the tracks back and commits nothing", async () => {
		const onLayoutCommit = vi.fn();
		let parent: ParentGrid | undefined;

		await mount({
			grid: { onLayoutCommit },
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		await mouseMove(50, 25);
		await commands.mouse("down");
		await mouseMove(70, 25);
		await frame();

		expect(parent!.getLayout().columns).toEqual([70, 30]);

		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
		});

		document.dispatchEvent(event);

		await mouseUp();
		await frame();

		expect(parent!.getLayout().columns).toEqual([50, 50]);
		expect(onLayoutCommit).not.toHaveBeenCalled();
	});

	test("in a right-to-left page, dragging left grows the first column", async () => {
		let parent: ParentGrid | undefined;

		await mount({
			dir: "rtl",
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		const left = document.getElementById("grid")!.getBoundingClientRect().left;
		await dragFrom(left + 50, 25, left + 40, 25);

		expect(parent!.getLayout().columns).toEqual([60, 40]);
	});

	test("a cell that spans a boundary blocks dragging there", async () => {
		await mount({
			bound: true,
			cells: [
				{ id: "a", column: 0, row: 0 },
				{ id: "b", column: 1, row: 0 },
				{ id: "c", column: 0, row: 1, columnSpan: 2 },
			],
		});

		await dragFrom(50, 75, 60, 75);
		expect(layout()).toEqual(EVEN);

		await dragFrom(50, 25, 60, 25);
		expect(layout().columns).toEqual([60, 40]);

		await dragFrom(90, 50, 90, 40);
		expect(layout().rows).toEqual([40, 60]);
	});

	test("track constraints and disabled tracks hold during a drag", async () => {
		await mount({
			bound: true,
			columns: [{ minSize: 20 }, { minSize: "40%" }],
			rows: [{ maxSize: "60%" }, {}],
		});

		await dragFrom(50, 50, 90, 90);
		expect(layout()).toEqual({
			columns: [60, 40],
			rows: [60, 40],
		});

		await dragFrom(60, 50, 0, 50);
		expect(layout().columns).toEqual([20, 80]);
	});

	test("a disabled grid or track ignores drags", async () => {
		const { unmount } = await mount({
			bound: true,
			grid: { disabled: true },
		});

		await dragFrom(50, 50, 60, 60);
		expect(layout()).toEqual(EVEN);

		unmount();

		await mount({
			bound: true,
			columns: [{ disabled: true }, {}],
		});

		await dragFrom(50, 50, 60, 60);
		expect(layout()).toEqual({
			columns: [50, 50],
			rows: [60, 40],
		});
	});

	test("gridlines sit in gutters and resize with keys and drags", async () => {
		await mount({
			size: 110,
			bound: true,
			grid: { step: 5 },
			rows: [{}, { collapsible: true, minSize: 20 }],
			gridlines: [
				{
					id: "column-line",
					label: "Resize columns",
					type: "column",
					column: 1,
				},
				{
					id: "row-line",
					label: "Resize rows",
					type: "row",
					row: 1,
				},
			],
		});

		expect(root().style.gridTemplateColumns).toBe("minmax(0px, 50fr) auto minmax(0px, 50fr)");
		expect(document.getElementById("cell-1-1")!.style.gridColumn).toBe("3 / span 1");

		const column = screen.getByRole("separator", { name: "Resize columns" });
		const row = screen.getByRole("separator", { name: "Resize rows" });

		expect(column.style.gridColumn).toBe("2 / span 1");
		expect(column.style.gridRow).toBe("1 / -1");
		expect(column.getAttribute("aria-orientation")).toBe("vertical");
		expect(row.getAttribute("aria-orientation")).toBe("horizontal");
		expect(column.getAttribute("aria-controls")).toBe("cell-0-0 cell-0-1");
		expect(column.getAttribute("aria-valuenow")).toBe("50");
		expect(row.getAttribute("aria-valuemax")).toBe("100");

		column.focus();

		await fireEvent.keyDown(column, { key: "ArrowRight" });
		await fireEvent.keyUp(column, { key: "ArrowRight" });
		await fireEvent.keyDown(column, { key: "ArrowDown" });

		expect(layout().columns).toEqual([55, 45]);
		expect(column.getAttribute("aria-valuenow")).toBe("55");

		const rect = column.getBoundingClientRect();
		await dragFrom(rect.left + 5, 20, rect.left + 5 - 15, 20);
		expect(layout().columns).toEqual([40, 60]);

		row.focus();

		await fireEvent.keyDown(row, { key: "End" });
		expect(layout().rows).toEqual([100, 0]);

		await fireEvent.keyDown(row, { key: "Enter" });
		expect(layout().rows).toEqual([80, 20]);

		await fireEvent.keyDown(row, { key: "Home" });
		expect(layout().rows).toEqual([0, 100]);

		await fireEvent.keyDown(row, { key: "F6" });
		expect(document.activeElement).toBe(row);
	});

	test("disabled and invalid gridlines leave the tab order and stay put", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => {});

		await mount({
			size: 110,
			bound: true,
			gridlines: [
				{
					id: "column-line",
					label: "Resize columns",
					type: "column",
					column: 1,
					disabled: true,
				},
				{
					id: "row-line",
					label: "Resize rows",
					type: "row",
					row: 1,
				},
				{
					id: "bad",
					label: "Bad",
					type: "column",
					column: 2,
				},
			],
		});

		const column = screen.getByRole("separator", { name: "Resize columns" });

		expect(column.getAttribute("aria-disabled")).toBe("true");
		expect(column.hasAttribute("tabindex")).toBe(false);
		expect(screen.getByRole("separator", { name: "Bad" }).getAttribute("aria-disabled")).toBe(
			"true",
		);

		expect(error).toHaveBeenCalledWith(
			"Invalid column Gridline column (2); must be between 1 and 1",
		);
		expect(error).toHaveBeenCalledOnce();

		await fireEvent.keyDown(column, { key: "ArrowRight" });

		const rect = column.getBoundingClientRect();
		await dragFrom(rect.left + 5, 20, rect.left + 15, 20);
		expect(layout()).toEqual(EVEN);

		error.mockRestore();
	});

	test("only the first gridline on a boundary is a tab stop", async () => {
		await mount({
			size: 110,
			gridlines: [
				{
					id: "top",
					label: "Top",
					type: "column",
					column: 1,
					row: 0,
					rowSpan: 1,
				},
				{
					id: "bottom",
					label: "Bottom",
					type: "column",
					column: 1,
					row: 1,
					rowSpan: 1,
				},
			],
		});

		expect(screen.getByRole("separator", { name: "Top" }).getAttribute("tabindex")).toBe("0");
		expect(screen.getByRole("separator", { name: "Bottom" }).getAttribute("tabindex")).toBe(
			"-1",
		);
	});

	test("the controller and getParentGrid resize tracks", async () => {
		let parent: ParentGrid | undefined;

		await mount({
			bound: true,
			columns: [{ id: "left" }, { id: "right" }],
			rows: [
				{},
				{
					collapsible: true,
					collapsedSize: 10,
					minSize: 30,
				},
			],
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		expect(parent!.id).toBe("grid");
		expect(parent!.getSize("rows", 1)).toEqual({ percentage: 50, pixels: 50 });
		expect(parent!.collapse("rows", 1)).toBe(true);
		expect(parent!.getLayout().rows).toEqual([90, 10]);
		expect(parent!.isCollapsed("rows", 1)).toBe(true);
		expect(parent!.expand("rows", 1)).toBe(true);
		expect(parent!.getLayout().rows).toEqual([50, 50]);
		expect(parent!.resize("columns", "right", "25px")).toBe(true);
		expect(parent!.getLayout().columns).toEqual([75, 25]);
		expect(parent!.setLayout({ columns: [30, 70] })).toBe(true);

		await frame();

		expect(root().style.gridTemplateColumns).toBe("minmax(0px, 30fr) minmax(0px, 70fr)");
		expect(() => parent!.getSize("columns", "middle")).toThrow('its ids are "left", "right"');
	});

	test("autoSaveId restores a saved layout", async () => {
		const values = new Map<string, string>();

		const storage = {
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => void values.set(key, value),
		};

		let parent: ParentGrid | undefined;

		const first = await mount({
			grid: {
				autoSaveId: "test",
				storage,
			},
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		parent!.setLayout({
			columns: [25, 75],
			rows: [40, 60],
		});

		first.unmount();

		await mount({
			grid: {
				autoSaveId: "test",
				storage,
			},
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		expect(parent!.getLayout()).toEqual({
			columns: [25, 75],
			rows: [40, 60],
		});
	});

	test("a preserve-pixel-size track keeps its pixels as the grid grows", async () => {
		let parent: ParentGrid | undefined;

		const { rerender } = await mount({
			size: 200,
			columns: [
				{
					defaultSize: "50px",
					groupResizeBehavior: "preserve-pixel-size",
				},
				{},
			],
			onParent: (grid: ParentGrid) => (parent = grid),
		});

		expect(document.getElementById("cell-0-0")!.getBoundingClientRect().width).toBeCloseTo(
			50,
			0,
		);

		await rerender({ size: 400 });
		await frame();
		await frame();

		expect(document.getElementById("cell-0-0")!.getBoundingClientRect().width).toBeCloseTo(
			50,
			0,
		);
		expect(parent!.getLayout().columns).toEqual([12.5, 87.5]);
	});
});
