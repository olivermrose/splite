import { createContext } from "svelte";
// oxlint-disable-next-line no-unused-vars - used for jsdoc
import type { Grid } from "./index.ts";
import type { GridController } from "./types";

/**
 * The nearest {@linkcode Grid} returned by {@linkcode getParentGrid()}.
 */
export interface ParentGrid extends GridController {
	/**
	 * The id of the grid.
	 */
	readonly id: string;
}

export interface GridContext {
	/**
	 * The id of the grid.
	 */
	readonly id: string;

	/**
	 * The controller for the grid, which can be used to resize tracks and
	 * listen for layout changes.
	 */
	readonly controller: GridController;
}

export const [getGrid, setGrid] = createContext<GridContext>();

/**
 * Returns the id and the controller methods of the nearest {@linkcode Grid}.
 * Call it while a component inside the grid initializes.
 */
export function getParentGrid(): ParentGrid {
	const grid = getGrid();

	return {
		get id() {
			return grid.id;
		},
		getLayout: () => grid.controller.getLayout(),
		setLayout: (...args) => grid.controller.setLayout(...args),
		collapse: (...args) => grid.controller.collapse(...args),
		expand: (...args) => grid.controller.expand(...args),
		resize: (...args) => grid.controller.resize(...args),
		isCollapsed: (...args) => grid.controller.isCollapsed(...args),
		getSize: (...args) => grid.controller.getSize(...args),
	};
}
