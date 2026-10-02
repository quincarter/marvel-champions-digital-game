/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Phoenix
 * (`phoenix` 34001a/b): the deck builder's start state and her deckbuilding rules.
 *
 * Fixture: `fixtures/marvelcdb-decklist-23099.json`, fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/23099.json` on 2026-10-02.
 *
 * "Phoenix - From the Ashes" — https://marvelcdb.com/decklist/view/23099, by user 27264, published 2022-10-02, days
 * after her pack. A Leadership build (aspect meta `leadership`, 42 cards) rather than her Justice precon. Every card is
 * in the pool through wave 6 (chosen from the Phoenix lists of 2022-10-01 to 2023-07-31, where most are in pool; the
 * later public lists mostly use packs after wave 6).
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  CORE_CARDS,
  PHOENIX_STARTER_DECKS,
  parseMarvelCdbDeckJsonText,
  type CoreAspect,
  type DeckContents,
  type HeroIdentityCard,
  type PlayerCard,
} from "@mc/content";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE6_CARDS } from "../../cards.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";

// `import.meta.glob` (Vite/vitest's static-file loader) rather than `node:fs`: `@mc/cards`'s tsconfig has no `node` types.
interface ImportMetaEnv {
  readonly glob: (pattern: string, opts: object) => unknown;
}
const FIXTURE_TEXT = (
  (import.meta as unknown as ImportMetaEnv).glob("./fixtures/*.json", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>
)["./fixtures/marvelcdb-decklist-23099.json"]!;

const precon = (): DeckContents => {
  const deck = PHOENIX_STARTER_DECKS.find((d) => d.id === "phoenix-justice");
  if (!deck) throw new Error("no Phoenix starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Phoenix: deck builder start state", () => {
  test("requiredIdentitySet is exactly her precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "34001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:34001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });

  test("Phoenix Force (34002a, Permanent) is part of the required set: it is in the builder's start state, not the 40-50 count", () => {
    // The precon lists Phoenix Force as a hero-set card, and the engine counts it as a hero-set card like any other;
    // being Permanent only exempts it from the deck size (engine deck.ts: "the identity and permanent cards do not
    // count"), and the Jean Grey setup (34001b) puts it into play.
    const required = requiredIdentitySet(WAVE6_CARDS.find((c) => c.id === "34001a") as HeroIdentityCard, WAVE6_CARDS);
    expect(required.find((r) => (r.cardId as string) === "34002a")?.quantity).toBe(1);
    const force = WAVE6_CARDS.find((c) => c.id === "34002a") as PlayerCard;
    expect(force.keywords.map((k) => k.name)).toContain("permanent");
  });
});

describe("Phoenix: deckbuilding rules", () => {
  // Phoenix's identity card has no `deckbuilding` block (no off-aspect allowance, no kit or aspect-count rule); her
  // only deck-shape rule is the standard one (hero set + one aspect + basic cards, RRG 1.8 Appendix I p. 50). So this
  // asserts the plain legal precon and a plain illegal deck's message, as the Cyclops file does.
  test("her identity carries no special deckbuilding rule", () => {
    expect((WAVE6_CARDS.find((c) => c.id === "34001a") as HeroIdentityCard).deckbuilding).toBeUndefined();
  });

  test("her Justice precon is legal", () => {
    expect(validateDeck(precon(), WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("an off-aspect card is rejected, with its player-readable message", () => {
    const support = CORE_CARDS.find(
      (c): c is PlayerCard => "deckLimit" in c && c.type === "support" && c.aspect === "aggression",
    );
    if (!support) throw new Error("no Core Aggression support");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: support.id, quantity: 1 }] };
    const verdict = validateDeck(deck, [...WAVE6_CARDS, ...CORE_CARDS]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["aspect_restriction"]);
    expect(verdict.problems[0]?.cardIds).toEqual([support.id]);
    expect(verdict.problems[0]?.message).toBe(
      `${support.name} is a Aggression card, but this deck's aspect is Justice; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
    );
  });
});

describe("Phoenix: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprints resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("34001a");
    expect(result.contents.aspects).toEqual(["leadership"]);
    expect(result.heroName).toBe("Phoenix");
    const ids = new Set(WAVE6_CARDS.map((c) => c.id as string));
    for (const line of result.contents.cards) expect(ids.has(line.cardId as string), line.cardId as string).toBe(true);
  });

  test("is legal under validateDeck", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(validateDeck(result.contents, WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("plays a seeded greedy game to an outcome that replays deep-equal", () => {
    const parsed = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems, null, 2));
    const contents: DeckContents = parsed.contents;
    const config = wave6Scenario("sabretooth", {
      seed: 2026,
      players: [
        {
          identityCardId: contents.identityCardId,
          deck: contents.cards.flatMap(({ cardId, quantity }) => Array.from({ length: quantity }, () => cardId)),
          aspects: contents.aspects as readonly CoreAspect[],
        },
      ],
    });
    const created = createGame(config, WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    console.info(
      `[wave6 custom-deck] Sabretooth — Phoenix (marvelcdb 23099): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
