// Pointing the engine at a new vintage.
//
// The datasets are named for the edition they carry — `EURIBOR_2026_07` lives
// in `euribor-2026-07.ts` — which means replacing one is a rename, and a rename
// touches the two files that spell the name out: the data registry and the
// engine's public surface. Those edits are mechanical, so they are done here,
// as string transformations that can be tested without a filesystem.
//
// The alias the rest of the code imports (`EURIBOR_FALLBACK`) does not change,
// which is why this stays a two-file edit rather than a rename across the app.

export interface Rename {
  /** e.g. `EURIBOR_2026_07`. */
  fromConstant: string;
  /** e.g. `EURIBOR_2026_08`. */
  toConstant: string;
  /** e.g. `./euribor-2026-07.js`, as written in an import. */
  fromModule: string;
  toModule: string;
}

/** A regex matching an identifier, and nothing it is merely a prefix of. */
function identifier(name: string): RegExp {
  return new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
}

/**
 * Apply a rename to a file's text.
 *
 * Throws when the old name is absent: a rewire that silently changed nothing
 * would leave the engine importing a module the refresh has just deleted, and
 * the failure would surface as a broken build rather than as this message.
 */
export function rewire(source: string, rename: Rename): string {
  if (!identifier(rename.fromConstant).test(source)) {
    throw new Error(`Expected to find ${rename.fromConstant} to rewire.`);
  }
  return source
    .replace(identifier(rename.fromConstant), rename.toConstant)
    .split(rename.fromModule)
    .join(rename.toModule);
}

/** Whether a rewire would be a no-op, i.e. the vintage is already the one shipped. */
export function isSameVintage(rename: Rename): boolean {
  return rename.fromConstant === rename.toConstant;
}
