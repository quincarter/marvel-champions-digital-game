/**
 * Wave 5 (cycle 4, Sinister Motives) hero-pack precon legality (PLAN.md Phase 7).
 *
 * Mirrors `wave4-precon-legality.test.ts`: lives in `@mc/cards` (not `@mc/content`'s own suite) because checking
 * legality means calling `@mc/engine`'s `validateDeck`/`requiredIdentitySet`, and `@mc/content` must never import
 * `@mc/engine` (`client → cards → engine → content`, CLAUDE.md). Covers the four wave 5 hero packs' precons
 * (docs/phase7-wave5.md §1.9, §5) transcribed from each pack's own printed decklist card. There is no `sm` precon
 * here: `sm`'s two precons (MC27 p. 20) are `sm`'s own scope, not this pass's.
 *
 * **Ironheart and SP//dr are gated, not broken.** `validateDeck` refuses `ironheart-leadership`'s identity
 * (29001a's `progressingIdentity`, docs/phase7-wave5.md §1.4) and `spdr-protection`'s identity (31001a's
 * `separatedIdentity`, §1.6) with `unsupported_identity`, by design, until §3.23 and §3.24 land — a real "cannot
 * seat this identity yet" gate, not a data mistake. Their `it`s below assert that specific, documented refusal
 * (rather than skipping legality checking outright) and then check everything `validateDeck` would otherwise have
 * checked (box quantity/deck limit, legal size, `requiredIdentitySet`) by hand, so a future accidental corruption
 * of either precon still fails a test today.
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
  /** Identity kind `validateDeck` refuses today (docs/phase7-wave5.md §1.4 / §1.6), if any. */
  readonly gatedIdentity?: "progressingIdentity" | "separatedIdentity";
}[] = [
  { label: "Nova", cards: NOVA_CARDS, decks: NOVA_STARTER_DECKS },
  { label: "Ironheart", cards: IRONHEART_CARDS, decks: IRONHEART_STARTER_DECKS, gatedIdentity: "progressingIdentity" },
  { label: "Spider-Ham", cards: SPIDERHAM_CARDS, decks: SPIDERHAM_STARTER_DECKS },
  { label: "SP//dr", cards: SPDR_CARDS, decks: SPDR_STARTER_DECKS, gatedIdentity: "separatedIdentity" },
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

    if (pack.gatedIdentity === undefined) {
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
    } else {
      const kind = pack.gatedIdentity;
      it.each(pack.decks.map((d) => [d.id, d] as const))(
        `${pack.label} %s: validateDeck refuses only the gated identity (${kind}, docs/phase7-wave5.md §1.4/§1.6) — everything else about the deck is legal`,
        (_id, deck) => {
          const result = validateDeck(contentsOf(deck), pack.cards);
          expect(result.ok, `${deck.id} should be refused for ${kind}, not accepted outright`).toBe(false);
          if (result.ok) return;
          const problems = (result as { problems: readonly { code: string; cardIds: readonly string[] }[] }).problems;
          expect(problems.length, JSON.stringify(problems, null, 2)).toBe(1);
          expect(problems[0]?.code).toBe("unsupported_identity");
          expect(problems[0]?.cardIds).toContain(deck.identityCardId);
        },
      );

      it.each(pack.decks.map((d) => [d.id, d] as const))(
        `${pack.label} %s: requiredIdentitySet matches the deck's signature cards exactly (checked directly — the identity gate doesn't touch this)`,
        (_id, deck) => checkRequiredIdentitySet(deck, pack.cards, byId),
      );
    }
  }
});
