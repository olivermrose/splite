import type { SplitOrientation } from "./index.js";
import { Pane } from "./pane.svelte.js";
import { type SplitNode, Split } from "./split.svelte.js";

export interface PaneSnapshot {
	type: "pane";
	id: string;
	tabs: string[];
	selected: string | null;
}

export interface SplitSnapshot {
	type: "split";
	id: string;
	orientation: SplitOrientation;
	children: NodeSnapshot[];
	weights: number[];
}

export type NodeSnapshot = PaneSnapshot | SplitSnapshot;

export interface LayoutSnapshot {
	readonly version: 1;
	focused: string;
	root: NodeSnapshot;
}

export const SNAPSHOT_VERSION = 1;

export function serializeNode(node: SplitNode): NodeSnapshot {
	if (node instanceof Pane) {
		return {
			type: "pane",
			id: node.id,
			tabs: [...node.tabs],
			selected: node.selected,
		};
	}

	return {
		type: "split",
		id: node.id,
		orientation: node.orientation,
		children: node.children.map(serializeNode),
		weights: [...node.weights],
	};
}

export function deserializeNode(snapshot: NodeSnapshot): SplitNode {
	if (snapshot.type === "pane") {
		return new Pane({
			id: snapshot.id,
			tabs: snapshot.tabs,
			selected: snapshot.selected,
		});
	}

	return new Split({
		id: snapshot.id,
		orientation: snapshot.orientation,
		children: snapshot.children.map(deserializeNode),
		weights: snapshot.weights,
	});
}

export function validateSnapshot(snapshot?: LayoutSnapshot): snapshot is LayoutSnapshot {
	if (!snapshot) return false;

	if (snapshot.version !== SNAPSHOT_VERSION) {
		console.warn(
			`[splite] unsupported snapshot version ${String(snapshot.version)}, the snapshot will be ignored`,
		);
		return false;
	}

	const validateNode = (node: NodeSnapshot): boolean => {
		if (node.type === "pane") {
			if (typeof node.id !== "string" || !Array.isArray(node.tabs)) {
				console.warn(`[splite] malformed pane snapshot`);
				return false;
			}
		} else if (node.type === "split") {
			if (
				(node.orientation !== "horizontal" && node.orientation !== "vertical") ||
				!Array.isArray(node.children) ||
				node.children.length < 2 ||
				!Array.isArray(node.weights) ||
				node.weights.length !== node.children.length ||
				node.weights.some((weight) => typeof weight !== "number" || weight <= 0)
			) {
				console.warn(`[splite] malformed split snapshot`);
				return false;
			}

			return node.children.every(validateNode);
		} else {
			console.warn(`[splite] malformed snapshot node`);
			return false;
		}

		return true;
	};

	return validateNode(snapshot.root);
}
