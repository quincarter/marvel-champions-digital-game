/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Rogue
 * (`rogue` 38001a/b): the deck builder's start state, the one deckbuilding restriction her pack brings (Beauty and the
 * Thief's Team-Up), and one real public MarvelCDB decklist played end to end outside her own precon.
 *
 * Fixture: `fixtures/marvelcdb-decklist-30358.json`, fetched unmodified (byte for byte as served) from
 * `GET https://marvelcdb.com/api/public/decklist/30358.json` on 2026-10-03.
 *
 * "Rogue Protection - Mystic Avenger" — https://marvelcdb.com/decklist/view/30358, by user 7708, published 2023-07-14.
 * A Protection build (aspect meta `protection`, 41 cards) that is not the `rogue-protection` precon: it runs her whole
 * hero set (Touched included), X-Gene, Gambit's printing of Beauty and the Thief (37019), and one copy each of many
 * cards from earlier packs. Chosen from the 209 public Rogue decklists in the cache without Med
 * Lab (38028, unscripted when this was chosen): 150 of them import fully against the wave 6 pool, are legal and have every ability
 * scripted; this is an English-titled one that runs both the Team-Up card and X-Gene.
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  CORE_STARTER_DECKS,
  GAMBIT_STARTER_DECKS,
  ROGUE_STARTER_DECKS,
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
)["./fixtures/marvelcdb-decklist-30358.json"]!;

const BEAUTY_AND_THE_THIEF = "38020";
const GAMBIT_BEAUTY = "37019";
const GOIN_ROGUE = "38005";

const precon = (): DeckContents => {
  const deck = ROGUE_STARTER_DECKS.find((d) => d.id === "rogue-protection");
  if (!deck) throw new Error("no Rogue starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Rogue: deck builder start state", () => {
  test("requiredIdentitySet is exactly her precon's signature cards, Touched included (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "38001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:38001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    // Touched (38002) is not a permanent card: it is in the deck-size count (phase7-wave6.md §6.2) and in the set.
    expect(heroSetInPrecon).toContainEqual({ cardId: "38002", quantity: 1 });
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });
});

describe("Rogue: deckbuilding rules", () => {
  // Rogue's identity prints no deckbuilding rule (Skin Contact and her Forced Response are gameplay abilities), so there
  // is no identity-specific allowance or restriction to prove (phase7-wave6.md §6.2). What her pack does bring is a
  // Team-Up basic event, Beauty and the Thief (38020): "Team-Up (Gambit and Rogue)", RRG 1.8 "Team-Up" p. 43.
  test("the precon is legal, and counts Touched toward its deck size", () => {
    expect(validateDeck(precon(), WAVE6_CARDS)).toEqual({ ok: true });
    expect(precon().cards.reduce((n, l) => n + l.quantity, 0)).toBe(41);
  });

  test("a deck missing an identity-set card (one Goin' Rogue) is rejected, with its player-readable message", () => {
    const deck = {
      ...precon(),
      cards: precon().cards.map((l) => (l.cardId === GOIN_ROGUE ? { ...l, quantity: l.quantity - 1 } : l)),
    };
    const verdict = validateDeck(deck, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    // 40 cards is still a legal size, so only the identity set is wrong.
    expect(verdict.problems.map((p) => p.code)).toEqual(["identity_set_mismatch"]);
    expect(verdict.problems.find((p) => p.code === "identity_set_mismatch")?.message).toBe(
      "Goin' Rogue has 2 copies, but Rogue (Anna Marie)'s identity set has exactly 3 copies, and a deck must include exactly that many.",
    );
  });

  test("Beauty and the Thief (Team-Up: Gambit and Rogue) is legal in Rogue's deck", () => {
    expect(precon().cards.find((l) => l.cardId === BEAUTY_AND_THE_THIEF)?.quantity).toBe(1);
    expect(validateDeck(precon(), WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("Gambit's printing of Beauty and the Thief is legal in a Rogue deck too, as a swap for her own", () => {
    const deck: DeckContents = {
      ...precon(),
      cards: precon().cards.map((l) =>
        l.cardId === BEAUTY_AND_THE_THIEF ? { ...l, cardId: cardId(GAMBIT_BEAUTY) } : l,
      ),
    };
    expect(validateDeck(deck, WAVE6_CARDS)).toEqual({ ok: true });
    // and it is legal in Gambit's own deck.
    const gambit = GAMBIT_STARTER_DECKS[0]!;
    expect(gambit.cards.some((l) => l.cardId === GAMBIT_BEAUTY)).toBe(true);
  });

  test("Beauty and the Thief is rejected in any other hero's deck (Spider-Man), with its player-readable message", () => {
    const spider = CORE_STARTER_DECKS.find((d) => d.id === "core-spider-man-justice")!;
    const deck: DeckContents = {
      identityCardId: spider.identityCardId,
      aspects: spider.aspects,
      cards: [...spider.cards, { cardId: cardId(BEAUTY_AND_THE_THIEF), quantity: 1 }],
    };
    const verdict = validateDeck(deck, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["team_up_identity"]);
    expect(verdict.problems.find((p) => p.code === "team_up_identity")?.message).toBe(
      "Beauty and the Thief is a Team-Up card for Gambit and Rogue; only a deck whose identity is one of them may include it.",
    );
  });
});

describe("Rogue: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprint codes resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("38001a");
    expect(result.contents.aspects).toEqual(["protection"]);
    expect(result.heroName).toBe("Rogue");
    expect(result.contents.cards.some((l) => l.cardId === GAMBIT_BEAUTY)).toBe(true);
    expect(result.contents.cards.some((l) => l.cardId === "38019")).toBe(true);
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
      `[wave6 custom-deck] Sabretooth — Rogue (marvelcdb 30358): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
