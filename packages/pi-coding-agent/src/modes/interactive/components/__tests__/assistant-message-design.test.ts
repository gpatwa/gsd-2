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
		const topRuleIndex = plain.findIndex((line) => line.includes("GSD") && line.includes("─"));
		const contentIndex = plain.findIndex((line) => line.includes("update the renderer"));
		assert.ok(contentIndex > topRuleIndex + 1, `expected a breathing row before content:\n${joined}`);
		assert.equal(plain[contentIndex + 1]?.trim(), "", `expected a breathing row after content:\n${joined}`);
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

	test("reuses rendered output until assistant message state changes", () => {
		const message = {
			id: "m1",
			role: "assistant",
			provider: "test",
			model: "gpt-test",
			timestamp: 1,
			content: [{ type: "text", text: "Cached assistant content." }],
		} as unknown as AssistantMessage;
		const component = new AssistantMessageComponent(message, true);

		const first = component.render(80);
		assert.equal(component.render(80), first);

		component.updateContent({
			...message,
			content: [{ type: "text", text: "Updated assistant content." }],
		} as unknown as AssistantMessage);
		const updated = component.render(80);

		assert.notEqual(updated, first);
		assert.match(updated.map((line) => stripAnsi(line)).join("\n"), /Updated assistant content/);
	});

	test("rebuilds the current assistant message when thinking visibility changes", () => {
		const message = {
			id: "m1",
			role: "assistant",
			provider: "test",
			model: "gpt-test",
			content: [{ type: "thinking", thinking: "Private reasoning trace." }],
		} as unknown as AssistantMessage;
		const component = new AssistantMessageComponent(message, true);

		assert.match(component.render(80).map((line) => stripAnsi(line)).join("\n"), /Thinking\.\.\./);

		component.setHideThinkingBlock(false);
		const expandedThinking = component.render(80).map((line) => stripAnsi(line)).join("\n");

		assert.match(expandedThinking, /Private reasoning trace/);
		assert.doesNotMatch(expandedThinking, /Thinking\.\.\./);
	});
});
