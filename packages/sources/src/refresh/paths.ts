// Where the engine's datasets live, found rather than assumed.
//
// The CLI is run from the repo root by npm, from `packages/sources` by a
// developer, and from wherever the Actions runner feels like by the workflow.
// Walking up to the workspace root makes all three the same.

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** The monorepo root: the nearest ancestor whose package.json has workspaces. */
export function repoRoot(from = dirname(fileURLToPath(import.meta.url))): string {
  let directory = from;
  for (let i = 0; i < 12; i += 1) {
    const manifest = join(directory, "package.json");
    if (existsSync(manifest)) {
      const parsed = JSON.parse(readFileSync(manifest, "utf8")) as {
        workspaces?: unknown;
      };
      if (parsed.workspaces) return directory;
    }
    const parent = dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  throw new Error(`No workspace root above ${from}.`);
}

/** `packages/engine/src/data`, where every dataset module sits. */
export function dataDir(root = repoRoot()): string {
  return join(root, "packages", "engine", "src", "data");
}

/** The two files that name datasets by their dated export. */
export function indexFiles(root = repoRoot()): { data: string; engine: string } {
  return {
    data: join(dataDir(root), "index.ts"),
    engine: join(root, "packages", "engine", "src", "index.ts"),
  };
}
