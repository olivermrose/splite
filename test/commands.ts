import type { BrowserCommand } from "vite-plus/test/node";

type MouseAction = "move" | "down" | "up";

const mouse: BrowserCommand<[action: MouseAction, x?: number, y?: number]> = async (
	context,
	action,
	x = 0,
	y = 0,
) => {
	if (context.provider.name !== "playwright") {
		throw new Error("mouse needs Playwright");
	}

	const frame = await context.frame();
	const box = await (await frame.frameElement()).boundingBox();

	const left = box?.x ?? 0;
	const top = box?.y ?? 0;

	const { mouse } = context.page;

	if (action === "move") {
		await mouse.move(left + x, top + y, { steps: 4 });
	} else if (action === "down") {
		await mouse.down();
	} else {
		await mouse.up();
	}
};

const key: BrowserCommand<[action: "down" | "up", key: string]> = async (context, action, name) => {
	if (context.provider.name !== "playwright") {
		throw new Error("key needs Playwright");
	}

	if (action === "down") {
		await context.page.keyboard.down(name);
	} else {
		await context.page.keyboard.up(name);
	}
};

export const commands = { mouse, key };
