import type { ResizableController } from "@ui-sdk/svelte/resizable";
import { createContext } from "svelte";
import type { Orientation, ParentGroup, ParentPanel, SeparatorPreview } from "./types";

export interface GroupContext {
	/**
	 * The id of the group.
	 */
	readonly id: string;

	/**
	 * The orientation of the group.
	 */
	readonly orientation: Orientation;

	/**
	 * The controller for the group, which can be used to resize panels and
	 * listen for layout changes.
	 */
	readonly controller: ResizableController;

	/**
	 * Registers a preview snippet for a separator by its id.
	 */
	registerPreview: (
		separatorId: string,
		preview: () => SeparatorPreview | undefined,
	) => () => void;
}

export const [getGroup, setGroup] = createContext<GroupContext>();
export const [getPanel, setPanel] = createContext<ParentPanel>();

export function getParentGroup(): ParentGroup {
	const group = getGroup();

	return {
		...group.controller,
		get id() {
			return group.id;
		},
		get orientation() {
			return group.orientation;
		},
	};
}

export function getParentPanel(): ParentPanel {
	return getPanel();
}
