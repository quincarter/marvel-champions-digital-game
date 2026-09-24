/**
 * Wave 4 (cycle 4) hero-pack precon legality (PLAN.md Phase 7).
 *
 * Mirrors `wave3-precon-legality.test.ts`: lives in `@mc/cards` (not `@mc/content`'s own suite) because checking
 * legality means calling `@mc/engine`'s `validateDeck`/`requiredIdentitySet`, and `@mc/content` must never import
 * `@mc/engine` (`client → cards → engine → content`, CLAUDE.md). Uses `@mc/content`'s own per-pack `*_CARDS`/
 * `*_STARTER_DECKS` exports (the four wave 4 hero packs emitted so far: Nebula, War Machine, Valkyrie, Vision —
 * `mts`/`hood` are still in progress and are deliberately not touched here).
 */
import {
  NEBU_CARDS,
  NEBU_STARTER_DECKS,
  WARM_CARDS,
  WARM_STARTER_DECKS,
  VALK_CARDS,
  VALK_STARTER_DECKS,
  VISION_CARDS,
  VISION_STARTER_DECKS,
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
  { label: "Nebula", cards: NEBU_CARDS, decks: NEBU_STARTER_DECKS },
  { label: "War Machine", cards: WARM_CARDS, decks: WARM_STARTER_DECKS },
  { label: "Valkyrie", cards: VALK_CARDS, decks: VALK_STARTER_DECKS },
  { label: "Vision", cards: VISION_CARDS, decks: VISION_STARTER_DECKS },
];

const contentsOf = (deck: StarterDeck): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});

describe("wave 4 precons — four hero packs emitted so far (Nebula, War Machine, Valkyrie, Vision)", () => {
  it("there is exactly one precon per pack", () => {
    for (const pack of packs) expect(pack.decks.length, pack.label).toBe(1);
  });

  it("ids: nebula-justice, war-machine-leadership, valkyrie-aggression, vision-protection", () => {
    expect(packs.flatMap((p) => p.decks.map((d) => d.id)).sort()).toEqual(
      ["nebula-justice", "war-machine-leadership", "valkyrie-aggression", "vision-protection"].sort(),
    );
  });

  for (const pack of packs) {
    const byId = new Map(pack.cards.map((c) => [c.id as string, c]));

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

    it.each(pack.decks.map((d) => [d.id, d] as const))(`${pack.label} %s: sources are verified`, (_id, deck) => {
      expect(deck.provenance.verified).toBe(true);
      expect(deck.provenance.sources.length).toBeGreaterThan(0);
    });

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: within box quantity and deck limit, and legal size (RRG 1.8 p. 50: 40-50)`,
      (_id, deck) => {
        const total = deck.cards.reduce((n, e) => n + e.quantity, 0);
        expect(total).toBeGreaterThanOrEqual(40);
        expect(total).toBeLessThanOrEqual(50);
        for (const e of deck.cards) {
          const card = byId.get(e.cardId as string);
          expect(card && "deckLimit" in card, e.cardId as string).toBe(true);
          if (!card || !("deckLimit" in card)) continue;
          expect(e.quantity, e.cardId as string).toBeLessThanOrEqual(Math.min(card.quantityInSet, card.deckLimit));
        }
      },
    );

    it.each(pack.decks.map((d) => [d.id, d] as const))(
      `${pack.label} %s: requiredIdentitySet matches the deck's signature cards exactly`,
      (_id, deck) => {
        const identity = byId.get(deck.identityCardId as string);
        expect(identity?.type).toBe("hero_identity");
        if (identity?.type !== "hero_identity") return;
        const required = requiredIdentitySet(identity as HeroIdentityCard, pack.cards);
        const inDeck = new Map(deck.cards.map((e) => [e.cardId as string, e.quantity]));
        for (const req of required) {
          expect(inDeck.get(req.cardId as string), `${deck.id}: missing/short ${req.cardId}`).toBe(req.quantity);
        }
        // And nothing in the deck carries a hero-set aspect that isn't in `required` (separate-deck cards excepted).
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
      },
    );
  }

  it("Vision's precon is 41 cards, not 40 — the pack's own printed reference card, cross-checked against MarvelCDB's community decklist (docs on VISION_CURATION)", () => {
    const deck = VISION_STARTER_DECKS.find((d) => d.id === "vision-protection");
    expect(deck).toBeDefined();
    if (!deck) return;
    expect(deck.cards.reduce((n, e) => n + e.quantity, 0)).toBe(41);
    const result = validateDeck(contentsOf(deck), VISION_CARDS);
    expect(result.ok).toBe(true);
  });
});
