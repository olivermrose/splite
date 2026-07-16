import { createContext } from "svelte";
import type { SpliteController } from "../controller.svelte.js";
import type { Pane } from "../pane.svelte.js";
import type { Rect, Side } from "../types.js";
import { clamp } from "../util.js";

const DRAG_THRESHOLD = 4;

interface DragCandidate {
	tabId: string;
	fromPane: Pane;
	x: number;
	y: number;
}

export type DropTarget =
	| { kind: "tab-bar"; paneId: string; index: number; indicator: Rect }
	| { kind: "zone"; paneId: string; side: Side | "center"; indicator: Rect };

export interface DragState {
	tabId: string;
	fromPane: Pane;
	x: number;
	y: number;
	target: DropTarget | null;
}

export interface SpliteViewProps {
	splite: SpliteController;
	tabBarHeight: number;
	middleClickClose: boolean;
	gap: number;
}

export class SpliteContext {
	readonly #props: Readonly<SpliteViewProps>;
	#dragCandidate: DragCandidate | null = null;

	public container = $state<HTMLElement>();

	public drag = $state<DragState | null>(null);
	public resizing = $state<{ splitId: string; index: number } | null>(null);

	public readonly panes = $derived(this.splite.panes);
	public readonly splits = $derived(this.splite.splits);

	public constructor(props: SpliteViewProps) {
		this.#props = props;
	}

	public get splite(): SpliteController {
		return this.#props.splite;
	}

	public get tabBarHeight(): number {
		return this.#props.tabBarHeight;
	}

	public get gap(): number {
		return this.#props.gap;
	}

	public onTabPointerDown = (event: MouseEvent, tabId: string, pane: Pane) => {
		if (event.button !== 0) return;

		this.splite.selectTab(tabId);
		this.#dragCandidate = { tabId, fromPane: pane, x: event.clientX, y: event.clientY };
	};

	public onTabAuxClick = (event: MouseEvent, tabId: string) => {
		if (this.#props.middleClickClose && event.button === 1) {
			event.preventDefault();
			this.splite.closeTab(tabId);
		}
	};

	public onResizerPointerDown = (event: PointerEvent, splitId: string, index: number) => {
		if (event.button !== 0) return;

		event.preventDefault();
		this.resizing = { splitId, index };
	};

	public onPointerMove = (event: PointerEvent) => {
		if (this.resizing) {
			this.#onResizeMove(event);
			return;
		}

		if (this.#dragCandidate && !this.drag) {
			const dx = event.clientX - this.#dragCandidate.x;
			const dy = event.clientY - this.#dragCandidate.y;

			if (dx * dx + dy * dy >= DRAG_THRESHOLD * DRAG_THRESHOLD) {
				this.drag = { ...this.#dragCandidate, target: null };
			}
		}

		if (this.drag) {
			this.drag.x = event.clientX;
			this.drag.y = event.clientY;
			this.drag.target = this.#hitTest(event.clientX, event.clientY);
		}
	};

	public onPointerUp = () => {
		if (this.resizing) {
			this.resizing = null;
			this.splite._resizeEnd();
			return;
		}

		if (this.drag?.target) {
			const { tabId, target } = this.drag;

			if (target.kind === "tab-bar") {
				this.splite.moveTab(tabId, target.paneId, target.index);
			} else if (target.side === "center") {
				this.splite.moveTab(tabId, target.paneId);
			} else {
				this.splite.splitPane(target.paneId, target.side, tabId);
			}
		}

		this.drag = null;
		this.#dragCandidate = null;
	};

	public onKeyDown = (event: KeyboardEvent) => {
		if (event.key === "Escape" && (this.drag || this.#dragCandidate)) {
			this.drag = null;
			this.#dragCandidate = null;
		}
	};

	public measurePaneRects = (): Map<string, Rect> => {
		const rects = new Map<string, Rect>();

		for (const pane of this.panes) {
			const rect = this.#nodeRect(pane.id);
			if (rect) rects.set(pane.id, rect);
		}

		return rects;
	};

	#nodeRect(id: string): Rect | null {
		const element = this.container?.querySelector(`[data-node-id="${id}"]`);
		if (!element || !this.container) return null;

		const bounds = this.container.getBoundingClientRect();
		const rect = element.getBoundingClientRect();

		return {
			x: rect.left - bounds.left,
			y: rect.top - bounds.top,
			width: rect.width,
			height: rect.height,
		};
	}

	#hitTest(clientX: number, clientY: number): DropTarget | null {
		if (!this.drag || !this.container) return null;

		const bounds = this.container.getBoundingClientRect();
		const x = clientX - bounds.left;
		const y = clientY - bounds.top;

		for (const pane of this.panes) {
			const rect = this.#nodeRect(pane.id);

			if (
				!rect ||
				x < rect.x ||
				x > rect.x + rect.width ||
				y < rect.y ||
				y > rect.y + rect.height
			) {
				continue;
			}

			if (y < rect.y + this.tabBarHeight) {
				return this.#tabBarTarget(pane, rect, clientX, bounds);
			}

			return this.#zoneTarget(pane, rect, clientX, clientY, bounds);
		}

		return null;
	}

	#tabBarTarget(pane: Pane, rect: Rect, clientX: number, bounds: DOMRect): DropTarget | null {
		const elements = this.container!.querySelectorAll<HTMLElement>(
			`[data-pane-id="${pane.id}"] .splite-tab`,
		);

		let index = pane.tabs.length;
		let indicatorX = rect.x;

		for (let i = 0; i < elements.length; i++) {
			const tabRect = elements[i].getBoundingClientRect();

			if (clientX < tabRect.left + tabRect.width / 2) {
				index = i;
				indicatorX = tabRect.left - bounds.left;
				break;
			}

			indicatorX = tabRect.right - bounds.left;
		}

		if (this.drag && pane === this.drag.fromPane) {
			const fromIndex = pane.tabs.indexOf(this.drag.tabId);

			if (index === fromIndex || index === fromIndex + 1) {
				return null;
			}
		}

		return {
			kind: "tab-bar",
			paneId: pane.id,
			index,
			indicator: {
				x: indicatorX - 1,
				y: rect.y,
				width: 2,
				height: this.tabBarHeight,
			},
		};
	}

	#zoneTarget(
		pane: Pane,
		rect: Rect,
		clientX: number,
		clientY: number,
		bounds: DOMRect,
	): DropTarget | null {
		if (!this.drag) return null;

		const body: Rect = {
			x: rect.x,
			y: rect.y + this.tabBarHeight,
			width: rect.width,
			height: rect.height - this.tabBarHeight,
		};

		const fx = clamp((clientX - bounds.left - body.x) / body.width, 0, 1);
		const fy = clamp((clientY - bounds.top - body.y) / body.height, 0, 1);

		const zoneAllowed = (horizontal: boolean): boolean => {
			const min = horizontal ? this.splite.minPaneWidth : this.splite.minPaneHeight;
			const orientation = horizontal ? "horizontal" : "vertical";

			const parent = this.splits.find((split) => split.children.includes(pane));

			if (parent?.orientation === orientation) {
				const parentRect = this.#nodeRect(parent.id);

				if (parentRect) {
					const extent = horizontal ? parentRect.width : parentRect.height;
					return extent >= (parent.children.length + 1) * min;
				}
			}

			const extent = horizontal ? rect.width : rect.height;
			return extent >= min * 2;
		};

		const horizontalAllowed = zoneAllowed(true);
		const verticalAllowed = zoneAllowed(false);

		let side: Side | "center" = "center";

		const edges = [
			{ side: "left", distance: fx, allowed: horizontalAllowed },
			{ side: "right", distance: 1 - fx, allowed: horizontalAllowed },
			{ side: "top", distance: fy, allowed: verticalAllowed },
			{ side: "bottom", distance: 1 - fy, allowed: verticalAllowed },
		] as const;

		const nearest = edges
			.filter((edge) => edge.allowed && edge.distance < 0.25)
			.sort((a, b) => a.distance - b.distance)[0];

		if (nearest) side = nearest.side;

		const isOwnPane = pane === this.drag.fromPane;

		if (isOwnPane && side === "center") return null;
		if (isOwnPane && pane.tabs.length === 1) return null;

		const indicator: Rect =
			side === "center"
				? body
				: side === "left"
					? { ...body, width: body.width / 2 }
					: side === "right"
						? { ...body, x: body.x + body.width / 2, width: body.width / 2 }
						: side === "top"
							? { ...body, height: body.height / 2 }
							: { ...body, y: body.y + body.height / 2, height: body.height / 2 };

		return { kind: "zone", paneId: pane.id, side, indicator };
	}

	#onResizeMove(event: PointerEvent) {
		if (!this.resizing || !this.container) return;

		const { splitId, index } = this.resizing;

		const split = this.splits.find((candidate) => candidate.id === splitId);
		const rect = this.#nodeRect(splitId);
		if (!split || !rect) return;

		const horizontal = split.orientation === "horizontal";

		const splitters = this.container.querySelectorAll<HTMLElement>(
			`.splite-splitter-track[data-split-id="${splitId}"]`,
		);

		let total = 0;
		let before = 0;

		for (const element of splitters) {
			const size = horizontal
				? element.getBoundingClientRect().width
				: element.getBoundingClientRect().height;
			const i = Number(element.dataset.splitterIndex);

			total += size;

			if (i < index) before += size;
			else if (i === index) before += size / 2;
		}

		const available = (horizontal ? rect.width : rect.height) - total;
		if (available <= 0) return;

		const bounds = this.container.getBoundingClientRect();
		const pointer = horizontal
			? event.clientX - bounds.left - rect.x
			: event.clientY - bounds.top - rect.y;

		this.splite.resize(splitId, index, (pointer - before) / available, available);
	}
}

export const [getSpliteContext, setSpliteContext] = createContext<SpliteContext>();

export function useSplite(): SpliteController {
	return getSpliteContext().splite;
}
