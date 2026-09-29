/**
 * Wave 5 (cycle 4, Sinister Motives) hero-pack precon legality (PLAN.md Phase 7).
 *
 * Mirrors `wave4-precon-legality.test.ts`: lives in `@mc/cards` (not `@mc/content`'s own suite) because checking
 * legality means calling `@mc/engine`'s `validateDeck`/`requiredIdentitySet`, and `@mc/content` must never import
 * `@mc/engine` (`client → cards → engine → content`, CLAUDE.md). Covers the four wave 5 hero packs' precons
 * (docs/phase7-wave5.md §1.9, §5) transcribed from each pack's own printed decklist card. There is no `sm` precon
 * here for the hero packs; `sm`'s two box precons (MC27 p. 20) have their own `describe` at the bottom.
 *
 * Every precon is checked in full by `validateDeck`. Ironheart's `progressingIdentity` (docs/phase7-wave5.md §1.4) was
 * gated until §3.23 and SP//dr's `separatedIdentity` (§1.6) until §3.24; both gates are lifted.
 */
import {
  NOVA_CARDS,
  NOVA_STARTER_DECKS,
  IRONHEART_CARDS,
  IRONHEART_STARTER_DECKS,
  SPIDERHAM_CARDS,
  SPIDERHAM_STARTER_DECKS,
  SPDR_CARDS,
  SPDR_STARTER_DECKS,
  SM_CARDS,
  SM_STARTER_DECKS,
  type AnyCard,
  type DeckContents,
  type HeroIdentityCard,
  type StarterDeck,
} from "@mc/content";
import { requiredIdentitySet, validateDeck } from "@mc/engine";

const packs: readonly {
  readonly label: string;
  readonly cards: readonly AnyCard[];
  readonly decks: readonly StarterDeck[];
}[] = [
  { label: "Nova", cards: NOVA_CARDS, decks: NOVA_STARTER_DECKS },
  { label: "Ironheart", cards: IRONHEART_CARDS, decks: IRONHEART_STARTER_DECKS },
  { label: "Spider-Ham", cards: SPIDERHAM_CARDS, decks: SPIDERHAM_STARTER_DECKS },
  { label: "SP//dr", cards: SPDR_CARDS, decks: SPDR_STARTER_DECKS },
];

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

/** Everything `validateDeck`'s own size/quantity/deck-limit check does (wave4-precon-legality.test.ts), standalone. */
function checkBoxQuantityAndSize(deck: StarterDeck, byId: Map<string, AnyCard>): void {
  const total = deck.cards.reduce((n, e) => n + e.quantity, 0);
  expect(total).toBeGreaterThanOrEqual(40);
  expect(total).toBeLessThanOrEqual(50);
  for (const e of deck.cards) {
    const card = byId.get(e.cardId as string);
    expect(card && "deckLimit" in card, e.cardId as string).toBe(true);
    if (!card || !("deckLimit" in card)) continue;
    expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(Math.min(card.quantityInSet, card.deckLimit));
  }
}

/** Everything `validateDeck`'s own hero-set-completeness check does, standalone. */
function checkRequiredIdentitySet(deck: StarterDeck, cards: readonly AnyCard[], byId: Map<string, AnyCard>): void {
  const identity = byId.get(deck.identityCardId as string);
  expect(identity?.type).toBe("hero_identity");
  if (identity?.type !== "hero_identity") return;
  const required = requiredIdentitySet(identity as HeroIdentityCard, cards);
  const inDeck = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
  for (const req of required) {
    expect(inDeck.get(req.cardId as string), `${deck.id}: missing/short ${req.cardId}`).toBe(req.quantity);
  }
  const requiredIds = new Set(required.map((r) => r.cardId as string));
  for (const e of deck.cards) {
    const card = byId.get(e.cardId as string);
    if (card && "aspect" in card && card.aspect === `hero:${identity.id}`) {
      expect(
        requiredIds.has(e.cardId as string),
        `${deck.id}: ${e.cardId} is a hero-set card missing from requiredIdentitySet`,
      ).toBe(true);
    }
  }
}

describe("wave 5 precons — four hero packs (Nova, Ironheart, Spider-Ham, SP//dr)", () => {
  it("there is exactly one precon per hero pack", () => {
    for (const pack of packs) expect(pack.decks.length, pack.label).toBe(1);
  });

  it("ids: nova-aggression, ironheart-leadership, spiderham-justice, spdr-protection", () => {
    expect(packs.flatMap((p) => p.decks.map((d) => d.id)).sort()).toEqual(
      ["nova-aggression", "ironheart-leadership", "spiderham-justice", "spdr-protection"].sort(),
    );
  });

  for (const pack of packs) {
    const byId = new Map(pack.cards.map((c) => [c.id as string, c]));

    it.each(pack.decks.map((d) => [d.id, d] as const))(`${pack.label} %s: sources are verified`, (_id, deck) => {
      expect(deck.provenance.verified).toBe(true);
      expect(deck.provenance.sources.length).toBeGreaterThan(0);
    });

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: within box quantity and deck limit, and legal size (RRG 1.8 p. 50: 40-50)`,
      (_id, deck) => checkBoxQuantityAndSize(deck, byId),
    );

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: validateDeck reports no problems`,
      (_id, deck) => {
        const result = validateDeck(contentsOf(deck), pack.cards);
        expect(
          result.ok,
          result.ok ? undefined : JSON.stringify((result as { problems: unknown }).problems, null, 2),
        ).toBe(true);
      },
    );

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: requiredIdentitySet matches the deck's signature cards exactly`,
      (_id, deck) => checkRequiredIdentitySet(deck, pack.cards, byId),
    );
  }
});

describe("wave 5 precons — Sinister Motives box (Ghost-Spider, Spider-Man (Miles Morales), MC27 p. 20)", () => {
  const byId = new Map(SM_CARDS.map((c) => [c.id as string, c]));

  it("ids: ghost-spider, spider-man-morales", () => {
    expect(SM_STARTER_DECKS.map((d) => d.id).sort()).toEqual(["ghost-spider", "spider-man-morales"]);
  });

  it.each(SM_STARTER_DECKS.map((d) => [d.id, d] as const))("%s: validateDeck reports no problems", (_id, deck) => {
    const result = validateDeck(contentsOf(deck), SM_CARDS);
    expect(result.ok, result.ok ? undefined : JSON.stringify((result as { problems: unknown }).problems, null, 2)).toBe(
      true,
    );
  });

  it.each(SM_STARTER_DECKS.map((d) => [d.id, d] as const))(
    "%s: requiredIdentitySet matches the deck's signature cards exactly",
    (_id, deck) => checkRequiredIdentitySet(deck, SM_CARDS, byId),
  );
});
