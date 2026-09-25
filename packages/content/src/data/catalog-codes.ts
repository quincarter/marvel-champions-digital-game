/**
 * Which printed cards an app card stands for, in the whole-game catalog's own unit (`catalog.ts`,
 * `scripts/generate-catalog.ts`).
 *
 * The app and MarvelCDB carve cards up differently. MarvelCDB lists a villain's stages, a main scheme's two sides and
 * a double-sided treachery as separate records; the app folds a villain's stages into one card and splits a few cards
 * MarvelCDB keeps whole. Both sides agree on the printed code, though (`01095`, `01117a`), and the app keeps it in its
 * ids and in every face's scan path, so counting printed codes on both sides compares like with like.
 *
 * Import-free apart from a type, so the Node-run generator and the browser bundle share it.
 */
import type { AnyCard } from "../schema/cards/index.js";

/** A printed code without its face letter: `01001a` and `01001b` are both the card `01001`. */
export const printedCodeOf = (code: string): string => code.replace(/[a-z]$/, "");

const SCAN_PATH = /\/cards\/(\d{5}[a-z]?)\.png$/;

/**
 * Every printed card `card` stands for: its own id, plus every face it carries a scan of (a villain's later stages, a
 * scheme's back), each as a catalog code — face letters dropped, and a reprint resolved to the card it reprints.
 */
export function printedCodesOfCard(card: AnyCard, reprints: Readonly<Record<string, string>>): Set<string> {
  const codes = new Set<string>();
  const add = (code: string): void => {
    const printed = printedCodeOf(code);
    codes.add(reprints[printed] ?? printed);
  };
  if (/^\d{5}[a-z]?$/.test(String(card.id))) add(String(card.id));
  const visit = (value: unknown): void => {
    if (typeof value === "string") {
      const match = SCAN_PATH.exec(value);
      if (match) add(match[1]!);
    } else if (Array.isArray(value)) {
      for (const item of value) visit(item);
    } else if (value !== null && typeof value === "object") {
      for (const item of Object.values(value)) visit(item);
    }
  };
  visit(card);
  return codes;
}

/** The fields of a cached MarvelCDB pack (`raw/marvelcdb/<pack>.json`) the catalog reads. */
export interface RawCatalogPack {
  readonly cards: readonly { readonly code: string; readonly duplicate_of_code?: string | null }[];
}

export interface Catalog {
  readonly packCount: number;
  /** Every printed card's code, reprints left out. */
  readonly codes: ReadonlySet<string>;
  readonly cardCount: number;
  readonly reprints: Readonly<Record<string, string>>;
}

/** Counts the catalog from the cached packs: one per printed code, reprints left out and mapped to their original. */
export function catalogOf(packs: readonly RawCatalogPack[]): Catalog {
  const cards = new Set<string>();
  const reprints: Record<string, string> = {};
  for (const pack of packs) {
    for (const card of pack.cards) {
      const code = printedCodeOf(card.code);
      if (card.duplicate_of_code) reprints[code] = printedCodeOf(card.duplicate_of_code);
      else cards.add(code);
    }
  }
  return { packCount: packs.length, codes: cards, cardCount: cards.size, reprints };
}
