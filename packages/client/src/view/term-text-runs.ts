/**
 * A guide sentence with `[[id|label]]` glossary markup, as the runs and tips `@mc/ui`'s `mc-term-text` draws:
 * `termTextModelOf` parses and resolves it (`view/term-text-model.ts`), this only reshapes the result. A term that did not
 * resolve (a production fallback) has no tip, so the element reads it as plain words.
 */
import type { McTermRun, McTermTipContent } from "@mc/ui";
import { termTextModelOf, tooltipContentOf } from "./term-text-model.js";

export interface TermTextRuns {
  readonly runs: readonly McTermRun[];
  /** The tips by term id. */
  readonly tips: Readonly<Record<string, McTermTipContent>>;
}

/**
 * `source`'s runs and tips. `linkLabel` is the tip link's words ("RULES GLOSSARY ▸"), already translated; a tip's body is
 * the definition with its source in brackets.
 */
export function termTextRunsOf(source: string, linkLabel: string): TermTextRuns {
  const runs: McTermRun[] = [];
  const tips: Record<string, McTermTipContent> = {};
  for (const run of termTextModelOf(source).runs) {
    if (run.kind === "text") runs.push({ kind: "text", text: run.text });
    else if (run.kind === "break") runs.push({ kind: "break", paragraph: run.paragraph });
    else {
      runs.push({ kind: "term", id: run.id, label: run.label });
      const content = tooltipContentOf(run);
      if (content)
        tips[run.id] = { heading: content.title, body: `${content.definition} (${content.citeLabel})`, linkLabel };
    }
  }
  return { runs, tips };
}
