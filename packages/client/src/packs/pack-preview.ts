/**
 * A pack's `preview.json` as the Mod Store reads it (docs/custom-content-packs.md §11.5, `PackPreview` in
 * `@mc/content`). The file is fetched before anything of the pack is trusted, so it is untrusted data: this validates
 * its shape, keeps only the pack's own well-formed cards and drops the rest. Pure (no DOM, no network), so it also runs
 * in the preview worker (`pack-preview.worker.ts`).
 */
import {
  PACK_PREVIEW_MAX_BYTES,
  PACK_PREVIEW_SCHEMA_VERSION,
  customCardPrefix,
  parsePackCardImagePath,
  validateCard,
  type AnyCard,
  type PackLanguages,
} from "@mc/content";

/** A preview whose cards passed validation, ready for the view models. */
export interface ParsedPackPreview {
  readonly packId: string;
  readonly version: string;
  readonly featured: { readonly cardId: string; readonly images: readonly string[] } | undefined;
  readonly images: ReadonlySet<string>;
  readonly languages: PackLanguages | undefined;
  readonly cards: readonly AnyCard[];
  readonly decks: readonly {
    readonly id: string;
    readonly name: string;
    readonly identityCardId: string;
    readonly cards: readonly { readonly cardId: string; readonly quantity: number }[];
  }[];
}

const MAX_CARDS = 600;
const MAX_IMAGES = 3000;
const MAX_DECKS = 24;
const MAX_DECK_ENTRIES = 300;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";

function languagesOf(v: unknown): PackLanguages | undefined {
  if (!isRecord(v) || !isString(v.base) || !Array.isArray(v.available) || !v.available.every(isString))
    return undefined;
  if (v.available.length > 32) return undefined;
  return { base: v.base, available: v.available, ...(isString(v.text) ? { text: v.text } : {}) };
}

function cardOk(card: unknown, prefix: string): card is AnyCard {
  if (!isRecord(card) || !isString(card.id) || !card.id.startsWith(prefix) || !isString(card.name)) return false;
  if (!isString(card.type)) return false;
  try {
    return validateCard(card as unknown as AnyCard).valid;
  } catch {
    return false;
  }
}

/** The preview when `data` has the format's shape for pack `packId`, else undefined. Malformed cards and decks are dropped. */
export function parsePackPreview(data: unknown, packId: string): ParsedPackPreview | undefined {
  if (!isRecord(data) || data.schema !== PACK_PREVIEW_SCHEMA_VERSION) return undefined;
  if (data.packId !== packId || !isString(data.version)) return undefined;
  if (!Array.isArray(data.images) || data.images.length > MAX_IMAGES) return undefined;
  const images = new Set(
    data.images.filter((path): path is string => isString(path) && !!parsePackCardImagePath(path)),
  );
  if (!Array.isArray(data.cards) || data.cards.length > MAX_CARDS) return undefined;
  const prefix = customCardPrefix(packId);
  const seen = new Set<string>();
  const cards: AnyCard[] = [];
  for (const card of data.cards) {
    if (!cardOk(card, prefix) || seen.has(card.id as string)) continue;
    seen.add(card.id as string);
    cards.push(card);
  }
  const decks: ParsedPackPreview["decks"][number][] = [];
  if (data.decks !== undefined) {
    if (!Array.isArray(data.decks) || data.decks.length > MAX_DECKS) return undefined;
    for (const deck of data.decks as unknown[]) {
      if (!isRecord(deck) || !isString(deck.id) || !isString(deck.name) || !isString(deck.identityCardId)) continue;
      if (!Array.isArray(deck.cards) || deck.cards.length > MAX_DECK_ENTRIES) continue;
      const entries = deck.cards.filter(
        (entry): entry is { cardId: string; quantity: number } =>
          isRecord(entry) &&
          isString(entry.cardId) &&
          typeof entry.quantity === "number" &&
          Number.isInteger(entry.quantity) &&
          entry.quantity >= 1 &&
          entry.quantity <= 99,
      );
      decks.push({ id: deck.id, name: deck.name, identityCardId: deck.identityCardId, cards: entries });
    }
  }
  const featured =
    isRecord(data.featured) && isString(data.featured.cardId) && Array.isArray(data.featured.images)
      ? {
          cardId: data.featured.cardId,
          images: data.featured.images.filter((path): path is string => isString(path) && images.has(path)),
        }
      : undefined;
  return { packId, version: data.version, featured, images, languages: languagesOf(data.languages), cards, decks };
}

/** Parses the file's text: undefined when it is too big (`PACK_PREVIEW_MAX_BYTES`), not JSON or the wrong shape. */
export function parsePackPreviewText(text: string, packId: string): ParsedPackPreview | undefined {
  if (text.length > PACK_PREVIEW_MAX_BYTES) return undefined;
  try {
    return parsePackPreview(JSON.parse(text), packId);
  } catch {
    return undefined;
  }
}

/**
 * The URL of card `code`'s picture, in `lang` when the pack has it and else the base language, or undefined when the pack
 * ships none: `base + cards/<lang>/<code>.webp` (the same fallback as `resolvePackCardImage`).
 */
export function previewPictureUrl(
  preview: Pick<ParsedPackPreview, "images" | "languages">,
  base: string,
  code: string,
  lang: string,
): string | undefined {
  const languages = preview.languages;
  if (!languages) return undefined;
  for (const candidate of lang === languages.base ? [lang] : [lang, languages.base]) {
    const path = `cards/${candidate}/${code}.webp`;
    if (languages.available.includes(candidate) && preview.images.has(path)) return `${base}${path}`;
  }
  return undefined;
}
