---
issue: 910
issue_title: "pi-permission-system: an absolute-path bash rule does not cover the relative spelling of the same path"
---

# Retro: #910 — pi-permission-system: an absolute-path bash rule does not cover the relative spelling of the same path

## Stage: Planning (2026-10-06T05:23:32Z)

### Session summary

The issue was third-party, filed and self-closed within a minute with a close comment claiming a maintainer decision; at the operator's direction it was reopened and planned on [#981]'s `BashCommand.spellings` seam rather than on PR [#917]'s separate `alias-values` intent.
The plan adds a second spelling producer (each resolvable path argument replaced by `AccessPath.value()`), joined to unit words by exact source span, plus a `matchedSpelling` fact through the result, dialog, and review log.
The roadmap disposition ("out of scope for Phase 15") landed as its own commit.

### Observations

- Reproduced on `main` with disposable probes over the real resolver and manager: the defect also fails **open**: an absolute bash `deny` is skipped by `cd /tmp && rm agent-builds/x` and by an in-cwd relative spelling (`allow` via `*`).
  The issue only described the fail-closed half.
- Operator decisions: absolute spelling only (no canonical, no project-relative); include the presentation half in this plan; classify as `fix!` (precedent: [#928]'s MCP last-match-wins change).
- The service advisory (`parseBashCommandsSync`) has no `PathNormalizer`, so without a change it would answer weaker than the gate; the plan replaces it with `BashProgram.parseSync` sharing one builder with `parse`, and deletes `sync-commands.ts`.
- The Tidy-First assessor caught a real hole: `rm $DIR/x` is a rule candidate today, and `path.value()` would invent `/cwd/$DIR/x`, which an absolute `allow` matches.
  The plan guards on `ArgWord.computed` in the enumerator and also excludes glob words.
- Design change from #917: the resolver records spellings per occurrence (before the dedup fold) in an `ArgumentSpeller` the enumerator asks per word node, so `BashPathRuleCandidate` and `CommandWord` stay unchanged.
  `BashCommand.spellings` stays absent when nothing is spelled.
- Expect assertion churn in `program.test.ts` (85 exact `commands()` assertions at planning) at step 6; any diff other than `spellings` there is a finding.
- Measured blast radius (heuristic regex): 310 of 13772 `bash`-surface entries in the local review log are a `cd` followed by a relative slash-bearing argument.
- PR [#917] is still open and conflicting; it is the close target at ship time, and step 6 carries its `Co-authored-by:` trailer.

#### Deferred tidyings

- `token-collection.ts`: the six `role: "operand"` literals share no single factory, because the derived sites have no span; the assessor rejected collapsing them as the wrong abstraction.
- Presentation: the request builders' repeated `executedUnit: null` literals, and the eight test files asserting full request literals; `test/helpers/prompt-details-fixtures.ts` could absorb them.

## Stage: Implementation — TDD (2026-10-06T06:00:22Z)

### Session summary

All nine plan steps landed as separate commits, plus a review-driven `test:` and `docs:` pair: `BashProgram.parseSync`, the advisory routed through it (`sync-commands.ts` deleted), `PathToken.span`, the resolver's `argumentSpellings`, the enumerator wiring (`fix!`), `matchedSpelling` on the result, and its dialog/log/redaction presentation.
The `pi-permission-system` suite went from 5587 to 5634 tests, and every killing mutation the plan named turned its tests red.

### Observations

- Deviation: step 5's planned killing test for the `isAbsolute` guard (`cd "$DIR" && rm ./a/x`) survived the mutation, because the literal form of `./a/x` equals the token, so `spelling === token` already excluded it.
  A token whose literal form differs (`rm "'a/x"`, whose leading quote `normalizePathPolicyLiteral` strips) is the one input that exercises the guard; that test was added and kills the mutation.
- Deviation: the salvaged-fragment test cannot assert an empty set, because a fragment node can share a span with a spelled primary-tree node (`f` in the redirect); it asserts the fragment's own token (`/tmp/../x` → `/x`) is absent instead.
- The enumeration-focused exact assertions that changed: 20 (`program.test.ts`, `program-parse-sync.test.ts`, and the metamorphic "salvage only adds" property, whose baseline now passes the resolver's speller to `collectCommands`).
  Two #981 tests that said "does not spell" `echo ~/x` and `sudo ~/bin/x` now assert the argument spelling, the case #981 deferred to this issue.
- Observed residual: the path projection classifies by shape, so an opaque wrapper's inline script (`bash -c "rm -rf /"` → `bash -c <cwd>/rm -rf `) and a slash-bearing non-path word (`git push origin feature/x`) get spellings too.
  The wrapper floor covers the first; the second is pinned by a test and documented in `docs/configuration.md`.
- `git interpret-trailers` found no trailer when `Refs #910` and `Co-authored-by:` shared a paragraph; the `fix!` commit puts them in separate paragraphs, matching the repo's prior `BREAKING CHANGE` + co-author commits.
- `pnpm --silent fallow guard` errors on stale `pi-subagents` boundary zones in `.fallowrc.json`, so the planned guard check could not run; `fallow dead-code` passes.
- Pre-completion reviewer: WARN on the full range (non-path slash tokens spelled, undocumented; advisory/gate differ for an aliased shell tool's `workdir`, an accepted Non-Goal), then PASS on the delta that pinned and documented the first item.

[#917]: https://github.com/gotgenes/pi-packages/pull/917
[#928]: https://github.com/gotgenes/pi-packages/issues/928
[#981]: https://github.com/gotgenes/pi-packages/issues/981

## Stage: Sync (worktree) (2026-10-06T06:02:36Z)

### Session summary

Pre-push checks passed (`pnpm run lint`, `pnpm fallow dead-code`), and the reviewer's earlier WARN was already settled by the delta commits, so nothing is open at land time.
The plan's marker is `**Release:** ship independently`, and the `fix!` commit makes it a major; PR #917 is the close target at ship time.

**Peer session transcript:** `/Users/chris/.pi/agent/sessions/--Users-chris-development-pi-pi-packages-worktrees-issue-910--/2026-10-06T05-02-55-824Z_01a10f97-e750-70cf-8b7c-aa3c8606400b.jsonl` — read with `read_session_file({ path: "<path>" })` for message-level verification at land/retro time.

### Observations

- The Phase 15 sweep disposition ("out of scope for the roadmap") already landed on this branch as `docs(pi-permission-system): disposition #910 against Phase 15`, so the root needs no roadmap edit.
- `.fallowrc.json` still carries stale `pi-subagents` boundary zones that make `fallow guard` error; `fallow dead-code` is unaffected.
