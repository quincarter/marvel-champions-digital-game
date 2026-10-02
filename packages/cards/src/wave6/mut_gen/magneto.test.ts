import {
  activeVillain,
  applyCommand,
  cardsInPlay,
  hasKeyword,
  keywordTotal,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { addCounters, confuse, stun, theMainScheme, theVillain, whenRevealed } from "../../dsl/index.js";
import { MAGNETO_ABILITIES } from "./magneto.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  driveStepwise,
  encounterCardInVillainArea,
} from "../../testing/staging.js";
import { attachToHost, engageMinion } from "./project-wideawake-testing.js";
import { handForMixedCost } from "./sabretooth-testing.js";
import {
  inEncounterPiles,
  inPlay,
  intoPlayArea,
  magnetCounters,
  magnetoGame,
  withDiscardOnTop,
  withMagnetCounters,
  withoutDealtCards,
} from "./magneto-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const finish = (state: GameState, pick: Picker = firstLegal) => settle(state, pick, undefined, WAVE6_DEPS);
const villain = (state: GameState) => activeVillain(state).instanceId;
const mainScheme = (state: GameState) => state.mainScheme.instanceId;
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;
const bare = (state: GameState, id: InstanceId) =>
  patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } });
const abilitiesResolved = (events: readonly GameEvent[]) => of(events, "abilityResolved").map((e) => e.abilityId);
/** The hero form: Magneto attacks (a villain in alter-ego form schemes). */
const hero = (state: GameState) => run(state, toHero(P1));
/**
 * One villain phase from the end of P1's turn: the stacked cards are drawn in order, the villain's boost card first
 * (Advance, no boost icons), then the reveal(s) the test is about. M-Type Sentinel (32146) is the quiet filler: a
 * minion that only engages.
 */
const BOOST = "01186";
const QUIET = "32146";
const phase = (state: GameState, top: readonly string[], pick: Picker = firstLegal, deps: EngineDeps = WAVE6_DEPS) =>
  driveEventsPicking(deps, stackEncounterDeck(state, ...top), pick, { type: "endTurn", playerId: P1 });
/** Replaces ability definitions, for a test of an ability that reacts to something no card of the set produces. */
const withAbilities = (overrides: EngineDeps["abilities"]): EngineDeps => ({
  ...WAVE6_DEPS,
  abilities: { ...WAVE6_DEPS.abilities, ...overrides },
});
/** Removes the side scheme caps and the dealt cards, so damage and reveals are the test's own. */
const withoutSideSchemes = (state: GameState): GameState => {
  const gone = cardsInPlay(state).filter((id) => state.cardPool[codeOf(state, id)]!.type === "side_scheme");
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    villainArea: state.villainArea.filter((id) => !gone.includes(id)),
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, ...gone] } },
  };
};

describe("registry", () => {
  it("registers every ability ref of the Magneto set except the skipped M-Type Sentinel boost", () => {
    expect(Object.keys(MAGNETO_ABILITIES).sort()).toEqual(
      [
        "32138.magneto-forced-response",
        "32139.when-revealed",
        "32139.magneto-forced-response",
        "32140.when-revealed",
        "32140.magneto-forced-response",
        "32141a.setup",
        "32141b.asteroid-m-forced-response",
        "32142a.when-revealed",
        "32142b.factory-online-forced-response",
        "32143a.when-revealed",
        "32143b.the-rule-of-magnus-forced-response",
        "32144a.boarding-party-constant",
        "32144a.when-defeated",
        "32144b.sabotage-master-mold-constant",
        "32144b.when-defeated",
        "32145a.orbital-decay-constant",
        "32145a.when-defeated",
        "32145b.physical-strain-constant",
        "32146.when-defeated",
        "32147.magnetos-helmet-constant",
        "32147.magnetos-helmet-response",
        "32148.magnetos-armor-constant",
        "32148.magnetos-armor-response",
        "32149.magnetic-bubble-constant",
        "32149.magnetic-bubble-forced-interrupt",
        "32150.wrapped-in-metal-constant",
        "32150.wrapped-in-metal-constant-2",
        "32150.wrapped-in-metal-action",
        "32151.when-revealed",
        "32152.when-revealed-alter-ego",
        "32152.when-revealed-hero",
        "32153.when-revealed",
        "32153.boost",
        "32154.when-revealed",
        "32154.boost",
        "32155.when-revealed",
        "32156.when-defeated",
        "32157.when-revealed",
        "32157.boost",
        "32158.when-revealed",
        "32158.when-defeated",
      ].sort(),
    );
  });
});

describe("Asteroid M 1A (32141a): Setup", () => {
  it("32141a.setup: Boarding Party is revealed into play and Orbital Decay is set aside, out of the deck", () => {
    for (const difficulty of ["standard", "expert"] as const) {
      const state = magnetoGame({ difficulty });
      expect(inPlay(state, "32144a")).toHaveLength(1);
      expect(inEncounterPiles(state, "32144a")).toHaveLength(0);
      expect(inPlay(state, "32145a")).toHaveLength(0);
      expect(inEncounterPiles(state, "32145a")).toHaveLength(0);
      expect(state.encounterSetAside.map((id) => codeOf(state, id))).toEqual(["32145a"]);
      expect(inst(state, inPlay(state, "32144a")[0]!).threat).toBe(3);
    }
  });
});

describe("Magneto (32138): Forced Response", () => {
  it("32138.magneto-forced-response: after Magneto attacks you, 1 magnet counter goes on the main scheme", () => {
    const start = withoutDealtCards(hero(magnetoGame()));
    expect(magnetCounters(start)).toBe(0);
    const { state, events } = phase(start, [BOOST, QUIET]);
    expect(of(events, "attackResolved")).toHaveLength(1);
    expect(abilitiesResolved(events)).toContain("32138.magneto-forced-response");
    expect(magnetCounters(state)).toBe(1);
  });

  it("in alter-ego form Magneto schemes instead and places none", () => {
    const start = withoutDealtCards(magnetoGame());
    const { state, events } = phase(start, [BOOST, QUIET]);
    expect(of(events, "attackResolved")).toHaveLength(0);
    expect(magnetCounters(state)).toBe(0);
  });
});

const revealed = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.cardId as string);
const counters = (events: readonly GameEvent[]) =>
  of(events, "counterAdded")
    .filter((e) => e.counterType === "magnet")
    .map((e) => e.amount);

describe("the main scheme's Forced Response (32141b, 32142b, 32143b)", () => {
  it("32141b.asteroid-m-forced-response: the third magnet counter removes 3 and reveals the first Magnetic card discarded", () => {
    const start = withMagnetCounters(withoutDealtCards(hero(magnetoGame())), 2);
    // Boost card, then Caught Off Guard (discarded, not revealed), Magnetic Bubble (the Magnetic card), then a quiet reveal.
    const { state, events } = phase(start, [BOOST, "01188", "32149", QUIET]);
    expect(abilitiesResolved(events)).toContain("32141b.asteroid-m-forced-response");
    expect(of(events, "counterRemoved").filter((e) => e.counterType === "magnet")).toEqual([
      expect.objectContaining({ amount: 3 }),
    ]);
    expect(magnetCounters(state)).toBe(0);
    const discarded = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.discard.map((id) =>
      codeOf(state, id),
    );
    expect(discarded).toContain("01188");
    expect(revealed(events)).not.toContain("01188");
    // The Bubble is revealed (it attaches to Magneto), and so is the quiet card the villain phase deals afterwards.
    expect(revealed(events)).toEqual(expect.arrayContaining(["32149", QUIET]));
    expect(inst(state, inPlay(state, "32149")[0]!).attachedTo ?? null).not.toBeNull();
  });

  it("two counters leave it alone: no removal, no reveal", () => {
    const start = withMagnetCounters(withoutDealtCards(hero(magnetoGame())), 1);
    const { state, events } = phase(start, [BOOST, QUIET]);
    expect(of(events, "counterRemoved")).toEqual([]);
    expect(magnetCounters(state)).toBe(2);
    expect(revealed(events)).toEqual([QUIET]);
  });

  it("Q8: 6 counters placed at once are one placement, so 3 are removed and 3 stay (one reveal)", () => {
    const six = withAbilities({ "32153.when-revealed": whenRevealed(addCounters("magnet", 6, theMainScheme)) });
    // Electromagnetic Blast is the quiet reveal here; Magnetic Bubble (no counters of its own) is what the response finds.
    const start = withoutDealtCards(magnetoGame());
    const { state, events } = driveEventsPicking(
      six,
      stackEncounterDeck(start, BOOST, "32153", "01188", "32149"),
      firstLegal,
      { type: "endTurn", playerId: P1 },
    );
    expect(counters(events)).toEqual([6]);
    expect(of(events, "counterRemoved").filter((e) => e.counterType === "magnet")).toEqual([
      expect.objectContaining({ amount: 3 }),
    ]);
    expect(magnetCounters(state)).toBe(3);
    expect(abilitiesResolved(events).filter((id) => id === "32141b.asteroid-m-forced-response")).toHaveLength(1);
    expect(revealed(events)).toContain("32149");
  });
});

/** P1's hero (Spider-Man, THW 1) removes the last threat from `scheme`, which defeats it. */
const thwartAway = (state: GameState, scheme: InstanceId): GameState => {
  const ready = patchInstance(patchInstance(state, scheme, { threat: 1 }), identityOf(state), { exhausted: false });
  return finish(
    run(ready, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(ready),
      schemeInstanceId: scheme,
    }),
  );
};
/** P1's hero attacks Magneto (tough status card removed first, so the damage is what the test reads). */
const attackMagneto = (state: GameState) => {
  const target = villain(state);
  const bared = patchInstance(bare(state, target), identityOf(state), { exhausted: false });
  return driveEventsPicking(WAVE6_DEPS, bared, firstLegal, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: identityOf(bared),
    targetInstanceId: target,
  });
};
const damageOf = (state: GameState, id: InstanceId) => inst(state, id).damage;
const atVillainStage = (state: GameState, stageIndex: number): GameState => ({
  ...state,
  villains: state.villains.map((v) => (v.instanceId === villain(state) ? { ...v, stageIndex } : v)),
});
const victoryDisplayCodes = (state: GameState) => state.victoryDisplay.map((id) => codeOf(state, id));
const attachedCodes = (state: GameState, id: InstanceId) => inst(state, id).attachments.map((a) => codeOf(state, a));

describe("the double-sided side schemes (32144, 32145)", () => {
  const start = () => withoutDealtCards(hero(magnetoGame()));

  it("32144a.boarding-party-constant: Magneto cannot have more than 6 sustained damage (1 hero)", () => {
    const base = start();
    const { state, events } = attackMagneto(patchInstance(base, villain(base), { damage: 5 }));
    expect(damageOf(state, villain(state))).toBe(6);
    const [cap] = of(events, "damageCapped");
    expect(cap).toBeDefined();
    const [hit] = of(events, "damageDealt");
    expect(hit!.amount).toBe(1);
  });

  it("the cap scales with the number of heroes: 12 sustained for two", () => {
    const base = withoutDealtCards(hero(magnetoGame({ players: TWO })));
    const { state } = attackMagneto(patchInstance(base, villain(base), { damage: 11 }));
    expect(damageOf(state, villain(state))).toBe(12);
  });

  it("Q9: capped damage is neither taken nor prevented and gives no excess, so Magneto is not defeated by it", () => {
    const base = start();
    // 17 of Magneto I's 18 hit points are gone: an uncapped hit would defeat him with excess damage.
    const { state, events } = attackMagneto(patchInstance(base, villain(base), { damage: 17 }));
    expect(damageOf(state, villain(state))).toBe(17);
    expect(of(events, "damageCapped")).toHaveLength(1);
    expect(of(events, "damageDealt")).toHaveLength(0);
    expect(of(events, "damagePrevented")).toEqual([]);
    expect(of(events, "excessDamageAsThreat")).toEqual([]);
    expect(activeVillain(state).stageIndex).toBe(0);
    expect(state.outcome).toBeNull();
  });

  it("32144a.when-defeated: Boarding Party flips and Sabotage Master Mold is revealed (threat 3 again, cap 12)", () => {
    const base = start();
    const [party] = inPlay(base, "32144a");
    const after = thwartAway(base, party!);
    expect(inPlay(after, "32144a")).toEqual([]);
    expect(inPlay(after, "32144b")).toEqual([party]);
    expect(inst(after, party!).threat).toBe(3);
    // The cap is now 12: from 11 sustained, 1 more is taken.
    const { state } = attackMagneto(patchInstance(after, villain(after), { damage: 11 }));
    expect(damageOf(state, villain(state))).toBe(12);
    const { events } = attackMagneto(patchInstance(after, villain(after), { damage: 12 }));
    expect(of(events, "damageCapped")).toHaveLength(1);
    expect(of(events, "damageDealt")).toHaveLength(0);
  });

  it("32144b.sabotage-master-mold-constant and .when-defeated: it goes to the victory display and Orbital Decay is revealed from the set-aside area", () => {
    const base = start();
    const flipped = thwartAway(base, inPlay(base, "32144a")[0]!);
    const sabotage = inPlay(flipped, "32144b")[0]!;
    expect(victoryDisplayCodes(flipped)).toEqual([]);
    const after = thwartAway(flipped, sabotage);
    expect(inPlay(after, "32144b")).toEqual([]);
    expect(victoryDisplayCodes(after)).toEqual(["32144b"]);
    expect(inPlay(after, "32145a")).toHaveLength(1);
    expect(after.encounterSetAside).toEqual([]);
    expect(inst(after, inPlay(after, "32145a")[0]!).threat).toBe(3);
  });

  it("32145a.orbital-decay-constant: the cap is 18 sustained (read on Magneto II, 20 hit points)", () => {
    const base = start();
    const flipped = thwartAway(base, inPlay(base, "32144a")[0]!);
    const decayed = thwartAway(flipped, inPlay(flipped, "32144b")[0]!);
    const second = atVillainStage(decayed, 1);
    const { state, events } = attackMagneto(patchInstance(second, villain(second), { damage: 17 }));
    expect(damageOf(state, villain(state))).toBe(18);
    expect(of(events, "damageDealt")).toHaveLength(1);
    const { events: more } = attackMagneto(patchInstance(second, villain(second), { damage: 18 }));
    expect(of(more, "damageCapped")).toHaveLength(1);
  });

  it("32145a.when-defeated and 32145b.physical-strain-constant: Orbital Decay flips into Physical Strain on Magneto, who loses steady", () => {
    const base = start();
    const flipped = thwartAway(base, inPlay(base, "32144a")[0]!);
    const decayed = thwartAway(flipped, inPlay(flipped, "32144b")[0]!);
    expect(hasKeyword(decayed, villain(decayed), "steady", WAVE6_DEPS)).toBe(true);
    const strained = thwartAway(decayed, inPlay(decayed, "32145a")[0]!);
    expect(inPlay(strained, "32145a")).toEqual([]);
    expect(attachedCodes(strained, villain(strained))).toEqual(["32145b"]);
    expect(hasKeyword(strained, villain(strained), "steady", WAVE6_DEPS)).toBe(false);
    // Toughness, which Physical Strain does not touch, is still there.
    expect(hasKeyword(strained, villain(strained), "toughness", WAVE6_DEPS)).toBe(true);
    // No cap is left in play: the next hit is all taken.
    expect(inPlay(strained, "32144a").concat(inPlay(strained, "32144b"), inPlay(strained, "32145a"))).toEqual([]);
  });
});

describe("the main scheme stages (32142a, 32143a)", () => {
  /** One villain phase from a stage one threat short of its target (the villain phase's step 1 completes it). */
  const completeStage = (state: GameState, top: readonly string[], pick: Picker = firstLegal) => {
    const target = (state.mainScheme.stageIndex === 0 ? 5 : 6) * state.players.length;
    return driveEventsPicking(
      WAVE6_DEPS,
      stackEncounterDeck(
        patchInstance(withoutDealtCards(state), mainScheme(state), { threat: target - state.players.length }),
        ...top,
      ),
      pick,
      { type: "endTurn", playerId: P1 },
    );
  };
  /** The events from the stage advancing to the first enemy activating: the new stage's own When Revealed. */
  const stageReveal = (events: readonly GameEvent[]) => {
    const from = events.findIndex((e) => e.type === "mainSchemeAdvanced");
    expect(from, "the stage advanced").toBeGreaterThan(-1);
    const rest = events.slice(from);
    const to = rest.findIndex((e) => e.type === "enemyActivated");
    return to < 0 ? rest : rest.slice(0, to);
  };
  const pickCode =
    (code: string): Picker =>
    (state) => {
      const options = state.pendingChoice?.options ?? [];
      const hit = options.find((o) => state.instances[o.optionId as InstanceId]?.cardId === code);
      return hit ? [hit.optionId] : firstLegal(state);
    };
  const sabotaged = (state: GameState) => {
    const flipped = thwartAway(state, inPlay(state, "32144a")[0]!);
    return thwartAway(flipped, inPlay(flipped, "32144b")[0]!);
  };

  it("32142a.when-revealed: Factory Online places 1 magnet counter and the first player reveals a copy of M-Type Sentinel", () => {
    const { state, events } = completeStage(hero(magnetoGame()), [BOOST, QUIET]);
    expect(state.mainScheme.stageIndex).toBe(1);
    const reveal = stageReveal(events);
    expect(counters(reveal)).toEqual([1]);
    expect(revealed(reveal)).toEqual(["32146"]);
    expect(of(reveal, "encounterCardRevealed")[0]!.playerId).toBe(P1);
  });

  it("32142a.when-revealed: with Sabotage Master Mold in the victory display nothing is searched for", () => {
    const base = hero(magnetoGame());
    const done = sabotaged(withoutDealtCards(base));
    expect(victoryDisplayCodes(done)).toEqual(["32144b"]);
    const { events } = completeStage(done, [BOOST, QUIET]);
    const reveal = stageReveal(events);
    expect(counters(reveal)).toEqual([1]);
    expect(revealed(reveal)).toEqual([]);
  });

  it("32143a.when-revealed: The Rule of Magnus places 2 magnet counters and the first player picks a Magnetic attachment to reveal", () => {
    const base = { ...hero(magnetoGame()), mainScheme: { ...hero(magnetoGame()).mainScheme, stageIndex: 1 } };
    const { state, events } = completeStage(base, [BOOST, QUIET], pickCode("32147"));
    expect(state.mainScheme.stageIndex).toBe(2);
    const reveal = stageReveal(events);
    expect(counters(reveal)).toEqual([2]);
    expect(revealed(reveal)).toEqual(["32147"]);
    expect(attachedCodes(state, villain(state))).toContain("32147");
  });

  it("32143a.when-revealed: with Physical Strain attached to Magneto no attachment is searched for", () => {
    const start = hero(magnetoGame());
    const strained = (() => {
      const decayed = sabotaged(withoutDealtCards(start));
      return thwartAway(decayed, inPlay(decayed, "32145a")[0]!);
    })();
    expect(attachedCodes(strained, villain(strained))).toEqual(["32145b"]);
    const { events } = completeStage({ ...strained, mainScheme: { ...strained.mainScheme, stageIndex: 1 } }, [
      BOOST,
      QUIET,
    ]);
    const reveal = stageReveal(events);
    expect(counters(reveal)).toEqual([2]);
    expect(revealed(reveal)).toEqual([]);
  });

  it("32142b / 32143b: the later stages gather magnets the same way (3 counters: remove them, reveal a Magnetic card)", () => {
    for (const stageIndex of [1, 2]) {
      const base = hero(magnetoGame());
      const start = withMagnetCounters(
        withoutDealtCards({ ...base, mainScheme: { ...base.mainScheme, stageIndex } }),
        2,
      );
      const { state, events } = phase(start, [BOOST, "01188", "32149", QUIET]);
      expect(abilitiesResolved(events)).toContain(
        stageIndex === 1 ? "32142b.factory-online-forced-response" : "32143b.the-rule-of-magnus-forced-response",
      );
      expect(magnetCounters(state)).toBe(0);
      expect(revealed(events)).toContain("32149");
    }
  });
});

describe("Magneto II and III (32139, 32140): When Revealed", () => {
  /** Defeats the villain's current stage with a basic attack (tough status card removed, the hero ready). */
  const defeatStage = (state: GameState): GameState => {
    const ready = patchInstance(bare(state, villain(state)), identityOf(state), { exhausted: false });
    return defeatWithAttack(WAVE6_DEPS, ready, villain(state));
  };

  it("standard (I, II): each player is dealt a facedown encounter card as Magneto II enters play", () => {
    const start = withoutSideSchemes(withoutDealtCards(hero(magnetoGame({ players: TWO }))));
    const after = defeatStage(start);
    expect(activeVillain(after).stageIndex).toBe(1);
    for (const player of [P1, P2]) expect(playerOf(after, player).dealtEncounter).toHaveLength(1);
  });

  it("expert (II, III): the same as Magneto III enters play when Magneto II falls", () => {
    const start = withoutSideSchemes(withoutDealtCards(hero(magnetoGame({ difficulty: "expert" }))));
    expect(activeVillain(start).stageIndex).toBe(1);
    const after = defeatStage(start);
    expect(activeVillain(after).stageIndex).toBe(2);
    expect(playerOf(after, P1).dealtEncounter).toHaveLength(1);
  });
});

describe("Magneto's attachments (32147, 32148, 32149)", () => {
  const armed = (code: string) => {
    const base = hero(magnetoGame());
    return attachToHost(base, code, villain(base));
  };
  /** Gives Magneto a confused and a stunned status card the way an encounter card would. */
  const statusGiver = withAbilities({
    "32153.when-revealed": whenRevealed(confuse(theVillain), stun(theVillain)),
  });
  const statusesAfterBlast = (state: GameState) => {
    const { state: after } = driveEventsPicking(
      statusGiver,
      stackEncounterDeck(withoutDealtCards(state), BOOST, "32153"),
      firstLegal,
      {
        type: "endTurn",
        playerId: P1,
      },
    );
    return inst(after, villain(after)).statuses;
  };

  it("32147.magnetos-helmet-constant: Magneto cannot be confused (and can be stunned)", () => {
    const base = hero(magnetoGame());
    expect(statusesAfterBlast(base)).toMatchObject({ confused: 1, stunned: 1 });
    const { state } = armed("32147");
    expect(statusesAfterBlast(state)).toMatchObject({ confused: 0, stunned: 1 });
  });

  it("32148.magnetos-armor-constant: Magneto cannot be stunned (and can be confused)", () => {
    const { state } = armed("32148");
    expect(statusesAfterBlast(state)).toMatchObject({ confused: 1, stunned: 0 });
  });

  const spending =
    (ids: readonly InstanceId[], respond: boolean): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers" && choice.prompt.timing === "response")
        return respond ? [choice.options[0]!.optionId] : [];
      if (choice?.prompt.kind === "payForAbility") return ids.map((id) => `hand:${id}`);
      return firstLegal(state);
    };
  const basicAttack = (state: GameState, pick: Picker) => {
    const ready = patchInstance(bare(state, villain(state)), identityOf(state), { exhausted: false });
    return driveEventsPicking(WAVE6_DEPS, ready, pick, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: identityOf(ready),
      targetInstanceId: villain(ready),
    });
  };

  it.each([
    ["32147", "32147.magnetos-helmet-response"],
    ["32148", "32148.magnetos-armor-response"],
  ])(
    "%s: after your hero's basic attack against Magneto, spend [energy][mental][physical] to discard it",
    (code, ability) => {
      const { state: armedState, id } = armed(code);
      const { state: stocked, ids } = handForMixedCost(armedState, P1, ["energy", "mental", "physical"]);
      const declined = basicAttack(stocked, spending(ids, false));
      expect(attachedCodes(declined.state, villain(declined.state))).toContain(code);
      const paid = basicAttack(stocked, spending(ids, true));
      expect(abilitiesResolved(paid.events)).toContain(ability);
      expect(inst(paid.state, villain(paid.state)).attachments).not.toContain(id);
      for (const spent of ids) expect(playerOf(paid.state, P1).discard).toContain(spent);
    },
  );

  it("32149.magnetic-bubble-constant: Magneto gains retaliate 1", () => {
    const base = hero(magnetoGame());
    expect(keywordTotal(base, villain(base), "retaliate", WAVE6_DEPS)).toBe(0);
    const { state } = armed("32149");
    expect(keywordTotal(state, villain(state), "retaliate", WAVE6_DEPS)).toBe(1);
  });

  it("32149.magnetic-bubble-forced-interrupt: damage Magneto would take is placed on the Bubble, which is discarded at 8", () => {
    const { state: bubbled, id: bubble } = armed("32149");
    const noCaps = withoutSideSchemes(bubbled);
    const hit = basicAttack(noCaps, firstLegal);
    expect(damageOf(hit.state, villain(hit.state))).toBe(0);
    const placed = damageOf(hit.state, bubble);
    expect(placed).toBeGreaterThan(0);
    expect(inst(hit.state, villain(hit.state)).attachments).toContain(bubble);
    // 7 damage already there: this hit brings it to 8 or more and the Bubble goes, with none of it reaching Magneto.
    const full = basicAttack(patchInstance(noCaps, bubble, { damage: 7 }), firstLegal);
    expect(damageOf(full.state, villain(full.state))).toBe(0);
    expect(inst(full.state, villain(full.state)).attachments).not.toContain(bubble);
  });
});

describe("M-Type Sentinel (32146)", () => {
  it("is a Guard minion (data)", () => {
    const { state, id } = engageMinion(hero(magnetoGame()), "32146", P1);
    expect(hasKeyword(state, id, "guard", WAVE6_DEPS)).toBe(true);
  });

  it("32146.when-defeated: Magneto is given a tough status card", () => {
    const base = withoutDealtCards(hero(magnetoGame()));
    const { state: engaged, id } = engageMinion(bare(base, villain(base)), "32146", P1);
    expect(inst(engaged, villain(engaged)).statuses.tough).toBe(0);
    const ready = patchInstance(engaged, identityOf(engaged), { exhausted: false });
    const after = defeatWithAttack(WAVE6_DEPS, ready, id);
    expect(cardsInPlay(after)).not.toContain(id);
    expect(inst(after, villain(after)).statuses.tough).toBe(1);
  });
});

describe("Wrapped in Metal (32150)", () => {
  const wrapped = (form: "hero" | "alterEgo") => {
    const base = withoutDealtCards(form === "hero" ? hero(magnetoGame()) : magnetoGame());
    return attachToHost(base, "32150", identityOf(base));
  };
  const accepts = (state: GameState, command: Parameters<typeof applyCommand>[1]) =>
    applyCommand(state, command, WAVE6_DEPS).ok;

  it("32150.wrapped-in-metal-constant-2: the attached identity cannot recover", () => {
    const hurt = (state: GameState) => patchInstance(state, identityOf(state), { damage: 3 });
    const free = hurt(withoutDealtCards(magnetoGame()));
    expect(accepts(free, { type: "basicRecover", playerId: P1 })).toBe(true);
    expect(accepts(hurt(wrapped("alterEgo").state), { type: "basicRecover", playerId: P1 })).toBe(false);
  });

  it("32150.wrapped-in-metal-constant-2: the attached identity cannot attack or thwart", () => {
    const free = withoutDealtCards(hero(magnetoGame()));
    const party = inPlay(free, "32144a")[0]!;
    const attack = (state: GameState) =>
      ({
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identityOf(state),
        targetInstanceId: villain(state),
      }) as const;
    const thwart = (state: GameState) =>
      ({
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: identityOf(state),
        schemeInstanceId: party,
      }) as const;
    expect(accepts(free, attack(free))).toBe(true);
    expect(accepts(free, thwart(free))).toBe(true);
    const { state } = wrapped("hero");
    expect(accepts(state, attack(state))).toBe(false);
    expect(accepts(state, thwart(state))).toBe(false);
  });

  it("32150.wrapped-in-metal-constant-2: the attached identity cannot defend", () => {
    const offered = (state: GameState) => {
      const options: string[] = [];
      driveStepwise(
        WAVE6_DEPS,
        run(stackEncounterDeck(state, BOOST, QUIET), { type: "endTurn", playerId: P1 }),
        (s) => {
          const choice = s.pendingChoice!;
          if (choice.prompt.kind === "declareDefender") options.push(...choice.options.map((o) => o.optionId));
          return firstLegal(s);
        },
      );
      return options;
    };
    const free = withoutDealtCards(hero(magnetoGame()));
    expect(offered(free)).toContain(identityOf(free));
    const { state } = wrapped("hero");
    expect(offered(state)).not.toContain(identityOf(state));
  });

  it("32150.wrapped-in-metal-action: exhaust your identity and spend a [physical] resource to discard it", () => {
    const { state: base, id } = wrapped("hero");
    const { state: stocked, ids } = handForMixedCost(base, P1, ["physical"]);
    const after = finish(
      run(
        stocked,
        use(
          P1,
          id,
          "32150.wrapped-in-metal-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    );
    expect(inst(after, identityOf(after)).attachments).not.toContain(id);
    expect(inst(after, identityOf(after)).exhausted).toBe(true);
    for (const spent of ids) expect(playerOf(after, P1).discard).toContain(spent);
  });

  it("an exhausted identity cannot pay for the discard", () => {
    const { state: base, id } = wrapped("hero");
    const { state: stocked, ids } = handForMixedCost(patchInstance(base, identityOf(base), { exhausted: true }), P1, [
      "physical",
    ]);
    expect(
      accepts(
        stocked,
        use(
          P1,
          id,
          "32150.wrapped-in-metal-action",
          ids.map((fromHand) => ({ fromHand })),
        ),
      ),
    ).toBe(false);
  });
});

describe("Master of Magnetism (32151)", () => {
  const given = (events: readonly GameEvent[], state: GameState) =>
    of(events, "boostCardDealt")
      .filter((e) => e.outsideActivation === true)
      .map((e) => codeOf(state, e.instanceId));

  it("takes the topmost Magnetic card of the encounter discard pile as a facedown boost card, then Magneto activates against you", () => {
    const start = withDiscardOnTop(withoutDealtCards(hero(magnetoGame())), "01188", "32152", "32154");
    const { state, events } = phase(start, [BOOST, "32151", "01186"]);
    // Caught Off Guard is not Magnetic: Electric Shock, the topmost Magnetic card, is the one given (not Metal Shards).
    expect(given(events, state)).toEqual(["32152"]);
    expect(of(events, "attackResolved")).toHaveLength(2);
    expect(of(events, "boostCardFlipped").map((e) => codeOf(state, e.instanceId))).toContain("32152");
    const discard = state.encounterDecks[Object.keys(state.encounterDecks)[0]!]!.discard.map((id) => codeOf(state, id));
    expect(discard).toContain("32154");
  });

  it("gives nothing when no Magnetic card is in the discard pile, and Magneto still activates", () => {
    const start = withoutDealtCards(hero(magnetoGame()));
    const { state, events } = phase(start, [BOOST, "32151", "01186"]);
    expect(given(events, state)).toEqual([]);
    expect(of(events, "attackResolved")).toHaveLength(2);
  });

  it("in alter-ego form Magneto schemes against you", () => {
    const start = withDiscardOnTop(withoutDealtCards(magnetoGame()), "32154");
    const { events } = phase(start, [BOOST, "32151", "01186"]);
    expect(of(events, "schemeResolved")).toHaveLength(2);
    expect(of(events, "attackResolved")).toHaveLength(0);
  });
});

describe("Electric Shock (32152)", () => {
  /**
   * One villain phase with `card` as the reveal, from a main scheme at stage 2 with no threat (so the placements below
   * complete nothing) and `magnets` magnet counters (fewer than 3 even after Magneto's own, which would reveal a card).
   */
  const shockPhase = (state: GameState, card: string, magnets: number) => {
    const staged = patchInstance(withMagnetCounters(withoutDealtCards(state), magnets), mainScheme(state), {
      threat: 0,
    });
    const { state: after } = phase({ ...staged, mainScheme: { ...staged.mainScheme, stageIndex: 1 } }, [BOOST, card]);
    return { after, threat: inst(after, mainScheme(after)).threat, me: inst(after, identityOf(after)) };
  };

  it("32152.when-revealed-alter-ego: you are confused and 1 threat goes on the main scheme per magnet counter", () => {
    const start = magnetoGame();
    const shock = shockPhase(start, "32152", 2);
    const control = shockPhase(start, QUIET, 2);
    expect(shock.me.statuses.confused).toBe(1);
    expect(control.me.statuses.confused).toBe(0);
    expect(shock.threat - control.threat).toBe(2);
  });

  it("32152.when-revealed-hero: you are stunned and take 1 damage per magnet counter on the main scheme", () => {
    const start = hero(magnetoGame());
    // Magneto's attack places one more counter before the reveal: 2 on the scheme when Electric Shock resolves.
    const shock = shockPhase(start, "32152", 1);
    const control = shockPhase(start, QUIET, 1);
    expect(shock.me.statuses.stunned).toBe(1);
    expect(control.me.statuses.stunned).toBe(0);
    expect(shock.me.damage - control.me.damage).toBe(2);
  });
});

describe("Electromagnetic Blast (32153)", () => {
  it("32153.when-revealed: exhausts each upgrade and support you control (not another player's) and places 1 magnet counter", () => {
    const base = withoutDealtCards(hero(magnetoGame({ players: TWO })));
    const { state: a, id: tracer } = intoPlayArea(base, P1, "01007");
    const { state: b, id: room } = intoPlayArea(a, P1, "01063");
    const { state: c, id: theirs } = intoPlayArea(b, P2, "01073");
    // Magneto activates once per player (a boost card each): the reveals are then P1's Blast and P2's quiet card.
    const { events } = driveEventsPicking(
      WAVE6_DEPS,
      stackEncounterDeck(c, BOOST, BOOST, "32153", QUIET),
      firstLegal,
      { type: "endTurn", playerId: P1 },
      { type: "endTurn", playerId: P2 },
    );
    const exhausted = of(events, "cardExhausted").map((e) => e.instanceId);
    expect(exhausted).toContain(tracer);
    expect(exhausted).toContain(room);
    expect(exhausted).not.toContain(theirs);
    // Magneto's attack placed one counter, the Blast the other.
    expect(counters(events)).toEqual([1, 1]);
    expect(abilitiesResolved(events)).toContain("32153.when-revealed");
  });

  it("32153.boost: as a boost card it exhausts your identity", () => {
    const start = withoutDealtCards(hero(magnetoGame()));
    const { events } = phase(start, ["32153", QUIET]);
    expect(abilitiesResolved(events)).toContain("32153.boost");
    expect(of(events, "cardExhausted").map((e) => e.instanceId)).toContain(identityOf(start));
    const control = phase(start, [BOOST, QUIET]);
    expect(of(control.events, "cardExhausted").map((e) => e.instanceId)).not.toContain(identityOf(start));
  });
});

describe("Metal Shards (32154)", () => {
  it("32154.when-revealed: 1 damage to each character you control and 1 magnet counter on the main scheme", () => {
    const base = withoutDealtCards(hero(magnetoGame()));
    const { state: staged, id: ally } = intoPlayArea(base, P1, "01058");
    const { state, events } = phase(staged, [BOOST, "32154"]);
    // Magneto's own attack (2 damage to the hero, 1 counter) comes first; the ally was undefended and takes only this.
    expect(inst(state, ally).damage).toBe(1);
    expect(
      of(events, "damageDealt")
        .filter((e) => e.targetInstanceId === identityOf(state))
        .map((e) => e.amount),
    ).toEqual([2, 1]);
    expect(counters(events)).toEqual([1, 1]);
  });

  describe("32154.boost: if this is an attack that defeats an ally, place 1 magnet counter on the main scheme", () => {
    const defendWith =
      (defender: InstanceId): Picker =>
      (state) =>
        state.pendingChoice?.prompt.kind === "declareDefender" &&
        state.pendingChoice.options.some((o) => o.optionId === defender)
          ? [defender]
          : firstLegal(state);
    const attackDefendedBy = (code: string) => {
      const base = withoutDealtCards(hero(magnetoGame()));
      const { state: staged, id: ally } = intoPlayArea(base, P1, code);
      const { state, events } = phase(staged, ["32154", QUIET], defendWith(ally));
      return { state, events, ally };
    };

    it("places it when the defending ally is defeated (Black Cat, 2 hit points, against 2 ATK)", () => {
      const { state, events, ally } = attackDefendedBy("01002");
      expect(cardsInPlay(state)).not.toContain(ally);
      // The boost's counter, then Magneto's own Forced Response.
      expect(counters(events)).toEqual([1, 1]);
    });

    it("places none when the ally survives (Daredevil, 3 hit points)", () => {
      const { state, events, ally } = attackDefendedBy("01058");
      expect(cardsInPlay(state)).toContain(ally);
      expect(counters(events)).toEqual([1]);
    });
  });
});

describe("Magnetic Missile (32155)", () => {
  /** Alter-ego form: the activations scheme, so the only damage the hero takes is the Missile's. */
  const missile = (withSentinel: boolean, pick: Picker = firstLegal) => {
    // The main scheme sits at its last stage with no threat, so the schemes' threat completes nothing (an advance would
    // search and shuffle the encounter deck under the stacked cards).
    const quiet = withoutDealtCards(magnetoGame());
    const base = patchInstance({ ...quiet, mainScheme: { ...quiet.mainScheme, stageIndex: 2 } }, mainScheme(quiet), {
      threat: 0,
    });
    const { state: engaged, id } = withSentinel ? engageMinion(base, "32146", P1) : { state: base, id: null };
    const { state, events } = phase(engaged, [BOOST, "32155", QUIET], pick);
    return { state, events, sentinel: id, damage: inst(state, identityOf(state)).damage };
  };
  const discarding =
    (n: number): Picker =>
    (state) => {
      const choice = state.pendingChoice;
      return choice?.prompt.kind === "chooseCards"
        ? choice.options.slice(0, n).map((o) => o.optionId)
        : firstLegal(state);
    };

  it("32155.when-revealed: defeats a Sentinel minion in play, then you take 5 damage (Surge is data)", () => {
    const { state, sentinel, damage, events } = missile(true);
    expect(cardsInPlay(state)).not.toContain(sentinel);
    expect(damage).toBe(5);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toContain(QUIET);
  });

  it("you may discard X cards from your hand to prevent X of the damage", () => {
    const base = missile(true);
    const base2 = missile(true, discarding(2));
    expect(base2.damage).toBe(3);
    expect(playerOf(base2.state, P1).discard.length - playerOf(base.state, P1).discard.length).toBe(2);
    const all = missile(true, discarding(5));
    expect(all.damage).toBe(0);
  });

  it("with no Sentinel minion in play nothing is defeated and, being after a 'then', no damage is taken", () => {
    const { damage, events } = missile(false);
    expect(damage).toBe(0);
    expect(abilitiesResolved(events)).toContain("32155.when-revealed");
  });
});

describe("Magnetic Mayhem (32156)", () => {
  const defeated = (stack: readonly string[]) => {
    const base = withoutDealtCards(hero(magnetoGame()));
    const { state: staged, id } = encounterCardInVillainArea(base, "32156", 4);
    const ready = patchInstance(stackEncounterDeck(staged, ...stack), identityOf(staged), { exhausted: false });
    const scheme = patchInstance(ready, id, { threat: 1 });
    return driveEventsPicking(WAVE6_DEPS, scheme, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: identityOf(scheme),
      schemeInstanceId: id,
    });
  };

  it("32156.when-defeated: discards the top 4 encounter cards and places 1 magnet counter (one placement) per Magnetic card among them", () => {
    const { state, events } = defeated(["32152", "01188", "32154", "01187"]);
    expect(
      of(events, "cardMoved")
        .filter((e) => e.to.kind === "encounterDiscard")
        .map((e) => e.cardId),
    ).toEqual(["32152", "01188", "32154", "01187", "32156"]);
    expect(counters(events)).toEqual([2]);
    expect(magnetCounters(state)).toBe(2);
  });

  it("with no Magnetic card among the 4 no counter is placed", () => {
    const { state, events } = defeated(["01188", "01187", "01189", "01190"]);
    expect(counters(events)).toEqual([]);
    expect(magnetCounters(state)).toBe(0);
  });
});

describe("Magnetically Sealed (32157)", () => {
  it("32157.when-revealed: crisis (data), 2 base threat and 2 more for each ally in play", () => {
    const base = withoutDealtCards(hero(magnetoGame({ players: TWO })));
    const threatWith = (allies: readonly [typeof P1, string][]) => {
      const staged = allies.reduce((s, [player, code]) => intoPlayArea(s, player, code).state, base);
      const { state } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(staged, BOOST, BOOST, "32157", QUIET),
        firstLegal,
        { type: "endTurn", playerId: P1 },
        { type: "endTurn", playerId: P2 },
      );
      return inst(state, inPlay(state, "32157")[0]!).threat;
    };
    const none = threatWith([]);
    expect(none).toBe(2);
    // An ally of each player counts: "each ally in play".
    expect(threatWith([[P1, "01058"]])).toBe(none + 2);
    expect(
      threatWith([
        [P1, "01058"],
        [P2, "01084"],
      ]),
    ).toBe(none + 4);
  });

  it("32157.boost: exhausts each ally you control", () => {
    const base = withoutDealtCards(hero(magnetoGame()));
    const { state: staged, id: ally } = intoPlayArea(base, P1, "01058");
    const { events } = phase(staged, ["32157", QUIET]);
    expect(abilitiesResolved(events)).toContain("32157.boost");
    expect(of(events, "cardExhausted").map((e) => e.instanceId)).toContain(ally);
  });
});

describe("Seized! (32158)", () => {
  const revealed6 = () => {
    const base = withoutDealtCards(hero(magnetoGame()));
    const top6 = playerOf(base, P1).deck.slice(0, 6);
    const { state } = phase(base, [BOOST, "32158", QUIET]);
    return { state, top6, seized: inPlay(state, "32158")[0]! };
  };

  it("32158.when-revealed: each player places the top 6 cards of their deck facedown under it", () => {
    const { state, top6, seized } = revealed6();
    expect(inst(state, seized).tucked).toEqual(top6);
    for (const id of top6) expect(inst(state, id).faceup).toBe(false);
  });

  it("32158.when-defeated: Magneto activates against the player who defeated it, and the cards under it are discarded", () => {
    const { state: before, top6, seized } = revealed6();
    const { state, events } = driveEventsPicking(
      WAVE6_DEPS,
      patchInstance(patchInstance(before, seized, { threat: 1 }), identityOf(before), { exhausted: false }),
      firstLegal,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(before), schemeInstanceId: seized },
    );
    expect(of(events, "attackResolved")).toHaveLength(1);
    for (const id of top6) expect(playerOf(state, P1).discard).toContain(id);
    expect(inPlay(state, "32158")).toEqual([]);
  });
});
