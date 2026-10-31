/**
 * Cutting a search result to one line (#576). The only part of Settings' search that runs on the main thread, because
 * how much fits is read off the text as drawn; which letters matched comes from the worker (`view/settings-search.ts`).
 */

export interface TextRange {
  readonly start: number;
  readonly end: number;
}

export interface MarkedLine {
  readonly text: string;
  readonly ranges: readonly TextRange[];
}

const ELLIPSIS = "…";
/** Letters kept ahead of the first match when a long description is cut to show it. */
const LEAD_IN = 12;

/** One line of at most `maxChars` holding `text`'s first match, cut at word starts where it can be. */
export function markedLineOf(text: string, ranges: readonly TextRange[], maxChars: number): MarkedLine {
  if (text.length <= maxChars) return { text, ranges };
  const first = ranges[0]?.start ?? 0;
  // The start of the line, unless that would cut the first match off.
  const fits = (ranges[0]?.end ?? 0) < maxChars;
  const leadIn = Math.min(LEAD_IN, Math.floor(maxChars / 3));
  let from = fits ? 0 : Math.min(first - leadIn, text.length - maxChars + 2);
  if (from > 0) {
    const space = text.indexOf(" ", from);
    if (space >= 0 && space < first) from = space + 1;
  }
  from = Math.max(0, from);
  const lead = from > 0 ? ELLIPSIS : "";
  const room = maxChars - lead.length - 1;
  const cut = from + room >= text.length;
  const body = text.slice(from, cut ? text.length : from + room).trimEnd();
  const shift = lead.length - from;
  return {
    text: `${lead}${body}${cut ? "" : ELLIPSIS}`,
    ranges: ranges.flatMap(({ start, end }) => {
      const clipped = { start: Math.max(start, from) + shift, end: Math.min(end, from + body.length) + shift };
      return clipped.end > clipped.start ? [clipped] : [];
    }),
  };
}
