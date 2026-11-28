/**
 * The Extras reader's page model (`views/reader/mc-reader-page`), as plain data from the book, the search and which pane a
 * phone shows. No Phaser here: the scene hands in what it knows (the sizes, the glyph).
 */
import type { HintGlyph, McArticleBlock } from "@mc/ui";
import { CAMPAIGN_ART, campaignRulebookPageFor } from "../../art/campaign-art.js";
import type { BookSpec } from "../../content/books.js";
import { t } from "../../i18n/translate.js";
import { searchBook, type BookBlock, type BookSection } from "../../view/book-model.js";
import type { ReaderPageModel, ReaderStatus } from "../../views/reader/mc-reader-page/mc-reader-page.types.js";

export interface ReaderModelInput {
  readonly book: BookSpec | null;
  readonly sections: readonly BookSection[] | null;
  readonly failed: boolean;
  readonly current: number;
  readonly query: string;
  readonly pane: "toc" | "text";
  readonly wide: boolean;
  readonly phone: boolean;
  /** The screen's height, to size a page picture so the whole page fits. */
  readonly height: number;
  readonly padKeyboard: boolean;
  readonly backGlyph: HintGlyph | null;
}

/** A book block as the article draws it: an illustration becomes the page picture (or the conversion's note). */
export function articleBlockOf(book: BookSpec, block: BookBlock): McArticleBlock {
  if (block.kind !== "illustration") return block;
  const picture =
    book.pageArtId && block.page !== null ? campaignRulebookPageFor(CAMPAIGN_ART, book.pageArtId, block.page) : null;
  return { kind: "picture", src: picture?.url ?? null, fallback: block.text };
}

/** Why there is no section to read, or "ready". */
export function readerStatusOf(
  book: BookSpec | null,
  sections: readonly BookSection[] | null,
  failed: boolean,
): ReaderStatus {
  return !book ? "none" : failed ? "failed" : !sections ? "loading" : "ready";
}

const MESSAGES: Readonly<Record<Exclude<ReaderStatus, "ready">, () => string>> = {
  none: () => t("reader.noBook"),
  failed: () => t("reader.failed"),
  loading: () => t("reader.loading"),
};

export function readerPageModelOf(input: ReaderModelInput): ReaderPageModel {
  const { book, sections, current, wide, phone } = input;
  const status = readerStatusOf(book, sections, input.failed);
  const ready = status === "ready" && book !== null && sections !== null;
  const showText = ready && (wide || input.pane === "text");
  const section = ready ? sections[current] : undefined;
  const pdfs = book ? book.pdfs.map((pdf) => pdf.label) : [];
  const hits = ready ? searchBook(sections, input.query) : [];
  return {
    wide,
    phone,
    pane: input.pane,
    bar: {
      backLabel: wide ? t("reader.back") : "◂",
      title: book?.title ?? t("reader.rulebook"),
      right: ready && showText && sections.length > 0 ? `${current + 1} / ${sections.length}` : "",
      backGlyph: input.backGlyph,
    },
    status,
    message: status === "ready" ? "" : MESSAGES[status](),
    contents: {
      query: input.query,
      padKeyboard: input.padKeyboard,
      hits: hits.map((index) => ({ key: `toc:${index}`, title: sections![index]!.title })),
      current: wide && ready ? `toc:${current}` : "",
      pdfs: wide ? [] : pdfs,
    },
    text: {
      article:
        section && book
          ? { title: section.title, blocks: section.blocks.map((block) => articleBlockOf(book, block)) }
          : null,
      pictureMax: Math.max(240, input.height - 60 - 56 - 56 - 100),
      pdfs: wide ? pdfs : [],
    },
    nav: { atStart: current <= 0, atEnd: !sections || current >= sections.length - 1 },
  };
}
