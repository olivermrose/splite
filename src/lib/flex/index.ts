import Group from "./Group.svelte";
import Panel from "./Panel.svelte";
import Separator from "./Separator.svelte";

export { Group, Panel, Separator };

export * from "./Group.svelte";
export * from "./Panel.svelte";
export * from "./Separator.svelte";

export {
	createResizableController as createGroupController,
	resizableStorageKey as groupStorageKey,
} from "@ui-sdk/svelte/resizable";

export type {
	ResizableController as GroupController,
	ResizableLayoutChangeDetails as LayoutChangeDetails,
	ResizableLayoutChangeReason as LayoutChangeReason,
	ResizableLayoutCommitDetails as LayoutCommitDetails,
	ResizableSize as PanelSizeValue,
	ResizableStorage as LayoutStorage,
} from "@ui-sdk/svelte/resizable";

export type {
	Orientation,
	PanelSize,
	ParentGroup,
	ParentPanel,
	SeparatorPreview,
	SeparatorPreviewState,
} from "./types";

export { getParentGroup, getParentPanel } from "./context";
