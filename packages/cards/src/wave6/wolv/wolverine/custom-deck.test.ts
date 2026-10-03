/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Wolverine
 * (`wolverine` 35001a/b): the deck builder's start state, his (absent) deckbuilding rule, and one real public MarvelCDB
 * decklist played end to end outside his own precon.
 *
 * Fixture: `fixtures/marvelcdb-decklist-60381.json`, fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/60381.json` on 2026-10-02.
 *
 * "Tiny Canadian with an Axe to grind" — https://marvelcdb.com/decklist/view/60381, by user 13437, published
 * 2026-03-08. An Aggression build (aspect meta `aggression`, 41 cards) around Clobber and Jarnbjorn with his Claws.
 * Every card is in the pool through wave 6 (chosen from the 104 public Wolverine decklists scanned; many use later
 * packs).
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  CORE_CARDS,
  WOLV_STARTER_DECKS,
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
)["./fixtures/marvelcdb-decklist-60381.json"]!;

const precon = (): DeckContents => {
  const deck = WOLV_STARTER_DECKS.find((d) => d.id === "wolverine-aggression");
  if (!deck) throw new Error("no Wolverine starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Wolverine: deck builder start state", () => {
  test("requiredIdentitySet is exactly his precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "35001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:35001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    // His kit includes the permanent Wolverine's Claws (35002), which setup puts into play rather than the hand; it is
    // still a deck card with quantity 1 in the set (the precon lists it and validateDeck requires it), so it is in the
    // required set like any other hero-set card. 35027 (obligation) and the nemesis cards sit outside the player deck.
    expect(heroSetInPrecon.map((r) => r.cardId)).toContain("35002");
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });
});

describe("Wolverine: deckbuilding rules", () => {
  // Wolverine's identity has no deckbuilding requirement of his own (no `deckbuilding` block on 35001a, asserted below),
  // so the only rules a custom deck can break are the general ones: RRG 1.8 Appendix I "Deck Customization" p. 50 (the
  // identity set plus one chosen aspect plus basic cards). The illegal case below is therefore a plain aspect breach.
  const byId = new Map(WAVE6_CARDS.map((c) => [c.id as string, c]));
  const identity = byId.get("35001a") as HeroIdentityCard;

  test("he has no special deckbuilding rule", () => {
    expect(identity.deckbuilding).toBeUndefined();
  });

  test("his precon plus a basic card is legal", () => {
    const basic = CORE_CARDS.find((c): c is PlayerCard => "deckLimit" in c && c.aspect === "basic");
    if (!basic) throw new Error("no Core basic card");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: basic.id, quantity: 1 }] };
    expect(validateDeck(deck, [...WAVE6_CARDS, ...CORE_CARDS])).toEqual({ ok: true });
  });

  test("an off-aspect card is rejected, with its player-readable message", () => {
    const support = CORE_CARDS.find(
      (c): c is PlayerCard => "deckLimit" in c && c.type === "support" && c.aspect === "justice",
    );
    if (!support) throw new Error("no Core Justice support");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: support.id, quantity: 1 }] };
    const verdict = validateDeck(deck, [...WAVE6_CARDS, ...CORE_CARDS]);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["aspect_restriction"]);
    expect(verdict.problems[0]?.cardIds).toEqual([support.id]);
    expect(verdict.problems[0]?.message).toBe(
      `${support.name} is a Justice card, but this deck's aspect is Aggression; beyond its identity set a deck may only use its chosen aspect and basic cards.`,
    );
  });
});

describe("Wolverine: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprints resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("35001a");
    expect(result.contents.aspects).toEqual(["aggression"]);
    expect(result.heroName).toBe("Wolverine");
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
      `[wave6 custom-deck] Sabretooth — Wolverine (marvelcdb 60381): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
