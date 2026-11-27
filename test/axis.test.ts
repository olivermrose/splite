import { describe, expect, test } from "vite-plus/test";
import {
	adjustLayout,
	boundaryValues,
	fitLayout,
	initialLayout,
	preserveFixed,
	resizeTrack,
	type TrackConstraints,
} from "#lib/grid/axis.ts";

const track = (overrides: Partial<TrackConstraints> = {}): TrackConstraints => ({
	min: 0,
	max: 100,
	collapsible: false,
	collapsed: 0,
	threshold: undefined,
	disabled: false,
	fixed: false,
	initial: undefined,
	...overrides,
});

describe("axis layout", () => {
	test("three equal tracks give the rounding to the first", () => {
		const tracks = [track(), track(), track()];

		expect(fitLayout(initialLayout(tracks), tracks)).toEqual([33.334, 33.333, 33.333]);
	});

	test("default sizes are kept and the rest shared", () => {
		expect(initialLayout([track({ initial: 20 }), track(), track()])).toEqual([20, 40, 40]);
	});

	test("a layout that doesn't add up to 100 is scaled", () => {
		expect(fitLayout([1, 3], [track(), track()])).toEqual([25, 75]);
	});

	test("a pointer delta moves the boundary and stops at a minimum", () => {
		const tracks = [track({ min: 20 }), track({ min: 40 })];

		expect(adjustLayout(10, [50, 50], [50, 50], tracks, [0, 1], "pointer")).toEqual([60, 40]);
		expect(adjustLayout(30, [50, 50], [50, 50], tracks, [0, 1], "pointer")).toEqual([60, 40]);
		expect(adjustLayout(-50, [50, 50], [50, 50], tracks, [0, 1], "pointer")).toEqual([20, 80]);
	});

	test("a shrinking track passes the rest on to the next", () => {
		const tracks = [track(), track({ min: 10 }), track({ min: 10 })];

		expect(adjustLayout(40, [40, 30, 30], [40, 30, 30], tracks, [0, 1], "pointer")).toEqual([
			80, 10, 10,
		]);
	});

	test("a disabled track keeps its size and the move passes over it", () => {
		const tracks = [track(), track({ disabled: true }), track()];

		expect(adjustLayout(10, [30, 40, 30], [30, 40, 30], tracks, [0, 1], "pointer")).toEqual([
			40, 40, 20,
		]);
	});

	test("a collapsible track collapses past half its minimum and opens again", () => {
		const tracks = [track({ collapsible: true, collapsed: 5, min: 25 }), track()];

		expect(adjustLayout(-8, [25, 75], [25, 75], tracks, [0, 1], "pointer")).toEqual([25, 75]);
		expect(adjustLayout(-11, [25, 75], [25, 75], tracks, [0, 1], "pointer")).toEqual([5, 95]);
		expect(adjustLayout(11, [5, 95], [5, 95], tracks, [0, 1], "pointer")).toEqual([25, 75]);
	});

	test("one key step from a collapsible track's minimum collapses it", () => {
		const tracks = [track({ collapsible: true, min: 20 }), track()];

		expect(adjustLayout(-1, [20, 80], [20, 80], tracks, [0, 1], "keyboard")).toEqual([0, 100]);
		expect(adjustLayout(1, [0, 100], [0, 100], tracks, [0, 1], "keyboard")).toEqual([20, 80]);
	});

	test("a fixed track keeps its pixels as the axis grows", () => {
		expect(preserveFixed([25, 75], [track({ fixed: true }), track()], 400, 800)).toEqual([
			12.5, 87.5,
		]);
		expect(preserveFixed([25, 75], [track(), track()], 400, 800)).toEqual([25, 75]);
	});

	test("resizing a track takes from the track after it, or before it for the last", () => {
		const tracks = [track(), track(), track()];

		expect(resizeTrack([30, 40, 30], tracks, 0, 50)).toEqual([50, 20, 30]);
		expect(resizeTrack([30, 40, 30], tracks, 2, 50)).toEqual([30, 20, 50]);
	});

	test("boundary values cover where the track can go", () => {
		const tracks = [track({ min: 10, max: 70 }), track({ min: 20 })];
		const collapsible = [track({ collapsible: true, min: 30 }), track()];

		expect(boundaryValues([50, 50], tracks, 1)).toEqual({ now: 50, min: 10, max: 70 });
		expect(boundaryValues([50, 50], collapsible, 1).min).toBe(0);
	});
});
