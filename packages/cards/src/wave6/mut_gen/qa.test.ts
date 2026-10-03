import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome, type DriverResult } from "../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario, type Wave6ScenarioOptions } from "../index.js";
import { magnetCounters, magnetoGame, withMagnetCounters, withoutDealtCards } from "./magneto-testing.js";
import { mansionAttackGame, setAsideVillainIds, villainTitle } from "./mansion-attack-testing.js";
import { engageMinion, inPlay, wideawakeGame } from "./project-wideawake-testing.js";

/**
 * Wave 6 rules QA, Mutant Genesis scenarios (`docs/phase7-wave6-qa-mutgen-scenarios.md`): Sabretooth, Project Wideawake,
 * Master Mold, Mansion Attack and Magneto, with the Brotherhood, Acolytes, Mystique, Sentinels, Zero Tolerance and Future
 * Past sets. Two parts.
 *
 * 1. Rulings, errata and FAQ entries that touch a card of these scenarios and sets. Already pinned exactly by a module
 *    test, so not copied here:
 *    - FAQ "Operation Zero Tolerance (#104)", RRG 1.8 p. 63 (an ally that is not discarded after being defeated still goes
 *      under it): `project-wideawake.test.ts` "FAQ Operation Zero Tolerance (#104), RRG 1.8 p. 63" (Regroup returns it to
 *      hand; the shuffled-into-the-deck case is the same selector and is not separately staged).
 *    - Ruling Jan 26, 2026 (4) #5 (a Drone minion that defeats an ally puts it under Operation Zero Tolerance; the
 *      facedown side does not matter): `project-wideawake.test.ts` "ruling Jan 26, 2026 (4) #5".
 *    - FAQ "Fabian Cortez (#159)", RRG 1.8 p. 64 (he is discarded as the found Acolyte enters, so its teamwork does not see
 *      him): `acolytes.test.ts` "FAQ #159 (p. 64)".
 *    - Erratum RRG 1.8 p. 68, Mutants at the Mall (#88A) ("discarding any other ally version of Jubilee from play"):
 *      `project-wideawake.test.ts` "32088a.when-defeated: any other ally version of Jubilee is discarded from play".
 *    - Ruling Jun 2, 2026 (1) (Jubilee, Cameo or ally, against Wolverine): `wolv/qa.test.ts`, which seats this box's ally
 *      Jubilee (32088b) as the "other version".
 *    - Erratum p. 68, Asteroid M (#141B): "Q8" and the three-counter test in `magneto.test.ts` pin that 3 counters are
 *      removed and a Magnetic card is revealed; the ORDER the erratum changed (remove first, reveal second) is new below.
 *    - Ruling Jan 26, 2026 (3) (Nimrod, Into the Fray, Marked): superseded by RRG 1.8 "Overkill" (p. 31), pinned at engine
 *      level in `engine/src/excess-equals-overkill.test.ts` (the example's Nimrod) and `max-sustained-damage.test.ts`; the
 *      real Future Past Nimrod against Into the Fray is new below.
 *    New below: the erratum's removal order on all three main scheme stages, Mutants at the Mall's search of the encounter
 *    discard pile, Ruling Feb 28, 2026 (6) (a boost card that gives "the villain" a boost card when a minion activates)
 *    against the Brotherhood treacheries' boost, and the real Nimrod against Into the Fray.
 *    No other erratum on pp. 65 to 69, FAQ entry on pp. 55 to 64 or post-1.7 ruling names a card of these scenarios or
 *    sets (White Queen #56, Mutant Protectors #17, Powerful Punch #14, Armor Up and Steel Fist are the heroes' and
 *    nemesis cards, the next pass; Mystique's Manipulations #26 is Rogue's nemesis card; Magnetic Missile is Magneto's
 *    hero pack).
 * 2. Whole games with wave 6 precons for every scenario (2 players standard, 1 hero expert) and one per modular set,
 *    played by the greedy driver and replayed deep-equal, each asserting the signature mechanic from the replayed events.
 */

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const resolvedIds = (events: readonly GameEvent[]): readonly string[] =>
  of(events, "abilityResolved").map((e) => e.abilityId as string);
const endTurnP1 = { type: "endTurn", playerId: P1 } as const;
const BOOST = "01186";
const QUIET = "32146";

// Rulings --------------------------------------------------------------------------------------------------------

describe("erratum RRG 1.8 p. 68: Asteroid M (#141B), Factory Online (#142B), The Rule of Magnus (#143B)", () => {
  // "After you place a magnet counter on this scheme, if there are at least 3 magnet counters here, remove 3 of them and
  // discard cards from the encounter deck until a Magnetic card is discarded. Reveal that card." (Magnet counters are now
  // removed before the Magnetic card is revealed.) Electric Shock (32152, Magnetic) reads the counters on the main
  // scheme when it is revealed: hero form, "take 1 damage for each magnet counter on the main scheme".
  const SHOCK = "32152";
  it.each([
    [0, "Asteroid M", "32141b.asteroid-m-forced-response"],
    [1, "Factory Online", "32142b.factory-online-forced-response"],
    [2, "The Rule of Magnus", "32143b.the-rule-of-magnus-forced-response"],
  ] as const)(
    "stage %i, %s: the 3 counters are removed before Electric Shock is revealed, so it reads 0",
    (stage, _name, ability) => {
      const base = run(magnetoGame(), toHero(P1));
      const staged = withMagnetCounters(
        withoutDealtCards({ ...base, mainScheme: { ...base.mainScheme, stageIndex: stage } }),
        2,
      );
      // Magneto's attack places the third counter; the boost card is Advance (no icons); Electric Shock is the Magnetic
      // card the response finds; the quiet minion is the villain phase's own reveal afterwards.
      const { state, events } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(staged, BOOST, SHOCK, QUIET),
        firstLegal,
        endTurnP1,
      );
      expect(resolvedIds(events)).toContain(ability);
      const removed = events.findIndex((e) => e.type === "counterRemoved" && e.counterType === "magnet");
      const shock = events.findIndex((e) => e.type === "encounterCardRevealed" && (e.cardId as string) === SHOCK);
      expect(removed).toBeGreaterThanOrEqual(0);
      expect(shock).toBeGreaterThan(removed);
      // The stun lands, the damage it counts is 0: nothing hit the hero after the reveal began.
      expect(inst(state, identityOf(state)).statuses.stunned).toBe(1);
      const afterShock = events.slice(shock);
      expect(afterShock.some((e) => e.type === "damageDealt" && e.targetInstanceId === identityOf(state))).toBe(false);
      expect(magnetCounters(state)).toBe(0);
    },
  );
});

describe("Mutants at the Mall (32088a), RRG 1.8 p. 68 erratum text: the first player searches the encounter deck AND discard pile", () => {
  it("a Sentinel minion that is only in the encounter discard pile is found and revealed engaged with the first player", () => {
    const start = run(wideawakeGame(), toHero(P1));
    const deckId = activeEncounterDeckId(start);
    const pile = start.encounterDecks[deckId]!;
    const sentinels = pile.deck.filter((id) => codeOf(start, id) === "32093");
    expect(sentinels.length).toBeGreaterThan(0);
    const markIv = sentinels[0]!;
    const inDiscard: GameState = {
      ...start,
      encounterDecks: {
        ...start.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== markIv), discard: [...pile.discard, markIv] },
      },
    };
    // Every other Sentinel minion that could be found first is out of the way: only Mark IV (the discard pile) is left.
    const only: GameState = {
      ...inDiscard,
      encounterDecks: {
        ...inDiscard.encounterDecks,
        [deckId]: {
          deck: inDiscard.encounterDecks[deckId]!.deck.filter(
            (i) => !(state0Type(inDiscard, i) === "minion" && hasSentinelTrait(inDiscard, i)),
          ),
          discard: inDiscard.encounterDecks[deckId]!.discard,
        },
      },
    };
    const mall = inPlay(only, "32088a")[0]!;
    const ready = patchInstance(patchInstance(only, mall, { threat: 1 }), identityOf(only), { exhausted: false });
    const pick: Picker = (s) => (s.pendingChoice?.prompt.kind === "chooseCards" ? [markIv] : firstLegal(s));
    const after = settle(
      run(ready, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(ready),
        schemeInstanceId: mall,
      }),
      pick,
      undefined,
      WAVE6_DEPS,
    );
    expect(cardsInPlay(after)).toContain(markIv);
    expect(inst(after, markIv).engagedWith).toBe(P1);
  });
});
const state0Type = (state: GameState, id: InstanceId): string => state.cardPool[state.instances[id]!.cardId]!.type;
const hasSentinelTrait = (state: GameState, id: InstanceId): boolean =>
  (
    ((state.cardPool[state.instances[id]!.cardId] as { traits?: readonly unknown[] }).traits ??
      []) as readonly unknown[]
  ).some((t) => String(t).toUpperCase() === "SENTINEL");

describe("Ruling Feb 28, 2026 (6): a boost card that gives the villain a boost card does nothing when a minion, not the villain, is activating", () => {
  // "If a Villainous minion activates and draws Pirate Lackey as a boost card (which gives a boost card to the villain
  // while it has 1+ boost cards), does the villain receive a boost card? No. Because the villain is not activating, do
  // not give it a boost card." The Brotherhood treacheries (Ground Swell, Immovable, Pyromaniac, Hopping Mad) print "[star]
  // Boost: If the villain is X, give him an additional boost card for this activation". Only the villain and villainous
  // minions are dealt boost cards (RRG 1.8 "Attack (Enemy Activation)", p. 9, step 1). Bastion (32167, Future Past) is a
  // villainous minion: with Ground Swell as his boost card and Avalanche the villain, the villain is not activating, so
  // no additional boost card is given to anyone (by analogy: the ruling names Pirate Lackey).
  // `it.fails`: BUG pinned, passes while it exists. Ground Swell's `modifyAttack({ extraBoostCards: 1 })` applies to the
  // activation in progress, which is Bastion's, so Bastion is dealt a second boost card (the villain still gets exactly
  // one). Remove `.fails` when the extra card is only given to the villain's own activation.
  it.fails("Avalanche is the villain, Bastion (villainous) activates with Ground Swell as his boost card: no additional boost card is dealt", () => {
    const base = mansionAttackGame({ villain: "Avalanche", modularSetIds: ["future_past"] });
    expect(villainTitle(base)).toBe("Avalanche");
    const hero = run(base, toHero(P1));
    const { state: withBastion, id: bastion } = engageMinion(withoutDealtCards(hero), "32167");
    const villainId = hero.villains[0]!.instanceId;
    // The villain activates first (boost card: Advance), then Bastion (boost card: Ground Swell), then a quiet reveal.
    const staged = stackEncounterDeck(withBastion, BOOST, "32132", "32136");
    const { events } = driveEventsPicking(WAVE6_DEPS, staged, firstLegal, endTurnP1);
    const dealt = of(events, "boostCardDealt");
    expect(of(events, "attackResolved").some((e) => e.enemyInstanceId === bastion)).toBe(true);
    expect(of(events, "boostCardFlipped").some((e) => e.enemyInstanceId === bastion)).toBe(true);
    expect(dealt.filter((e) => e.enemyInstanceId === villainId)).toHaveLength(1);
    expect(dealt.filter((e) => e.enemyInstanceId === bastion)).toHaveLength(1);
  });
});

describe("Ruling Jan 26, 2026 (3) with the real Future Past Nimrod (32166), as superseded by RRG 1.8 'Overkill' (p. 31)", () => {
  // Nimrod "cannot take more than 3 damage each phase". FFG's example: Into the Fray deals 6 to Nimrod (4 hit points
  // left), he takes 3, 2 excess damage was "dealt". RRG 1.8 p. 31 revised Overkill: a card that counts excess damage dealt
  // counts the value overkill resolves with (damage taken beyond remaining hit points), which supersedes that ruling
  // (user decision 2026-09-25; `engine/src/excess-equals-overkill.test.ts`): 3 taken against 4 left is 0 excess, so no
  // threat is removed. Flagged conflict between the ruling and the RRG: the RRG wins.
  it("Into the Fray (13013) on a Nimrod with 4 hit points left removes no threat: he takes 3 and none of it is excess", () => {
    const hero = run(magnetoGame(), toHero(P1));
    const { state: withNimrod, id: nimrod } = engageMinion(hero, "32146");
    // The minion in play is a stand-in body for Nimrod: swap its printed card to Nimrod and give him 4 hit points left.
    const asNimrod = patchInstance(withNimrod, nimrod, { cardId: cardId("32166") });
    const hp = (asNimrod.cardPool[cardId("32166")] as { stages?: unknown; hp?: number }).hp;
    expect(hp).toBeGreaterThan(4);
    const hurtNimrod = patchInstance(asNimrod, nimrod, { damage: (hp as number) - 4 });
    const handId = playerOf(hurtNimrod, P1).deck[0]!;
    const withFray = {
      ...patchInstance(hurtNimrod, handId, { cardId: cardId("13013") }),
      players: hurtNimrod.players.map((p) =>
        p.playerId === P1 ? { ...p, deck: p.deck.filter((i) => i !== handId), hand: [...p.hand, handId] } : p,
      ),
    };
    const threatBefore = inst(withFray, withFray.mainScheme.instanceId).threat;
    const cost = (withFray.cardPool[cardId("13013")] as { cost?: number }).cost ?? 0;
    const ready = patchInstance(withFray, identityOf(withFray), { exhausted: false });
    const aimed: Picker = (s) =>
      s.pendingChoice?.options.some((o) => o.optionId === nimrod) ? [nimrod] : firstLegal(s);
    const state = settle(
      run(ready, play(P1, handId, payWith(ready, P1, cost, [handId]))),
      aimed,
      undefined,
      WAVE6_DEPS,
    );
    expect(inst(state, nimrod).damage).toBe((hp as number) - 4 + 3);
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(threatBefore);
  });
});

// Whole games ----------------------------------------------------------------------------------------------------

interface Variant {
  readonly label: string;
  readonly players: readonly { readonly starterDeckId: string }[];
  readonly difficulty: "standard" | "expert";
}
const two = (a: string, b: string): Variant["players"] => [{ starterDeckId: a }, { starterDeckId: b }];
const one = (a: string): Variant["players"] => [{ starterDeckId: a }];
const SEED_LIMIT = 60;

/**
 * First seed of 1..SEED_LIMIT whose game (played from setup, no surgery) reaches an outcome, replays deep-equal and whose
 * replayed events satisfy `wanted`.
 */
function findGame(
  scenarioId: string,
  modularSetIds: readonly string[],
  variant: Variant,
  wanted: (events: readonly GameEvent[], created: GameState) => boolean,
): { result: DriverResult; events: readonly GameEvent[]; created: GameState; seed: number } {
  for (let seed = 1; seed <= SEED_LIMIT; seed++) {
    const options: Wave6ScenarioOptions = {
      players: variant.players,
      seed,
      difficulty: variant.difficulty,
      modularSetIds: [...modularSetIds],
    };
    const created = createGame(wave6Scenario(scenarioId, options), WAVE6_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const result = playToOutcome(created.state, WAVE6_DEPS);
    if (!result.outcome) continue;
    const played = replay(result.session.log, WAVE6_DEPS);
    if (!played.ok) throw new Error("replay failed");
    expect(played.state).toEqual(result.session.state);
    if (wanted(played.events, created.state)) return { result, events: played.events, created: created.state, seed };
  }
  throw new Error(`no seed of 1..${SEED_LIMIT} ended as wanted`);
}

const STANDARD_2P = (a: string, b: string): Variant => ({
  label: "2 players, standard",
  players: two(a, b),
  difficulty: "standard",
});
const EXPERT_SOLO = (a: string): Variant => ({ label: "1 hero, expert", players: one(a), difficulty: "expert" });
const idsOf = (events: readonly GameEvent[]) => new Set(resolvedIds(events));
const revealedCodes = (events: readonly GameEvent[]) =>
  of(events, "encounterCardRevealed").map((e) => e.cardId as string);

/** Applies `command`, then answers every choice with the first legal option, through `sessionApply` so the log replays. */
function applyAll(session: GameSession, command: Command): GameSession {
  let current = sessionApply(session, command, WAVE6_DEPS);
  if (!current.ok) throw new Error(current.error.message);
  let next = current.session;
  for (let guard = 0; next.state.pendingChoice && !next.state.outcome && guard < 50; guard++) {
    const choice = next.state.pendingChoice;
    current = sessionApply(
      next,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(next.state),
      },
      WAVE6_DEPS,
    );
    if (!current.ok) throw new Error(current.error.message);
    next = current.session;
  }
  return next;
}

/**
 * A game whose first turn is staged (the greedy driver never defeats these schemes in 60 seeds): P1 changes to hero form
 * and thwarts the side scheme `schemeCode` (its threat set to 1 by surgery) through `sessionApply`, then the driver
 * plays on to an outcome. Two logs, each replayed deep-equal: the prefix equals the state handed to `playToOutcome`,
 * and that run's log equals its final state.
 */
function stagedThwartGame(
  scenarioId: string,
  modularSetIds: readonly string[],
  variant: Variant,
  schemeCode: string,
): { prefix: readonly GameEvent[]; before: GameState; after: GameState; created: GameState; outcome: unknown } {
  const options: Wave6ScenarioOptions = {
    players: variant.players,
    seed: 1,
    difficulty: variant.difficulty,
    modularSetIds: [...modularSetIds],
  };
  const created = createGame(wave6Scenario(scenarioId, options), WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const start = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE6_DEPS);
  const scheme = inPlay(start, schemeCode)[0]!;
  const staged = patchInstance(start, scheme, { threat: 1 });
  let session = applyAll(startSession(staged), toHero(P1));
  session = applyAll(session, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identityOf(session.state),
    schemeInstanceId: scheme,
  });
  const prefix = replay(session.log, WAVE6_DEPS);
  if (!prefix.ok) throw new Error("prefix replay failed");
  expect(prefix.state).toEqual(session.state);
  const result = playToOutcome(session.state, WAVE6_DEPS);
  const rest = replay(result.session.log, WAVE6_DEPS);
  if (!rest.ok) throw new Error("replay failed");
  expect(rest.state).toEqual(result.session.state);
  return {
    prefix: prefix.events,
    before: session.state,
    after: result.session.state,
    created: created.state,
    outcome: result.outcome,
  };
}

interface SearchedGame {
  readonly variant: Variant;
  readonly wanted: (events: readonly GameEvent[], created: GameState) => boolean;
  readonly check: (events: readonly GameEvent[], created: GameState) => void;
}
interface StagedGame {
  readonly variant: Variant;
  readonly schemeCode: string;
  readonly check: (prefix: readonly GameEvent[], before: GameState, created: GameState) => void;
}
interface ScenarioCase {
  readonly name: string;
  readonly scenarioId: string;
  readonly modular: readonly string[];
  readonly searched: readonly SearchedGame[];
  readonly staged: readonly StagedGame[];
}

const CAPTIVES = ["32089", "32090", "32091", "32092"];

const SCENARIOS: readonly ScenarioCase[] = [
  {
    // Signature: Robert Kelly takes the per-phase damage from Stalked by Sabretooth; Find the Senator is defeated, flips to
    // Protect the Senator and the first player takes control of Kelly.
    name: "Sabretooth",
    scenarioId: "sabretooth",
    modular: ["brotherhood", "mystique"],
    searched: [
      {
        variant: STANDARD_2P("cyclops-leadership", "phoenix-justice"),
        wanted: (events) => {
          const ids = idsOf(events);
          return ids.has("32063b.stalked-by-sabretooth-forced-response") && ids.has("32065a.when-defeated");
        },
        check: (events, created) => {
          const kelly = Object.keys(created.instances).filter((id) => codeOf(created, id as InstanceId) === "32066");
          expect(kelly).toHaveLength(1);
          expect(of(events, "cardFlippedToOtherFace").some((e) => (e.to as string) === "32065b")).toBe(true);
          expect(of(events, "controllerChanged").some((e) => e.instanceId === kelly[0] && e.reason === "effect")).toBe(
            true,
          );
          expect(of(events, "damageDealt").some((e) => e.targetInstanceId === kelly[0])).toBe(true);
        },
      },
    ],
    staged: [
      {
        variant: EXPERT_SOLO("wolverine-aggression"),
        schemeCode: "32065a",
        check: (prefix, before, created) => {
          const kelly = Object.keys(created.instances).filter((id) => codeOf(created, id as InstanceId) === "32066");
          expect(kelly).toHaveLength(1);
          expect(idsOf(prefix)).toContain("32065a.when-defeated");
          expect(of(prefix, "cardFlippedToOtherFace").some((e) => (e.to as string) === "32065b")).toBe(true);
          expect(inst(before, kelly[0] as InstanceId).controllerId).toBe(P1);
        },
      },
    ],
  },
  {
    // Signature: the four Captive allies start set aside; Operation Zero Tolerance takes cards; defeating Abduction
    // Protocols puts a Captive into play under the defeating player.
    name: "Project Wideawake",
    scenarioId: "project-wideawake",
    modular: ["sentinels"],
    searched: [
      {
        variant: STANDARD_2P("wolverine-aggression", "storm-leadership"),
        wanted: (events) => {
          const ids = idsOf(events);
          return (
            ids.has("32104.operation-zero-tolerance-forced-response") &&
            ids.has("32087b.night-of-the-sentinels-forced-response")
          );
        },
        check: (_events, created) => {
          expect(created.encounterSetAside.map((id) => codeOf(created, id)).sort()).toEqual(CAPTIVES);
        },
      },
      {
        variant: EXPERT_SOLO("phoenix-justice"),
        wanted: (events) => idsOf(events).has("32104.operation-zero-tolerance-forced-response"),
        check: (_events, created) => {
          expect(created.encounterSetAside.map((id) => codeOf(created, id)).sort()).toEqual(CAPTIVES);
        },
      },
    ],
    staged: [STANDARD_2P("wolverine-aggression", "storm-leadership"), EXPERT_SOLO("phoenix-justice")].map(
      (variant): StagedGame => ({
        variant,
        schemeCode: "32100",
        check: (prefix, before) => {
          expect(idsOf(prefix)).toContain("32100.when-defeated");
          const captive = cardsInPlay(before).filter((id) => CAPTIVES.includes(codeOf(before, id)));
          expect(captive).toHaveLength(1);
          expect(inst(before, captive[0]!).controllerId).toBe(P1);
        },
      }),
    ),
  },
  {
    // Signature: Master Mold's scheme Forced Interrupt puts a Sentinel into play and withholds its own boost card.
    name: "Master Mold",
    scenarioId: "master-mold",
    modular: ["zero_tolerance"],
    searched: [STANDARD_2P("storm-leadership", "cyclops-leadership"), EXPERT_SOLO("wolverine-aggression")].map(
      (variant): SearchedGame => ({
        variant,
        wanted: (events) =>
          [...idsOf(events)].some((id) => /^(32109|32110|32111)\.master-mold-forced-interrupt$/.test(id)) &&
          of(events, "boostWithheld").length > 0,
        check: (events) => {
          const withheld = of(events, "boostWithheld");
          expect(withheld.length).toBeGreaterThan(0);
          expect(withheld.every((e) => e.activation === "scheme")).toBe(true);
        },
      }),
    ),
    staged: [],
  },
  {
    // Signature: one villain in play and three set aside, the four stage-2 schemes shuffled (stage order a permutation of
    // 0..4 with the first stage first), and a main scheme stage is completed and advanced.
    name: "Mansion Attack",
    scenarioId: "mansion-attack",
    modular: ["mystique"],
    searched: [STANDARD_2P("phoenix-justice", "wolverine-aggression"), EXPERT_SOLO("cyclops-leadership")].map(
      (variant): SearchedGame => ({
        variant,
        wanted: (events) => of(events, "mainSchemeCompleted").length > 0,
        check: (events, created) => {
          expect(setAsideVillainIds(created)).toHaveLength(3);
          const order = created.mainScheme.stageOrder!;
          expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
          expect(order[0]).toBe(0);
          expect(of(events, "mainSchemeAdvanced").length).toBeGreaterThan(0);
        },
      }),
    ),
    staged: [],
  },
  {
    // Signature: magnet counters gather (3 removed, a Magnetic card revealed) and Wrapped in Metal is revealed.
    name: "Magneto",
    scenarioId: "magneto",
    modular: ["acolytes"],
    searched: [STANDARD_2P("storm-leadership", "phoenix-justice"), EXPERT_SOLO("cyclops-leadership")].map(
      (variant): SearchedGame => ({
        variant,
        wanted: (events) =>
          idsOf(events).has("32141b.asteroid-m-forced-response") && revealedCodes(events).includes("32150"),
        check: (events) => {
          expect(of(events, "counterRemoved").some((e) => e.counterType === "magnet" && e.amount === 3)).toBe(true);
          expect(revealedCodes(events)).toContain("32150");
        },
      }),
    ),
    staged: [],
  },
];

describe.each(SCENARIOS)("$name: wave 6 precons play to an outcome and replay deep-equal", (scenario) => {
  it.each(scenario.searched)(
    "$variant.label: the signature mechanic happens, no surgery",
    (game) => {
      const { result, events, created } = findGame(scenario.scenarioId, scenario.modular, game.variant, game.wanted);
      expect(result.outcome).not.toBeNull();
      game.check(events, created);
    },
    900_000,
  );

  it.each(scenario.staged)(
    "$variant.label: the first turn is staged (the driver never reaches it), then played on",
    (game) => {
      const { prefix, before, created, outcome } = stagedThwartGame(
        scenario.scenarioId,
        scenario.modular,
        game.variant,
        game.schemeCode,
      );
      game.check(prefix, before, created);
      expect(outcome).not.toBeNull();
    },
    900_000,
  );
});

// One game per modular set ---------------------------------------------------------------------------------------

interface SetCase {
  readonly name: string;
  readonly scenarioId: string;
  readonly modular: readonly string[];
  readonly variant: Variant;
  readonly abilityPattern: RegExp;
}
const SETS: readonly SetCase[] = [
  {
    name: "Brotherhood (32073-32079)",
    scenarioId: "sabretooth",
    modular: ["brotherhood"],
    variant: STANDARD_2P("cyclops-leadership", "wolverine-aggression"),
    abilityPattern: /^3207[3-9]\./,
  },
  {
    name: "Acolytes (32159-32165)",
    scenarioId: "magneto",
    modular: ["acolytes"],
    variant: STANDARD_2P("phoenix-justice", "storm-leadership"),
    abilityPattern: /^3216[0-5]\./,
  },
  {
    name: "Mystique (32080-32083)",
    scenarioId: "mansion-attack",
    modular: ["mystique"],
    variant: EXPERT_SOLO("phoenix-justice"),
    abilityPattern: /^3208[0-3]\./,
  },
  {
    name: "Sentinels (32105-32108)",
    scenarioId: "project-wideawake",
    modular: ["sentinels"],
    variant: STANDARD_2P("storm-leadership", "phoenix-justice"),
    abilityPattern: /^3210[5-8]\./,
  },
  {
    name: "Zero Tolerance (32101-32104)",
    scenarioId: "master-mold",
    modular: ["zero_tolerance"],
    variant: EXPERT_SOLO("cyclops-leadership"),
    abilityPattern: /^3210[1-4]\./,
  },
  {
    name: "Future Past (32166-32170)",
    scenarioId: "sabretooth",
    modular: ["future_past"],
    variant: STANDARD_2P("wolverine-aggression", "cyclops-leadership"),
    abilityPattern: /^3216[6-9]\.|^32170\./,
  },
];

describe.each(SETS)("modular set $name", (set) => {
  it("a game with a wave 6 precon plays to an outcome, a card of the set resolves, and it replays deep-equal", () => {
    const { result, events } = findGame(set.scenarioId, set.modular, set.variant, (evs) =>
      resolvedIds(evs).some((id) => set.abilityPattern.test(id)),
    );
    expect(result.outcome).not.toBeNull();
    expect(events.length).toBeGreaterThan(0);
  }, 900_000);
});
