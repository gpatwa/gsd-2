import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { webPreferencesPath } from "../../../../src/app-paths.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Shape of persisted web preferences. */
interface WebPreferences {
  devRoot?: string;
  lastActiveProject?: string;
}

/**
 * Shape returned by GET. `launchCwd` is the CWD the user launched `gsd --web`
 * from, propagated by the CLI via `GSD_WEB_PROJECT_CWD`. The client uses it
 * to auto-select the launch project instead of falling back to
 * `lastActiveProject` (or alphabetically first). See issue #6344.
 */
interface WebPreferencesResponse extends WebPreferences {
  launchCwd: string | null;
}

function readLaunchCwd(): string | null {
  const v = process.env.GSD_WEB_PROJECT_CWD;
  return typeof v === "string" && v.length > 0 ? v : null;
}

// ─── GET: read current preferences ─────────────────────────────────────────

export async function GET(): Promise<Response> {
  const launchCwd = readLaunchCwd();
  try {
    if (!existsSync(webPreferencesPath)) {
      const body: WebPreferencesResponse = { launchCwd };
      return Response.json(body);
    }
    const raw = readFileSync(webPreferencesPath, "utf-8");
    const prefs: WebPreferences = JSON.parse(raw);
    const body: WebPreferencesResponse = { ...prefs, launchCwd };
    return Response.json(body);
  } catch {
    // File corrupt or unreadable — return empty (but still surface launchCwd)
    const body: WebPreferencesResponse = { launchCwd };
    return Response.json(body);
  }
}

// ─── PUT: write preferences ────────────────────────────────────────────────

export async function PUT(request: Request): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;

    // Read existing prefs to merge (don't clobber fields not in this request)
    let existing: WebPreferences = {};
    try {
      if (existsSync(webPreferencesPath)) {
        existing = JSON.parse(readFileSync(webPreferencesPath, "utf-8"));
      }
    } catch {
      // Corrupt file — start fresh
    }

    // Merge only provided keys
    const prefs: WebPreferences = { ...existing };
    if (typeof body.devRoot === "string") {
      prefs.devRoot = body.devRoot;
    }
    if (typeof body.lastActiveProject === "string") {
      prefs.lastActiveProject = body.lastActiveProject;
    }

    // Ensure parent directory exists
    const dir = dirname(webPreferencesPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(webPreferencesPath, JSON.stringify(prefs, null, 2), "utf-8");
    return Response.json(prefs);
  } catch (err) {
    return Response.json(
      { error: `Failed to write preferences: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 },
    );
  }
}
