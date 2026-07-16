<script lang="ts">
	import { Splite, useSplite } from "$lib/index.js";
	import close from "../assets/close.svg?raw";
	import { files, highlighter } from "./demo.svelte.js";
	import Editor from "./Editor.svelte";
	import TabBarActions from "./TabBarActions.svelte";

	const splite = useSplite();

	if (splite.panes.length === 1 && splite.panes[0].tabs.length === 0) {
		splite.createTab("html");

		const right = splite.splitPane(splite.focusedPane.id, "right");
		if (right) {
			splite.createTab("css", right);

			const bottom = splite.splitPane(right, "bottom");
			if (bottom) splite.createTab("js", bottom);
		}
	}
</script>

{#snippet tabLabel(tabId: string)}
	<svg class="size-4 opacity-70" viewBox="0 0 16 16" fill="none" aria-hidden="true">
		<path
			d="M4 1.5h5.5L13 5v9.5H4v-13Z M9.5 1.5V5H13"
			stroke="currentColor"
			stroke-width="1.2"
			stroke-linejoin="round"
		/>
	</svg>

	{files.get(tabId)?.title ?? tabId}
{/snippet}

<Splite.View>
	{#snippet tabBar(pane)}
		<Splite.TabBar
			class="flex flex-none items-stretch border border-b-neutral-800 bg-neutral-900"
		>
			{#each pane.tabs as tabId (tabId)}
				<Splite.Tab
					class={[
						"flex cursor-pointer items-center",
						"data-[state=active]:bg-neutral-900 data-[state=dragging]:opacity-50",
					]}
					{tabId}
					{pane}
					onClose={(event) => {
						if (!confirm(`Close ${files.get(event.tabId)?.title ?? event.tabId}?`)) {
							event.preventDefault();
							return;
						}

						files.delete(event.tabId);
					}}
				>
					<div
						class={[
							"group relative flex h-full items-center gap-2 border-r border-neutral-800 pr-2 pl-4 text-xs whitespace-nowrap",
							pane.selected === tabId
								? "text-neutral-100"
								: "text-neutral-500 hover:text-neutral-300",
						]}
					>
						{#if pane.selected === tabId}
							<span
								class={[
									"absolute inset-x-0 top-0 h-0.5",
									splite.focusedPane === pane ? "bg-blue-500" : "bg-neutral-600",
								]}
							></span>
						{/if}

						{@render tabLabel(tabId)}

						<button
							class="rounded p-0.5 text-neutral-600 opacity-0 group-hover:opacity-100 hover:bg-neutral-800 hover:text-neutral-100 [&>svg]:size-4"
							aria-label="Close tab"
							onpointerdown={(event) => event.stopPropagation()}
							onclick={() => splite.closeTab(tabId)}
						>
							{@html close}
						</button>
					</div>
				</Splite.Tab>
			{/each}

			<TabBarActions {pane} />
		</Splite.TabBar>
	{/snippet}

	{#snippet content(tabId, pane)}
		{@const file = files.get(tabId)}

		<Splite.Content {tabId} {pane}>
			{#if file}
				{#await highlighter then hl}
					<Editor highlighter={hl} {file} />
				{/await}
			{/if}
		</Splite.Content>
	{/snippet}

	{#snippet empty()}
		<div class="grid min-h-0 flex-1 place-items-center bg-neutral-900 text-neutral-500">
			<span class="text-center">Empty pane</span>
		</div>
	{/snippet}

	{#snippet splitter(split, index)}
		<Splite.Splitter {split} {index}></Splite.Splitter>
	{/snippet}
</Splite.View>

<Splite.DropIndicator
	class={[
		"data-[target=tab-bar]:bg-neutral-100",
		"data-[target=zone]:border data-[target=zone]:border-blue-400/80 data-[target=zone]:bg-blue-400/20",
	]}
/>

<Splite.DragOverlay class="border border-neutral-800 bg-neutral-900 opacity-80">
	{#snippet children(tabId)}
		<span class="flex h-10 items-center gap-2 border border-neutral-700 px-4 text-xs">
			{@render tabLabel(tabId)}
		</span>
	{/snippet}
</Splite.DragOverlay>
