import { cleanup } from "@testing-library/svelte";
import { afterEach } from "vite-plus/test";

declare global {
	var __UI_SDK_STRICT__: boolean | undefined;
}

globalThis.__UI_SDK_STRICT__ = true;

document.head.append(
	Object.assign(document.createElement("style"), {
		textContent: "@layer ui-sdk; html, body { margin: 0; }",
	}),
);

afterEach(cleanup);
