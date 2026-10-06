import { existsSync } from "node:fs";
import type { PathFlavor } from "./path-flavor";

/**
 * Walk up from `startDir` to the nearest ancestor that holds a `.git` entry,
 * returning that directory — the repository root — or `undefined` when the
 * walk reaches the filesystem root without finding one.
 *
 * `.git` is tested for existence rather than directory-ness: a worktree or
 * submodule carries a `.git` file instead of a directory, and both mark a
 * repository root.
 *
 * The walk is expressed through the injected {@link PathFlavor}, so win32
 * paths rise under win32 separators on any host. Existence is an injected
 * predicate so that a win32 path can be exercised from a POSIX test host,
 * where the real filesystem cannot hold it; it defaults to `fs.existsSync`.
 */
export function findGitRoot(
  startDir: string,
  flavor: PathFlavor,
  exists: (candidate: string) => boolean = existsSync,
): string | undefined {
  if (!startDir) return undefined;
  let dir = startDir;
  for (;;) {
    if (exists(flavor.impl.join(dir, ".git"))) return dir;
    const parent = flavor.impl.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}
