import { describe, expect, it } from "vite-plus/test";
import { SpliteController } from "./controller.svelte.js";
import type { LayoutSnapshot } from "./snapshot.js";
import { Split } from "./split.svelte.js";
import type { Rect } from "./types.js";

function rootShares(splite: SpliteController): number[] {
	const root = splite.root as Split;
	const total = root.weights.reduce((sum, weight) => sum + weight, 0) || 1;

	return root.weights.map((weight) => weight / total);
}

function threePanesAcross(options?: ConstructorParameters<typeof SpliteController>[0]) {
	const splite = new SpliteController(options);

	splite.createTab("a");

	const second = splite.splitPane(splite.panes[0].id, "right")!;
	splite.createTab("b", second);

	const third = splite.splitPane(second, "right")!;
	splite.createTab("c", third);

	return splite;
}

describe("SpliteController options", () => {
	it("applies default options", () => {
		const splite = new SpliteController();

		expect(splite.minPaneWidth).toBe(240);
		expect(splite.minPaneHeight).toBe(240);

		splite.createTab("a");
		splite.createTab("b");

		const newPaneId = splite.splitPane(splite.focusedPane.id, "right", "b");
		expect(newPaneId).not.toBeNull();
		expect(splite.panes).toHaveLength(2);

		splite.closeTab("b");
		expect(splite.panes).toHaveLength(1);
	});

	it("inserts new tabs after the selected tab by default", () => {
		const splite = new SpliteController();

		splite.createTab("a");
		splite.createTab("b");
		splite.selectTab("a");
		splite.createTab("c");

		expect(splite.focusedPane.tabs).toEqual(["a", "c", "b"]);
	});

	it("keeps empty panes when collapseEmptyPanes is false", () => {
		const splite = new SpliteController({ collapseEmptyPanes: false });

		splite.createTab("a");
		splite.createTab("b");
		splite.splitPane(splite.focusedPane.id, "right", "b");
		splite.closeTab("b");

		expect(splite.panes).toHaveLength(2);
	});
});

describe("n-ary splits", () => {
	it("splices new panes into a same-orientation split instead of nesting", () => {
		const splite = threePanesAcross();

		expect(splite.root).toBeInstanceOf(Split);

		const root = splite.root as Split;
		expect(root.children).toHaveLength(3);
		expect(root.children.every((child) => !(child instanceof Split))).toBe(true);

		// The new pane takes half of the split pane's share.
		const shares = rootShares(splite);
		expect(shares[0]).toBeCloseTo(0.5);
		expect(shares[1]).toBeCloseTo(0.25);
		expect(shares[2]).toBeCloseTo(0.25);
	});

	it("preserves sibling proportions when a middle pane is spliced out", () => {
		const splite = threePanesAcross();
		const middle = splite.panes[1];

		expect(splite.closePane(middle.id)).toBe(true);
		expect(splite.panes).toHaveLength(2);

		// 0.5 : 0.25 renormalizes to 2/3 : 1/3.
		const shares = rootShares(splite);
		expect(shares[0]).toBeCloseTo(2 / 3);
		expect(shares[1]).toBeCloseTo(1 / 3);
	});

	it("merges same-orientation splits when a collapse unwraps a shell", () => {
		const splite = new SpliteController();

		splite.createTab("a");
		const paneA = splite.panes[0];

		const paneB = splite.splitPane(paneA.id, "right")!;
		splite.createTab("b", paneB);

		const paneC = splite.splitPane(paneB, "bottom")!;
		splite.createTab("c", paneC);

		const paneD = splite.splitPane(paneB, "right")!;
		splite.createTab("d", paneD);

		// root = H[A, V[H[B, D], C]]; closing C unwraps the vertical shell and
		// the two horizontal splits merge into one flat 3-child split.
		expect(splite.closePane(paneC)).toBe(true);

		const root = splite.root as Split;
		expect(root).toBeInstanceOf(Split);
		expect(root.orientation).toBe("horizontal");
		expect(root.children).toHaveLength(3);
		expect(splite.panes.map((pane) => pane.id)).toEqual([paneA.id, paneB, paneD]);
	});
});

describe("resize", () => {
	it("cascades shrinking through siblings and respects minPaneWidth with a measured extent", () => {
		// The view passes the split's pane-available extent (split px minus
		// total splitter px) measured from the DOM.
		const splite = threePanesAcross({ minPaneWidth: 100 });

		const root = splite.root as Split;
		root.weights = [1, 1, 1];

		// Dragging the first divider far right: only the adjacent left child
		// grows, the others cascade down to the 100px minimum.
		splite.resize(root.id, 0, 0.95, 1000);

		const shares = rootShares(splite);
		expect(shares[0]).toBeCloseTo(0.8);
		expect(shares[1]).toBeCloseTo(0.1);
		expect(shares[2]).toBeCloseTo(0.1);
	});

	it("resizes without a measured extent using a zero minimum", () => {
		const splite = threePanesAcross();

		const root = splite.root as Split;
		root.weights = [1, 1, 1];

		splite.resize(root.id, 1, 0.5);

		const shares = rootShares(splite);
		expect(shares[0]).toBeCloseTo(1 / 3);
		expect(shares[1]).toBeCloseTo(0.5 - 1 / 3);
		expect(shares[2]).toBeCloseTo(0.5);
	});
});

describe("navigateFocus", () => {
	it("falls back to weight-derived rects without a measurer", () => {
		const splite = threePanesAcross();
		const [first, second, third] = splite.panes;

		splite.focusPane(first.id);
		splite.navigateFocus("right");
		expect(splite.focusedPane.id).toBe(second.id);

		splite.navigateFocus("right");
		expect(splite.focusedPane.id).toBe(third.id);

		splite.navigateFocus("left");
		expect(splite.focusedPane.id).toBe(second.id);

		// No pane above.
		splite.navigateFocus("up");
		expect(splite.focusedPane.id).toBe(second.id);
	});

	it("uses measured DOM rects when a measurer is registered", () => {
		const splite = threePanesAcross();
		const [first, second, third] = splite.panes;

		// A measurer reporting geometry that contradicts the weight model:
		// the third pane sits to the left of the first.
		const rects = new Map<string, Rect>([
			[first.id, { x: 400, y: 0, width: 400, height: 600 }],
			[second.id, { x: 800, y: 0, width: 400, height: 600 }],
			[third.id, { x: 0, y: 0, width: 400, height: 600 }],
		]);

		splite._setMeasurer(() => rects);

		splite.focusPane(first.id);
		splite.navigateFocus("left");
		expect(splite.focusedPane.id).toBe(third.id);

		// Unregistering restores the model fallback, where the third pane is
		// rightmost and the second pane is its left neighbor.
		splite._setMeasurer(null);
		splite.navigateFocus("left");
		expect(splite.focusedPane.id).toBe(second.id);
	});
});

describe("snapshots", () => {
	it("round-trips a v1 snapshot", () => {
		const splite = threePanesAcross();
		splite.selectTab("a");

		const snapshot = splite.toJSON();
		expect(snapshot.version).toBe(1);
		expect(snapshot.root.type).toBe("split");

		const restored = new SpliteController({ snapshot });

		expect(restored.focusedPane.id).toBe(splite.focusedPane.id);
		expect(restored.panes.map((pane) => pane.id)).toEqual(splite.panes.map((pane) => pane.id));
		expect(restored.panes.map((pane) => pane.tabs)).toEqual([["a"], ["b"], ["c"]]);
		expect(rootShares(restored)).toEqual(rootShares(splite));
	});

	it("ignores non-v1 snapshots", () => {
		const snapshot = {
			version: 2,
			focused: "pane:invalid",
			root: { type: "pane", id: "pane:invalid", tabs: ["a"], selected: "a" },
		} as unknown as LayoutSnapshot;

		const splite = new SpliteController({ snapshot });

		expect(splite.panes).toHaveLength(1);
		expect(splite.panes[0].tabs).toEqual([]);
	});
});
