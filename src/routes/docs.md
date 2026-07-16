## Installation

Splite is a Svelte 5 library (it uses runes) and has a peer dependency on `svelte ^5.0.0`.

```bash
npm install splite
```

## Quick start

Wrap your layout in `Splite.Provider`, then render the pane tree with `Splite.View`. Splite is headless: the `tabBar`, `content`, and `splitter` snippets give you full control over what each part looks like.

```svelte
<script lang="ts">
	import { Splite, useSplite } from "splite";

	const splite = useSplite();
</script>

<Splite.Provider>
	<Splite.View>
		{#snippet tabBar(pane)}
			<Splite.TabBar>
				{#each pane.tabs as tabId (tabId)}
					<Splite.Tab {tabId} {pane}>{tabId}</Splite.Tab>
				{/each}
			</Splite.TabBar>
		{/snippet}

		{#snippet content(tabId, pane)}
			<Splite.Content {tabId} {pane}>
				Content for {tabId}
			</Splite.Content>
		{/snippet}

		{#snippet splitter(split, index)}
			<Splite.Splitter {split} {index} />
		{/snippet}
	</Splite.View>

	<Splite.DropIndicator />
	<Splite.DragOverlay />
</Splite.Provider>
```

## Components

| Component              | Description                                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `Splite.Provider`      | Creates the controller, sets context, and hosts global drag/resize handling. Everything else goes inside it. |
| `Splite.View`          | Renders the pane tree. You provide the `tabBar`, `content`, `splitter`, and optional `empty` snippets.       |
| `Splite.TabBar`        | The tab strip for a pane. Acts as a drop target for dragged tabs.                                            |
| `Splite.Tab`           | A single draggable tab. Supports an `onClose` callback (cancelable) and middle-click close.                  |
| `Splite.Content`       | Wraps a tab's content and shows/hides it based on the pane's selected tab.                                   |
| `Splite.Splitter`      | The drag handle between two children of a split. Also keyboard-resizable.                                    |
| `Splite.DropIndicator` | Highlights the drop zone (pane edge or tab bar position) while dragging a tab.                               |
| `Splite.DragOverlay`   | Renders a preview of the tab being dragged, following the pointer.                                           |

## The controller

`useSplite()` returns the `SpliteController` from context — the imperative API behind the components. You can also bind it from the provider with `bind:splite`, or construct one yourself for headless use.

```ts
const splite = useSplite();

splite.createTab("readme"); // open a tab in the focused pane

const right = splite.splitPane(splite.focusedPane.id, "right");
if (right) splite.createTab("preview", right); // open a tab in the new pane

splite.on("tabClose", (event) => {
	if (hasUnsavedChanges(event.tabId)) event.preventDefault();
});
```

### Methods

| Method                                    | Description                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `createTab(id, paneId?)`                  | Adds a tab to a pane (defaults to the focused pane). Placement is controlled by `newTabPosition`.     |
| `closeTab(id)`                            | Closes a tab. Empty panes collapse automatically unless `collapseEmptyPanes` is false.                |
| `selectTab(id)`                           | Selects a tab and focuses its pane.                                                                   |
| `selectPreviousTab()` / `selectNextTab()` | Cycles through tabs in the focused pane, wrapping around.                                             |
| `moveTab(id, paneId, index?)`             | Moves a tab to another pane, or reorders it within its own pane.                                      |
| `splitPane(paneId, side, tabId?)`         | Splits a pane on the given side. Optionally moves a tab into the new pane. Returns the new pane's id. |
| `closePane(id)`                           | Closes a pane and all of its tabs (each close is cancelable).                                         |
| `focusPane(id)`                           | Focuses a pane by id.                                                                                 |
| `navigateFocus(direction)`                | Moves focus to the spatially nearest pane: `"left"`, `"right"`, `"up"`, or `"down"`.                  |
| `resize(splitId, index, position)`        | Moves a splitter to a fractional (0–1) position, respecting minimum pane sizes.                       |
| `on(type, handler)`                       | Subscribes to an event. Returns an unsubscribe function.                                              |
| `toJSON()`                                | Serializes the current layout into a snapshot for later restoration.                                  |

The controller also exposes `root`, `panes`, `splits`, `focusedPane`, and `findTab(id)` for reading the tree — all reactive.

## Events

Subscribe with `splite.on(type, handler)`. Cancelable events can be stopped with `event.preventDefault()` — for example to prompt before closing a tab with unsaved changes.

| Event          | Cancelable | Fires when                                                                                        |
| -------------- | ---------- | ------------------------------------------------------------------------------------------------- |
| `tabCreate`    | Yes        | A tab is about to be created.                                                                     |
| `tabClose`     | Yes        | A tab is about to be closed.                                                                      |
| `tabSelect`    | No         | A tab was selected.                                                                               |
| `tabMove`      | No         | A tab was moved or reordered.                                                                     |
| `paneSplit`    | Yes        | A pane is about to be split.                                                                      |
| `paneClose`    | Yes / No   | A pane was closed by the user (cancelable) or collapsed because it became empty (not cancelable). |
| `paneFocus`    | No         | A pane received focus.                                                                            |
| `layoutChange` | No         | Batched: fires once per tick after any structural mutation. Ideal for persistence.                |

## Persistence

`splite.toJSON()` serializes the layout to a `LayoutSnapshot`. Pass it back as the provider's `snapshot` prop to restore it. The `layoutChange` event is batched per tick, so it's safe to save on every one — that's exactly what the demo above does.

```svelte
<Splite.Provider
	snapshot={loadSnapshot()}
	onLayoutChange={(splite) => saveSnapshot(splite.toJSON())}
>
	...
</Splite.Provider>
```

## Provider options

| Option               | Default                                            | Description                                                                                     |
| -------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `snapshot`           | —                                                  | A previously serialized layout to restore. Ignored if malformed or from an unsupported version. |
| `collapseEmptyPanes` | `true`                                             | Automatically close panes when their last tab is removed.                                       |
| `newTabPosition`     | `"after"`                                          | Where `createTab` inserts: `"start"`, `"end"`, `"before"`, or `"after"` the selected tab.       |
| `minPaneWidth`       | `240`                                              | Minimum pane width in px, enforced while resizing.                                              |
| `minPaneHeight`      | `240`                                              | Minimum pane height in px, enforced while resizing.                                             |
| `tabBarHeight`       | `32`                                               | Tab bar height in px.                                                                           |
| `gap`                | `0`                                                | Gap between panes in px.                                                                        |
| `animations`         | `{ enabled: true, duration: 150, easing: "ease" }` | Animate pane size changes (suppressed while actively resizing).                                 |
| `middleClickClose`   | `true`                                             | Close tabs on middle-click.                                                                     |
