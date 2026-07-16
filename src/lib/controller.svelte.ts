import { Pane } from "./pane.svelte.js";
import {
	deserializeNode,
	validateSnapshot,
	serializeNode,
	SNAPSHOT_VERSION,
	type LayoutSnapshot,
} from "./snapshot.js";
import { Split, type SplitNode } from "./split.svelte.js";
import type {
	Direction,
	Rect,
	Side,
	SpliteEventHandler,
	SpliteEvents,
	Tab,
	SpliteEventPayload,
} from "./types.js";
import { clamp, sum } from "./util.js";

type ListenerMap = Map<keyof SpliteEvents, Set<SpliteEventHandler<keyof SpliteEvents>>>;

export interface SpliteControllerOptions {
	/**
	 * A previously serialized layout to restore. If the snapshot is malformed
	 * or from an unsupported version, it will be ignored and a fresh layout
	 * will be created.
	 */
	snapshot?: LayoutSnapshot;

	/**
	 * Automatically close panes when they have no tabs.
	 *
	 * @default true
	 */
	collapseEmptyPanes?: boolean;

	/**
	 * Where {@link SpliteController.createTab createTab} inserts relative to the pane's
	 * tabs. `"before"`/`"after"` are relative to the selected tab.
	 *
	 * @default "after"
	 */
	newTabPosition?: "start" | "end" | "before" | "after";

	/**
	 * Minimum pane width in px.
	 *
	 * @default 240
	 */
	minPaneWidth?: number;

	/**
	 * Minimum pane height in px.
	 *
	 * @default 240
	 */
	minPaneHeight?: number;
}

export class SpliteController {
	readonly #options: Required<Omit<SpliteControllerOptions, "snapshot">>;

	#root = $state<SplitNode>()!;
	#focusedPaneId = $state("");

	#listeners: ListenerMap = new Map();
	#layoutChangeQueued = false;

	#measure: (() => Map<string, Rect>) | null = null;

	public constructor(options: SpliteControllerOptions = {}) {
		this.#options = {
			collapseEmptyPanes: options.collapseEmptyPanes ?? true,
			newTabPosition: options.newTabPosition ?? "after",
			minPaneWidth: options.minPaneWidth ?? 240,
			minPaneHeight: options.minPaneHeight ?? 240,
		};

		if (validateSnapshot(options.snapshot)) {
			this.#root = this.#canonicalize(deserializeNode(options.snapshot.root));
			this.#focusedPaneId =
				this.#findPane(options.snapshot.focused)?.id ?? this.#firstLeaf(this.#root).id;
		} else {
			this.#root = new Pane();
			this.#focusedPaneId = this.#root.id;
		}
	}

	/**
	 * The root node of the tree.
	 */
	public get root(): SplitNode {
		return this.#root;
	}

	public get minPaneWidth(): number {
		return this.#options.minPaneWidth;
	}

	public get minPaneHeight(): number {
		return this.#options.minPaneHeight;
	}

	/**
	 * The pane that currently has focus. If the pane was removed, this falls
	 * back to the first leaf in the tree.
	 */
	public get focusedPane(): Pane {
		return this.#findPane(this.#focusedPaneId) ?? this.#firstLeaf(this.#root);
	}

	/**
	 * The list of panes in the tree in depth-first order.
	 */
	public get panes(): Pane[] {
		const out: Pane[] = [];

		this.#walk(this.#root, (node) => {
			if (node instanceof Pane) out.push(node);
		});

		return out;
	}

	/**
	 * The list of splits in the tree in depth-first order.
	 */
	public get splits(): Split[] {
		const out: Split[] = [];

		this.#walk(this.#root, (node) => {
			if (node instanceof Split) out.push(node);
		});

		return out;
	}

	public on<K extends keyof SpliteEvents>(type: K, handler: SpliteEventHandler<K>): () => void {
		type Handler = SpliteEventHandler<keyof SpliteEvents>;

		let handlers = this.#listeners.get(type);

		if (!handlers) {
			handlers = new Set();
			this.#listeners.set(type, handlers);
		}

		handlers.add(handler as Handler);

		return () => handlers.delete(handler as Handler);
	}

	/**
	 * Returns the pane and index of a tab or `null` if the tab does not exist.
	 */
	public findTab(id: string): Tab | null {
		for (const pane of this.panes) {
			const index = pane.tabs.indexOf(id);

			if (index !== -1) {
				return { pane, index };
			}
		}

		return null;
	}

	/**
	 * Adds a tab with the provided `id`. If no `paneId` is provided, the tab is
	 * added to the {@linkcode focusedPane}.
	 *
	 * @returns A boolean indicating if the tab was created
	 */
	public createTab(id: string, paneId?: string): boolean {
		if (this.findTab(id)) {
			console.warn(`[splite] tab id "${id}" already exists, skipping tab creation`);
			return false;
		}

		const pane = paneId ? this.#findPane(paneId) : this.focusedPane;
		if (!pane) return false;

		if (!this.#emit("tabCreate", { tabId: id, paneId: pane.id }, true)) {
			return false;
		}

		let index = pane.tabs.length;

		switch (this.#options.newTabPosition) {
			case "start": {
				index = 0;
				break;
			}

			case "before":
			case "after": {
				const selectedIndex = pane.selected ? pane.tabs.indexOf(pane.selected) : -1;

				if (selectedIndex !== -1) {
					index = selectedIndex + (this.#options.newTabPosition === "after" ? 1 : 0);
				}

				break;
			}
		}

		pane.insertTab(id, index);
		this.focusPane(pane.id);

		this.#emit("tabSelect", { tabId: id, paneId: pane.id });

		return true;
	}

	/**
	 * Closes a tab with the provided `id`. If the tab is the last in its pane,
	 * the pane is collapsed.
	 *
	 * @returns A boolean indicating if the tab was closed
	 */
	public closeTab(id: string): boolean {
		const found = this.findTab(id);
		if (!found) return false;

		if (!this.#emit("tabClose", { tabId: id, paneId: found.pane.id }, true)) {
			return false;
		}

		found.pane.removeTab(id);

		if (found.pane.tabs.length === 0 && this.#options.collapseEmptyPanes) {
			this.#collapse(found.pane);
		}

		return true;
	}

	/**
	 * Selects a tab and focuses its pane.
	 */
	public selectTab(id: string) {
		const found = this.findTab(id);
		if (!found) return;

		const changed = found.pane.selected !== id;
		found.pane.selectTab(id);
		this.focusPane(found.pane.id);

		if (changed) {
			this.#emit("tabSelect", { tabId: id, paneId: found.pane.id });
		}
	}

	/**
	 * Selects the previous tab in the focused pane, wrapping to the end if
	 * necessary.
	 */
	public selectPreviousTab() {
		this.#selectSibling(-1);
	}

	/**
	 * Selects the next tab in the focused pane, wrapping to the start if
	 * necessary.
	 */
	public selectNextTab() {
		this.#selectSibling(1);
	}

	/**
	 * Focuses a pane by the provided `id` if it exists.
	 */
	public focusPane(id: string) {
		if (this.#focusedPaneId === id || !this.#findPane(id)) return;

		this.#focusedPaneId = id;
		this.#emit("paneFocus", { paneId: id });
	}

	/**
	 * Moves focus to the spatially nearest pane in the given direction.
	 */
	public navigateFocus(direction: Direction) {
		const rects = this.#measure?.() ?? this.#modelRects();
		const from = rects.get(this.focusedPane.id);
		if (!from) return;

		const cx = from.x + from.width / 2;
		const cy = from.y + from.height / 2;
		const epsilon = 1e-6;

		let best: Pane | null = null;
		let bestDistance = Infinity;

		for (const pane of this.panes) {
			if (pane.id === this.focusedPane.id) continue;

			const rect = rects.get(pane.id);
			if (!rect) continue;

			const beyond =
				direction === "left"
					? rect.x + rect.width <= from.x + epsilon
					: direction === "right"
						? rect.x >= from.x + from.width - epsilon
						: direction === "up"
							? rect.y + rect.height <= from.y + epsilon
							: rect.y >= from.y + from.height - epsilon;

			if (!beyond) continue;

			const dx = rect.x + rect.width / 2 - cx;
			const dy = rect.y + rect.height / 2 - cy;
			const distance = dx * dx + dy * dy;

			if (distance < bestDistance) {
				bestDistance = distance;
				best = pane;
			}
		}

		if (best) {
			this.focusPane(best.id);
		}
	}

	/**
	 * Splits a pane, placing a new pane on the given side. When `tabId` is
	 * provided the tab moves into the new pane; otherwise the new pane starts
	 * empty.
	 *
	 * @returns The id of the new pane or `null` if the operation was canceled
	 * or invalid
	 */
	public splitPane(paneId: string, side: Side, tabId?: string): string | null {
		const pane = this.#findPane(paneId);
		if (!pane) return null;

		if (tabId) {
			const found = this.findTab(tabId);
			if (!found) return null;

			// Splitting a pane with its own only tab would immediately collapse.
			if (found.pane === pane && pane.tabs.length === 1) {
				return null;
			}
		}

		const newPane = new Pane();
		const before = side === "left" || side === "top";
		const orientation = side === "left" || side === "right" ? "horizontal" : "vertical";

		// When the pane already lives in a split with the same orientation, the
		// new pane is spliced in as a sibling instead of nesting a new split.
		const parent = this.#findParent(pane);
		const target = parent?.orientation === orientation ? parent : null;

		const split =
			target ??
			new Split({
				orientation,
				children: before ? [newPane, pane] : [pane, newPane],
			});

		const allowed = this.#emit(
			"paneSplit",
			{
				splitId: split.id,
				paneId: pane.id,
				newPaneId: newPane.id,
				orientation,
				side,
				tabId,
			},
			true,
		);

		if (!allowed) return null;

		if (target) {
			// The new pane takes half of the split pane's weight.
			const index = target.children.indexOf(pane);
			const weight = target.weights[index] / 2;

			target.weights[index] = weight;
			target.children.splice(before ? index : index + 1, 0, newPane);
			target.weights.splice(before ? index : index + 1, 0, weight);
		} else {
			this.#replaceNode(pane, split);
		}

		this.#root = this.#canonicalize(this.#root);

		if (tabId) {
			this.moveTab(tabId, newPane.id);
		} else {
			this.focusPane(newPane.id);
		}

		return newPane.id;
	}

	/**
	 * Moves a tab to a pane (or reorders within its pane). Collapses the
	 * source pane if the move empties it.
	 */
	public moveTab(id: string, paneId: string, index?: number) {
		const found = this.findTab(id);
		const target = this.#findPane(paneId);
		if (!found || !target) return;

		const { pane: source, index: fromIndex } = found;

		let toIndex: number;

		if (source === target) {
			// index is relative to the list before removal
			let insertion = clamp(index ?? source.tabs.length, 0, source.tabs.length);
			if (insertion === fromIndex || insertion === fromIndex + 1) return;

			source.tabs.splice(fromIndex, 1);
			if (insertion > fromIndex) insertion--;

			source.tabs.splice(insertion, 0, id);
			source.selected = id;

			toIndex = insertion;
		} else {
			source.removeTab(id);
			toIndex = clamp(index ?? target.tabs.length, 0, target.tabs.length);
			target.insertTab(id, toIndex);
		}

		this.focusPane(target.id);
		this.#emit("tabMove", {
			tabId: id,
			from: { paneId: source.id, index: fromIndex },
			to: { paneId: target.id, index: toIndex },
		});

		if (source !== target && source.tabs.length === 0 && this.#options.collapseEmptyPanes) {
			this.#collapse(source);
		}
	}

	/**
	 * Closes a pane with the provided `id`. If the pane has tabs, they are
	 * closed first.
	 *
	 * @returns A boolean indicating if the pane was closed
	 */
	public closePane(id: string): boolean {
		const pane = this.#findPane(id);
		if (!pane) return false;

		if (!this.#emit("paneClose", { paneId: pane.id, reason: "close" }, true)) {
			return false;
		}

		// Copy: pane.tabs is mutated while iterating.
		const tabs = [...pane.tabs];

		for (const tabId of tabs) {
			if (!this.#emit("tabClose", { tabId, paneId: pane.id }, true)) {
				continue;
			}

			pane.removeTab(tabId);
		}

		if (pane.tabs.length > 0) return false;

		// The cancelable paneClose already fired above.
		this.#collapse(pane, false);
		return true;
	}

	/**
	 * Moves a split's splitter.
	 *
	 * @param index The splitter between children at `index` and `index + 1`
	 * @param position The splitter's target position as a fraction (0–1) of the
	 * split's extent
	 */
	public resize(splitId: string, index: number, position: number, extent?: number) {
		const split = this.splits.find((s) => s.id === splitId);
		if (!split || index < 0 || index >= split.children.length - 1) return;

		const total = sum(split.weights) || 1;
		const sizes = split.weights.map((weight) => weight / total);

		// Minimum child size as a fraction of the pane-available extent.
		// Without a measurement the minimum cannot be expressed in px, so it
		// is 0.
		let min = 0;

		if (extent !== undefined && extent > 0) {
			const minSize =
				split.orientation === "horizontal"
					? this.#options.minPaneWidth
					: this.#options.minPaneHeight;

			min = Math.min(minSize / extent, 1 / split.children.length);
		}

		let current = 0;

		for (let i = 0; i <= index; i++) {
			current += sizes[i];
		}

		const delta = clamp(position, 0, 1) - current;
		if (delta === 0) return;

		// Children on the shrinking side, ordered nearest-first from the
		// divider, and the single child that takes the recovered space.
		const shrink: number[] = [];
		let grow: number;

		if (delta > 0) {
			for (let i = index + 1; i < split.children.length; i++) shrink.push(i);
			grow = index;
		} else {
			for (let i = index; i >= 0; i--) shrink.push(i);
			grow = index + 1;
		}

		let remaining = Math.abs(delta);
		let recovered = 0;

		for (const i of shrink) {
			const available = Math.max(0, sizes[i] - min);
			const taken = Math.min(available, remaining);

			sizes[i] -= taken;
			recovered += taken;
			remaining -= taken;

			if (remaining <= 0) break;
		}

		if (recovered === 0) return;

		sizes[grow] += recovered;
		split.weights = sizes.map((size) => size * total);
	}

	/**
	 * Serializes the current layout into a snapshot that can be restored later.
	 */
	public toJSON(): LayoutSnapshot {
		return {
			version: SNAPSHOT_VERSION,
			focused: this.#focusedPaneId,
			root: serializeNode(this.#root),
		};
	}

	/**
	 * @internal
	 */
	public _setMeasurer(measure: (() => Map<string, Rect>) | null) {
		this.#measure = measure;
	}

	/**
	 * @internal
	 */
	public _resizeEnd() {
		this.#emit("layoutChange", { splite: this });
	}

	#handlers<K extends keyof SpliteEvents>(type: K) {
		// Copy: a handler may unsubscribe during dispatch
		return [...(this.#listeners.get(type) ?? [])] as SpliteEventHandler<K>[];
	}

	#createEvent<K extends keyof SpliteEvents>(
		payload: SpliteEventPayload<K>,
		cancelable: boolean,
	): SpliteEvents[K] {
		let prevented = false;

		return {
			...payload,
			cancelable,
			preventDefault() {
				if (cancelable) prevented = true;
			},
			get defaultPrevented() {
				return prevented;
			},
		} as SpliteEvents[K];
	}

	#dispatch<K extends keyof SpliteEvents>(type: K, event: SpliteEvents[K]) {
		for (const handler of this.#handlers(type)) {
			handler(event);
		}
	}

	#emit<K extends keyof SpliteEvents>(
		type: K,
		payload: SpliteEventPayload<K>,
		cancelable = false,
	): boolean {
		const event = this.#createEvent<K>(payload, cancelable);
		this.#dispatch(type, event);

		if (event.defaultPrevented) return false;

		if (type !== "layoutChange" && type !== "paneFocus" && !this.#layoutChangeQueued) {
			this.#layoutChangeQueued = true;

			queueMicrotask(() => {
				this.#layoutChangeQueued = false;
				this.#emit("layoutChange", { splite: this });
			});
		}

		return true;
	}

	#selectSibling(offset: number) {
		const pane = this.focusedPane;
		if (pane.tabs.length === 0 || !pane.selected) return;

		const index = pane.tabs.indexOf(pane.selected);
		const next = pane.tabs[(index + offset + pane.tabs.length) % pane.tabs.length];

		if (next !== pane.selected) {
			pane.selected = next;
			this.#emit("tabSelect", { tabId: next, paneId: pane.id });
		}
	}

	#walk(node: SplitNode, visit: (node: SplitNode) => void) {
		visit(node);

		if (node instanceof Split) {
			for (const child of node.children) {
				this.#walk(child, visit);
			}
		}
	}

	#firstLeaf(node: SplitNode): Pane {
		return node instanceof Pane ? node : this.#firstLeaf(node.children[0]);
	}

	#findPane(id: string): Pane | null {
		let found: Pane | null = null;

		this.#walk(this.#root, (node) => {
			if (node instanceof Pane && node.id === id) found = node;
		});

		return found;
	}

	#findParent(target: SplitNode): Split | null {
		let found: Split | null = null;

		this.#walk(this.#root, (node) => {
			if (node instanceof Split && node.children.includes(target)) {
				found = node;
			}
		});

		return found;
	}

	#replaceNode(target: SplitNode, replacement: SplitNode) {
		if (this.#root === target) {
			this.#root = replacement;
			return;
		}

		const parent = this.#findParent(target);
		if (!parent) return;

		const index = parent.children.indexOf(target);
		parent.children[index] = replacement;
	}

	#collapse(pane: Pane, notify = true) {
		if (this.#root === pane) return;

		const parent = this.#findParent(pane);
		if (!parent) return;

		const index = parent.children.indexOf(pane);

		// Splicing the child out preserves the remaining siblings' proportions
		// because weights are relative.
		parent.children.splice(index, 1);
		parent.weights.splice(index, 1);

		const sibling = parent.children[Math.min(index, parent.children.length - 1)];

		if (parent.children.length === 1) {
			this.#replaceNode(parent, parent.children[0]);
		}

		this.#root = this.#canonicalize(this.#root);

		if (notify) {
			this.#emit("paneClose", { paneId: pane.id, reason: "collapse" });
		}

		if (this.#focusedPaneId === pane.id) {
			this.focusPane(this.#firstLeaf(sibling).id);
		}
	}

	#canonicalize(node: SplitNode): SplitNode {
		if (node instanceof Pane) return node;

		const children: SplitNode[] = [];
		const weights: number[] = [];
		const total = sum(node.weights) || 1;

		for (let i = 0; i < node.children.length; i++) {
			const child = this.#canonicalize(node.children[i]);
			const weight = (node.weights[i] ?? 1) / total;

			if (child instanceof Split && child.orientation === node.orientation) {
				const childTotal = sum(child.weights) || 1;

				for (let j = 0; j < child.children.length; j++) {
					children.push(child.children[j]);
					weights.push((child.weights[j] / childTotal) * weight);
				}
			} else {
				children.push(child);
				weights.push(weight);
			}
		}

		if (children.length === 1) return children[0];

		node.children = children;
		node.weights = weights;

		return node;
	}

	/**
	 * Normalized (0–1) rectangles for every node in the tree, computed from
	 * cumulative weights.
	 *
	 * Used as a fallback so {@linkcode navigateFocus} still works headless.
	 */
	#modelRects(): Map<string, Rect> {
		const map = new Map<string, Rect>();

		const walk = (node: SplitNode, rect: Rect) => {
			map.set(node.id, rect);

			if (node instanceof Split) {
				const { x, y, width, height } = rect;
				const total = sum(node.weights) || 1;

				let offset = 0;

				for (let i = 0; i < node.children.length; i++) {
					const fraction = node.weights[i] / total;

					if (node.orientation === "horizontal") {
						walk(node.children[i], {
							x: x + offset * width,
							y,
							width: fraction * width,
							height,
						});
					} else {
						walk(node.children[i], {
							x,
							y: y + offset * height,
							width,
							height: fraction * height,
						});
					}

					offset += fraction;
				}
			}
		};

		walk(this.#root, { x: 0, y: 0, width: 1, height: 1 });

		return map;
	}
}
