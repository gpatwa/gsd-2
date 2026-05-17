import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Use a temporary GSD_HOME so the preferences route reads from a known path.
// MUST be set BEFORE importing the route module (webPreferencesPath is module-scope).
const tmpHome = mkdtempSync(join(tmpdir(), "gsd-prefs-test-"));
process.env.GSD_HOME = tmpHome;

const { GET } = await import("../../app/api/preferences/route.ts");

after(() => {
  rmSync(tmpHome, { recursive: true, force: true });
  delete process.env.GSD_HOME;
});

function writePrefs(prefs: Record<string, unknown>) {
  mkdirSync(tmpHome, { recursive: true });
  writeFileSync(join(tmpHome, "web-preferences.json"), JSON.stringify(prefs), "utf-8");
}

describe("GET /api/preferences — launchCwd propagation (#6344)", () => {
  before(() => {
    writePrefs({ devRoot: "/Users/alice/dev", lastActiveProject: "/Users/alice/dev/foo" });
  });

  test("includes launchCwd from GSD_WEB_PROJECT_CWD when set", async () => {
    const prev = process.env.GSD_WEB_PROJECT_CWD;
    process.env.GSD_WEB_PROJECT_CWD = "/Users/alice/dev/launched-project";
    try {
      const res = await GET();
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.launchCwd, "/Users/alice/dev/launched-project");
      assert.equal(body.devRoot, "/Users/alice/dev");
      assert.equal(body.lastActiveProject, "/Users/alice/dev/foo");
    } finally {
      if (prev === undefined) delete process.env.GSD_WEB_PROJECT_CWD;
      else process.env.GSD_WEB_PROJECT_CWD = prev;
    }
  });

  test("launchCwd is null when GSD_WEB_PROJECT_CWD is unset", async () => {
    const prev = process.env.GSD_WEB_PROJECT_CWD;
    delete process.env.GSD_WEB_PROJECT_CWD;
    try {
      const res = await GET();
      const body = (await res.json()) as Record<string, unknown>;
      assert.equal(body.launchCwd, null);
    } finally {
      if (prev !== undefined) process.env.GSD_WEB_PROJECT_CWD = prev;
    }
  });
});
