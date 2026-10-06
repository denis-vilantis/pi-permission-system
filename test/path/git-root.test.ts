import { describe, expect, it } from "vitest";

import { findGitRoot } from "#src/path/git-root";
import { posixPathFlavor, win32PathFlavor } from "#src/path/path-flavor";

/** An `exists` predicate over an explicit set of `.git` entries. */
function existsIn(entries: readonly string[]): (candidate: string) => boolean {
  const set = new Set(entries);
  return (candidate) => set.has(candidate);
}

describe("findGitRoot", () => {
  it("returns the nearest ancestor holding .git", () => {
    expect(
      findGitRoot(
        "/work/repo/pkg/src",
        posixPathFlavor,
        existsIn(["/work/repo/.git"]),
      ),
    ).toBe("/work/repo");
  });

  it("prefers the nearest repository when repositories nest", () => {
    expect(
      findGitRoot(
        "/work/repo/pkg/src",
        posixPathFlavor,
        existsIn(["/work/repo/.git", "/work/repo/pkg/.git"]),
      ),
    ).toBe("/work/repo/pkg");
  });

  it("returns the start directory when it is itself the repository root", () => {
    expect(
      findGitRoot("/work/repo", posixPathFlavor, existsIn(["/work/repo/.git"])),
    ).toBe("/work/repo");
  });

  it("matches a .git file (worktree/submodule) as well as a directory", () => {
    // The predicate sees the joined path; existence, not kind, is the test.
    expect(
      findGitRoot("/work/wt", posixPathFlavor, existsIn(["/work/wt/.git"])),
    ).toBe("/work/wt");
  });

  it("returns undefined when no ancestor holds .git", () => {
    expect(
      findGitRoot("/work/repo/src", posixPathFlavor, existsIn([])),
    ).toBeUndefined();
  });

  it("stops at the filesystem root", () => {
    expect(findGitRoot("/", posixPathFlavor, existsIn([]))).toBeUndefined();
  });

  it("returns undefined for an empty start directory", () => {
    expect(findGitRoot("", posixPathFlavor, existsIn([]))).toBeUndefined();
  });

  it("walks a win32 path under win32 separators", () => {
    expect(
      findGitRoot(
        "C:\\work\\repo\\src",
        win32PathFlavor,
        existsIn(["C:\\work\\repo\\.git"]),
      ),
    ).toBe("C:\\work\\repo");
  });
});
