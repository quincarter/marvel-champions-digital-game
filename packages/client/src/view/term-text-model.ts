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
 *
 * **Paragraphs.** A blank line (`\n\n`, or any run of two-or-more newlines) in guide copy starts a
 * new paragraph — `McTermText` draws a paragraph gap (~0.6 line-height) before it, wider than the
 * ordinary line gap, rather than joining the two sentences with no space at all (the bug this
 * exists to fix). A single `\n` is an ordinary line break, no extra gap. Only whole `[[id]]` term
 * labels are exempt from this splitting — a label is never itself expected to contain a newline.
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

/** A `\n` (ordinary line break) or `\n\n`+ (paragraph break, wider gap) in the source copy — see the module header. */
export interface TermTextBreak {
  readonly kind: "break";
  readonly paragraph: boolean;
}

export type TermTextRun = TermTextWord | TermTextTerm | TermTextBreak;

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

/**
 * Splits a raw text run's own text on newlines into text/break runs — `\n\n`+ becomes one `paragraph`
 * break, a lone `\n` becomes a `line` break, an empty line between markup (e.g. text ending right
 * before a paragraph break) contributes no empty text run.
 */
function splitOnBreaks(text: string): readonly (TermTextWord | TermTextBreak)[] {
  const runs: (TermTextWord | TermTextBreak)[] = [];
  const paragraphs = text.split(/\n{2,}/);
  paragraphs.forEach((paragraph, pi) => {
    if (pi > 0) runs.push({ kind: "break", paragraph: true });
    const lines = paragraph.split("\n");
    lines.forEach((line, li) => {
      if (li > 0) runs.push({ kind: "break", paragraph: false });
      if (line.length > 0) runs.push({ kind: "text", text: line });
    });
  });
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
  const runs: TermTextRun[] = [];
  for (const run of raw) {
    if (run.kind === "text") {
      runs.push(...splitOnBreaks(run.text));
      continue;
    }
    const entry = lookup.get(run.id) ?? null;
    if (!entry) unknownIds.push(run.id);
    runs.push({ kind: "term", id: run.id, label: run.label ?? entry?.displayName ?? run.id, entry });
  }
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
