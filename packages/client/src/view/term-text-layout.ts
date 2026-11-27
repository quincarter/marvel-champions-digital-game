/**
 * Where each word of a guide sentence with inline glossary terms (`view/term-text-model.ts`) sits when it is wrapped at
 * a width: the pure layout `ui/term-text.ts`'s Phaser widget does as it adds one Text per word, for a screen that draws
 * the sentence as a Lit panel (`scenes/how-to-win.ts`). Words keep their trailing space, a term is one atomic word, a
 * line break starts a new line (a paragraph break a wider gap), and a word that would run past the width starts the
 * next line.
 */
import type { TermTextModel, TermTextTerm } from "./term-text-model.js";

/** One positioned word, in the block's own coordinates (from its top left). */
export interface LaidWord {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  /** The glossary term this word is, or null for plain text. */
  readonly term: TermTextTerm | null;
}

export interface TermTextLayout {
  readonly words: readonly LaidWord[];
  readonly height: number;
}

/** Splits a text run on whitespace, each word keeping its own trailing space (a pure-whitespace run is its own piece). */
function piecesOf(text: string): readonly string[] {
  return [...text.matchAll(/\S+\s*|\s+/g)].map((match) => match[0]);
}

/**
 * Lays `model` out at `width` with `lineHeight` between lines; `measure` is the drawn width of a piece of text. A blank
 * piece never opens a line, and one that would overflow is dropped at the wrap.
 */
export function layoutTermText(
  model: TermTextModel,
  width: number,
  lineHeight: number,
  measure: (text: string) => number,
): TermTextLayout {
  const paragraphGap = Math.round(lineHeight * 0.6);
  const words: LaidWord[] = [];
  let x = 0;
  let y = 0;
  const place = (text: string, term: TermTextTerm | null): void => {
    const blank = term === null && text.trim() === "";
    const wordWidth = measure(text);
    if (blank && x === 0) return;
    if (x + wordWidth > width && x > 0) {
      x = 0;
      y += lineHeight;
      if (blank) return;
    }
    words.push({ text, x, y, width: wordWidth, term });
    x += wordWidth;
  };
  for (const run of model.runs) {
    if (run.kind === "text") for (const piece of piecesOf(run.text)) place(piece, null);
    else if (run.kind === "term") place(run.label, run);
    else {
      x = 0;
      y += lineHeight + (run.paragraph ? paragraphGap : 0);
    }
  }
  return { words, height: y + lineHeight };
}
