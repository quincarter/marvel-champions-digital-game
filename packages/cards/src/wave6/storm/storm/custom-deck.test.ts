/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Storm
 * (`storm` 36001a/b): the deck builder's start state, her Weather-deck handling, and one real public MarvelCDB decklist
 * played end to end outside her own precon.
 *
 * Fixture: `fixtures/marvelcdb-decklist-67363.json`, fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/67363.json` on 2026-10-02.
 *
 * "Stolen Thunder!" — https://marvelcdb.com/decklist/view/67363, by user 34614, published 2026-09-27. An Aggression
 * build (aspect meta `aggression`, 41 cards) that is not the `storm-leadership` precon. Every card is in the pool
 * through wave 6 (chosen from the 43 public Storm decklists in the cache: only it and 56851 "Storm- autorita - Test", a
 * Leadership list, import fully and are legal; the rest use later packs).
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  STORM_STARTER_DECKS,
  cardId,
  parseMarvelCdbDeckJsonText,
  type CoreAspect,
  type DeckContents,
  type HeroIdentityCard,
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
)["./fixtures/marvelcdb-decklist-67363.json"]!;

/** Clear Skies, Hurricane and the other two WEATHER supports: her separate facedown deck, not the player deck. */
const WEATHER_IDS = ["36002", "36003", "36004", "36005"];

const precon = (): DeckContents => {
  const deck = STORM_STARTER_DECKS.find((d) => d.id === "storm-leadership");
  if (!deck) throw new Error("no Storm starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Storm: deck builder start state", () => {
  test("requiredIdentitySet is exactly her precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "36001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:36001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });

  test("the Weather supports are in neither the required set nor the precon: they are her separate Weather deck (wave 6 spec 3.45/3.46)", () => {
    // The Storm Hero Pack insert: she "begins each game with a special, four-card WEATHER deck in addition to her player
    // deck". The precon is "40 + 4 weather": 40 deck cards here, the four Weather cards built by setup from the identity.
    const identity = WAVE6_CARDS.find((c) => c.id === "36001a") as HeroIdentityCard;
    const required = requiredIdentitySet(identity, WAVE6_CARDS).map((r) => r.cardId as string);
    for (const id of WEATHER_IDS) {
      expect(required).not.toContain(id);
      expect(precon().cards.map((l) => l.cardId as string)).not.toContain(id);
    }
    expect(precon().cards.reduce((n, l) => n + l.quantity, 0)).toBe(40);
    expect(
      identity.separateDecks?.map((d) => ({ name: d.name, cards: d.cards.map((c) => c.cardId as string) })),
    ).toEqual([{ name: "Weather", cards: WEATHER_IDS }]);
  });
});

describe("Storm: deckbuilding rules", () => {
  // Storm's identity prints no deckbuilding rule (Weather Control, Ororo Munroe's text and her Setup are gameplay
  // abilities), so there is no identity-specific allowance or restriction to prove. What her identity does bring is
  // the Weather deck, which a player deck must not list: RRG 1.8 "Deck" (p. 15) "Certain identities or scenarios may
  // add other decks to the game"; the cards are deckLimit 0 and `separateDeck: "Weather"`.
  test("the precon is legal", () => {
    expect(validateDeck(precon(), WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("listing a Weather support (Clear Skies) in the deck is rejected, with its player-readable message", () => {
    const deck = { ...precon(), cards: [...precon().cards, { cardId: cardId(WEATHER_IDS[0]!), quantity: 1 }] };
    const verdict = validateDeck(deck, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["separate_deck_card"]);
    expect(verdict.problems[0]?.cardIds).toEqual([WEATHER_IDS[0]]);
    expect(verdict.problems[0]?.message).toBe(
      "Clear Skies belongs to Storm (Ororo Munroe)'s Weather deck, which setup builds from the identity; it is not part of a player deck, so it cannot be listed.",
    );
  });

  test("an imported list that does include a Weather card imports it and is then rejected by validateDeck", () => {
    // The importer is deliberately separate from legality (packages/content/src/import/index.ts): it keeps the line.
    // (Real MarvelCDB lists omit the Weather cards, so this is a hand-edited copy of the fixture, in memory only.)
    const edited = JSON.parse(FIXTURE_TEXT) as { slots: Record<string, number> };
    edited.slots["36002"] = 1;
    const parsed = parseMarvelCdbDeckJsonText(JSON.stringify(edited), WAVE6_CARDS);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems, null, 2));
    expect(parsed.contents.cards.some((l) => l.cardId === "36002")).toBe(true);
    const verdict = validateDeck(parsed.contents, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["separate_deck_card"]);
  });

  test("a deck missing one of her identity-set cards (Storm's Crown) is rejected", () => {
    const deck = { ...precon(), cards: precon().cards.filter((l) => l.cardId !== "36006") };
    const verdict = validateDeck(deck, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    // Dropping the copy also leaves the 40-card precon one short, so deck_size is reported too.
    expect(verdict.problems.map((p) => p.code)).toEqual(["deck_size", "identity_set_mismatch"]);
    expect(verdict.problems.find((p) => p.code === "identity_set_mismatch")?.message).toBe(
      "Storm's Crown is missing: a deck for Storm (Ororo Munroe) must include every card in that identity's set, and this one needs 1 copy.",
    );
  });
});

describe("Storm: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprints resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("36001a");
    expect(result.contents.aspects).toEqual(["aggression"]);
    expect(result.heroName).toBe("Storm");
    // MarvelCDB's `slots` for Storm do not list her four Weather supports (36002-36005) at all: none of the 43 public
    // Storm decklists scanned on 2026-10-02 has one. So the import has nothing to drop, and the deck stays legal.
    expect(result.contents.cards.filter((l) => WEATHER_IDS.includes(l.cardId as string))).toEqual([]);
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
      `[wave6 custom-deck] Sabretooth — Storm (marvelcdb 67363): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
