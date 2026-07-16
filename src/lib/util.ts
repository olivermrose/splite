export function uid(type: string) {
	return `${type}:${crypto.randomUUID()}`;
}

export function clamp(value: number, min: number, max: number) {
	return Math.min(Math.max(value, min), max);
}

export function sum(values: number[]) {
	let total = 0;

	for (const value of values) {
		total += value;
	}

	return total;
}
