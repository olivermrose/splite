export interface PreviewBox {
	handle: HTMLElement;
	left: number;
	top: number;
	width: number;
	height: number;
	offset: number;
	active: boolean;
}

interface Handle {
	el: HTMLElement;
	before: number;
}

function isSlot(el: Element, slot: string) {
	return el.getAttribute("data-slot") === slot;
}

/**
 * Where each separator of `root` lands if the layout becomes `next`.
 */
export function previewBoxes(
	root: HTMLElement,
	next: readonly number[],
	vertical: boolean,
): PreviewBox[] {
	const rootRect = root.getBoundingClientRect();

	const sizes: number[] = [];
	const handles: Handle[] = [];

	for (const child of root.children) {
		if (isSlot(child, "resizable-panel")) {
			const rect = child.getBoundingClientRect();
			sizes.push(vertical ? rect.height : rect.width);
		} else if (isSlot(child, "resizable-handle")) {
			handles.push({ el: child as HTMLElement, before: sizes.length });
		}
	}

	const space = sizes.reduce((sum, size) => sum + size, 0);
	const boxes: PreviewBox[] = [];

	let from = 0;
	let to = 0;
	let counted = 0;

	for (const { el, before } of handles) {
		for (; counted < before; counted++) {
			from += sizes[counted] ?? 0;
			to += ((next[counted] ?? 0) / 100) * space;
		}

		const offset = to - from;
		const active = el.hasAttribute("data-dragging");

		if (!active && Math.abs(offset) < 0.5) continue;

		const rect = el.getBoundingClientRect();

		boxes.push({
			handle: el,
			left: rect.left - rootRect.left - root.clientLeft,
			top: rect.top - rootRect.top - root.clientTop,
			width: rect.width,
			height: rect.height,
			offset,
			active,
		});
	}

	return boxes;
}

const OMITTED_CLONE_ATTRS = [
	"id",
	"role",
	"tabindex",
	"aria-controls",
	"aria-label",
	"aria-labelledby",
];

/**
 * A copy of a separator to show where it will land without moving the original.
 *
 * The clone is stripped of attributes that would make it interactive or
 * accessible and is sized to fill the separator's slot.
 */
export function cloneSeparator(handle: HTMLElement): HTMLElement {
	const clone = handle.cloneNode(true) as HTMLElement;

	for (const el of [clone, ...clone.querySelectorAll<HTMLElement>("*")]) {
		for (const name of OMITTED_CLONE_ATTRS) {
			el.removeAttribute(name);
		}

		for (const { name } of Array.from(el.attributes)) {
			if (name.startsWith("aria-value")) {
				el.removeAttribute(name);
			}
		}
	}

	clone.removeAttribute("data-slot");
	clone.removeAttribute("data-dragging");
	clone.removeAttribute("data-hovering");

	clone.style.width = "100%";
	clone.style.height = "100%";

	return clone;
}
