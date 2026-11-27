import { createContext } from "svelte";
import type { GridController } from "./types";

/**
 * The nearest `Grid`, returned by {@linkcode getParentGrid()}.
 */
export interface ParentGrid extends GridController {
	/**
	 * The id of the grid.
	 */
	readonly id: string;
}

export interface GridContext {
	readonly id: string;
	readonly controller: GridController;
}

export const [getGrid, setGrid] = createContext<GridContext>();

/**
 * Returns the id and the controller methods of the nearest `Grid`. Call it
 * while a component inside the grid initializes.
 */
export function getParentGrid(): ParentGrid {
	const grid = getGrid();

	return {
		get id() {
			return grid.id;
		},
		...grid.controller,
	};
}
