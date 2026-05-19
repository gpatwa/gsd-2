// Project/App: GSD-2
// File Purpose: Visual contract test for the user message open surface.

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { stripVTControlCharacters } from "node:util";

import { initTheme } from "../../theme/theme.js";
import { UserMessageComponent } from "../user-message.js";

initTheme("dark", false);

describe("UserMessageComponent open surface", () => {
	test("renders a user message as a copy-clean open surface", () => {
		const component = new UserMessageComponent(
			"Can we make the transcript feel like chat?",
			undefined,
			1,
			"date-time-iso",
		);
		const joined = component
			.render(100)
			.map((line) => stripVTControlCharacters(line))
			.join("\n");

		assert.match(joined, /You/);
		assert.match(joined, /feel like chat/);
		// Open surface — no rail glyph, no boxed bubble corners.
		assert.doesNotMatch(joined, /[│┃╭╮╰╯]/, "user surface must use no rail or box glyphs");
		// A titled top rule carries the You label.
		assert.ok(
			joined.split("\n").some((line) => line.includes("You") && line.includes("─")),
			`expected a titled top rule carrying the You label:\n${joined}`,
		);
	});
});
