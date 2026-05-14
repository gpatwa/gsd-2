import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { _parseDiscussArgsForTest } from "../commands/handlers/workflow.ts";

describe("discuss command targeting (#5471)", () => {
  test("parses positional milestone and slice targets", () => {
    assert.deepEqual(_parseDiscussArgsForTest("M014"), { target: "M014", error: null });
    assert.deepEqual(_parseDiscussArgsForTest("M014/S03"), { target: "M014/S03", error: null });
  });

  test("parses --milestone and --slice flags", () => {
    assert.deepEqual(_parseDiscussArgsForTest("--milestone M014"), { target: "M014", error: null });
    assert.deepEqual(_parseDiscussArgsForTest("--slice M014/S03"), { target: "M014/S03", error: null });
  });

  test("returns errors for invalid argument shapes", () => {
    const cases = [
      "--milestone",
      "--slice",
      "--unknown M014",
      "--milestone M014/S03",
      "--slice M014",
      "--milestone M014 --slice M014/S03",
    ];
    for (const input of cases) {
      const parsed = _parseDiscussArgsForTest(input);
      assert.equal(parsed.target, null, `expected null target for: ${input}`);
      assert.ok(parsed.error, `expected error for: ${input}`);
    }
  });

  test("handles whitespace and preserves positional parsing behavior", () => {
    assert.deepEqual(_parseDiscussArgsForTest("   M014   "), { target: "M014", error: null });
    assert.deepEqual(_parseDiscussArgsForTest(""), { target: null, error: null });
    assert.deepEqual(_parseDiscussArgsForTest("m014"), { target: "m014", error: null });
    assert.deepEqual(_parseDiscussArgsForTest("M014/S03/extra"), { target: "M014/S03/extra", error: null });
  });
});
