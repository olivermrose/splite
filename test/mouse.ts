import { commands } from "vite-plus/test/browser";

export function center(el: Element) {
	const rect = el.getBoundingClientRect();

	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	};
}

export async function drag(el: Element, dx: number, dy: number, { release = true } = {}) {
	const { x, y } = center(el);

	await commands.mouse("move", x, y);
	await commands.mouse("down");
	await commands.mouse("move", x + dx, y + dy);

	if (release) await commands.mouse("up");
}

export const mouseUp = () => commands.mouse("up");
export const mouseDown = () => commands.mouse("down");
export const mouseMove = (x: number, y: number) => commands.mouse("move", x, y);
