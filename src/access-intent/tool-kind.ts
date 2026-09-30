import type { ShellToolsConfig } from "#src/config/config-schema";
import { getNonEmptyString, toRecord } from "#src/value-guards";
import { PATH_BEARING_TOOLS } from "./path-surfaces";

/**
 * What a tool invocation accesses — decided once from the tool name at the
 * point an invocation enters the system.
 *
 * This is the single dispatch point that replaces the scattered
 * `toolName === "bash"`/`"mcp"` re-derivation across the extraction consumers
 * (`input-normalizer`, `tool-input-path`, the tool-call gate pipeline, and
 * `permission-manager`'s source derivation) and the presentation consumers
 * (`tool-preview-formatter`, `permission-prompts`, the payload builders, and
 * `deriveDecisionValue`), which dispatch on {@link classifyToolKind} or
 * {@link isMcpCheck}. Adding a tool kind means editing {@link classifyToolKind}
 * plus the exhaustive switches the compiler flags — an OCP win over silent
 * `===` comparisons a new variant sails past (#561).
 *
 * The value is plain data (a string union): `tool-kind.ts` imports no
 * `AccessPath`, so `permission-manager.ts` may consume it without breaching the
 * string boundary formalized in ADR-0002
 * (`docs/decisions/0002-path-values-string-boundary.md`).
 *
 * - `bash` — its own token-based path gates; extraction product is the command.
 * - `mcp` — extraction product is the qualified target.
 * - `skill` — a distinct surface `normalizeInput`/`deriveSource` treat specially.
 * - `path` — a path-bearing built-in (`read`/`write`/`edit`/`grep`/`find`/`ls`);
 *   extraction product is `input.path`.
 * - `extension` — every other tool, plus the `external_directory`/`path` special
 *   surfaces that reach `deriveSource` as normalized names.
 */
export type ToolKind = "bash" | "mcp" | "skill" | "path" | "extension";

/** Classify a tool name into its {@link ToolKind}. */
export function classifyToolKind(toolName: string): ToolKind {
  const name = toolName.trim();
  if (name === "bash") return "bash";
  if (name === "mcp") return "mcp";
  if (name === "skill") return "skill";
  if (PATH_BEARING_TOOLS.has(name)) return "path";
  return "extension";
}

/** A shell invocation's effective command and optional working directory. */
export interface ShellInvocation {
  /** The shell command string to decompose and gate. */
  command: string;
  /** The working directory the command runs in, if the tool projects one. */
  workdir: string | undefined;
}

/**
 * Decide whether a tool invocation carries shell semantics, and if so extract
 * its command and working directory.
 *
 * Native `bash` and any tool recorded in `shellTools` both yield a
 * {@link ShellInvocation}; every other tool yields `null`. This is the single
 * dispatch point the bash gate pipeline consults instead of re-deriving
 * `toolName === "bash"` and reading `input.command`, so an aliased shell tool
 * (e.g. `@howaboua/pi-codex-conversion`'s `exec_command`) is routed through the
 * same bash enforcement stack as native `bash` (#574).
 *
 * The command and workdir are read through {@link getNonEmptyString} (trimmed,
 * empty → `""`/`undefined`), matching the pipeline's existing native-bash
 * extraction. Kept separate from {@link classifyToolKind} because it needs
 * config (the alias map) and returns a richer product than a {@link ToolKind}
 * string — `classifyToolKind` stays AccessPath-free and config-free.
 *
 * An alias may carry a predicate (`whenArgument`/`whenEquals`) so only some
 * calls of the aliased tool are shell invocations — e.g. a code-execution tool
 * whose `language` argument decides whether its `code` is shell. A call that
 * does not match the predicate is not aliased for that call, so it keeps its
 * normal extension surface.
 *
 * An alias may also point `commandArgument` at an array (`commandItemArgument`
 * naming the item's command field) so a batch tool's commands are joined into
 * one newline-separated program and gated unit-by-unit.
 */
export function resolveShellInvocation(
  toolName: string,
  input: unknown,
  aliases: ShellToolsConfig | undefined,
): ShellInvocation | null {
  const name = toolName.trim();
  const record = toRecord(input);

  if (name === "bash") {
    return {
      command: getNonEmptyString(record.command) ?? "",
      workdir: undefined,
    };
  }

  const alias = aliases?.[name];
  if (alias) {
    if (!aliasMatches(alias, record)) {
      return null;
    }
    return {
      command: resolveAliasCommand(record[alias.commandArgument], alias),
      workdir: alias.workdirArgument
        ? (getNonEmptyString(record[alias.workdirArgument]) ?? undefined)
        : undefined,
    };
  }

  return null;
}

/** One configured shell-tool alias. */
type ShellToolAlias = ShellToolsConfig[string];

/**
 * Evaluate a shell alias's optional `whenArgument`/`whenEquals` predicate.
 *
 * No predicate → the alias always applies. Otherwise the named input argument
 * must match: membership in `whenEquals` when set, truthiness when not. A
 * non-matching call returns `null` from {@link resolveShellInvocation}, leaving
 * the tool on its normal extension surface for that call.
 */
function aliasMatches(
  alias: ShellToolAlias,
  record: Record<string, unknown>,
): boolean {
  if (!alias.whenArgument) {
    return true;
  }
  const actual = record[alias.whenArgument];
  if (alias.whenEquals === undefined) {
    return Boolean(actual);
  }
  const allowed = Array.isArray(alias.whenEquals)
    ? alias.whenEquals
    : [alias.whenEquals];
  return typeof actual === "string" && allowed.includes(actual);
}

/**
 * Read a shell alias's command argument, joining an array of command items
 * into one newline-separated shell program so every item is decomposed and
 * gated by the bash stack.
 *
 * Arrays may hold plain strings, or records whose command lives under
 * `commandItemArgument` (e.g. `commands: [{ command: "npm i" }]`). Items that
 * yield no command are dropped; a non-array value keeps the single-string
 * behavior.
 */
function resolveAliasCommand(
  value: unknown,
  alias: ShellToolAlias,
): string {
  if (!Array.isArray(value)) {
    return getNonEmptyString(value) ?? "";
  }
  const itemArgument = alias.commandItemArgument;
  const commands = value
    .map((item) =>
      itemArgument === undefined
        ? getNonEmptyString(item)
        : getNonEmptyString(toRecord(item)[itemArgument]),
    )
    .filter((command): command is string => command !== null);
  return commands.join("\n");
}

/** The resolved-check fields that decide MCP-ness. */
interface McpKindFields {
  toolName: string;
  source: string;
}

/**
 * True when a resolved check concerns an MCP call — either the invoked tool is
 * `mcp`, or the winning rule matched on the `mcp` surface (`source`). The
 * `source` disjunct is why this cannot reduce to `classifyToolKind(toolName)`:
 * `deriveSource` can set `source` to `mcp` on a result whose `toolName` is a
 * server-qualified string.
 */
export function isMcpCheck(check: McpKindFields): boolean {
  return check.source === "mcp" || classifyToolKind(check.toolName) === "mcp";
}
