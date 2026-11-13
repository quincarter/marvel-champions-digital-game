/**
 * House-rule packs (docs/custom-content-packs.md §11.11): what a `house-rule` pack's trait additions do to the card
 * records. Pure data in, data out: the client applies them to a game's card pool before the engine starts, so the engine
 * never learns a house rule exists (it reads the added trait as a printed one).
 */
import type { AnyCard } from "./cards/index.js";
import { trait, type Trait } from "./common.js";
import type { PackTraitAddition } from "./packs.js";

/**
 * Which face of an official card a printed face code names: a card's own code is its front (a hero identity's hero
 * face), and the `b` sibling of a hero identity whose code ends in `a` is its alter-ego face (`14001b` is Pietro
 * Maximoff, the back of `14001a`). Undefined when the code names no card in `cardsById`, or a face this module does not
 * change (a double-sided card's flip side, a three-sided identity's inside form).
 */
export function officialFaceOfCode(
  code: string,
  cardsById: ReadonlyMap<string, AnyCard>,
): { readonly card: AnyCard; readonly side: "front" | "alterEgo" } | undefined {
  const own = cardsById.get(code);
  if (own) return "traits" in own || own.type === "hero_identity" ? { card: own, side: "front" } : undefined;
  if (!code.endsWith("b")) return undefined;
  const front = cardsById.get(`${code.slice(0, -1)}a`);
  return front?.type === "hero_identity" ? { card: front, side: "alterEgo" } : undefined;
}

/** `printed` plus each of `added` it lacks, in order (traits compare in their normalized ALL CAPS form). */
const withTraits = (printed: readonly Trait[], added: readonly string[]): readonly Trait[] => {
  const out = [...printed];
  for (const name of added) {
    const normalized = trait(name);
    if (!out.includes(normalized)) out.push(normalized);
  }
  return out;
};

/**
 * `cards` with each addition's traits added to the face its code names (`officialFaceOfCode`). Additions only: a trait
 * the face already has is not doubled, and nothing is ever removed. An addition whose code names no card here is
 * ignored (the pack's validation refuses one against the base game). Returns `cards` itself when nothing changes, so a
 * caller's cache keyed on the array stays valid.
 */
export function applyTraitAdditions(
  cards: readonly AnyCard[],
  additions: readonly PackTraitAddition[],
): readonly AnyCard[] {
  if (additions.length === 0) return cards;
  const byId = new Map(cards.map((card) => [card.id as string, card]));
  const changed = new Map<string, AnyCard>();
  for (const addition of additions) {
    const found = officialFaceOfCode(addition.code, byId);
    if (!found) continue;
    const card = changed.get(found.card.id as string) ?? found.card;
    let next: AnyCard;
    if (card.type === "hero_identity") {
      next =
        found.side === "alterEgo"
          ? { ...card, alterEgo: { ...card.alterEgo, traits: withTraits(card.alterEgo.traits, addition.traits) } }
          : { ...card, hero: { ...card.hero, traits: withTraits(card.hero.traits, addition.traits) } };
    } else if ("traits" in card) {
      next = { ...card, traits: withTraits(card.traits, addition.traits) } as AnyCard;
    } else continue;
    changed.set(card.id as string, next);
  }
  if (changed.size === 0) return cards;
  return cards.map((card) => changed.get(card.id as string) ?? card);
}

const PICTURE_STEM = /\/([0-9]{5}[a-z]?)\.(?:png|jpe?g|webp)$/;
const BY_PICTURE = new WeakMap<readonly AnyCard[], ReadonlyMap<string, AnyCard>>();

/**
 * The official card each printed picture code belongs to: its own id, and the stem of every scan its record points at
 * (`/bundles/cards/16107b.png` is a main scheme's stage 2B, `01001b` an alter-ego). A house rule's rebuilt face is
 * filed under one of these. Cached per `cards` array.
 */
export function officialCardsByPictureCode(cards: readonly AnyCard[]): ReadonlyMap<string, AnyCard> {
  let found = BY_PICTURE.get(cards);
  if (found) return found;
  const map = new Map<string, AnyCard>();
  for (const card of cards) map.set(card.id as string, card);
  for (const card of cards) {
    const visit = (node: unknown): void => {
      if (typeof node === "string") {
        const match = PICTURE_STEM.exec(node);
        if (match && !map.has(match[1] as string)) map.set(match[1] as string, card);
      } else if (Array.isArray(node)) for (const item of node) visit(item);
      else if (typeof node === "object" && node !== null) for (const value of Object.values(node)) visit(value);
    };
    visit(card);
  }
  found = map;
  BY_PICTURE.set(cards, found);
  return found;
}

/** Every printed picture code of the official cards (`officialCardsByPictureCode`'s keys). */
export function officialPictureCodes(cards: readonly AnyCard[]): ReadonlySet<string> {
  return new Set(officialCardsByPictureCode(cards).keys());
}

/**
 * The picture codes a `balanced` mode pack (GMW Fixes) may rebuild: the Balanced campaign cards, which are the scans of
 * the client's `art/balanced-scans.ts` (a test there checks the two agree) plus 16107a, the fixed scheme's stage whose
 * text is unchanged. A mode pack shows no other face.
 */
export const BALANCED_FACE_CODES: ReadonlySet<string> = new Set([
  "16070",
  "16071",
  "16072",
  "16073a",
  "16073b",
  "16093",
  "16106a",
  "16106b",
  "16107a",
  "16107b",
  "16142",
]);

/**
 * Whether a house rule may show a rebuilt face for picture `code`: a trait addition's own face (`code` is a listed
 * addition, a hero identity's alter-ego `b` included), or, for `enablesMode: "balanced"`, a Balanced campaign card.
 * Any other official card keeps its printed face.
 */
export function houseRuleMayRebuild(
  rule: { readonly traitAdditions?: readonly { readonly code: string }[]; readonly enablesMode?: string },
  code: string,
): boolean {
  if (rule.traitAdditions?.some((addition) => addition.code === code)) return true;
  return rule.enablesMode === "balanced" && BALANCED_FACE_CODES.has(code);
}
