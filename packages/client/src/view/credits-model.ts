/**
 * The Art & Credits screen (`scenes/credits.ts`) as plain data: the fan-project notice, then one section per group of
 * `content/credits.ts`, each entry a row. Rows are read-only text, so a phone swipe that lifts over one fires nothing
 * (CLAUDE.md, no tap on finger lift). Row heights are estimated from the text length because the rows wrap.
 */
import { CREDITS, CREDIT_GROUPS, CREDITS_INTRO, type CreditEntry, type CreditGroup } from "../content/credits.js";

export type CreditsRow =
  | { readonly kind: "notice"; readonly text: string }
  | { readonly kind: "section"; readonly id: CreditGroup; readonly title: string; readonly count: string }
  | { readonly kind: "entry"; readonly entry: CreditEntry };

export function creditsRowsOf(): readonly CreditsRow[] {
  const rows: CreditsRow[] = CREDITS_INTRO.map((text) => ({ kind: "notice", text }));
  for (const group of CREDIT_GROUPS) {
    const entries = CREDITS.filter((entry) => entry.group === group.id);
    if (entries.length === 0) continue;
    rows.push({ kind: "section", id: group.id, title: group.title, count: String(entries.length) });
    for (const entry of entries) rows.push({ kind: "entry", entry });
  }
  return rows;
}

/** Lines `text` needs at `width` px in a font `size` px high (a plain average-glyph estimate, rounded up). */
export function wrappedLinesOf(text: string, width: number, size: number): number {
  const perLine = Math.max(8, Math.floor(width / (size * 0.54)));
  let lines = 0;
  for (const paragraph of text.split("\n")) {
    let used = 0;
    let line = 1;
    for (const word of paragraph.split(/\s+/)) {
      const need = word.length + (used > 0 ? 1 : 0);
      if (used + need > perLine && used > 0) {
        line += 1;
        used = word.length;
      } else used += need;
      // A word longer than a line (a web address) is broken across lines.
      if (word.length > perLine) {
        line += Math.floor((word.length - 1) / perLine);
        used = word.length % perLine;
      }
    }
    lines += line;
  }
  return lines;
}

/** Font sizes in px; the scene draws with these and the height estimate reads the same numbers. */
export const CREDITS_TEXT = { notice: 13, title: 15, body: 12, small: 11 } as const;
export const CREDITS_LINE = 1.4;

export const shownInLabelOf = (entry: CreditEntry): string => `Shown in: ${entry.shownIn}`;

export function creditsRowHeightOf(row: CreditsRow, textWidth: number): number {
  if (row.kind === "section") return 46;
  if (row.kind === "notice") {
    return (
      Math.ceil(wrappedLinesOf(row.text, textWidth, CREDITS_TEXT.notice) * CREDITS_TEXT.notice * CREDITS_LINE) + 16
    );
  }
  const { entry } = row;
  const block = (text: string, size: number): number => wrappedLinesOf(text, textWidth, size) * size * CREDITS_LINE;
  const height =
    block(entry.title, CREDITS_TEXT.title) +
    block(shownInLabelOf(entry), CREDITS_TEXT.small) +
    block(entry.credit, CREDITS_TEXT.body) +
    block(entry.notice, CREDITS_TEXT.small) +
    (entry.url ? block(entry.url, CREDITS_TEXT.small) : 0);
  return Math.ceil(height) + 24;
}
