// Project/App: GSD-2
// File Purpose: Visual contract tests for the assistant message open surface.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import stripAnsi from "strip-ansi";
import type { AssistantMessage } from "@gsd/pi-ai";

import { initTheme } from "../../theme/theme.js";
import { AssistantMessageComponent } from "../assistant-message.js";
import { formatTimestamp } from "../timestamp.js";

initTheme("dark", false);

describe("AssistantMessageComponent open surface", () => {
	test("renders assistant content as a copy-clean open surface", () => {
		const message = {
			id: "m1",
			role: "assistant",
			provider: "test",
			model: "gpt-test",
			timestamp: 1,
			content: [{ type: "text", text: "I will update the renderer and run verification." }],
		} as unknown as AssistantMessage;

		const component = new AssistantMessageComponent(message, true);
		const plain = component.render(80).map((line) => stripAnsi(line));
		const joined = plain.join("\n");

		assert.match(joined, /GSD/);
		assert.match(joined, /gpt-test/);
		assert.match(joined, /update the renderer/);
		// Open surface — no rail glyph, no boxed bubble corners.
		assert.doesNotMatch(joined, /[│┃╭╮╰╯]/, "assistant surface must use no rail or box glyphs");
		// A titled top rule carries the GSD label.
		assert.ok(
			plain.some((line) => line.includes("GSD") && line.includes("─")),
			`expected a titled top rule:\n${joined}`,
		);
	});

	test("renders metadata for a zero timestamp", () => {
		const message = {
			id: "m1",
			role: "assistant",
			provider: "test",
			model: "gpt-test",
			timestamp: 0,
			content: [{ type: "text", text: "Finished." }],
		} as unknown as AssistantMessage;

		const component = new AssistantMessageComponent(message, true);
		const joined = component.render(80).map((line) => stripAnsi(line)).join("\n");

		assert.match(joined, new RegExp(formatTimestamp(0)));
	});
});
