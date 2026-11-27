import type { GridLayout, GridOptions, GridStorage } from "./types";

type Tracks = Record<keyof GridLayout, readonly { id: string }[]>;
type Saving = Pick<GridOptions, "autoSaveId" | "storage">;

/**
 * Returns the storage key that a grid with the given `autoSaveId` saves its
 * layouts under. Use it to read or clear the saved layouts.
 */
export function gridStorageKey(autoSaveId: string) {
	return `splite-grid:${autoSaveId}`;
}

function storageOf(options: Saving): GridStorage | undefined {
	if (options.storage) return options.storage;

	// Reading `localStorage` throws when the browser blocks storage, such as
	// in a sandboxed iframe.
	try {
		return globalThis.localStorage;
	} catch {
		return undefined;
	}
}

// Saved layouts are keyed by track ids so that a layout saved for one set of
// tracks does not restore onto a different set under the same `autoSaveId`.
function layoutKey(tracks: Tracks) {
	const ids = (axis: keyof GridLayout) => tracks[axis].map((track) => track.id).join(",");
	return `${ids("columns")}|${ids("rows")}`;
}

function read(storage: GridStorage, key: string): Record<string, GridLayout> {
	return JSON.parse(storage.getItem(key) ?? "{}") as Record<string, GridLayout>;
}

export function saveLayout(options: Saving, tracks: Tracks, layout: GridLayout) {
	const storage = storageOf(options);
	if (!options.autoSaveId || !storage) return;

	const key = gridStorageKey(options.autoSaveId);

	try {
		const saved = read(storage, key);

		saved[layoutKey(tracks)] = layout;
		storage.setItem(key, JSON.stringify(saved));
	} catch (error) {
		console.error(error);
	}
}

/**
 * The layout saved for these tracks, if there is one that fits them.
 */
export function loadLayout(options: Saving, tracks: Tracks): GridLayout | undefined {
	const storage = storageOf(options);

	if (!options.autoSaveId || !storage) {
		return undefined;
	}

	try {
		const layout = read(storage, gridStorageKey(options.autoSaveId))[layoutKey(tracks)];

		return layout?.columns?.length === tracks.columns.length &&
			layout.rows?.length === tracks.rows.length
			? layout
			: undefined;
	} catch {
		return undefined;
	}
}
