/**
 * A rulebook as the Extras reader shows it (`scenes/extras-reader.ts`): plain text in sections, parsed from the
 * repo's markdown conversions of the official PDFs (the Rules Reference, the campaign rulebooks, the rulings
 * transcript). The reader draws Phaser text, not HTML, so this turns markdown into a handful of block kinds and
 * cleans off the markup and the PDF-conversion noise (running page headers, page numbers, dot-leader index rows,
 * private-use icon glyphs) along the way.
 *
 * Pure, so parsing is tested against the real files without a scene.
 */

export type BookBlock =
  /** A heading inside a section (one the section split didn't break on). */
  | { readonly kind: "heading"; readonly text: string }
  | { readonly kind: "paragraph"; readonly text: string }
  /** A list item; `depth` 0 is top level. */
  | { readonly kind: "bullet"; readonly text: string; readonly depth: number }
  /** A quoted or called-out passage: a card, a sidebar, flavor text. */
  | { readonly kind: "quote"; readonly text: string };

export interface BookSection {
  readonly title: string;
  readonly blocks: readonly BookBlock[];
}

export interface BookParseOptions {
  /** Heading levels that start a new section; deeper or other headings stay inside it as `heading` blocks. */
  readonly splitAt: readonly number[];
  /** The first section's title, when the text before the first split heading has any body. */
  readonly preamble?: string;
  /** Sections dropped by title (a markdown table of contents is links the reader can't follow). */
  readonly skipTitles?: RegExp;
}

/** Private-use-area glyphs: the PDFs' icon font, meaningless as text. */
const PRIVATE_USE = /[-]/g;

/** Markdown inline markup off, whitespace and punctuation spacing tidied. */
export function cleanInline(raw: string): string {
  return (
    raw
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\(([^)]*)\)/g, (_, text: string, url: string) => (text.trim() ? text : url))
      .replace(PRIVATE_USE, "")
      .replace(/\*\*|__|~~/g, "")
      // Single `_`/`*` emphasis, only where it opens or closes a run (never inside a word or an id).
      .replace(/(^|[\s(“"'«])[_*]+(?=\S)/g, "$1")
      .replace(/(\S)[_*]+(?=$|[\s).,;:!?”"'»])/g, "$1")
      .replace(/\s*\*+\s*$/, "")
      .replace(/\(\s*\)/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+([.,;:!?”)])/g, "$1")
      .replace(/([“(])\s+/g, "$1")
      .trim()
  );
}

/** Lines a PDF conversion leaves behind that are no part of the text. */
function isNoise(text: string): boolean {
  return (
    text === "" ||
    /^\d{1,3}$/.test(text) ||
    /^r\s*ules\s*r\s*efe\s*r\s*ence$/i.test(text) ||
    /^Source: .*\(Page \d+ of \d+\)$/i.test(text)
  );
}

/** "Page 6: Page 6 Rules" → "Page 6": the converter's placeholder for a page with no heading of its own. */
function sectionTitle(text: string): string {
  const placeholder = /^Page (\d+): Page \1 Rules$/i.exec(text);
  return placeholder ? `Page ${placeholder[1]}` : text;
}

export function parseBook(markdown: string, options: BookParseOptions): readonly BookSection[] {
  const split = new Set(options.splitAt);
  const sections: { title: string; blocks: BookBlock[] }[] = [];
  let current: { title: string; blocks: BookBlock[] } = { title: options.preamble ?? "Introduction", blocks: [] };
  let paragraph: string[] = [];
  let quote: string[] = [];

  const flushParagraph = (): void => {
    const text = cleanInline(paragraph.join(" "));
    paragraph = [];
    if (!isNoise(text)) current.blocks.push({ kind: "paragraph", text });
  };
  const flushQuote = (): void => {
    const lines = quote.map(cleanInline).filter((line) => line !== "");
    quote = [];
    if (lines.length > 0) current.blocks.push({ kind: "quote", text: lines.join("\n") });
  };
  const flush = (): void => {
    if (paragraph.length > 0) flushParagraph();
    if (quote.length > 0) flushQuote();
  };
  const closeSection = (): void => {
    flush();
    if (current.blocks.length > 0 && !options.skipTitles?.test(current.title)) sections.push(current);
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, "");
    const trimmed = line.trim();

    const quoteLine = /^>\s?(.*)$/.exec(trimmed);
    if (quoteLine) {
      if (paragraph.length > 0) flushParagraph();
      // `> [!NOTE] Card / Graphic Callout`: the converter's own label, not the card's text.
      const body = quoteLine[1]!.replace(/^\[![A-Z]+\]\s*(Card \/ Graphic Callout)?/i, "");
      quote.push(body);
      continue;
    }
    if (quote.length > 0) flushQuote();

    if (trimmed === "" || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed) || trimmed.startsWith("<a id=")) {
      flush();
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(trimmed);
    if (heading) {
      flush();
      const text = cleanInline(heading[2]!);
      if (split.has(heading[1]!.length)) {
        closeSection();
        current = { title: sectionTitle(text), blocks: [] };
      } else if (text !== "") {
        current.blocks.push({ kind: "heading", text });
      }
      continue;
    }

    if (trimmed.startsWith("|")) {
      flush();
      // Separator rows, and the index's dot-leader rows ("Ability ........4"), carry nothing readable.
      if (/^\|[\s:|-]+\|?$/.test(trimmed) || trimmed.includes("....")) continue;
      const cells = trimmed
        .replace(/^\||\|$/g, "")
        .split("|")
        .map(cleanInline)
        .filter((cell) => cell !== "");
      if (cells.length > 0) current.blocks.push({ kind: "paragraph", text: cells.join(" · ") });
      continue;
    }

    const bullet = /^(\s*)[-*+]\s+(.*)$/.exec(line);
    if (bullet) {
      flush();
      let depth = Math.floor(bullet[1]!.replace(/\t/g, "  ").length / 2);
      let body = bullet[2]!;
      // The RRG's "»" sub-points are drawn as a second level.
      const sub = /^(\*\*)?»(\*\*)?\s*/.exec(body);
      if (sub) {
        depth += 1;
        body = body.slice(sub[0].length);
      }
      const text = cleanInline(body);
      if (!isNoise(text)) current.blocks.push({ kind: "bullet", text, depth });
      continue;
    }

    paragraph.push(trimmed);
  }
  closeSection();
  return sections;
}

/**
 * The sections a search finds, in book order: every section whose title or text holds `query` (case-insensitive),
 * title matches first. An empty query finds every section.
 */
export function searchBook(sections: readonly BookSection[], query: string): readonly number[] {
  const needle = query.trim().toLowerCase();
  const all = sections.map((_, index) => index);
  if (needle === "") return all;
  const inTitle = all.filter((index) => sections[index]!.title.toLowerCase().includes(needle));
  const inBody = all.filter(
    (index) =>
      !inTitle.includes(index) && sections[index]!.blocks.some((block) => block.text.toLowerCase().includes(needle)),
  );
  return [...inTitle, ...inBody];
}
