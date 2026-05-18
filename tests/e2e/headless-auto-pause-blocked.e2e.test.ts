// Project/App: GSD-2
// File Purpose: E2E gate for headless auto-mode pause exit behavior.

import { execFileSync } from "node:child_process";
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
	artifactsFor,
	createTmpProject,
	gsdSync,
	parseJsonEvents,
	writeTranscript,
} from "./_shared/index.ts";

function binaryAvailable(): { ok: boolean; reason?: string } {
	const bin = process.env.GSD_SMOKE_BINARY;
	if (!bin) return { ok: false, reason: "GSD_SMOKE_BINARY not set; build with `npm run build:core` and re-export." };
	if (!existsSync(bin)) return { ok: false, reason: `binary not found at ${bin}` };
	return { ok: true };
}

function commitFixture(dir: string): void {
	execFileSync("git", ["add", ".gitignore", "package.json", "src/answer.js", "test/answer.test.js"], {
		cwd: dir,
		stdio: "pipe",
	});
	execFileSync("git", ["commit", "-m", "test: seed headless pause fixture"], { cwd: dir, stdio: "pipe" });
}

function writeRecoveredMilestone(dir: string): void {
	const milestoneDir = join(dir, ".gsd", "milestones", "M001");
	const sliceDir = join(milestoneDir, "slices", "S01");
	mkdirSync(join(sliceDir, "tasks"), { recursive: true });

	writeFileSync(
		join(milestoneDir, "M001-CONTEXT.md"),
		[
			"# M001: Provider Pause Fixture",
			"",
			"## Purpose",
			"Exercise headless auto-mode pause handling.",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(milestoneDir, "M001-ROADMAP.md"),
		[
			"# M001: Provider Pause Fixture",
			"",
			"## Slices",
			"",
			"- [ ] **S01: Update answer** `risk:low` `depends:[]`",
			"  > Demo: answer() returns ready.",
			"",
		].join("\n"),
	);
	writeFileSync(
		join(sliceDir, "S01-PLAN.md"),
		[
			"# S01: Update answer",
			"",
			"**Goal:** Make the answer implementation return ready.",
			"",
			"## Tasks",
			"",
			"- [ ] **T01: Update answer implementation** `est:5m`",
			"",
			"### T01: Update answer implementation",
			"",
			"Inputs:",
			"- `src/answer.js`",
			"",
			"Expected Output:",
			"- `src/answer.js`",
			"",
			"Verification:",
			"- `node --test test/answer.test.js`",
			"",
		].join("\n"),
	);
}

describe("headless auto pause e2e (fake LLM)", () => {
	const avail = binaryAvailable();
	const skipReason = avail.ok ? null : avail.reason;

	test("headless auto exits blocked when auto-mode pauses on provider error", { skip: skipReason ?? false }, (t) => {
		const project = createTmpProject({
			git: true,
			files: {
				".gitignore": ".gsd/\n",
				"package.json": JSON.stringify({ type: "module", scripts: { test: "node --test test/answer.test.js" } }, null, 2) + "\n",
				"src/answer.js": "export function answer() {\n\treturn \"pending\";\n}\n",
				"test/answer.test.js": [
					"import test from \"node:test\";",
					"import assert from \"node:assert/strict\";",
					"import { answer } from \"../src/answer.js\";",
					"",
					"test(\"answer returns ready\", () => {",
					"\tassert.equal(answer(), \"ready\");",
					"});",
					"",
				].join("\n"),
			},
		});
		t.after(project.cleanup);
		commitFixture(project.dir);
		writeRecoveredMilestone(project.dir);

		const recover = gsdSync(["headless", "recover"], {
			cwd: project.dir,
			timeoutMs: 30_000,
		});
		assert.equal(
			recover.code,
			0,
			`expected recover exit 0, got ${recover.code}. stderr=${recover.stderrClean.slice(0, 800)}`,
		);

		const transcript = writeTranscript([
			{
				turn: 1,
				expect: { modelId: "gsd-fake-model" },
				emit: { kind: "error_429", message: "invalid api key" },
			},
		]);

		const result = gsdSync(
			[
				"headless",
				"--output-format",
				"stream-json",
				"--events",
				"extension_ui_request,agent_end",
				"--model",
				"gsd-fake-model",
				"--timeout",
				"15000",
				"--max-restarts",
				"0",
				"auto",
			],
			{
				cwd: project.dir,
				timeoutMs: 30_000,
				env: {
					GSD_FAKE_LLM_TRANSCRIPT: transcript,
				},
			},
		);

		const artifacts = artifactsFor("headless-auto-pause-blocked");
		artifacts.write("stdout.jsonl", result.stdout);
		artifacts.write("stderr.log", result.stderr);

		assert.equal(
			result.code,
			10,
			`expected blocked exit 10, got code=${result.code} signal=${result.signal} timedOut=${result.timedOut}. artifacts: ${artifacts.dir}`,
		);
		assert.ok(!result.timedOut, "headless auto pause must exit before the harness timeout");
		assert.ok(!/Timeout after/i.test(result.stderrClean), `headless should not report timeout:\n${result.stderrClean}`);

		const events = parseJsonEvents(result.stdoutClean);
		const notifyMessages = events
			.filter((event) => event.type === "extension_ui_request" && event.method === "notify")
			.map((event) => String(event.message ?? ""));

		assert.ok(
			notifyMessages.some((message) => /auto-mode paused due to provider error/i.test(message)),
			`expected provider-error pause notification, got:\n${notifyMessages.join("\n")}`,
		);
		assert.ok(
			notifyMessages.some((message) => /^auto-mode paused/i.test(message)),
			`expected terminal auto-mode paused notification, got:\n${notifyMessages.join("\n")}`,
		);
	});
});
