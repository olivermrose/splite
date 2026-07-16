<script lang="ts" module>
	export type EasingFunction = "linear" | "ease" | "ease-in" | "ease-out" | "ease-in-out";

	export interface AnimationOptions {
		/**
		 * Whether pane size changes are animated. Transitions are always
		 * suppressed while actively resizing.
		 *
		 * @default true
		 */
		enabled?: boolean;

		/**
		 * Transition duration in ms.
		 *
		 * @default 150
		 */
		duration?: number;

		/**
		 * CSS transition timing function.
		 *
		 * @default "ease"
		 */
		easing?: EasingFunction | (string & {});
	}

	export interface ProviderProps extends SpliteControllerOptions, HTMLAttributes<HTMLDivElement> {
		/**
		 * The controller driving the layout. Read-only binding: bind to get
		 * imperative access to the controller created by the provider.
		 */
		splite?: SpliteController;

		/**
		 * Tab bar height in px.
		 *
		 * @default 32
		 */
		tabBarHeight?: number;

		/**
		 * The gap between panes in px.
		 *
		 * @default 0
		 */
		gap?: number;

		/**
		 * Animate layout changes.
		 *
		 * @default { enabled: true, duration: 150, easing: "ease" }
		 */
		animations?: AnimationOptions;

		/**
		 * Close tabs on middle-click.
		 *
		 * @default true
		 */
		middleClickClose?: boolean;

		/**
		 * Fires asynchronously exactly once per event-loop tick if any
		 * structural layout mutations have occurred. Multiple sequential
		 * mutations are batched together.
		 */
		onLayoutChange?(splite: SpliteController): void;
	}
</script>

<script lang="ts">
	import { mergeProps } from "svelte-toolbelt";
	import type { HTMLAttributes } from "svelte/elements";
	import { SpliteController, type SpliteControllerOptions } from "../controller.svelte.js";
	import { SpliteContext, setSpliteContext } from "./context.svelte.js";

	let {
		snapshot,
		collapseEmptyPanes,
		newTabPosition,
		minPaneWidth,
		minPaneHeight,

		tabBarHeight = 32,
		gap = 0,
		animations,
		middleClickClose = true,
		onLayoutChange,

		children,

		...rest
	}: ProviderProps = $props();

	const animationsEnabled = $derived(animations?.enabled ?? true);
	const animationDuration = $derived(animations?.duration ?? 150);
	const animationEasing = $derived(animations?.easing ?? "ease");

	const splite = new SpliteController({
		get snapshot() {
			return snapshot;
		},
		get collapseEmptyPanes() {
			return collapseEmptyPanes;
		},
		get newTabPosition() {
			return newTabPosition;
		},
		get minPaneWidth() {
			return minPaneWidth;
		},
		get minPaneHeight() {
			return minPaneHeight;
		},
	});

	const context = new SpliteContext({
		get splite() {
			return splite;
		},
		get tabBarHeight() {
			return tabBarHeight;
		},
		get gap() {
			return gap;
		},
		get middleClickClose() {
			return middleClickClose;
		},
	});

	setSpliteContext(context);

	const providerProps = $derived(
		mergeProps(rest, {
			class: "splite",
			"data-resizing": context.resizing !== null,
			style: {
				"--splite-tab-bar-height": `${tabBarHeight}px`,
				"--splite-transition-duration":
					animationsEnabled && !context.resizing ? `${animationDuration}ms` : 0,
				"--splite-transition-easing": animationEasing,
				position: "relative",
				display: "flex",
				width: "100%",
				height: "100%",
			},
		}),
	);

	$effect(() => {
		splite._setMeasurer(context.measurePaneRects);

		return () => splite._setMeasurer(null);
	});

	$effect(() => {
		const off = splite.on("layoutChange", (event) => {
			onLayoutChange?.(event.splite);
		});

		return () => off();
	});
</script>

<svelte:window
	onpointermove={context.onPointerMove}
	onpointerup={context.onPointerUp}
	onkeydown={context.onKeyDown}
/>

<div {...providerProps} bind:this={context.container}>
	{@render children?.()}
</div>
