import { uid } from "./util.js";

export interface PaneInit {
	id?: string;
	tabs?: string[];
	selected?: string | null;
}

export class Pane {
	/**
	 * The id of the pane.
	 */
	public readonly id: string;

	/**
	 * The ids of the tabs in the pane.
	 */
	public readonly tabs = $state<string[]>([]);

	/**
	 * The id of the selected tab in the pane.
	 */
	public selected = $state<string | null>(null);

	public constructor(init: PaneInit = {}) {
		this.id = init.id ?? uid("pane");
		this.tabs = init.tabs ? [...init.tabs] : [];
		this.selected = init.selected ?? this.tabs.at(-1) ?? null;
	}

	public selectTab(id: string) {
		if (this.tabs.includes(id)) {
			this.selected = id;
		}
	}

	public insertTab(id: string, index: number, select = true) {
		this.tabs.splice(index, 0, id);

		if (select) {
			this.selected = id;
		}
	}

	public removeTab(id: string): number {
		const index = this.tabs.indexOf(id);
		if (index === -1) return -1;

		this.tabs.splice(index, 1);

		if (this.selected === id) {
			this.selected = this.tabs[Math.min(index, this.tabs.length - 1)] ?? null;
		}

		return index;
	}
}
