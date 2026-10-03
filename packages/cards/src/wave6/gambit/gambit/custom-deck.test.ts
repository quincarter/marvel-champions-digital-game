/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for Gambit
 * (`gambit` 37001a/b): the deck builder's start state, the one deckbuilding restriction his pack brings (Beauty and the
 * Thief's Team-Up), and one real public MarvelCDB decklist played end to end outside his own precon.
 *
 * Fixture: `fixtures/marvelcdb-decklist-67364.json`, fetched unmodified (byte for byte as served) from
 * `GET https://marvelcdb.com/api/public/decklist/67364.json` on 2026-10-03.
 *
 * "Gambit | MAZO DEFINITIVO" — https://marvelcdb.com/decklist/view/67364, by user 75879, published 2026-09-27. A Justice
 * build (aspect meta `justice`, 40 cards) that is not the `gambit-justice` precon: it runs Gambit's whole hero set, Dazzler,
 * Operative Skill, Breaking and Entering, Mutant Education, Beauty and the Thief, and reprints/cards of other wave 6
 * packs (Professor X, X-Mansion, Angel, Utopia, ...). Chosen from the 275 public Gambit decklists in the cache
 * (2022-10 to 2026-10): 205 import fully against the wave 6 pool and are legal; this is the newest of the ones that
 * use Beauty and the Thief, so the Team-Up card is exercised in a real list.
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
)["./fixtures/marvelcdb-decklist-67364.json"]!;

const BEAUTY_AND_THE_THIEF = "37019";

const precon = (): DeckContents => {
  const deck = GAMBIT_STARTER_DECKS.find((d) => d.id === "gambit-justice");
  if (!deck) throw new Error("no Gambit starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Gambit: deck builder start state", () => {
  test("requiredIdentitySet is exactly his precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "37001a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:37001a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });
});

describe("Gambit: deckbuilding rules", () => {
  // Gambit's identity prints no deckbuilding rule (Charge de Card, Throw de Card and Thief Extraordinaire are gameplay
  // abilities), so there is no identity-specific allowance or restriction to prove (phase7-wave6.md §6.2). What his pack
  // does bring is a Team-Up basic event, Beauty and the Thief (37019): "Team-Up (Gambit and Rogue)", RRG 1.8 "Team-Up" p. 43.
  test("the precon is legal", () => {
    expect(validateDeck(precon(), WAVE6_CARDS)).toEqual({ ok: true });
  });

  test("a deck missing an identity-set card (one Charged Card) is rejected, with its player-readable messages", () => {
    const deck = {
      ...precon(),
      cards: precon().cards.map((l) => (l.cardId === "37006" ? { ...l, quantity: l.quantity - 1 } : l)),
    };
    const verdict = validateDeck(deck, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    // Dropping the copy also leaves the 40-card precon one short, so deck_size is reported too.
    expect(verdict.problems.map((p) => p.code)).toEqual(["deck_size", "identity_set_mismatch"]);
    expect(verdict.problems.find((p) => p.code === "identity_set_mismatch")?.message).toBe(
      "Charged Card has 2 copies, but Gambit (Remy LeBeau)'s identity set has exactly 3 copies, and a deck must include exactly that many.",
    );
  });

  test("Beauty and the Thief (Team-Up: Gambit and Rogue) is legal in Gambit's deck", () => {
    expect(precon().cards.some((l) => l.cardId === BEAUTY_AND_THE_THIEF)).toBe(true);
    const verdict = validateDeck(precon(), WAVE6_CARDS);
    expect(verdict).toEqual({ ok: true });
  });

  test("Beauty and the Thief is legal in a Rogue deck (the other named character), as a swap for her own printing", () => {
    // Rogue's precon runs the same card under her pack's code (38020, same title and Team-Up); swap in Gambit's printing.
    const rogue = ROGUE_STARTER_DECKS[0]!;
    expect(rogue.cards.find((l) => l.cardId === "38020")?.quantity).toBe(1);
    const deck: DeckContents = {
      identityCardId: rogue.identityCardId,
      aspects: rogue.aspects,
      cards: rogue.cards.map((l) => (l.cardId === "38020" ? { ...l, cardId: cardId(BEAUTY_AND_THE_THIEF) } : l)),
    };
    expect(validateDeck(deck, WAVE6_CARDS)).toEqual({ ok: true });
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

describe("Gambit: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprints resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("37001a");
    expect(result.contents.aspects).toEqual(["justice"]);
    expect(result.heroName).toBe("Gambit");
    expect(result.contents.cards.some((l) => l.cardId === BEAUTY_AND_THE_THIEF)).toBe(true);
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
      `[wave6 custom-deck] Sabretooth — Gambit (marvelcdb 67364): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
