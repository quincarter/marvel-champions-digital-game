import { afterEach, describe, expect, test } from "vitest";
import { useEnglish, useSpanish } from "../i18n/test-language.js";
import type { AnyCard, Scenario } from "@mc/content";
import { foeWord, isLeaderCard } from "./foe-words.js";
import { CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";

const rhinoScenario = POOL_SCENARIOS.find((s) => (s.id as string) === "rhino")!;
const rhino = CARDS_BY_ID.get(rhinoScenario.villainCardId as string)!;
const breakout = POOL_SCENARIOS.find((s) => (s.id as string) === "breakout")!;

/** A leader fixture: Rhino's card re-printed as a leader (the pool has no Civil War data yet). */
const ironMan = { ...rhino, id: "fixture-iron-man", printedType: "leader" } as unknown as AnyCard;
const leaderScenario = { ...rhinoScenario, villainCardId: ironMan.id } as unknown as Scenario;
const cardsWithLeader = new Map<string, AnyCard>([...CARDS_BY_ID, [ironMan.id as string, ironMan]]);

describe("foeWord", () => {
  test("a leader card says Leader", () => {
    expect(isLeaderCard(ironMan)).toBe(true);
    expect(foeWord(ironMan)).toBe("Leader");
    expect(foeWord(ironMan, { lower: true })).toBe("leader");
  });

  test("an ordinary villain (Rhino) says Villain", () => {
    expect(isLeaderCard(rhino)).toBe(false);
    expect(foeWord(rhino)).toBe("Villain");
    expect(foeWord(rhino, { lower: true })).toBe("villain");
  });

  test("a leader scenario says Leader when the cards are given, Villain without them", () => {
    expect(foeWord(leaderScenario, { cardsById: cardsWithLeader })).toBe("Leader");
    expect(foeWord(leaderScenario)).toBe("Villain");
    expect(foeWord(rhinoScenario, { cardsById: cardsWithLeader })).toBe("Villain");
  });

  test("a multi-villain scenario (Breakout) says villains", () => {
    expect(foeWord(breakout, { cardsById: CARDS_BY_ID, lower: true })).toBe("villains");
  });

  test("a bySetup scenario keeps the villain wording even when its card is a leader", () => {
    const bySetup = { ...leaderScenario, startingVillain: "bySetup" } as unknown as Scenario;
    expect(foeWord(bySetup, { cardsById: cardsWithLeader })).toBe("Villain");
  });

  test("no subject reads as a villain", () => {
    expect(foeWord(undefined)).toBe("Villain");
  });

  test("plural forms", () => {
    expect(foeWord(ironMan, { plural: true })).toBe("Leaders");
    expect(foeWord(rhino, { plural: true, lower: true })).toBe("villains");
    expect(foeWord(rhinoScenario, { plural: false })).toBe("Villain");
  });
});

describe("foeWord in Spanish", () => {
  afterEach(useEnglish);

  test("keeps the game term capitalized, even where English lowers it", () => {
    useSpanish();
    expect(foeWord(rhino, { lang: "es" })).toBe("Villano");
    expect(foeWord(rhino, { lang: "es", lower: true })).toBe("Villano");
    expect(foeWord(ironMan, { lang: "es", plural: true })).toBe("Líderes");
    // Asked for no language, it stays English, so the log and the board don't pick up Spanish words.
    expect(foeWord(rhino, { lower: true })).toBe("villain");
  });
});
