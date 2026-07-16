import type { Pane } from "./pane.svelte.js";
import type { SplitOrientation } from "./types.js";
import { uid } from "./util.js";

export type SplitNode = Split | Pane;

export interface SplitInit {
	id?: string;
	orientation: SplitOrientation;
	children: SplitNode[];
	weights?: number[];
}

export class Split {
	/**
	 * The id of the split.
	 */
	public readonly id: string;

	/**
	 * The axis the children are laid out along.
	 */
	public readonly orientation: SplitOrientation;

	/**
	 * The children of the split, in layout order.
	 */
	public children = $state<SplitNode[]>([]);

	/**
	 * The relative share of space given to each child.
	 */
	public weights = $state<number[]>([]);

	public constructor(init: SplitInit) {
		this.id = init.id ?? uid("split");
		this.orientation = init.orientation;

		this.children = [...init.children];
		this.weights = init.weights ? [...init.weights] : init.children.map(() => 1);
	}
}
