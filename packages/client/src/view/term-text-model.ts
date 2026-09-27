/**
 * `McTermText`'s view model (guided mode G3b, `docs/guided-mode.md` §4): parses a guide string's
 * inline term markup and resolves each term against the Rules glossary (`view/rules-reference.ts`'s
 * `everyGlossaryEntry`, which already merges `@mc/content`'s keyword/status/concept entries with
 * the client's own "exhausted"/"ready"/"facedown boost card" table-state entries — every id a
 * guide surface should ever need to link).
 *
 * **Markup**: `[[id]]` shows the glossary entry's own display name; `[[id|label]]` shows `label`
 * in its place (for a lowercase or inflected mention — "Every villain phase he adds [[threat]] to
 * it", `[[exhausted|exhaust]]`). `id` is any `GlossaryId` (`RulesEntry.id`): a keyword name, a
 * status name, a concept id, or one of the three client-only table-state ids. There is no escape
 * syntax for a literal `[[` — no guide copy needs one today.
 *
 * **Unknown ids.** A term whose `id` doesn't resolve to any glossary entry is a content bug (a
 * typo, or copy written before its glossary entry landed): `termTextModelOf` throws in dev so it
 * fails the authoring pass loudly and is caught by a test, and quietly falls back to plain text (no
 * underline, no tooltip) in a production build, so a stray bad id degrades a sentence instead of
 * crashing the guide.
 */
import { everyGlossaryEntry, type RulesEntry } from "./rules-reference.js";

/** A plain span of text with no term markup. */
export interface TermTextWord {
  readonly kind: "text";
  readonly text: string;
}

/** A resolved `[[id]]` / `[[id|label]]` span. `entry` is `null` only in a production fallback (see module header). */
export interface TermTextTerm {
  readonly kind: "term";
  readonly id: string;
  readonly label: string;
  readonly entry: RulesEntry | null;
}

export type TermTextRun = TermTextWord | TermTextTerm;

export interface TermTextModel {
  readonly runs: readonly TermTextRun[];
  /** Ids from the markup that didn't resolve to any glossary entry — always empty once content is fixed. */
  readonly unknownIds: readonly string[];
}

const TERM_PATTERN = /\[\[([^[\]|]+)(?:\|([^[\]]+))?]]/g;

/** Splits `source` into text and (unresolved) term runs, with no glossary lookup. Exported for the widget's own tests. */
export function parseTermText(
  source: string,
): readonly (TermTextWord | { readonly kind: "term"; readonly id: string; readonly label?: string })[] {
  const runs: (TermTextWord | { readonly kind: "term"; readonly id: string; readonly label?: string })[] = [];
  let last = 0;
  for (const match of source.matchAll(TERM_PATTERN)) {
    const start = match.index ?? 0;
    if (start > last) runs.push({ kind: "text", text: source.slice(last, start) });
    const id = match[1]!.trim();
    const label = match[2]?.trim();
    runs.push({ kind: "term", id, ...(label ? { label } : {}) });
    last = start + match[0].length;
  }
  if (last < source.length) runs.push({ kind: "text", text: source.slice(last) });
  return runs;
}

let glossaryLookup: ReadonlyMap<string, RulesEntry> | null = null;

/** Every glossary entry the client knows, by id — built once (the glossary is static content) and cached. */
function defaultLookup(): ReadonlyMap<string, RulesEntry> {
  glossaryLookup ??= new Map(everyGlossaryEntry().map((entry) => [entry.id, entry]));
  return glossaryLookup;
}

/**
 * Parses `source` and resolves every term against `lookup` (defaults to the full glossary,
 * `defaultLookup`). `devMode` (defaults to `import.meta.env.DEV`, overridable so a test can exercise
 * both branches without faking the build mode) decides what an unknown id does — see the module
 * header.
 */
export function termTextModelOf(
  source: string,
  lookup: ReadonlyMap<string, RulesEntry> = defaultLookup(),
  devMode: boolean = import.meta.env.DEV,
): TermTextModel {
  const raw = parseTermText(source);
  const unknownIds: string[] = [];
  const runs: TermTextRun[] = raw.map((run) => {
    if (run.kind === "text") return run;
    const entry = lookup.get(run.id) ?? null;
    if (!entry) unknownIds.push(run.id);
    return { kind: "term", id: run.id, label: run.label ?? entry?.displayName ?? run.id, entry };
  });
  if (devMode && unknownIds.length > 0) {
    throw new Error(`McTermText: unknown glossary id(s) in guide copy: ${unknownIds.join(", ")} (source: "${source}")`);
  }
  return { runs, unknownIds };
}

/** A term run's tooltip content: title, one-line definition, and the cite label — what `McTooltip` shows. */
export interface TermTooltipContent {
  readonly title: string;
  readonly definition: string;
  readonly citeLabel: string;
}

/** `null` only for a production-fallback term whose `entry` is `null` (see module header) — such a term draws as plain text and never opens a tooltip. */
export function tooltipContentOf(term: TermTextTerm): TermTooltipContent | null {
  if (!term.entry) return null;
  return { title: term.entry.displayName, definition: term.entry.definition, citeLabel: term.entry.citeLabel };
}
