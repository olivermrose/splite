import type { LayoutSnapshot } from "$lib/index.js";
import { createHighlighter } from "shiki/bundle/web";
import { SvelteMap } from "svelte/reactivity";

export type Lang = "html" | "css" | "javascript";

export interface File {
	title: string;
	lang: Lang;
	code: string;
}

export const highlighter = createHighlighter({
	themes: ["github-dark-default"],
	langs: ["html", "css", "javascript"],
});

const HTML = `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<title>Splite Demo</title>
		<link rel="stylesheet" href="styles.css" />
	</head>
	<body>
		<main class="app">
			<h1>Hello, Splite</h1>
			<button id="go">Click me</button>
		</main>
		<script src="main.js"></script>
	</body>
</html>`;

const CSS = `.app {
	display: grid;
	place-items: center;
	min-height: 100vh;
	font-family: system-ui, sans-serif;
}

button {
	padding: 0.5rem 1rem;
	border-radius: 8px;
	border: 1px solid #333;
	cursor: pointer;
}`;

const JS = `const button = document.querySelector("#go");
let count = 0;

button.addEventListener("click", () => {
	count += 1;
	button.textContent = \`Clicked \${count}×\`;
});`;

function defaultFiles(): [string, File][] {
	return [
		["html", { title: "index.html", lang: "html", code: HTML }],
		["css", { title: "styles.css", lang: "css", code: CSS }],
		["js", { title: "main.js", lang: "javascript", code: JS }],
	];
}

const STORAGE_KEY = "splite-demo";

interface Persisted {
	layout: LayoutSnapshot;
	files: [string, File][];
	counter: number;
}

function load(): Persisted | null {
	if (typeof localStorage === "undefined") return null;

	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? (JSON.parse(raw) as Persisted) : null;
	} catch {
		return null;
	}
}

export const persisted = load();

export const files = new SvelteMap<string, File>(persisted?.files ?? defaultFiles());

export const meta = $state({ counter: persisted?.counter ?? 0 });

export function save(layout: LayoutSnapshot) {
	if (typeof localStorage === "undefined") return;

	const data: Persisted = { layout, files: [...files], counter: meta.counter };
	localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
