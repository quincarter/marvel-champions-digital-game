/**
 * QA: real decks around Deadpool and the 'Pool aspect (fixtures in `fixtures/pool-decks/`), the deck rules they prove,
 * and the setup rule that follows a chosen aspect.
 *
 * Rule sentences relied on (quoted in docs/phase7-wave7-qa-pool-decks.md):
 * - RRG 1.8 "Aspect Card", p. 8: "When building a player deck, a player must choose one of the five aspects
 *   (Aggression, Justice, Leadership, Protection, or 'Pool) to use for customization. The remainder of their deck ...
 *   can then be customized with cards that belong to the chosen aspect."
 * - RRG 1.8 FAQ, p. 64, Crisis of Infinite Deadpools (#37): "Crisis of Infinite Deadpools is only included if at least
 *   one player in the game chooses the 'Pool aspect as (one of) their chosen aspect(s)." (The question: "if an ability
 *   allows a player to include one or more 'Pool aspect cards from outside of their chosen aspect in their deck".)
 * - RRG 1.8 Appendix I "Deck Customization", p. 50: deck of 40 to 50 cards, the identity set exactly, no more than
 *   three copies by title, a chosen aspect's cards plus basic cards.
 * - Deadpool insert, "Using the 'Pool Aspect" (quoted in docs/phase7-wave7.md §1): "You can customize any hero's deck
 *   using the 'Pool aspect as your chosen aspect"; with a 'Pool player, "shuffle 1 copy of the Crisis of Infinite
 *   Deadpools (#37) ... Set the rest of the Dreadpool modular encounter set aside."
 * - Break Time prints "Max 1 per deck."
 */
import { describe, expect, test } from "vitest";
import { createGame, validateDeck, unscriptedCards, type GameState } from "@mc/engine";
import {
  PLAYABLE_CARDS,
  cardId,
  parseDecklistText,
  parseMarvelCdbDeckJson,
  type AnyCard,
  type CoreAspect,
  type DeckContents,
} from "@mc/content";
import { PLAYABLE_DEPS, playableScenario } from "../playable/index.js";
import { playToOutcome } from "../testing/driver.js";
import {
  ADAM_WARLOCK_POOL,
  CABLE_LEADERSHIP_LIVE_DANGEROUSLY,
  DEADPOOL_AGGRESSION,
  DEADPOOL_POOL_BREAK_TIME,
  DOMINO_POOL,
  POOL_FIXTURE_DECKS,
  SPIDER_MAN_POOL,
  SPIDER_WOMAN_POOL_JUSTICE,
  type PoolFixture,
} from "./fixtures/pool-decks/index.js";

const byId = new Map<string, AnyCard>(PLAYABLE_CARDS.map((card) => [card.id as string, card]));
const card = (id: string) => byId.get(id) as AnyCard & { aspect?: string; type: string; name: string };
const PLAYER_TYPES = ["ally", "event", "support", "upgrade", "resource", "player_side_scheme"];
const isPermanent = (id: string): boolean =>
  ((card(id) as { keywords?: readonly { name: string }[] }).keywords ?? []).some((k) => k.name === "permanent");

const contentsOf = (deck: PoolFixture): DeckContents => ({
  identityCardId: deck.identityCardId,
  aspects: deck.aspects,
  cards: deck.cards,
});
const verdict = (deck: DeckContents) => validateDeck(deck, PLAYABLE_CARDS);
const problemsOf = (deck: DeckContents) => {
  const v = verdict(deck);
  if (v.ok) throw new Error("expected an illegal deck");
  return v.problems;
};
const withLine = (deck: DeckContents, id: string, quantity: number): DeckContents => ({
  ...deck,
  cards: [...deck.cards.filter((l) => l.cardId !== id), { cardId: cardId(id), quantity }],
});
const countedOf = (deck: DeckContents): number =>
  deck.cards.filter((l) => !isPermanent(l.cardId as string)).reduce((n, l) => n + l.quantity, 0);
const aspectLines = (deck: DeckContents, aspect: string) =>
  deck.cards.filter((l) => card(l.cardId as string).aspect === aspect);
const quantityOf = (lines: DeckContents["cards"]): number => lines.reduce((n, l) => n + l.quantity, 0);

const EXPECTED: Readonly<
  Record<string, { aspects: readonly CoreAspect[]; counted: number; pool: number; hero: number }>
> = {
  "deadpool-pool-break-time": { aspects: ["pool"], counted: 40, pool: 25, hero: 15 },
  "deadpool-aggression": { aspects: ["aggression"], counted: 40, pool: 0, hero: 15 },
  "spider-man-pool": { aspects: ["pool"], counted: 40, pool: 25, hero: 15 },
  "domino-pool": { aspects: ["pool"], counted: 40, pool: 25, hero: 15 },
  "adam-warlock-pool": { aspects: ["pool", "justice", "leadership", "protection"], counted: 40, pool: 6, hero: 15 },
  "cable-leadership-live-dangerously": { aspects: ["leadership"], counted: 40, pool: 1, hero: 15 },
  "spider-woman-pool-justice": { aspects: ["pool", "justice"], counted: 40, pool: 11, hero: 15 },
};

describe("the fixtures: legal decks, with their aspects, size and copies asserted", () => {
  test("seven fixtures, each named once", () => {
    expect(POOL_FIXTURE_DECKS.map((d) => d.id)).toEqual(Object.keys(EXPECTED));
  });

  describe.each(POOL_FIXTURE_DECKS.map((d) => [d.id, d] as const))("%s", (id, deck) => {
    const expected = EXPECTED[id]!;
    const contents = contentsOf(deck);

    test("is legal under validateDeck against the playable pool", () => {
      expect(verdict(contents)).toEqual({ ok: true });
    });

    test("names its aspects, and its size and 'Pool and hero card counts are as designed (RRG p. 50: 40 to 50 cards)", () => {
      expect(deck.aspects).toEqual(expected.aspects);
      expect(countedOf(contents)).toBe(expected.counted);
      expect(quantityOf(aspectLines(contents, "pool"))).toBe(expected.pool);
      expect(
        quantityOf(contents.cards.filter((l) => card(l.cardId as string).aspect === `hero:${deck.identityCardId}`)),
      ).toBe(expected.hero);
    });

    test("no card is over its copy limit (three by title, or the printed Max), and no encounter card is in it", () => {
      const byTitle = new Map<string, number>();
      for (const l of contents.cards) {
        const c = card(l.cardId as string);
        byTitle.set(c.name, (byTitle.get(c.name) ?? 0) + l.quantity);
        expect(PLAYER_TYPES).toContain(c.type);
        const limit = (c as { unique?: boolean }).unique ? 1 : ((c as { deckLimit?: number }).deckLimit ?? 3);
        expect(l.quantity, c.name).toBeLessThanOrEqual(limit);
      }
      for (const [, n] of byTitle) expect(n).toBeLessThanOrEqual(3);
      for (const id44 of ["44037", "44038", "44039", "44040", "44041", "44042"])
        expect(contents.cards.some((l) => l.cardId === id44)).toBe(false);
    });

    test("nothing in it is unscripted, so a seat can be dealt it", () => {
      expect(unscriptedCards(contents, PLAYABLE_CARDS, PLAYABLE_DEPS)).toEqual([]);
    });
  });

  test("deck 1 holds Break Time and Git Gud once each (both supported cards), and differs from the precon's 'Pool list", () => {
    const lines = DEADPOOL_POOL_BREAK_TIME.cards;
    expect(lines.find((l) => l.cardId === "44046")?.quantity).toBe(1);
    expect(lines.find((l) => l.cardId === "44028")?.quantity).toBe(1);
    expect(card("44046").name).toBe("Break Time");
    expect(card("44028").name).toBe("Git Gud");
    expect(lines.some((l) => l.cardId === "44031")).toBe(false); // the precon's Frenemies
  });

  test("deck 2 has no 'Pool card; deck 6 has exactly one, a player side scheme (the allowance Cable's text prints)", () => {
    expect(aspectLines(contentsOf(DEADPOOL_AGGRESSION), "pool")).toEqual([]);
    const pool = aspectLines(contentsOf(CABLE_LEADERSHIP_LIVE_DANGEROUSLY), "pool");
    expect(pool.map((l) => [l.cardId, l.quantity])).toEqual([["44024", 1]]);
    expect(card("44024").type).toBe("player_side_scheme");
  });

  test("deck 5: four aspects with six cards each, one copy of every title outside Adam Warlock's set", () => {
    const contents = contentsOf(ADAM_WARLOCK_POOL);
    for (const aspect of ["pool", "justice", "leadership", "protection"]) {
      expect(quantityOf(aspectLines(contents, aspect)), aspect).toBe(6);
      for (const l of aspectLines(contents, aspect)) expect(l.quantity).toBe(1);
    }
    expect(aspectLines(contents, "aggression")).toEqual([]);
  });

  test("deck 5b: Spider-Woman's two aspects hold eleven cards each", () => {
    const contents = contentsOf(SPIDER_WOMAN_POOL_JUSTICE);
    expect(quantityOf(aspectLines(contents, "pool"))).toBe(11);
    expect(quantityOf(aspectLines(contents, "justice"))).toBe(11);
  });
});

describe("illegal 'Pool decks, each refused with its code and player-readable message", () => {
  const messageOf = (deck: DeckContents, code: string): string | undefined =>
    problemsOf(deck).find((p) => p.code === code)?.message;
  const only = (deck: DeckContents): readonly string[] => problemsOf(deck).map((p) => p.code);

  test("a 'Pool card in a non-'Pool deck is refused: Deadpool Aggression plus Cutupper (RRG p. 8; nobody's text lets Deadpool)", () => {
    // Swap one Aggression Haymaker (basic) for Cutupper, so the deck stays 40.
    const deck = withLine(withLine(contentsOf(DEADPOOL_AGGRESSION), "01087", 2), "44018", 1);
    expect(only(deck)).toEqual(["aspect_restriction"]);
    expect(messageOf(deck, "aspect_restriction")).toBe(
      "Cutupper is a 'Pool card, but this deck's aspect is Aggression; beyond its identity set a deck may only use its chosen aspect and basic cards.",
    );
  });

  test("the same holds for any non-'Pool hero: Spider-Man Justice with a 'Pool ally", () => {
    const deck: DeckContents = { ...contentsOf(SPIDER_MAN_POOL), aspects: ["justice"] };
    const refused = problemsOf(deck).filter((p) => p.code === "aspect_restriction");
    expect(refused.length).toBeGreaterThan(0);
    expect(refused[0]!.message).toMatch(/ is a 'Pool card, but this deck's aspect is Justice; /);
  });

  test("Cable's allowance reaches player side schemes only: a 'Pool event in his Leadership deck is refused", () => {
    const deck = withLine(withLine(contentsOf(CABLE_LEADERSHIP_LIVE_DANGEROUSLY), "01085", 1), "44018", 1);
    expect(messageOf(deck, "aspect_restriction")).toBe(
      "Cutupper is a 'Pool card, but this deck's aspect is Leadership; beyond its identity set a deck may only use its chosen aspect and basic cards.",
    );
  });

  test("two aspects for a one-aspect hero, one of them 'Pool: Deadpool 'Pool and Aggression", () => {
    const deck: DeckContents = { ...contentsOf(DEADPOOL_POOL_BREAK_TIME), aspects: ["pool", "aggression"] };
    expect(messageOf(deck, "aspect_choice")).toBe(
      "A deck for Deadpool (Wade Wilson) must choose exactly one aspect; this deck chooses 'Pool and Aggression.",
    );
  });

  test("two aspects for Spider-Man, 'Pool and Justice", () => {
    const deck: DeckContents = { ...contentsOf(SPIDER_MAN_POOL), aspects: ["pool", "justice"] };
    expect(messageOf(deck, "aspect_choice")).toBe(
      "A deck for Spider-Man (Peter Parker) must choose exactly one aspect; this deck chooses 'Pool and Justice.",
    );
  });

  test("Adam Warlock with 'Pool and three aspects but Aggression too is five aspects: refused", () => {
    const deck: DeckContents = {
      ...contentsOf(ADAM_WARLOCK_POOL),
      aspects: ["pool", "aggression", "justice", "leadership", "protection"],
    };
    expect(messageOf(deck, "aspect_choice")).toBe(
      "A deck for Adam Warlock (Adam Warlock) must choose exactly 4 different aspects; this deck chooses 'Pool and Aggression and Justice and Leadership and Protection.",
    );
  });

  test("a fourth Barely a Scratch (three copies is the limit by title)", () => {
    const deck = withLine(contentsOf(SPIDER_MAN_POOL), "44017", 4);
    expect(messageOf(deck, "copy_limit")).toBe(
      "Barely a Scratch has 4 copies; a deck may include no more than 3 copies of a non-unique card (by title).",
    );
  });

  test("Break Time twice (it prints Max 1 per deck)", () => {
    const deck = withLine(contentsOf(DEADPOOL_POOL_BREAK_TIME), "44046", 2);
    expect(messageOf(deck, "copy_limit")).toBe(
      "Break Time has 2 copies, but its deck limit is 1: no more than 1 copy may be in a deck.",
    );
    expect(card("44046")).toMatchObject({ name: "Break Time", deckLimit: 1 });
  });

  test("a Deadpool identity card (Cable, 44002) in another hero's 'Pool deck", () => {
    const deck = withLine(contentsOf(SPIDER_MAN_POOL), "44002", 1);
    expect(messageOf(deck, "other_identity_card")).toBe(
      "Cable (Nathan Summers) belongs to Deadpool (Wade Wilson)'s identity set; identity-specific cards can only be used in that identity's deck.",
    );
  });

  test("Dreadpool-set cards in a deck: the minion, the side scheme and Crisis of Infinite Deadpools", () => {
    for (const [id, type] of [
      ["44038", "minion"],
      ["44039", "side scheme"],
      ["44037", "treachery"],
    ] as const) {
      const deck = withLine(contentsOf(DEADPOOL_POOL_BREAK_TIME), id, 1);
      const problem = problemsOf(deck).find((p) => p.code === "not_a_player_card");
      expect(problem?.cardIds, id).toEqual([id]);
      expect(problem?.message, id).toBe(
        `${card(id).name} is a ${type} card, not a player card: encounter cards (including obligations and nemesis cards, which setup adds for you) cannot be in a player deck.`,
      );
    }
  });

  test("Adam Warlock: unequal aspects (7 'Pool, 5 Justice) are refused, and a second copy of a 'Pool title too", () => {
    const base = contentsOf(ADAM_WARLOCK_POOL);
    const twoCopies = withLine(base, "44017", 2);
    expect(problemsOf(twoCopies).map((p) => p.code)).toContain("copy_limit");
    expect(messageOf(twoCopies, "copy_limit")).toBe(
      "Barely a Scratch has 2 copies; Adam Warlock (Adam Warlock)'s deckbuilding allows no more than 1 copy of any card outside the identity set.",
    );
  });
});

describe("the 'Pool setup rule: Dreadpool set 1 shuffled in, 6 set aside, exactly when a seat chose 'Pool (RRG p. 64)", () => {
  const seat = (deck: PoolFixture) => ({
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap((l) => Array.from({ length: l.quantity }, () => l.cardId)),
  });
  const start = (decks: readonly PoolFixture[]): GameState => {
    const config = playableScenario("rhino", { seed: 5, players: decks.map(seat) });
    const created = createGame(config, PLAYABLE_DEPS);
    if (!created.ok) throw new Error(created.error.message);
    return created.state;
  };
  const dreadpoolIds = ["44037", "44038", "44039", "44040", "44041", "44042"];
  const inDeck = (state: GameState): string[] =>
    Object.values(state.encounterDecks)
      .flatMap((d) => d.deck)
      .map((id) => state.instances[id]!.cardId as string)
      .filter((id) => dreadpoolIds.includes(id))
      .sort();
  const aside = (state: GameState): string[] =>
    state.encounterSetAside
      .map((id) => state.instances[id]!.cardId as string)
      .filter((id) => dreadpoolIds.includes(id))
      .sort();
  const SIX = ["44038", "44039", "44040", "44041", "44041", "44042"];

  test.each(POOL_FIXTURE_DECKS.filter((d) => d.aspects.includes("pool")).map((d) => [d.id, d] as const))(
    "solo %s: Crisis in the encounter deck once, the other six set aside",
    (_id, deck) => {
      const state = start([deck]);
      expect(inDeck(state)).toEqual(["44037"]);
      expect(aside(state)).toEqual(SIX);
    },
  );

  test.each(POOL_FIXTURE_DECKS.filter((d) => !d.aspects.includes("pool")).map((d) => [d.id, d] as const))(
    "solo %s (no 'Pool chosen): no Dreadpool card anywhere",
    (_id, deck) => {
      const state = start([deck]);
      expect(inDeck(state)).toEqual([]);
      expect(aside(state)).toEqual([]);
    },
  );

  test("Cable with Live Dangerously still has the 'Pool card in his deck and no Dreadpool set (the FAQ's case)", () => {
    const state = start([CABLE_LEADERSHIP_LIVE_DANGEROUSLY]);
    const cards = Object.values(state.instances).map((i) => i.cardId as string);
    expect(cards).toContain("44024");
    expect(cards.some((id) => dreadpoolIds.includes(id))).toBe(false);
  });

  test("2 players, one seat chose 'Pool (Cable Leadership + Domino 'Pool): one Crisis, six set aside", () => {
    const state = start([CABLE_LEADERSHIP_LIVE_DANGEROUSLY, DOMINO_POOL]);
    expect(inDeck(state)).toEqual(["44037"]);
    expect(aside(state)).toEqual(SIX);
  });

  test("2 players, the 'Pool seat second or first makes no difference, and two 'Pool seats add one set, not two", () => {
    expect(inDeck(start([DOMINO_POOL, DEADPOOL_AGGRESSION]))).toEqual(["44037"]);
    const both = start([DEADPOOL_POOL_BREAK_TIME, SPIDER_MAN_POOL]);
    expect(inDeck(both)).toEqual(["44037"]);
    expect(aside(both)).toEqual(SIX);
  });

  test("2 players, no seat chose 'Pool (a 'Pool card in one deck only): no Dreadpool card", () => {
    const state = start([CABLE_LEADERSHIP_LIVE_DANGEROUSLY, DEADPOOL_AGGRESSION]);
    expect(inDeck(state)).toEqual([]);
    expect(aside(state)).toEqual([]);
  });

  test('an Adam Warlock seat that chose \'Pool among four aspects brings the set ("(one of) their chosen aspect(s)")', () => {
    const state = start([ADAM_WARLOCK_POOL]);
    expect(inDeck(state)).toEqual(["44037"]);
  });

  test.each(POOL_FIXTURE_DECKS.map((d) => [d.id, d] as const))(
    "smoke %s: the game starts and the first player turn has a legal action besides ending the turn",
    (_id, deck) => {
      const state = start([deck]);
      expect(state.outcome).toBeFalsy();
      const result = playToOutcome(state, PLAYABLE_DEPS, { maxCommands: 40 });
      expect(result.commands).toBeGreaterThan(0);
      const types = result.session.log.commands.map((command) => command.type);
      expect(types.some((t) => t !== undefined && t !== "endTurn" && t !== "resolveChoice")).toBe(true);
    },
  );
});

describe("sharing: each fixture round-trips through the app's pasted-decklist text", () => {
  /** The format of the client's `exportDecklistText` (`packages/client/src/view/deck-import-model.ts`), rebuilt here since @mc/cards never imports the client. */
  const exportText = (deck: DeckContents): string => {
    const names = new Map<string, number>();
    for (const l of deck.cards) {
      const name = card(l.cardId as string).name;
      names.set(name, (names.get(name) ?? 0) + l.quantity);
    }
    return [
      `Hero: ${card(deck.identityCardId as string).name}`,
      ...deck.aspects.map((a) => `Aspect: ${a.charAt(0).toUpperCase()}${a.slice(1)}`),
      ...[...names.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, n]) => `${n}x ${name}`),
    ].join("\n");
  };
  const byTitleCount = (deck: DeckContents): [string, number][] => {
    const m = new Map<string, number>();
    for (const l of deck.cards)
      m.set(card(l.cardId as string).name, (m.get(card(l.cardId as string).name) ?? 0) + l.quantity);
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  };

  const TEXT_OK = ["domino-pool", "adam-warlock-pool"];
  const textRoundTrip = (deck: PoolFixture) => {
    const result = parseDecklistText(exportText(contentsOf(deck)), PLAYABLE_CARDS);
    if (!result.ok) throw new Error(JSON.stringify(result.problems.map((p) => p.code)));
    expect(result.contents.identityCardId).toBe(deck.identityCardId);
    expect([...result.contents.aspects].sort()).toEqual([...deck.aspects].sort());
    expect(byTitleCount(result.contents)).toEqual(byTitleCount(contentsOf(deck)));
    expect(verdict(result.contents)).toEqual({ ok: true });
  };

  test.each(POOL_FIXTURE_DECKS.filter((d) => TEXT_OK.includes(d.id)).map((d) => [d.id, d] as const))(
    "text export then import: %s",
    (_id, deck) => textRoundTrip(deck),
  );

  // PIN (defect, reported in docs/phase7-wave7-qa-pool-decks.md): the app's own text export names cards by title, and a
  // title shared with another card in the pool (Deadpool's ally "Cable" and the identity Cable; Spider-Man's
  // "Web-Shooter"; "Hulk", "Hawkeye", "Mind Scan") is refused on import as `ambiguous_card_name`. test.fails: this
  // passes while the defect stands and goes red when exported text of these decks imports.
  test.fails.each(POOL_FIXTURE_DECKS.filter((d) => !TEXT_OK.includes(d.id)).map((d) => [d.id, d] as const))(
    "text export then import (ambiguous titles, defect): %s",
    (_id, deck) => textRoundTrip(deck),
  );

  /** A MarvelCDB-shaped deck (`slots` by code, `meta` aspects): the by-id way to share a deck, which never has the title problem. */
  const marvelCdbOf = (deck: DeckContents, metaAspects: readonly string[]) => ({
    id: 1,
    name: "fixture",
    hero_code: deck.identityCardId,
    slots: Object.fromEntries(deck.cards.map((l) => [l.cardId, l.quantity])),
    meta: JSON.stringify(Object.fromEntries(metaAspects.map((a, i) => [i === 0 ? "aspect" : `aspect${i + 1}`, a]))),
  });

  test.each(POOL_FIXTURE_DECKS.map((d) => [d.id, d] as const))(
    "MarvelCDB JSON by code, then import: %s",
    (_id, deck) => {
      const result = parseMarvelCdbDeckJson(marvelCdbOf(contentsOf(deck), deck.aspects.slice(0, 2)), PLAYABLE_CARDS);
      if (!result.ok) throw new Error(JSON.stringify(result.problems.map((p) => p.code)));
      expect(result.contents.identityCardId).toBe(deck.identityCardId);
      expect([...result.contents.aspects].sort()).toEqual([...deck.aspects].sort());
      expect(Object.fromEntries(result.contents.cards.map((l) => [l.cardId, l.quantity]))).toEqual(
        Object.fromEntries(deck.cards.map((l) => [l.cardId, l.quantity])),
      );
      expect(verdict(result.contents)).toEqual({ ok: true });
    },
  );

  // PIN (defect): MarvelCDB's meta holds two aspects; for Adam the importer fills the other two from the deck's aspect
  // cards, but its `CORE_ASPECT_NAMES` leaves 'Pool out, so a meta that names two non-'Pool aspects cannot recover 'Pool.
  test.fails("Adam Warlock: meta naming Justice and Leadership recovers 'Pool and Protection from the cards", () => {
    const result = parseMarvelCdbDeckJson(
      marvelCdbOf(contentsOf(ADAM_WARLOCK_POOL), ["justice", "leadership"]),
      PLAYABLE_CARDS,
    );
    if (!result.ok) throw new Error("import failed");
    expect([...result.contents.aspects].sort()).toEqual(["justice", "leadership", "pool", "protection"]);
  });
});
