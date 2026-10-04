/**
 * Wave 6 definition-of-done 4b (docs/wave-definition-of-done.md, docs/custom-deck-testing.md "The pieces") for
 * Shadowcat (`shadowcat` 32030a/b): the deck builder's start state including her Solid / Phased mass form upgrade, her
 * (absent) deckbuilding rule, and one real public MarvelCDB decklist played end to end outside her own precon.
 *
 * Fixture: `fixtures/marvelcdb-decklist-23153.json`, fetched unmodified from
 * `GET https://marvelcdb.com/api/public/decklist/23153.json` on 2026-10-02.
 *
 * "Shadowcat" — https://marvelcdb.com/decklist/view/23153, by user 18463, published 2022-10-03 (days after the box
 * released). A Protection build (aspect meta `protection`, 41 cards, including Solid 32031a as MarvelCDB lists it) that
 * is not the `shadowcat-aggression` precon. Every card is in the pool through wave 6 (chosen from the public Shadowcat
 * decklists scanned in the cache: 90 of 133 import fully and are legal, most from the first weeks after release).
 */
import { describe, expect, test } from "vitest";
import { createGame, replay, requiredIdentitySet, validateDeck } from "@mc/engine";
import {
  CORE_CARDS,
  MUT_GEN_STARTER_DECKS,
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
)["./fixtures/marvelcdb-decklist-23153.json"]!;

const precon = (): DeckContents => {
  const deck = MUT_GEN_STARTER_DECKS.find((d) => d.id === "shadowcat-aggression");
  if (!deck) throw new Error("no Shadowcat starter deck");
  return { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards };
};

describe("Shadowcat: deck builder start state", () => {
  test("requiredIdentitySet is exactly her precon's signature cards (RRG 1.8 Appendix I 'Deck Customization', p. 50)", () => {
    const identity = WAVE6_CARDS.find((c) => c.id === "32030a") as HeroIdentityCard;
    expect(identity.type).toBe("hero_identity");
    const required = requiredIdentitySet(identity, WAVE6_CARDS);
    const heroSetInPrecon = precon()
      .cards.filter((line) => {
        const card = WAVE6_CARDS.find((c) => c.id === line.cardId);
        return card && "aspect" in card && card.aspect === "hero:32030a";
      })
      .map((line) => ({ cardId: line.cardId as string, quantity: line.quantity }));
    expect(heroSetInPrecon.length).toBeGreaterThan(0);
    // Solid / Phased (32031a, the double-sided mass form upgrade, Permanent) is a permanent set aside before setup
    // (docs/phase7-wave6.md 3.74, Q15): Kitty's Setup puts it into play Solid side up. It is still a deck-list card:
    // the precon (41 cards) lists it, MarvelCDB lists it in `slots`, `requiredIdentitySet` includes it at quantity 1 and
    // `validateDeck` requires it (next describe). All of them agree, so nothing is pinned. Her obligation (32055) and
    // nemesis set are not player-deck cards: neither the precon nor the required set lists them.
    expect(heroSetInPrecon.map((r) => r.cardId)).toContain("32031a");
    expect(required.map((r) => r.cardId as string)).not.toContain("32055");
    expect(required.map((r) => ({ cardId: r.cardId as string, quantity: r.quantity }))).toEqual(heroSetInPrecon);
  });
});

describe("Shadowcat: deckbuilding rules", () => {
  // Shadowcat's identity prints no deckbuilding requirement of her own: Selective Intangibility, Kitty's Setup and Phase
  // Control are gameplay abilities, and the identity has no `deckbuilding` block (asserted below). Her mass form upgrade
  // is an ordinary identity-set card as far as deckbuilding goes. So the only rules a custom deck can break are the
  // general ones, RRG 1.8 Appendix I "Deck Customization" p. 50 (identity set plus one chosen aspect plus basic cards).
  const byId = new Map(WAVE6_CARDS.map((c) => [c.id as string, c]));
  const identity = byId.get("32030a") as HeroIdentityCard;

  test("she has no special deckbuilding rule", () => {
    expect(identity.deckbuilding).toBeUndefined();
  });

  test("her precon plus a basic card is legal", () => {
    const basic = CORE_CARDS.find((c): c is PlayerCard => "deckLimit" in c && c.aspect === "basic");
    if (!basic) throw new Error("no Core basic card");
    const deck = { ...precon(), cards: [...precon().cards, { cardId: basic.id, quantity: 1 }] };
    expect(validateDeck(deck, [...WAVE6_CARDS, ...CORE_CARDS])).toEqual({ ok: true });
  });

  test("a deck missing her mass form upgrade (Solid) is rejected as an incomplete identity set", () => {
    const deck = { ...precon(), cards: precon().cards.filter((l) => l.cardId !== "32031a") };
    const verdict = validateDeck(deck, WAVE6_CARDS);
    expect(verdict.ok).toBe(false);
    if (verdict.ok) return;
    expect(verdict.problems.map((p) => p.code)).toEqual(["identity_set_mismatch"]);
    expect(verdict.problems[0]?.cardIds).toEqual(["32031a"]);
    expect(verdict.problems[0]?.message).toBe(
      "Solid is missing: a deck for Shadowcat (Kitty Pryde) must include every card in that identity's set, and this one needs 1 copy.",
    );
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

describe("Shadowcat: a real MarvelCDB decklist", () => {
  test("imports against the wave 6 pool, reprints resolved to our card ids", () => {
    const result = parseMarvelCdbDeckJsonText(FIXTURE_TEXT, WAVE6_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems, null, 2));
    expect(result.contents.identityCardId).toBe("32030a");
    expect(result.contents.aspects).toEqual(["protection"]);
    expect(result.heroName).toBe("Shadowcat");
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
      `[wave6 custom-deck] Sabretooth — Shadowcat (marvelcdb 23153): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
    );
    expect(result.outcome).not.toBeNull();
    expect(result.rounds).toBeGreaterThanOrEqual(1);
    const replayed = replay(result.session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  }, 120_000);
});
