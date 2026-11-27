import { render } from "@testing-library/svelte";
import { createAgent } from "@ui-sdk/svelte/agent";
import { describe, expect, test } from "vite-plus/test";
import Cell from "#lib/grid/Cell.svelte";
import GridFixture from "./fixtures/GridFixture.svelte";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
const agent = createAgent();

describe("Grid before it's measured", () => {
	test("writes pixel defaults as they are and shares the rest", async () => {
		render(GridFixture, {
			columns: [{ defaultSize: "20%" }, {}, {}],
			rows: [{ defaultSize: "100px" }, {}],
			cells: [],
		});

		await tick();
		const root = document.getElementById("grid")!;

		expect(root.style.gridTemplateColumns).toBe(
			"minmax(0, 20fr) minmax(0, 40fr) minmax(0, 40fr)",
		);
		expect(root.style.gridTemplateRows).toBe("100px minmax(0, 100fr)");
	});

	test("renders a given default layout", async () => {
		render(GridFixture, {
			grid: { defaultLayout: { columns: [30, 70] } },
			cells: [],
		});

		await tick();

		expect(document.getElementById("grid")!.style.gridTemplateColumns).toBe(
			"minmax(0, 30fr) minmax(0, 70fr)",
		);
	});

	test("a Cell outside a Grid throws", () => {
		expect(() => render(Cell, { column: 0, row: 0 })).toThrow();
	});

	test("an agent can find the grid by name and set its layout", async () => {
		render(GridFixture);

		await tick();

		const entry = agent
			.snapshot()
			.find((component) => !component.offPage && component.label === "Dashboard");

		expect(entry?.component).toBe("grid");
		expect(entry?.actions).toEqual(["setLayout", "collapse", "expand", "resize"]);

		const result = await agent.act({
			steps: [
				{
					ref: entry!.ref,
					action: "setLayout",
					args: [{ columns: [25, 75] }],
				},
			],
		});

		expect(result.ok, result.error?.message).toBe(true);

		await tick();

		expect(document.getElementById("grid")!.style.gridTemplateColumns).toBe(
			"minmax(0, 25fr) minmax(0, 75fr)",
		);
	});
});
