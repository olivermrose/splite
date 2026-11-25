import { fireEvent, render, screen } from "@testing-library/svelte";
import { describe, expect, test, vi } from "vite-plus/test";
import type { LayoutCommitDetails } from "#lib";
import type { ParentGroup } from "#lib/flex/types.ts";
import Fixture from "./fixtures/Fixture.svelte";

function tick() {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

function separator() {
	return screen.getByRole("separator", { name: "Resize files" });
}

function size(id: string) {
	return document.getElementById(id)!.style.getPropertyValue("--resizable-panel-size");
}

async function press(el: HTMLElement, key: string) {
	el.focus();

	await fireEvent.keyDown(el, { key });
	await fireEvent.keyUp(el, { key });
}

describe("Group, Panel and Separator", () => {
	test("render ui-sdk's resizable parts with the given ids", async () => {
		render(Fixture);

		await tick();
		const root = document.getElementById("group")!;

		expect(root.dataset.slot).toBe("resizable");
		expect(document.getElementById("files")!.dataset.slot).toBe("resizable-panel");
		expect(separator().dataset.slot).toBe("resizable-handle");
		expect(separator().getAttribute("aria-controls")).toBe("files");
		expect(separator().getAttribute("aria-valuenow")).toBe("30");
		expect(size("files")).toBe("30%");
		expect(size("editor")).toBe("70%");
	});

	test("arrow keys resize, and bind:layout and onLayoutCommit follow", async () => {
		const commits: [number[], string][] = [];

		render(Fixture, {
			group: {
				onLayoutCommit(layout: number[], details: LayoutCommitDetails) {
					commits.push([layout, details.reason]);
				},
			},
		});

		await tick();
		await press(separator(), "ArrowRight");

		expect(size("files")).toBe("31%");
		expect(screen.getByTestId("layout").textContent).toBe("31,69");
		expect(commits).toEqual([[[31, 69], "step-key"]]);
	});

	test("a double-click collapses the panel unless disableDoubleClick is set", async () => {
		const { unmount } = render(Fixture);

		await tick();
		await fireEvent.dblClick(separator());

		expect(size("files")).toBe("0%");
		unmount();

		render(Fixture, { separator: { disableDoubleClick: true } });

		await tick();
		await fireEvent.dblClick(separator());

		expect(size("files")).toBe("30%");
	});

	test("a user's dblclick handler still runs with disableDoubleClick", async () => {
		const ondblclick = vi.fn();

		render(Fixture, {
			separator: {
				disableDoubleClick: true,
				ondblclick,
			},
		});

		await tick();
		await fireEvent.dblClick(separator());

		expect(ondblclick).toHaveBeenCalledOnce();
	});

	test("a disabled panel keeps its size", async () => {
		render(Fixture, { first: { disabled: true } });

		await tick();
		await press(separator(), "ArrowRight");
		await press(separator(), "Home");

		expect(size("files")).toBe("30%");
	});

	test("getParentPanel and getParentGroup reach the panel and its group", async () => {
		let group: ParentGroup | undefined;

		render(Fixture, {
			onGroup: (parent: ParentGroup) => (group = parent),
		});

		await tick();

		expect(group?.id).toBe("group");
		expect(group?.orientation).toBe("horizontal");
		expect(group?.getLayout()).toEqual([30, 70]);

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Collapse files in group",
			}),
		);

		expect(size("files")).toBe("0%");

		await fireEvent.click(
			screen.getByRole("button", {
				name: "Half",
			}),
		);

		expect(size("files")).toBe("50%");
		expect(group?.setLayout([20, 80])).toBe(true);
		expect(size("files")).toBe("20%");
	});

	test("onResize runs on mount and after each change", async () => {
		const onResize = vi.fn();

		render(Fixture, { onResize });

		await tick();

		expect(onResize).toHaveBeenLastCalledWith(
			"files",
			{ percentage: 30, pixels: 0 },
			undefined,
		);

		await press(separator(), "ArrowRight");
		await tick();

		expect(onResize).toHaveBeenLastCalledWith(
			"files",
			{ percentage: 31, pixels: 0 },
			{ percentage: 30, pixels: 0 },
		);

		expect(onResize).toHaveBeenCalledTimes(2);
	});

	test("separator preview mode holds a drag back until it ends", async () => {
		const commits: string[] = [];
		let group: ParentGroup | undefined;

		render(Fixture, {
			group: {
				resizePreviewMode: "separator",
				onLayoutCommit(_layout: number[], details: LayoutCommitDetails) {
					commits.push(details.reason);
				},
			},
			onGroup: (parent: ParentGroup) => (group = parent),
		});

		await tick();
		expect(document.getElementById("group")!.style.position).toBe("relative");

		const root = document.getElementById("group")!;

		async function drag(layout: number[], end: () => unknown) {
			root.setAttribute("data-dragging", "");

			group!.setLayout(layout, {
				reason: "drag",
				event: new PointerEvent("pointermove"),
			});

			await end();

			root.removeAttribute("data-dragging");
			await tick();
		}

		await drag([40, 60], () => expect(size("files")).toBe("30%"));

		expect(size("files")).toBe("40%");
		expect(commits).toEqual(["drag"]);

		await drag([45, 55], () => fireEvent.keyDown(window, { key: "Escape" }));

		expect(size("files")).toBe("40%");
	});

	test("keys still resize at once in separator preview mode", async () => {
		render(Fixture, {
			group: { resizePreviewMode: "separator" },
		});

		await tick();
		await press(separator(), "ArrowRight");

		expect(size("files")).toBe("31%");
	});
});
