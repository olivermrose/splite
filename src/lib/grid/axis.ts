/**
 * What a track allows, in percent of its axis's space.
 */
export interface TrackConstraints {
	min: number;
	max: number;
	collapsible: boolean;

	/**
	 * The size of the track while it is collapsed.
	 */
	collapsed: number;

	/**
	 * How far past `min` a pointer drags before the track collapses. Half the
	 * span when `undefined`.
	 */
	threshold: number | undefined;
	disabled: boolean;

	/**
	 * Keeps its pixels instead of its share when the axis changes size.
	 */
	fixed: boolean;

	/**
	 * The default size of the track, or `undefined` when it shares the space
	 * that the sized tracks leave.
	 */
	initial: number | undefined;
}

/**
 * What moves a boundary. Pointer and keyboard moves collapse tracks in
 * different ways, and only imperative moves can resize disabled tracks.
 */
export type Trigger = "pointer" | "keyboard" | "imperative";

// Rounds to 3 decimal places so that floating-point error does not make equal
// sizes compare as different.
export function format(value: number) {
	return parseFloat(value.toFixed(3));
}

export function equal(a: number, b: number, tolerance = 0) {
	return Math.abs(format(a) - format(b)) <= tolerance;
}

const compare = (a: number, b: number) => (equal(a, b) ? 0 : a > b ? 1 : -1);

export function sameLayout(a: readonly number[], b: readonly number[]) {
	return a.length === b.length && a.every((value, i) => value === b[i]);
}

function validateSize(track: TrackConstraints, prev: number, size: number, override = false) {
	if (track.disabled && !override) {
		return prev;
	}

	const { collapsed, min, max } = track;

	if (compare(size, min) < 0) {
		if (track.collapsible) {
			const threshold = track.threshold ?? (min - collapsed) / 2;
			const wasCollapsed = compare(prev, collapsed) <= 0;
			const boundary = wasCollapsed ? collapsed + threshold : min - threshold;
			const comparison = compare(size, boundary);

			size =
				compare(size, collapsed) <= 0 ||
				comparison < 0 ||
				(track.threshold !== undefined && wasCollapsed && comparison === 0)
					? collapsed
					: min;
		} else {
			size = min;
		}
	}

	return format(Math.min(max, size));
}

/**
 * The layout scaled to 100, with each size settled into its track's bounds and
 * what's left shared out in order.
 */
export function fitLayout(
	layout: readonly number[],
	tracks: readonly TrackConstraints[],
): number[] {
	const prev = tracks.map((_, i) => layout[i] ?? 0);
	const next = [...prev];
	const total = next.reduce((sum, size) => sum + size, 0);

	if (!equal(total, 100) && next.length > 0) {
		for (let i = 0; i < next.length; i++) {
			next[i] = total === 0 ? 100 / next.length : (100 / total) * next[i];
		}
	}

	let remaining = 0;

	for (let i = 0; i < tracks.length; i++) {
		const safe = validateSize(tracks[i], prev[i], next[i], true);

		if (next[i] !== safe) {
			remaining += next[i] - safe;
			next[i] = safe;
		}
	}

	if (!equal(remaining, 0)) {
		for (let i = 0; i < tracks.length; i++) {
			const prevSize = next[i];
			const safe = validateSize(tracks[i], prevSize, prevSize + remaining, true);

			if (prevSize !== safe) {
				remaining -= safe - prevSize;
				next[i] = safe;

				if (equal(remaining, 0)) break;
			}
		}
	}
	return next;
}

/**
 * The layout after moving the boundary between tracks `a` and `b` by `delta`
 * percent from `initial`: positive grows `a`. Tracks shrink from the boundary
 * outward, each down to its minimum, and the growing side takes what they give.
 *
 * Returns `prev` when nothing moves.
 */
export function adjustLayout(
	delta: number,
	initial: readonly number[],
	prev: readonly number[],
	tracks: readonly TrackConstraints[],
	[a, b]: readonly [number, number],
	trigger?: Trigger,
): readonly number[] {
	if (equal(delta, 0)) return initial;

	const override = trigger === "imperative";
	const next = [...initial];

	let applied = 0;

	// One key press opens a collapsed track to its minimum, and one key press
	// collapses a track at its minimum, even when the step is smaller than the
	// gap between the two sizes.
	if (trigger === "keyboard") {
		{
			const index = delta < 0 ? b : a;
			const { collapsible, collapsed, min } = tracks[index];

			if (collapsible && equal(initial[index], collapsed)) {
				const local = min - initial[index];

				if (compare(local, Math.abs(delta)) > 0) {
					delta = delta < 0 ? -local : local;
				}
			}
		}

		{
			const index = delta < 0 ? a : b;
			const { collapsible, collapsed, min } = tracks[index];

			if (collapsible && equal(initial[index], min)) {
				const local = initial[index] - collapsed;

				if (compare(local, Math.abs(delta)) > 0) {
					delta = delta < 0 ? -local : local;
				}
			}
		}
	} else {
		// A drag that expands a collapsed track jumps the whole gap to its
		// minimum once it passes the threshold, and does not move before that.
		const index = delta < 0 ? b : a;

		const { collapsible, collapsed, min, threshold } = tracks[index];
		const size = initial[index];

		if (collapsible && compare(size, min) < 0) {
			const gap = min - collapsed;

			if (compare(size + Math.abs(delta), min) < 0) {
				const comparison = compare(Math.abs(delta), threshold ?? gap / 2);
				const atBoundary = threshold === undefined && delta < 0;

				delta =
					comparison > 0 || (comparison === 0 && atBoundary)
						? delta < 0
							? -gap
							: gap
						: 0;
			}
		}
	}

	{
		const step = delta < 0 ? 1 : -1;
		let available = 0;

		for (let i = delta < 0 ? b : a; i >= 0 && i < tracks.length; i += step) {
			available += validateSize(tracks[i], initial[i], 100, override) - initial[i];
		}

		const limited = Math.min(Math.abs(delta), Math.abs(available));
		delta = delta < 0 ? -limited : limited;
	}

	{
		let i = delta < 0 ? a : b;

		while (i >= 0 && i < tracks.length) {
			const remaining = Math.abs(delta) - Math.abs(applied);
			const safe = validateSize(tracks[i], initial[i], initial[i] - remaining, override);

			if (!equal(initial[i], safe)) {
				applied += initial[i] - safe;
				next[i] = safe;

				if (compare(applied, Math.abs(delta)) >= 0) break;
			}

			i += delta < 0 ? -1 : 1;
		}
	}

	if (sameLayout(prev, next)) return prev;

	{
		const pivot = delta < 0 ? b : a;

		const unsafe = initial[pivot] + applied;
		const safe = validateSize(tracks[pivot], initial[pivot], unsafe, override);
		next[pivot] = safe;

		if (!equal(safe, unsafe)) {
			let remaining = unsafe - safe;
			let i = pivot;

			while (i >= 0 && i < tracks.length) {
				const before = next[i];
				const settled = validateSize(tracks[i], before, before + remaining, override);

				if (!equal(before, settled)) {
					remaining -= settled - before;
					next[i] = settled;
				}

				if (equal(remaining, 0)) break;

				i += delta > 0 ? -1 : 1;
			}
		}
	}

	const total = next.reduce((sum, size) => sum + size, 0);

	return equal(total, 100, 0.1) ? next : prev;
}

/**
 * Where tracks start: their `initial` size, and what's left shared by the
 * tracks without one.
 */
export function initialLayout(tracks: readonly TrackConstraints[]): number[] {
	let total = 0;
	let unsized = 0;

	for (const track of tracks) {
		if (track.initial === undefined) {
			unsized += 1;
		} else {
			total += track.initial;
		}
	}

	const share = unsized > 0 ? format((100 - total) / unsized) : 0;

	return tracks.map((track) => format(track.initial ?? share));
}

/**
 * Where an axis starts: `given` when it has a size for every track, otherwise
 * each track's default size, fitted to the tracks.
 */
export function startAxis(
	tracks: readonly TrackConstraints[],
	given?: readonly number[],
): number[] {
	return fitLayout(given?.length === tracks.length ? given : initialLayout(tracks), tracks);
}

/**
 * `layout`, laid out for `from` pixels, moved to `to` pixels: fixed tracks
 * keep their pixels and the others share the rest in proportion.
 */
export function preserveFixed(
	layout: readonly number[],
	tracks: readonly TrackConstraints[],
	from: number,
	to: number,
): readonly number[] {
	if (from <= 0 || to <= 0 || from === to) {
		return layout;
	}

	if (!tracks.some((track) => track.fixed) || tracks.every((track) => track.fixed)) {
		return layout;
	}

	const next = [...layout];

	let fixedTotal = 0;
	let flexibleBefore = 0;
	let flexibleCount = 0;

	for (let i = 0; i < tracks.length; i++) {
		if (tracks[i].fixed) {
			next[i] = format((layout[i] * from) / to);
			fixedTotal += next[i];
		} else {
			flexibleBefore += layout[i];
			flexibleCount += 1;
		}
	}

	const left = 100 - fixedTotal;

	for (let i = 0; i < tracks.length; i++) {
		if (tracks[i].fixed) continue;

		next[i] = format(
			flexibleBefore > 0 ? (layout[i] / flexibleBefore) * left : left / flexibleCount,
		);
	}

	return next;
}

/**
 * The layout with track `index` at `target`: through the boundary after it,
 * then the one before it for whatever that leaves, like for the last track.
 */
export function resizeTrack(
	layout: readonly number[],
	tracks: readonly TrackConstraints[],
	index: number,
	target: number,
): readonly number[] {
	let next = layout;
	const order: [number, number][] = [];

	if (index < tracks.length - 1) {
		order.push([index, index + 1]);
	}

	if (index > 0) {
		order.push([index - 1, index]);
	}

	for (const [a, b] of order) {
		const delta = target - next[index];
		if (equal(delta, 0)) break;

		next = adjustLayout(a === index ? delta : -delta, next, next, tracks, [a, b], "imperative");
	}

	return next;
}

/**
 * The `aria-valuenow`, `aria-valuemin`, and `aria-valuemax` of the boundary
 * before track `index`. The values are the size of track `index - 1`, which
 * grows as the boundary moves forward.
 */
export function boundaryValues(
	layout: readonly number[],
	tracks: readonly TrackConstraints[],
	index: number,
) {
	const primary = index - 1;

	const track = tracks[primary];
	const now = layout[primary] ?? 0;

	function reach(target: number) {
		return fitLayout(
			adjustLayout(target - now, layout, layout, tracks, [primary, index]),
			tracks,
		)[primary];
	}

	return {
		now,
		min: reach(track.collapsible ? track.collapsed : track.min),
		max: reach(track.max),
	};
}

export function isCollapsed(track: TrackConstraints, size: number) {
	return track.collapsible && equal(size, track.collapsed);
}
