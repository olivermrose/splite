import { render, screen } from "@testing-library/svelte";
import { describe, expect, test, vi } from "vite-plus/test";
import { drag, mouseUp } from "./mouse";
import BrowserFixture from "./fixtures/BrowserFixture.svelte";

const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
const width = (id: string) => document.getElementById(id)!.getBoundingClientRect().width;
const handle = (name = "Resize A") => screen.getByRole("separator", { name });

describe("in a browser", () => {
	test("dragging a separator resizes the panels beside it", async () => {
		render(BrowserFixture);

		await frame();

		expect(width("a")).toBeCloseTo(300, 0);

		await drag(handle(), 60, 0);
		await frame();

		expect(width("a")).toBeCloseTo(360, 0);
		expect(width("b")).toBeCloseTo(240, 0);
		expect(handle().hasAttribute("data-dragging")).toBe(false);
	});

	test("separator preview mode moves a preview and resizes on release", async () => {
		const onLayoutCommit = vi.fn();

		render(BrowserFixture, {
			group: { resizePreviewMode: "separator", onLayoutCommit },
		});

		await frame();
		await drag(handle(), 60, 0, { release: false });
		await frame();

		expect(width("a")).toBeCloseTo(300, 0);

		const preview = document.querySelector<HTMLElement>('[data-slot="resizable-preview"]');

		expect(preview).not.toBeNull();
		expect(preview!.hasAttribute("data-active")).toBe(true);
		expect(preview!.getBoundingClientRect().left).toBeCloseTo(
			handle().getBoundingClientRect().left + 60,
			0,
		);
		expect(preview!.firstElementChild?.getAttribute("role")).toBeNull();

		await mouseUp();
		await frame();

		expect(width("a")).toBeCloseTo(360, 0);
		expect(document.querySelector('[data-slot="resizable-preview"]')).toBeNull();
		expect(onLayoutCommit).toHaveBeenCalledOnce();
		expect(onLayoutCommit.mock.calls[0][1].reason).toBe("drag");
	});

	test("Escape drops a separator preview", async () => {
		render(BrowserFixture, { group: { resizePreviewMode: "separator" } });

		await frame();
		await drag(handle(), 60, 0, { release: false });
		await frame();

		const event = new KeyboardEvent("keydown", {
			key: "Escape",
			bubbles: true,
		});

		handle().dispatchEvent(event);

		await mouseUp();
		await frame();

		expect(width("a")).toBeCloseTo(300, 0);
		expect(document.querySelector('[data-slot="resizable-preview"]')).toBeNull();
	});

	test("previews show for separators a drag pushes along", async () => {
		render(BrowserFixture, {
			third: true,
			group: { resizePreviewMode: "separator" },
		});

		await frame();

		const before = handle("Resize B").getBoundingClientRect().left;

		await drag(handle(), 150, 0, { release: false });
		await frame();

		const previews = [
			...document.querySelectorAll<HTMLElement>('[data-slot="resizable-preview"]'),
		];

		expect(previews).toHaveLength(2);

		const pushed = previews.find((el) => !el.hasAttribute("data-active"))!;

		expect(pushed.getBoundingClientRect().left).toBeGreaterThan(before);

		await mouseUp();
	});

	test("onResize reports pixels", async () => {
		const onResize = vi.fn();

		render(BrowserFixture, {
			first: { onResize },
		});

		await frame();

		expect(onResize.mock.lastCall?.[1].pixels).toBeCloseTo(300, 0);
	});

	test("a preserve-pixel-size panel keeps its pixels as the group grows", async () => {
		const { rerender } = render(BrowserFixture, {
			first: { groupResizeBehavior: "preserve-pixel-size" },
		});

		await frame();

		expect(width("a")).toBeCloseTo(300, 0);

		await rerender({ width: 904, first: { groupResizeBehavior: "preserve-pixel-size" } });
		await frame();
		await frame();

		expect(width("a")).toBeCloseTo(300, 0);
		expect(width("b")).toBeCloseTo(600, 0);
	});

	test("a relative panel keeps its share as the group grows", async () => {
		const { rerender } = render(BrowserFixture);

		await frame();
		await rerender({ width: 904 });
		await frame();
		await frame();

		expect(width("a")).toBeCloseTo(450, 0);
	});
});
