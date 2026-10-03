import { createGame, replay, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import { firstLegal, inst, threatOn, P1, patchInstance, runWith, settle, toHero, use } from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { challengersOf, championOf } from "./magog-testing.js";
import { mojoOf, wheelOf, withNoSetAside, withShrunkEncounterDeck } from "./mojo-testing.js";
import { GENRE_SETS, spiralGame } from "./spiral-testing.js";

/**
 * Wave 6 rules QA, MojoMania (`docs/phase7-wave6-qa-mojo.md`). Two parts.
 *
 * 1. The docs/phase7-wave6.md §7.6 fixtures. Each was already pinned exactly by a module test, which is where the
 *    assertion lives (a second copy would only drift). Where each one is pinned:
 *    - FAQ "Dial M for Mojo (#35)" (RRG 1.8 p. 64): `spiral.test.ts` "FAQ 'Dial M for Mojo (#35)'" (two tests).
 *    - FAQ "Wild Wild Mojo (#66)" (p. 64): `western.test.ts` "FAQ #66: an overkill attack that defeats a minion ..." and
 *      "... an ally defeated by the villain's attack spills +1 ... (FAQ #66)".
 *    - Insert p. 18 bullet 1 (Wild Wild Mojo and an ally's consequential damage): `western.test.ts` "an ally's
 *      consequential damage is +1 only when it takes at least 1".
 *    - Insert p. 18 bullet 2 (Stinger Tail gone before its retaliate 2) and bullet 3 (Stinger Tail with Undercover
 *      Mojo, first player picks): `mojo.test.ts` "insert p. 18: Stinger Tail discarded by an attack's damage ..." and
 *      "insert p. 18: Stinger Tail and Undercover Mojo in play together".
 *    - Insert p. 18, a SHOW from the show deck or the Wheel does not surge: `spiral.test.ts` (line 674, Search's reveal),
 *      `mojo.test.ts` "the SHOW revealed by the Wheel does not surge" and "the SHOW revealed by 1B does not surge".
 *    - Ruling Apr 30, 2026 (1): `spiral.test.ts` "an effect whose only effect is damage cannot target her" (ESCAPED) and
 *      `crime.test.ts` "... cannot target the villain" (Dragnet), each with the second-effect control.
 *    - Ruling Apr 30, 2026 (3) #1: `../../campaigns/mojo.test.ts` "Longshot in play at the end of scenario 1 ...".
 *    - Errata p. 69, Fetch Quest: `fantasy.test.ts` "erratum (RRG 1.8 p. 69): a card with a requirement is never offered".
 *    - Errata p. 69, The Search for Spiral: the definition and cost order are pinned in `spiral.test.ts`
 *      ("39016.the-search-for-spiral-action"); the rule that makes "cost" matter (prevented damage means unpaid) is
 *      NOT, and is asserted below.
 * 2. Whole games in the shapes docs/phase7-wave6.md §7.8 asks for, in two players (standard) and expert (one hero),
 *    played by the greedy driver and replayed deep-equal. The one-hero standard games are in `*-e2e.test.ts`.
 */
const SOLO = [{ starterDeckId: "core-spider-man-justice" }] as const;
const DUO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

const start = (
  scenario: "magog" | "spiral" | "mojo",
  options: Partial<Wave6ScenarioOptions>,
  stage: (state: GameState) => GameState = (s) => s,
) => {
  const config = wave6Scenario(scenario, { players: SOLO, seed: 1, firstPlayerIndex: 0, ...options });
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return stage(settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS));
};

/** The replay of the session's log must reach the identical final state; returns its events. */
const replayed = (result: DriverResult): readonly GameEvent[] => {
  const again = replay(result.session.log, WAVE6_DEPS);
  expect(again.ok).toBe(true);
  if (!again.ok) throw new Error("replay failed");
  expect(again.state).toEqual(result.session.state);
  return again.events;
};

const findGame = (
  seeds: readonly number[],
  build: (seed: number) => GameState,
  wanted: (result: DriverResult) => boolean,
): DriverResult => {
  for (const seed of seeds) {
    const result = playToOutcome(build(seed), WAVE6_DEPS);
    if (wanted(result)) return result;
  }
  throw new Error(`no seed of ${seeds[0]}..${seeds[seeds.length - 1]} ended as wanted`);
};
const seeds = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** The two shapes every game below is played in. */
const VARIANTS: readonly {
  readonly label: string;
  readonly options: Partial<Wave6ScenarioOptions>;
  /** Ratings counters The Challengers start a staged winning game with: one real placement short of its flip. */
  readonly challengersStart: number;
}[] = [
  // The crowds flip at 5 per hero and win or lose at 10 per hero (39004a, 39004b): 10 and 20 with two players.
  { label: "2 players, standard", options: { players: DUO }, challengersStart: 16 },
  { label: "1 hero, expert", options: { difficulty: "expert" }, challengersStart: 6 },
];

const ratings = (state: GameState, id: ReturnType<typeof championOf>): number =>
  state.instances[id]!.counters["ratings"] ?? 0;

describe.each(VARIANTS)("MaGog ($label)", ({ options, challengersStart }) => {
  it("is won on The Challengers: the crowd flips, and 10 ratings counters there win", () => {
    // Staged by surgery: The Challengers start with `challengersStart` ratings counters (16 of the 20 a two-player win
    // takes; 6 of the 10 an expert one hero win takes). Played unaided, the greedy driver puts about 10 counters there
    // in a two-player game before the heroes fall; the flip, the remaining placements and the win are played.
    const result = findGame(
      seeds(60),
      (seed) =>
        start("magog", { ...options, seed, modularSetIds: ["western"] }, (s) =>
          patchInstance(s, challengersOf(s), { counters: { ratings: challengersStart } }),
        ),
      (r) => r.outcome?.result === "win",
    );
    const end = result.session.state;
    expect(end.instances[challengersOf(end)]!.flipped).toBe(true);
    expect(ratings(end, challengersOf(end))).toBeGreaterThanOrEqual(10);
    expect(ratings(end, championOf(end))).toBeLessThan(10);
    replayed(result);
  }, 600_000);

  it("is lost on The Champion: 10 ratings counters there and MaGog wins again", () => {
    // Played from the real setup, no surgery.
    const result = findGame(
      seeds(60),
      (seed) => start("magog", { ...options, seed, modularSetIds: ["crime"] }),
      (r) => {
        const end = r.session.state;
        return r.outcome?.result === "loss" && ratings(end, championOf(end)) >= 10;
      },
    );
    const end = result.session.state;
    expect(end.instances[championOf(end)]!.flipped).toBe(true);
    expect(ratings(end, challengersOf(end))).toBeLessThan(10);
    replayed(result);
  }, 600_000);
});

const SHOW_CODES = ["39035", "39053", "39066"];
/**
 * Cornered! (39017) revealed, then shuffled back into the show deck ("Shuffle this card into the show deck": a move
 * into the show deck after the reveal), and a SHOW environment sent from play to the bottom of the show deck instead of
 * being discarded (1B's forced interrupt; the show deck has no discard pile). A move out of the show deck itself, as at
 * setup, does not count.
 */
const showDeckTrip = (events: readonly GameEvent[]) => {
  const at = events.findIndex((e) => e.type === "encounterCardRevealed" && e.cardId === "39017");
  const intoShowDeck = (e: GameEvent, ids: readonly string[]) =>
    e.type === "cardMoved" &&
    e.to.kind === "scenarioDeck" &&
    e.from.kind !== "scenarioDeck" &&
    ids.includes(e.cardId as string);
  return {
    cornered: at >= 0,
    shuffledBack: at >= 0 && events.slice(at).some((e) => intoShowDeck(e, ["39017"])),
    // From play, not from the encounter piles (setup builds the show deck out of them).
    showToBottom: events.some(
      (e) =>
        intoShowDeck(e, SHOW_CODES) &&
        e.type === "cardMoved" &&
        !["encounterDeck", "encounterDiscard"].includes(e.from.kind),
    ),
  };
};

describe.each(VARIANTS)("Spiral through the show deck ($label)", ({ options }) => {
  it("Cornered! flips her and is shuffled back; a SHOW goes to the bottom; the game replays deep-equal", () => {
    // Played from the real setup, no surgery.
    const result = findGame(
      seeds(80),
      (seed) => start("spiral", { ...options, seed, modularSetIds: [...GENRE_SETS] }),
      (r) => {
        const again = replay(r.session.log, WAVE6_DEPS);
        if (!again.ok) return false;
        const trip = showDeckTrip(again.events);
        return r.outcome !== null && trip.shuffledBack && trip.showToBottom;
      },
    );
    const events = replayed(result);
    expect(showDeckTrip(events)).toEqual({ cornered: true, shuffledBack: true, showToBottom: true });
    expect(events.some((e) => e.type === "villainFlipped")).toBe(true);
    // The show deck has no discard pile (insert p. 11): nothing of it was ever discarded.
    expect(result.session.state.scenarioDecks["show"]!.discard).toEqual([]);
  }, 600_000);
});

const resetsIn = (events: readonly GameEvent[]) => events.filter((e) => e.type === "accelerationTokenAdded").length;

describe.each(VARIANTS)("Mojo, encounter deck resets ($label)", ({ options }) => {
  it("resets twice: the Wheel flips, a set is shuffled on top, a second reset follows", () => {
    // Staged by surgery: the encounter deck is cut to 6 cards (the rest removed from the game) so that two resets fall
    // inside a few rounds; a real encounter deck of ~40 cards seldom resets once before a game ends. Resets, flips and
    // set placement are all the engine's own.
    const deckSize = (options.players?.length ?? 1) > 1 ? 8 : 6;
    const wanted = (r: DriverResult): boolean => {
      const again = replay(r.session.log, WAVE6_DEPS);
      if (!again.ok) return false;
      const wheel = wheelOf(r.session.state);
      return (
        resetsIn(again.events) >= 2 &&
        again.events.some((e) => e.type === "cardFlipped" && e.instanceId === wheel) &&
        again.events.some((e) => e.type === "setAsideModularSetShuffledIn" && e.placement === "shuffledOnTop")
      );
    };
    const result = findGame(
      seeds(40),
      (seed) => start("mojo", { ...options, seed }, (s) => withShrunkEncounterDeck(s, deckSize)),
      wanted,
    );
    const events = replayed(result);
    const firstReset = events.findIndex((e) => e.type === "accelerationTokenAdded");
    const brought = events.findIndex(
      (e) => e.type === "setAsideModularSetShuffledIn" && e.placement === "shuffledOnTop",
    );
    expect(resetsIn(events)).toBeGreaterThanOrEqual(2);
    expect(firstReset).toBeGreaterThanOrEqual(0);
    expect(brought).toBeGreaterThan(firstReset);
    expect(result.outcome).not.toBeNull();
  }, 600_000);

  it("is lost when the deck resets and no set-aside modular set remains", () => {
    // Staged by surgery: no genre set is left set aside and the deck is 3 cards, so the first reset comes in round 1.
    const state = start("mojo", { ...options, seed: 2 }, (s) => withNoSetAside(withShrunkEncounterDeck(s, 3)));
    const wheel = wheelOf(state);
    const result = playToOutcome(state, WAVE6_DEPS);
    expect(result.outcome?.result).toBe("loss");
    const events = replayed(result);
    expect(resetsIn(events)).toBeGreaterThanOrEqual(1);
    // The Wheel never flipped: the loss came with the reset.
    expect(events.filter((e) => e.type === "cardFlipped" && e.instanceId === wheel)).toHaveLength(0);
    expect(result.session.state.setAsideModularSets ?? []).toEqual([]);
    // Not an ordinary villain or scheme loss.
    expect(result.session.state.villains.find((v) => v.instanceId === mojoOf(result.session.state))!.defeated).toBe(
      false,
    );
  }, 600_000);
});

describe("The Search for Spiral, errata RRG 1.8 p. 69: the 2 damage is a cost (Cost, p. 14)", () => {
  // RRG "Cost" (p. 14): "If taking damage is a cost, that cost is not considered paid unless all of that damage was
  // taken." With the cost arrow added by the erratum, a hero whose damage is prevented has not paid, so no threat is
  // removed.
  const USE = "39016.the-search-for-spiral-action";
  const heroForm = (): GameState => {
    const state = spiralGame();
    return settle(runWith(WAVE6_DEPS, state, toHero(P1)), firstLegal, undefined, WAVE6_DEPS);
  };

  it("control: unprevented, the 2 damage is taken and 3 threat is removed", () => {
    const base = heroForm();
    const search = [...Object.keys(base.instances)].find((id) => base.instances[id as never]!.cardId === "39016")!;
    const staged = patchInstance(base, search as never, { threat: 5 });
    const used = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, use(P1, search as never, USE));
    expect(threatOn(used.state, search as never)).toBe(2);
  });

  // BUG (found by this pass, engine): `AbilityCost.damageSelf` (`takeDamageCost`) pushes a plain dealDamage and never
  // settles it (`settleCostDamage`, as `indirectDamage` and `damageCards` do), so tough prevents the damage but the
  // effects still resolve: threat goes 5 to 2. RRG 1.8 p. 14 and the Focused Rage FAQ (#27, p. 57) say the ability
  // cannot be used. Same gap for She-Hulk's Focused Rage and every other `takeDamageCost` card. Remove `.fails` once fixed.
  it.fails("a tough status card on the hero prevents the damage: the cost is unpaid and no threat is removed", () => {
    const base = heroForm();
    const search = [...Object.keys(base.instances)].find((id) => base.instances[id as never]!.cardId === "39016")!;
    const heroId = base.players[0]!.identity.instanceId;
    const staged = patchInstance(patchInstance(base, search as never, { threat: 5 }), heroId, {
      statuses: { ...inst(base, heroId).statuses, tough: 1 },
    });
    const used = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, use(P1, search as never, USE));
    expect(threatOn(used.state, search as never)).toBe(5);
  });
});
