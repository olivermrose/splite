declare module "vite-plus/test/browser" {
	interface BrowserCommands {
		mouse: (action: "move" | "down" | "up", x?: number, y?: number) => Promise<void>;
		key: (action: "down" | "up", key: string) => Promise<void>;
	}
}

export {};
