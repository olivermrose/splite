import { format, type TrackConstraints } from "./axis";
import type { GridSize, GridTrack } from "./types";

export interface Track extends GridTrack {
	id: string;
}

export function normalizeTracks(tracks: number | readonly GridTrack[]): Track[] {
	const list: readonly GridTrack[] =
		typeof tracks === "number" ? Array.from({ length: tracks }, () => ({})) : tracks;

	if (list.length === 0) {
		throw new Error(`Grid must have at least one track; got ${JSON.stringify(tracks)}`);
	}

	const seen = new Set<string>();

	return list.map((track, i) => {
		const id = track.id ?? String(i);

		if (seen.has(id)) {
			throw new Error(`Grid track ids must be unique; "${id}" is used twice`);
		}

		seen.add(id);

		return { ...track, id };
	});
}

/**
 * A size in percent of `space` pixels. Pixel and rem sizes are undefined until
 * the grid is measured.
 */
export function toPercent(size: GridSize | undefined, space: number, rem = 16): number | undefined {
	if (size === undefined) {
		return undefined;
	}

	if (typeof size === "number") {
		return size;
	}

	const value = parseFloat(size);

	if (size.endsWith("%")) {
		return value;
	}

	if (space <= 0) {
		return undefined;
	}

	const pixels = size.endsWith("rem") ? value * rem : value;

	return format((pixels / space) * 100);
}

export function constraintsOf(track: GridTrack, space: number, rem?: number): TrackConstraints {
	const collapsed = toPercent(track.collapsedSize, space, rem) ?? 0;
	const min = toPercent(track.minSize, space, rem) ?? 0;

	return {
		min,
		max: toPercent(track.maxSize, space, rem) ?? 100,
		collapsible: track.collapsible ?? false,
		collapsed,
		threshold: toPercent(track.collapsedThreshold, space, rem),
		disabled: track.disabled ?? false,
		fixed: track.groupResizeBehavior === "preserve-pixel-size",
		initial: toPercent(track.defaultSize, space, rem),
	};
}

const isPercent = (size: GridSize | undefined) => typeof size === "number" || !!size?.endsWith("%");

/**
 * The CSS track sizes before the grid is measured, like on the server: the
 * layout as `fr` when there is one, otherwise each default size, with pixel
 * and rem defaults as written.
 */
export function initialTemplate(tracks: readonly Track[], layout: readonly number[] | undefined) {
	if (layout?.length === tracks.length) {
		return layout.map((size) => `minmax(0, ${size}fr)`);
	}

	let unsized = 0;
	let total = 0;

	for (const track of tracks) {
		if (track.defaultSize === undefined) {
			unsized += 1;
		} else if (isPercent(track.defaultSize)) {
			total += toPercent(track.defaultSize, 0) ?? 0;
		}
	}

	const share = Math.max(0, 100 - total) / Math.max(1, unsized);

	return tracks.map((track) => {
		if (track.defaultSize === undefined) {
			return `minmax(0, ${format(share)}fr)`;
		}

		if (isPercent(track.defaultSize)) {
			return `minmax(0, ${toPercent(track.defaultSize, 0)}fr)`;
		}

		return String(track.defaultSize);
	});
}
