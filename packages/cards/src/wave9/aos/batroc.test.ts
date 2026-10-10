import { AOS_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  cannotLeavePlay,
  cardAbilitiesCannotRemove,
  createGame,
  hasKeyword,
  mainSchemeValue,
  maxHitPoints,
  remainingHitPoints,
  statBonus,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  payWith,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
  withForm,
} from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import {
  BLACK_CAT,
  BLANK,
  ONE_ICON,
  IRON_MAN,
  SPIDER_MAN,
  codeOf,
  dataOf,
  heroAttacks,
  heroThwarts,
  inPlayCard,
  picking,
  piles,
  revealedCodes,
  stunWith,
  types,
} from "../testing.js";
import { wave9Scenario } from "../setup.js";
import { BATROC, BATROC_SKIPPED } from "./batroc.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Batroc (docs/phase7-wave9.md sections 2.3, 3.1, 3.5, 3.13 to 3.16, 3.25, 3.33): the villain 50086a/b, the three main
 * scheme stages 50087a/b to 50089a/b and Alert Level 50090a/b, then the second half: Rescued Captive 50091, Heightened
 * Reflexes 50092, Embassy Guard / Patrol 50093 / 50094, Commandeer Security Office 50095, Leaping Kick 50096 and
 * Security Cameras 50097. The real `batroc` scenario (Spider-Man and Iron Man preconstructed decks from Core), every seat
 * in hero form.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, BATROC) };
const SEATS = [SPIDER_MAN, IRON_MAN] as const;
const SECOND_HALF = ["50091", "50092", "50093", "50094", "50095", "50096", "50097"];
const REGISTERED_FIRST_HALF = [
  "50086a.batroc-forced-response",
  "50086a.batroc-forced-interrupt",
  "50086b.batroc-forced-response",
  "50086b.batroc-forced-interrupt",
  "50087a.setup",
  "50087b.infiltrate-aim-island-embassy-forced-interrupt",
  "50088b.locate-missing-person-forced-interrupt",
  "50089a.when-revealed",
  "50089b.extract-captives-constant",
  "50089b.extract-captives-forced-interrupt",
  "50089b.extract-captives-constant-2",
  "50089b.extract-captives-constant-3",
  "50090a.alert-level-constant",
  "50090a.alert-level-forced-response",
  "50090a.alert-level-action",
  "50090b.alert-level-constant",
  "50090b.alert-level-constant-2",
  "50090b.alert-level-forced-response",
  "50090b.alert-level-action",
];
const REGISTERED_SECOND_HALF = [
  "50091.rescued-captive-constant",
  "50091.rescued-captive-action",
  "50092.heightened-reflexes-forced-interrupt",
  "50092.boost",
  "50093.embassy-guard-constant",
  "50093.when-defeated",
  "50094.embassy-patrol-constant",
  "50094.when-defeated",
  "50095.when-revealed",
  "50095.when-defeated",
  "50096.when-revealed-alter-ego",
  "50096.when-revealed-hero",
  "50097.when-revealed-alter-ego",
  "50097.when-revealed-hero",
];
const REGISTERED = [...REGISTERED_FIRST_HALF, ...REGISTERED_SECOND_HALF];
const GUARD = "50093";
/** Three fillers (Core treacheries): two blanks and a one-icon boost; the villain phase reveals one per player and boosts once. */
const STACK = [BLANK, BLANK, ONE_ICON];

type Mode = "standard" | "expert";
interface Table {
  readonly state: GameState;
  readonly villain: InstanceId;
  readonly main: InstanceId;
  readonly alert: InstanceId;
}

/** The scenario past setup, every seat in hero form. */
function game(players = 2, mode: Mode = "standard"): Table {
  const config = wave9Scenario("batroc", { players: SEATS.slice(0, players), seed: 1, difficulty: mode });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  for (let p = 0; p < players; p++) state = withForm(state, { heroForm: 0 }, state.players[p]!.playerId);
  return {
    state,
    villain: state.villains[0]!.instanceId,
    main: state.mainScheme.instanceId,
    alert: inPlayCard(state, "50090a")!,
  };
}
const withState = (t: Table, state: GameState): Table => ({ ...t, state });
const threat = (s: GameState, id: InstanceId) => inst(s, id).threat;
const alertOf = (s: GameState) => inPlayCard(s, "50090a")!;
/** Which side Alert Level shows: it is one card with a `flipSide`, so a flip sets `flipped` and keeps the card. */
const side = (s: GameState) => (inst(s, alertOf(s)).flipped ? "High" : "Low");
const captivesInPlay = (s: GameState) =>
  Object.keys(s.instances).filter(
    (i) => codeOf(s, i as InstanceId) === "50091" && inPlayOf(s, i as InstanceId),
  ) as InstanceId[];
const inPlayOf = (s: GameState, id: InstanceId) =>
  s.players.some((p) => p.playArea.includes(id)) || s.villainArea.includes(id);
const stage = (s: GameState) => s.mainScheme.stageIndex;
const labels = (s: GameState) => s.pendingChoice!.options.map((o) => o.label);

/** Answers the choice whose option label contains `part`; the first player's player choice is `forPlayer`. */
const choosing =
  (part: string, forPlayer: (s: GameState) => PlayerId = () => P1): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    // An ordering prompt (several players dealt a card) wants every option, in the order offered.
    if (choice.minSelections > 1) return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
    const byPlayer = choice.options.find((o) => o.ref.kind === "player" && o.ref.playerId === forPlayer(s));
    if (byPlayer) return [byPlayer.optionId];
    const hit = choice.options.find((o) => o.label.includes(part));
    return hit ? [hit.optionId] : firstLegal(s);
  };

/** The first player's identity readied, so it can thwart again. */
const ready = (s: GameState): GameState => patchInstance(s, identityOf(s, P1), { exhausted: false });

/** Removes the main scheme's threat down to `left` then thwarts it away with Spider-Man's basic thwart (THW 1). */
function thwartLast(t: Table, pick: Picker = firstLegal) {
  const staged = patchInstance(ready(t.state), t.main, { threat: 1 });
  return heroThwarts(DEPS, staged, t.main, { pick });
}

/** A Guard (a minion with 3 hit points here) put into play engaged with P1 by surgery. */
function engagedMinion(t: Table, code = GUARD): { readonly t: Table; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(t.state);
  const pile = t.state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(t.state, i) === code)!;
  const state: GameState = {
    ...t.state,
    encounterDecks: {
      ...t.state.encounterDecks,
      [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
    },
    players: t.state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: { ...t.state.instances, [id]: { ...t.state.instances[id]!, faceup: true, engagedWith: P1 } },
  };
  return { t: withState(t, state), id };
}

/** Advances through the real path from stage `from` (0 based) to stage `to`: the last threat thwarted away, each choice `pick`ed. */
function advanceTo(t: Table, to: number, pick: Picker): Table {
  let current = t;
  while (stage(current.state) < to) {
    const { state } = thwartLast(current, pick);
    current = withState(current, state);
    if (current.state.outcome) break;
  }
  return current;
}
/** Both players take turns; `pick` answers everything. */
const villainPhase = (t: Table, pick: Picker = firstLegal, ...stack: string[]) =>
  driveEventsPicking(
    DEPS,
    stack.length > 0 ? stackEncounterDeck(t.state, ...stack) : t.state,
    pick,
    ...t.state.players.map((p) => endTurn(p.playerId)),
  );

describe("registry", () => {
  it("registers every ref of the module's cards (none skipped), each a valid definition", () => {
    expect(Object.keys(BATROC).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(BATROC)) expect(validateDefinition(def), id).toEqual([]);
    const refs = SECOND_HALF.flatMap((code) => abilityRefIds(AOS_CARDS.find((c) => c.id === code)!));
    expect([...Object.keys(BATROC_SKIPPED), ...REGISTERED_SECOND_HALF].sort()).toEqual([...refs].sort());
    expect(BATROC_SKIPPED).toEqual({});
  });

  it("the data names exactly the registered and skipped refs", () => {
    const refs = ["50086a", "50087a", "50090a", ...SECOND_HALF].flatMap((code) =>
      abilityRefIds(AOS_CARDS.find((c) => c.id === code)!),
    );
    expect([...refs].sort()).toEqual([...REGISTERED, ...Object.keys(BATROC_SKIPPED)].sort());
  });
});

describe("Batroc data (50086a/b)", () => {
  const stages = () =>
    (
      dataOf("50086a").sides as { stages: { atk: number; sch: number; hp: { base: number; perPlayer: number } }[] }[]
    )[0]!.stages;
  it("(A): ATK 2, SCH 1, 8 hit points not per player; (B): ATK 2, SCH 2, 12 hit points not per player", () => {
    const [a, b] = stages();
    expect([a!.atk, a!.sch, a!.hp]).toEqual([2, 1, { base: 8, perPlayer: 0 }]);
    expect([b!.atk, b!.sch, b!.hp]).toEqual([2, 2, { base: 12, perPlayer: 0 }]);
  });

  it("standard: Batroc (A) with 8 hit points at one and two players; expert: (B) with 12", () => {
    for (const players of [1, 2]) {
      const std = game(players);
      expect(maxHitPoints(std.state, std.villain, DEPS)).toBe(8);
      expect(std.state.villains[0]!.stageIndex).toBe(0);
      const exp = game(players, "expert");
      expect(maxHitPoints(exp.state, exp.villain, DEPS)).toBe(12);
      expect(exp.state.villains[0]!.stageIndex).toBe(1);
    }
  });
});

describe("Batroc's Forced Interrupt: would be defeated", () => {
  it("(A) with 6 damage, stunned, a 999-damage blow: reset to 8, 6 threat removed from the main scheme (12 -> 6), never defeated", () => {
    const base = game();
    const t = withState(
      base,
      patchInstance(base.state, base.villain, { damage: 6, statuses: { stunned: 1, confused: 0, tough: 0 } }),
    );
    const state = defeatWithAttack(DEPS, t.state, t.villain);
    expect(inst(state, t.villain).damage).toBe(0);
    expect(remainingHitPoints(state, t.villain, DEPS)).toBe(8);
    expect(inst(state, t.villain).statuses.stunned).toBe(1);
    expect(threat(state, t.main)).toBe(6);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.villains[0]!.stageIndex).toBe(0);
    expect(state.outcome).toBeNull();
  });

  it("(B) expert resets to 12 and removes 6 threat the same way (12 -> 6)", () => {
    const t = game(2, "expert");
    expect(threat(t.state, t.main)).toBe(12);
    const state = defeatWithAttack(DEPS, t.state, t.villain);
    expect(remainingHitPoints(state, t.villain, DEPS)).toBe(12);
    expect(threat(state, t.main)).toBe(6);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.outcome).toBeNull();
  });

  it("nothing defeat-related happens: no character is defeated, no threat goes onto Alert Level, one reset is logged", () => {
    const t = game();
    const staged = patchInstance(t.state, t.villain, { damage: 7 });
    const { state, events } = heroAttacks(DEPS, staged, t.villain);
    expect(types(events, "characterDefeated")).toEqual([]);
    expect(types(events, "villainFlipped")).toEqual([]);
    expect(types(events, "mainSchemeAdvanced")).toEqual([]);
    expect(inst(state, t.villain).damage).toBe(0);
    expect(threat(state, t.alert)).toBe(0);
    expect(threat(state, t.main)).toBe(6);
  });

  it("with less than 6 threat on the scheme (4) all 4 are removed, and removing the last advances stage 1B to 2A", () => {
    const base = game();
    const t = withState(base, patchInstance(base.state, base.main, { threat: 4 }));
    const state = defeatWithAttack(DEPS, t.state, t.villain);
    expect(stage(state)).toBe(1);
    expect(threat(state, t.main)).toBe(6);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.outcome).toBeNull();
  });
});

describe("Batroc's Forced Response: after Batroc attacks", () => {
  it("places 1 threat on Alert Level for each attack (two heroes, two attacks, no defeats)", () => {
    const t = game();
    const { state, events } = villainPhase(t, firstLegal, ...STACK);
    const attacks = types(events, "attackResolved").filter((a) => a.enemyInstanceId === t.villain);
    // The villain activates once for each of the two engaged heroes, and each of his attacks places 1 threat.
    expect(attacks).toHaveLength(2);
    expect(threat(state, t.alert)).toBe(2);
  });
});

describe("Infiltrate A.I.M. Island Embassy (50087a/b), stage 1", () => {
  it("data: 6 per player start, 12 per player target, +1 per player acceleration, completion loses", () => {
    const stage1 = (dataOf("50087a") as { stages: Record<string, unknown>[] }).stages[0]!;
    expect(stage1.startingThreat).toEqual({ base: 0, perPlayer: 6 });
    expect(stage1.targetThreat).toEqual({ base: 0, perPlayer: 12 });
    expect(stage1.acceleration).toEqual({ base: 0, perPlayer: 1 });
    expect(stage1.completionLoses).toBe(true);
  });

  it("setup: Alert Level on its Low side with no threat, 4 Rescued Captives set aside and in no deck; 6 / 12 / 1 per player", () => {
    for (const [players, starting, target, acceleration] of [
      [1, 6, 12, 1],
      [2, 12, 24, 2],
    ] as const) {
      const t = game(players);
      expect(codeOf(t.state, t.alert)).toBe("50090a");
      expect(threat(t.state, t.alert)).toBe(0);
      expect(t.state.encounterSetAside.map((i) => codeOf(t.state, i))).toEqual(["50091", "50091", "50091", "50091"]);
      const pile = piles(t.state);
      expect([...pile.deck, ...pile.discard].map((i) => codeOf(t.state, i))).not.toContain("50091");
      expect([...pile.deck].map((i) => codeOf(t.state, i))).not.toContain("50090a");
      expect(threat(t.state, t.main)).toBe(starting);
      expect(mainSchemeValue(t.state, "targetThreat", DEPS)).toBe(target);
      expect(mainSchemeValue(t.state, "acceleration", DEPS)).toBe(acceleration);
    }
  });

  it("expert setup places 2 per player threat on Alert Level: 2 at one player, 4 at two", () => {
    expect(threat(game(1, "expert").state, game(1, "expert").alert)).toBe(2);
    const t = game(2, "expert");
    expect(threat(t.state, t.alert)).toBe(4);
    expect(codeOf(t.state, t.alert)).toBe("50090a");
  });

  it("removing the last threat (a thwart of 1) advances to stage 2A: 3 per player threat, target 10, acceleration 1 per player", () => {
    const t = game();
    const { state } = thwartLast(t);
    expect(stage(state)).toBe(1);
    expect(threat(state, t.main)).toBe(6);
    expect(mainSchemeValue(state, "targetThreat", DEPS)).toBe(20);
    expect(mainSchemeValue(state, "acceleration", DEPS)).toBe(2);
    expect(state.outcome).toBeNull();
    // One player: 3, 10, 1.
    const one = game(1);
    const { state: s1 } = thwartLast(one);
    expect([
      threat(s1, one.main),
      mainSchemeValue(s1, "targetThreat", DEPS),
      mainSchemeValue(s1, "acceleration", DEPS),
    ]).toEqual([3, 10, 1]);
  });

  it("removing some but not the last threat leaves the stage (12 -> 11)", () => {
    const t = game();
    const { state } = heroThwarts(DEPS, t.state, t.main);
    expect(stage(state)).toBe(0);
    expect(threat(state, t.main)).toBe(11);
  });

  it("completing the stage loses the game: 24 threat at two players is the target", () => {
    const t = game();
    const { state } = villainPhase(withState(t, patchInstance(t.state, t.main, { threat: 24 })), firstLegal, ...STACK);
    expect(state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
    expect(stage(state)).toBe(0);
  });
});

describe("Locate Missing Person (50088a/b), stage 2", () => {
  const at2 = (players = 2) => advanceTo(game(players), 1, firstLegal);

  it("2A is blank; 2B: 3 per player start, 10 per player target, +1 per player acceleration, completion loses", () => {
    const stage2 = (dataOf("50087a") as { stages: Record<string, unknown>[] }).stages[1]!;
    expect(stage2.startingThreat).toEqual({ base: 0, perPlayer: 3 });
    expect(stage2.targetThreat).toEqual({ base: 0, perPlayer: 10 });
    expect(stage2.acceleration).toEqual({ base: 0, perPlayer: 1 });
    expect(stage2.completionLoses).toBe(true);
    expect((stage2 as { aSide: { abilities: unknown[] } }).aSide.abilities).toEqual([]);
  });

  it("completing the stage loses the game (20 threat at two players)", () => {
    const t = at2();
    const staged = patchInstance(t.state, t.main, { threat: 20 });
    const { state } = villainPhase(withState(t, staged), firstLegal, ...STACK);
    expect(state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("the last threat removed: a captive enters exhausted under the chosen player (P2), the first player may stay: 6 threat", () => {
    const t = at2();
    const { state, events } = thwartLast(
      t,
      choosing("Do not advance", () => P2),
    );
    const captives = captivesInPlay(state);
    expect(captives).toHaveLength(1);
    expect(playerOf(state, P2).playArea).toContain(captives[0]);
    expect(playerOf(state, P1).playArea).not.toContain(captives[0]);
    expect(inst(state, captives[0]!).exhausted).toBe(true);
    expect(state.encounterSetAside).toHaveLength(3);
    expect(stage(state)).toBe(1);
    expect(threat(state, t.main)).toBe(6);
    expect(types(events, "mainSchemeAdvanced")).toEqual([]);
    expect(state.outcome).toBeNull();
  });

  it("the choice is offered to the first player with both options", () => {
    const t = at2();
    let seen: string[] = [];
    thwartLast(t, (s) => {
      if (s.pendingChoice!.options.some((o) => o.label.includes("Advance"))) seen = labels(s);
      return choosing("Advance")(s);
    });
    expect(seen).toEqual(["Advance to stage 3A", "Do not advance: place 3[per_hero] threat here"]);
  });

  it("staying again brings a second captive; advancing resolves 3A and shows 3B: 12 per player (24), target 36", () => {
    let t = at2();
    t = withState(
      t,
      thwartLast(
        t,
        choosing("Do not advance", () => P1),
      ).state,
    );
    expect(captivesInPlay(t.state)).toHaveLength(1);
    const { state } = thwartLast(
      t,
      choosing("Advance to", () => P1),
    );
    expect(captivesInPlay(state)).toHaveLength(2);
    expect(stage(state)).toBe(2);
    expect(threat(state, t.main)).toBe(24);
    expect(mainSchemeValue(state, "targetThreat", DEPS)).toBe(36);
    expect(mainSchemeValue(state, "acceleration", DEPS)).toBe(2);
  });

  it("the fifth time through 2B no captive enters and the choice is still offered", () => {
    let t = at2();
    // The captives go to whoever has fewer in play (the ally limit of 3 is not lifted yet, see the file header).
    const fewer = (s: GameState) =>
      captivesInPlay(s).filter((i) => playerOf(s, P1).playArea.includes(i)).length <=
      captivesInPlay(s).filter((i) => playerOf(s, P2).playArea.includes(i)).length
        ? P1
        : P2;
    const stay = choosing("Do not advance", fewer);
    for (let n = 1; n <= 4; n++) {
      t = withState(t, thwartLast(t, stay).state);
      expect(captivesInPlay(t.state)).toHaveLength(n);
    }
    expect(t.state.encounterSetAside).toHaveLength(0);
    let offered = false;
    const { state } = thwartLast(t, (s) => {
      if (s.pendingChoice!.options.some((o) => o.label.includes("Advance"))) offered = true;
      return choosing("Do not advance")(s);
    });
    expect(offered).toBe(true);
    expect(captivesInPlay(state)).toHaveLength(4);
    expect(threat(state, t.main)).toBe(6);
  });
});

describe("Extract Captives (50089a/b), stage 3", () => {
  /** Stage 3B by the real path: 1B thwarted away, 2B stayed once (a second captive on the advance), then advanced. */
  function reach3(players = 2, mode: Mode = "standard", alertThreat = 5): Table {
    let t = game(players, mode);
    t = withState(t, patchInstance(t.state, t.alert, { threat: alertThreat }));
    t = withState(t, thwartLast(t).state);
    t = withState(
      t,
      thwartLast(
        t,
        choosing("Do not advance", () => P1),
      ).state,
    );
    t = withState(
      t,
      thwartLast(
        t,
        choosing("Advance to", () => P2),
      ).state,
    );
    return t;
  }

  it("data: 3A When Revealed; 3B 12 per player start, 18 per player target, +1 per player, completion loses", () => {
    const stage3 = (dataOf("50087a") as { stages: Record<string, unknown>[] }).stages[2]!;
    expect(stage3.startingThreat).toEqual({ base: 0, perPlayer: 12 });
    expect(stage3.targetThreat).toEqual({ base: 0, perPlayer: 18 });
    expect(stage3.acceleration).toEqual({ base: 0, perPlayer: 1 });
    expect(stage3.completionLoses).toBe(true);
  });

  it("3A on Low (5 threat on Alert Level): all threat removed and Alert Level flips to High, tokens not kept (0)", () => {
    const t = reach3();
    expect(stage(t.state)).toBe(2);
    expect(side(t.state)).toBe("High");
    expect(threat(t.state, alertOf(t.state))).toBe(0);
    expect(statBonus(t.state, DEPS, t.villain, "atk")).toBe(1);
  });

  it("3A on Low in expert mode: threat removed, flipped, then 2 per player (4) placed", () => {
    const t = reach3(2, "expert", 3);
    expect(side(t.state)).toBe("High");
    expect(threat(t.state, alertOf(t.state))).toBe(4);
  });

  it("3A on High: each player is dealt 1 facedown encounter card and Alert Level keeps its threat (3; expert 3 + 4 = 7)", () => {
    for (const [mode, expected] of [
      ["standard", 3],
      ["expert", 7],
    ] as const) {
      let t = game(2, mode);
      t = withState(t, patchInstance(t.state, t.alert, { flipped: true, threat: 3 }));
      t = withState(t, thwartLast(t).state);
      t = withState(
        t,
        thwartLast(
          t,
          choosing("Do not advance", () => P1),
        ).state,
      );
      const dealt = driveEventsPicking(
        DEPS,
        patchInstance(patchInstance(ready(t.state), t.main, { threat: 1 }), t.alert, {}),
        choosing("Advance to", () => P2),
        { type: "basicThwart", playerId: P1, thwarterInstanceId: identityOf(t.state, P1), schemeInstanceId: t.main },
      );
      expect(stage(dealt.state)).toBe(2);
      expect(side(dealt.state)).toBe("High");
      expect(threat(dealt.state, alertOf(dealt.state))).toBe(expected);
      // The dealt cards are revealed in the next villain phase: one per player waits facedown.
      expect(dealt.state.players.map((p) => p.dealtEncounter.length)).toEqual([1, 1]);
    }
  });

  it("3B: Batroc's attack goes to the Rescued Captive the first player picks (the other is untouched), not to a hero", () => {
    const t = reach3(2, "standard", 0);
    const [first, second] = captivesInPlay(t.state) as [InstanceId, InstanceId];
    const identities = t.state.players.map((p) => inst(t.state, p.identity.instanceId).damage);
    const { state, events } = villainPhase(t, picking(second), ...STACK);
    const attacks = types(events, "attackResolved").filter((a) => a.enemyInstanceId === t.villain);
    expect(attacks.map((a) => a.targetInstanceId)).toEqual([second, second]);
    expect(attacks.map((a) => a.baseAtk)).toEqual([3, 3]);
    expect(inst(state, first).damage).toBe(0);
    // 3 damage twice on 5 hit points: the second blow defeats the picked captive, the other stands, the game goes on.
    expect(attacks.map((a) => a.damageDealt)).toEqual([3, 3]);
    expect(types(events, "characterDefeated").map((e) => e.instanceId)).toEqual([second]);
    expect(captivesInPlay(state)).toEqual([first]);
    expect(state.outcome).toBeNull();
    expect(state.players.map((p) => inst(state, p.identity.instanceId).damage)).toEqual(identities);
  });

  it("3B: the last Rescued Captive defeated loses the game (Batroc's 3 ATK against a captive with 1 hit point left)", () => {
    let t = reach3(2, "standard", 0);
    const [first, second] = captivesInPlay(t.state) as [InstanceId, InstanceId];
    // One captive is defeated first by surgery (removed from play), the other stands at 4 damage of 5.
    const gone = {
      ...t.state,
      players: t.state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => i !== first) })),
    };
    t = withState(t, patchInstance(gone, second, { damage: 4 }));
    const { state } = villainPhase(t, picking(second), ...STACK);
    expect(state.outcome).toMatchObject({ result: "loss" });
  });

  it("3B: removing the last threat wins the game", () => {
    const t = reach3();
    const { state } = thwartLast(t);
    expect(state.outcome).toMatchObject({ result: "win" });
  });

  it("3B: with threat left (24 -> 23) the game goes on; the target is 36 and completing the stage loses", () => {
    const t = reach3();
    const { state } = heroThwarts(DEPS, ready(t.state), t.main);
    expect(threat(state, t.main)).toBe(23);
    expect(state.outcome).toBeNull();
    const staged = patchInstance(t.state, t.main, { threat: 36 });
    const done = villainPhase(withState(t, staged), firstLegal, ...STACK);
    expect(done.state.outcome).toMatchObject({ result: "loss", reason: "mainSchemeCompleted" });
  });

  it("3B with no Rescued Captive in play: the players lose at once", () => {
    let t = game();
    t = withState(t, { ...t.state, encounterSetAside: [] });
    t = withState(t, thwartLast(t).state);
    t = withState(
      t,
      thwartLast(
        t,
        choosing("Advance to", () => P1),
      ).state,
    );
    expect(t.state.outcome).toMatchObject({ result: "loss" });
    expect(stage(t.state)).toBe(2);
  });

  it("expert: each minion gains quickstrike; standard: none does", () => {
    for (const mode of ["standard", "expert"] as const) {
      const t = reach3(2, mode, 0);
      const m = engagedMinion(t);
      expect(hasKeyword(m.t.state, m.id, "quickstrike", DEPS)).toBe(mode === "expert");
    }
  });
});

describe("Alert Level (50090a/b)", () => {
  const alertAt = (t: Table, n: number, flipped = false): Table =>
    withState(t, patchInstance(t.state, t.alert, { threat: n, flipped }));

  it("data: a Low (trait LOW) and a High (trait HIGH) side of one environment", () => {
    const card = dataOf("50090a") as { traits: string[]; flipSide: { traits: string[] } };
    expect(card.traits).toEqual(["LOW"]);
    expect(card.flipSide.traits).toEqual(["HIGH"]);
  });

  it("Low at 7 (threshold 8 at two players), a minion defeated: 8 -> all threat removed, High faceup, Batroc SCH +1 and ATK +1", () => {
    const { t, id } = engagedMinion(alertAt(game(), 7));
    expect(statBonus(t.state, DEPS, t.villain, "atk")).toBe(0);
    const state = defeatWithAttack(DEPS, t.state, id);
    expect(side(state)).toBe("High");
    // The Guard's own When Defeated (50093) takes Alert Level to 8, which flips it; Alert Level's response then adds 1.
    expect(threat(state, alertOf(state))).toBe(1);
    expect(statBonus(state, DEPS, t.villain, "sch")).toBe(1);
    expect(statBonus(state, DEPS, t.villain, "atk")).toBe(1);
    expect(state.outcome).toBeNull();
  });

  it("Low at 3 (two players): a Guard defeated gives 5 (its own When Defeated and Alert Level's response) and nothing flips; at one player the threshold is 4 and it flips", () => {
    const { t, id } = engagedMinion(alertAt(game(), 3));
    const state = defeatWithAttack(DEPS, t.state, id);
    expect(side(state)).toBe("Low");
    expect(threat(state, alertOf(state))).toBe(5);
    const m = engagedMinion(alertAt(game(1), 3));
    const s1 = defeatWithAttack(DEPS, m.t.state, m.id);
    expect(side(s1)).toBe("High");
    // The Guard's When Defeated reaches 4 and flips it (tokens cleared); Alert Level's response then adds 1.
    expect(threat(s1, alertOf(s1))).toBe(1);
  });

  it("flipping keeps the tokens a High side shows: High at 3 stays at 3 until the threshold", () => {
    const t = alertAt(game(), 3, true);
    expect(side(t.state)).toBe("High");
    expect(threat(t.state, alertOf(t.state))).toBe(3);
    expect(t.state.outcome).toBeNull();
  });

  it("High at 7, a minion defeated: 8 -> the players lose the game (card ability)", () => {
    const { t, id } = engagedMinion(alertAt(game(), 7, true));
    const state = defeatWithAttack(DEPS, t.state, id);
    expect(state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
    expect(threat(state, alertOf(state))).toBe(8);
  });

  it("an ally defeated by its own consequential damage places no threat; a Guard defeated by an attack places 2", () => {
    const base = game();
    const played = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    // Black Cat (2 hit points, 1 consequential damage on a thwart) with 1 damage thwarts and is defeated by her own 1.
    const { t, id } = engagedMinion(withState(base, patchInstance(played.state, played.id, { damage: 1 })));
    const thwarted = driveEventsPicking(DEPS, t.state, firstLegal, {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: played.id,
      schemeInstanceId: t.main,
    });
    expect(types(thwarted.events, "characterDefeated").map((e) => e.instanceId)).toContain(played.id);
    expect(threat(thwarted.state, alertOf(thwarted.state))).toBe(0);
    const killed = defeatWithAttack(DEPS, t.state, id);
    // The Guard's own When Defeated (50093) and Alert Level's response: 2.
    expect(threat(killed, alertOf(killed))).toBe(2);
  });

  it("Hero Action: spend 1 resource of any type -> remove 1 threat from here, on either side", () => {
    for (const flipped of [false, true]) {
      const t = alertAt(game(), 3, flipped);
      const action = flipped ? "50090b.alert-level-action" : "50090a.alert-level-action";
      const [paid] = payWith(t.state, P1, 1);
      const { state } = driveEventsPicking(DEPS, t.state, firstLegal, use(P1, t.alert, action, [{ fromHand: paid! }]));
      expect(threat(state, alertOf(state))).toBe(2);
      expect(playerOf(state, P1).hand).not.toContain(paid);
      expect(playerOf(state, P1).discard).toContain(paid);
    }
  });

  it("Batroc attacking places 1 threat on Alert Level (Low) and, with the High side showing, hits for 3 not 2", () => {
    const t = alertAt(game(), 0, true);
    expect(statBonus(t.state, DEPS, t.villain, "atk")).toBe(1);
    expect(statBonus(t.state, DEPS, t.villain, "sch")).toBe(1);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Second half
// ---------------------------------------------------------------------------------------------------------------------

const CAPTIVE = "50091";
const JESSICA_JONES = "01059";
const DAREDEVIL = "01058";
const REFLEXES = "50092";
const PATROL = "50094";
const COMMANDEER = "50095";
const KICK = "50096";
const CAMERAS = "50097";
const HAYMAKER = "01087";
/** Two Core "Assault" treacheries (0 boost icons, no boost ability): fillers for a boost card. */
const FILL = "01187";
/** Six more cards from the top of P1's deck in hand, to pay for a card. */
const refill = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, 6)], deck: p.deck.slice(6) } : p,
  ),
});

/** The next set-aside Rescued Captive put into play under `player` by surgery (faceup, ready, `damage` on it). */
function withCaptive(t: Table, player: PlayerId, damage = 0): { readonly t: Table; readonly id: InstanceId } {
  const id = t.state.encounterSetAside[0]!;
  const state: GameState = {
    ...t.state,
    encounterSetAside: t.state.encounterSetAside.filter((i) => i !== id),
    players: t.state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
    instances: {
      ...t.state.instances,
      [id]: { ...t.state.instances[id]!, faceup: true, exhausted: false, controllerId: player, damage },
    },
  };
  return { t: withState(t, state), id };
}

describe("Rescued Captive (50091)", () => {
  it("data: cost dash, THW 1, ATK 1, 5 hit points, Civilian, Victory -1, 1 consequential damage, no deck limit beyond the scenario", () => {
    const card = dataOf(CAPTIVE);
    expect([card.type, card.cost, card.specialCost, card.thw, card.atk, card.hp]).toEqual(["ally", 0, "dash", 1, 1, 5]);
    expect(card.keywords).toEqual([{ name: "victory", value: -1 }]);
    expect(card.consequentialDamage).toEqual({ attack: 1, thwart: 1 });
    expect(card.traits).toEqual(["CIVILIAN"]);
  });

  it("enters play under the chosen player (P2), exhausted, with 5 hit points", () => {
    const t = advanceTo(game(), 1, firstLegal);
    const { state } = thwartLast(
      t,
      choosing("Do not advance", () => P2),
    );
    const [captive] = captivesInPlay(state) as [InstanceId];
    expect(playerOf(state, P2).playArea).toContain(captive);
    expect(inst(state, captive).controllerId).toBe(P2);
    expect(remainingHitPoints(state, captive, DEPS)).toBe(5);
  });

  it("does not count against the ally limit: P1 holds three allies and takes a captive, so all four stay and nothing is discarded", () => {
    let t = advanceTo(game(), 1, firstLegal);
    for (const [code, cost] of [
      [BLACK_CAT, 2],
      [JESSICA_JONES, 3],
      [DAREDEVIL, 4],
    ] as const)
      t = withState(t, playFromHand(DEPS, refill(t.state), code, cost).state);
    const { state } = thwartLast(
      t,
      choosing("Do not advance", () => P1),
    );
    const [captive] = captivesInPlay(state) as [InstanceId];
    expect(playerOf(state, P1).playArea).toContain(captive);
    for (const code of [BLACK_CAT, JESSICA_JONES, DAREDEVIL])
      expect(playerOf(state, P1).playArea.map((i) => codeOf(state, i))).toContain(code);
    expect(
      playerOf(state, P1).discard.filter((i) => [BLACK_CAT, JESSICA_JONES, DAREDEVIL].includes(codeOf(state, i))),
    ).toEqual([]);
    expect(state.pendingChoice).toBeNull();
    // Four allies under one player: three ordinary and the captive.
    expect(
      playerOf(state, P1).playArea.filter((i) => inst(state, i).controllerId === P1 && i !== identityOf(state, P1)),
    ).toHaveLength(4);
  });

  it("card abilities cannot remove it, but a game rule can: cardAbilitiesCannotRemove and a card-sourced leave are stopped, a defeat is not", () => {
    const { t, id } = withCaptive(game(), P1);
    expect(cardAbilitiesCannotRemove(t.state, DEPS, id)).toBe(true);
    expect(cannotLeavePlay(t.state, DEPS, id, AOS_CARDS.find((c) => c.id === "50096")!.id)).toBe(true);
    // No source card: the game's own removal (damage to 0, the ally limit) is not stopped.
    expect(cannotLeavePlay(t.state, DEPS, id)).toBe(false);
  });

  it("its defeat: Victory -1 in the victory display and 1 threat on Alert Level (Batroc's 3 ATK twice on 5 hit points at stage 3B)", () => {
    const t = reach3Table();
    const [first, second] = captivesInPlay(t.state) as [InstanceId, InstanceId];
    const { state } = villainPhase(t, picking(second), ...STACK);
    expect(state.victoryDisplay).toContain(second);
    expect(state.victoryDisplay).not.toContain(first);
    // Two Batroc attacks place 1 each, the defeated captive 1 more.
    expect(threat(state, alertOf(state))).toBe(3);
    expect((dataOf(CAPTIVE).keywords as { name: string; value?: number }[])[0]).toEqual({ name: "victory", value: -1 });
  });

  it("Hero Action: exhaust it -> remove 1 per hero threat from the main scheme: 12 -> 10 at two players, 6 -> 5 at one", () => {
    for (const [players, before, after] of [
      [2, 12, 10],
      [1, 6, 5],
    ] as const) {
      const { t, id } = withCaptive(game(players), P1);
      const { state } = driveEventsPicking(DEPS, t.state, firstLegal, use(P1, id, "50091.rescued-captive-action"));
      expect(threat(t.state, t.main)).toBe(before);
      expect(threat(state, t.main)).toBe(after);
      expect(inst(state, id).exhausted).toBe(true);
    }
  });

  it("the action removes only from the main scheme: Alert Level keeps its threat, and it removes the last threat to advance stage 1B", () => {
    const base = game();
    const { t, id } = withCaptive(withState(base, patchInstance(base.state, base.alert, { threat: 3 })), P1);
    const staged = withState(t, patchInstance(t.state, t.main, { threat: 2 }));
    const { state } = driveEventsPicking(DEPS, staged.state, firstLegal, use(P1, id, "50091.rescued-captive-action"));
    expect(threat(state, t.alert)).toBe(3);
    expect(stage(state)).toBe(1);
  });

  it("an exhausted captive cannot use the action: the command is refused", () => {
    const { t, id } = withCaptive(game(), P1);
    const tired = patchInstance(t.state, id, { exhausted: true });
    expect(() => driveEventsPicking(DEPS, tired, firstLegal, use(P1, id, "50091.rescued-captive-action"))).toThrow();
  });
});

/** Stage 3B by the real path with Alert Level cleared: two captives in play, 24 threat, High side. */
function reach3Table(): Table {
  let t = game(2, "standard");
  t = withState(t, thwartLast(t).state);
  t = withState(
    t,
    thwartLast(
      t,
      choosing("Do not advance", () => P1),
    ).state,
  );
  return withState(
    t,
    thwartLast(
      t,
      choosing("Advance to", () => P2),
    ).state,
  );
}

describe("Heightened Reflexes (50092)", () => {
  /** Reflexes attached to Batroc with `leap` leap counters, by surgery. */
  function withReflexes(t: Table, leap = 4): { readonly t: Table; readonly id: InstanceId } {
    const deckId = activeEncounterDeckId(t.state);
    const pile = t.state.encounterDecks[deckId]!;
    const id = [...pile.deck, ...pile.discard].find((i) => codeOf(t.state, i) === REFLEXES)!;
    const state: GameState = {
      ...t.state,
      encounterDecks: {
        ...t.state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...t.state.instances,
        [id]: { ...t.state.instances[id]!, faceup: true, attachedTo: t.villain, counters: { leap } },
        [t.villain]: {
          ...t.state.instances[t.villain]!,
          attachments: [...t.state.instances[t.villain]!.attachments, id],
        },
      },
    };
    return { t: withState(t, state), id };
  }
  const leapOf = (s: GameState, id: InstanceId) => inst(s, id).counters.leap ?? 0;
  const haymaker = (t: Table): Table => withState(t, playFromHand(DEPS, refill(t.state), HAYMAKER, 2).state);

  it("data: attaches to the villain, Condition, Uses (4 leap counters), 0 boost icons and a star", () => {
    const card = dataOf(REFLEXES);
    expect(card.attachesTo).toEqual({ kind: "villain" });
    expect(card.keywords).toEqual([{ name: "uses", count: 4, counterType: "leap" }]);
    expect([card.boostIcons, card.starIcon, card.traits]).toEqual([0, true, ["CONDITION"]]);
  });

  it("Boost: as Batroc's boost card it is attached to him, entering play with 4 leap counters", () => {
    const t = game();
    const { state } = villainPhase(t, firstLegal, REFLEXES, BLANK, BLANK, ONE_ICON);
    const attached = inst(state, t.villain).attachments.filter((i) => codeOf(state, i) === REFLEXES);
    expect(attached).toHaveLength(1);
    expect(inst(state, attached[0]!).attachedTo).toBe(t.villain);
    expect(leapOf(state, attached[0]!)).toBe(4);
    expect(piles(state).discard.map((i) => codeOf(state, i))).not.toContain(REFLEXES);
  });

  it("a 3 damage attack on Batroc: 2 prevented, 1 dealt, one counter removed (4 -> 3)", () => {
    const { t, id } = withReflexes(game());
    const played = playFromHand(DEPS, t.state, HAYMAKER, 2);
    expect(inst(played.state, t.villain).damage).toBe(1);
    expect(leapOf(played.state, id)).toBe(3);
  });

  it("a 1 damage attack: all 1 prevented (it cannot prevent more than the damage), still one counter removed", () => {
    const { t, id } = withReflexes(game());
    const { state } = heroAttacks(DEPS, t.state, t.villain);
    expect(inst(state, t.villain).damage).toBe(0);
    expect(leapOf(state, id)).toBe(3);
  });

  it("an 8 damage blow: 6 dealt (8 - 2), one counter removed", () => {
    const { t, id } = withReflexes(game());
    const big = playFromHand(DEPS, t.state, "01005", 3);
    expect(inst(big.state, t.villain).damage).toBe(6);
    expect(leapOf(big.state, id)).toBe(3);
  });

  it("each hit takes one counter: three hits of 3 leave 1 counter and 3 damage; the fourth removes the last counter and the card is discarded", () => {
    let { t, id } = withReflexes(game());
    for (const left of [3, 2, 1]) {
      t = haymaker(t);
      expect(leapOf(t.state, id)).toBe(left);
    }
    expect(inst(t.state, t.villain).damage).toBe(3);
    t = haymaker(t);
    expect(inst(t.state, t.villain).damage).toBe(4);
    expect(inst(t.state, t.villain).attachments).not.toContain(id);
    expect(piles(t.state).discard).toContain(id);
  });

  it("with one counter left the hit is still reduced by 2 (1 dealt); once it is gone the next 3 damage is all dealt", () => {
    let { t } = withReflexes(game(), 1);
    t = haymaker(t);
    expect(inst(t.state, t.villain).damage).toBe(1);
    t = haymaker(t);
    expect(inst(t.state, t.villain).damage).toBe(4);
  });
});

/** The first player in alter-ego form. */
const alterEgo = (t: Table, player: PlayerId = P1): Table => withState(t, withForm(t.state, "alterEgo", player));
const alertSet = (t: Table, n: number, flipped = false): Table =>
  withState(t, patchInstance(t.state, t.alert, { threat: n, flipped }));
const attacksOf = (s: GameState, events: ReturnType<typeof villainPhase>["events"], villain: InstanceId) =>
  types(events, "attackResolved").filter((a) => a.enemyInstanceId === villain);

describe("Embassy Guard (50093) and Embassy Patrol (50094)", () => {
  it("data: Guard ATK 2, SCH 1, 3 hit points, A.I.M., Guard + Vulnerable, 1 boost icon; Patrol ATK 1, SCH 2, 3 hit points, Patrol + Vulnerable, 1 boost icon", () => {
    const guard = dataOf(GUARD);
    expect([guard.atk, guard.sch, guard.hp, guard.boostIcons, guard.traits]).toEqual([2, 1, 3, 1, ["A.I.M."]]);
    expect(guard.keywords).toEqual([{ name: "guard" }, { name: "vulnerable" }]);
    const patrol = dataOf(PATROL);
    expect([patrol.atk, patrol.sch, patrol.hp, patrol.boostIcons, patrol.traits]).toEqual([1, 2, 3, 1, ["A.I.M."]]);
    expect(patrol.keywords).toEqual([{ name: "patrol" }, { name: "vulnerable" }]);
    for (const code of [GUARD, PATROL]) expect(abilityRefIds(AOS_CARDS.find((c) => c.id === code)!)).toHaveLength(2);
  });

  it("Alert Level Low: Guard has no surge and Patrol no incite; High: Guard gains surge, Patrol gains incite 1", () => {
    for (const [flipped, expected] of [
      [false, false],
      [true, true],
    ] as const) {
      const guard = engagedMinion(alertSet(game(), 0, flipped), GUARD);
      expect(hasKeyword(guard.t.state, guard.id, "surge", DEPS)).toBe(expected);
      expect(hasKeyword(guard.t.state, guard.id, "guard", DEPS)).toBe(true);
      expect(hasKeyword(guard.t.state, guard.id, "vulnerable", DEPS)).toBe(true);
      const patrol = engagedMinion(alertSet(game(), 0, flipped), PATROL);
      expect(hasKeyword(patrol.t.state, patrol.id, "incite", DEPS)).toBe(expected);
      expect(hasKeyword(patrol.t.state, patrol.id, "patrol", DEPS)).toBe(true);
    }
  });

  it("revealed on High the Guard surges: the next card is revealed too; on Low only the Guard is", () => {
    const low = villainPhase(game(1), firstLegal, BLANK, GUARD, BLANK);
    expect(revealedCodes(low.state, low.events)).toEqual([GUARD]);
    const high = villainPhase(alertSet(game(1), 0, true), firstLegal, BLANK, GUARD, BLANK);
    expect(revealedCodes(high.state, high.events)).toEqual([GUARD, BLANK]);
  });

  it("revealed on High the Patrol's incite 1 puts 1 more threat on the main scheme than on Low", () => {
    const stack = [BLANK, PATROL, ONE_ICON] as const;
    const low = villainPhase(game(1), firstLegal, ...stack);
    const high = villainPhase(alertSet(game(1), 0, true), firstLegal, ...stack);
    expect(
      threat(high.state, high.state.mainScheme.instanceId) - threat(low.state, low.state.mainScheme.instanceId),
    ).toBe(1);
  });

  it("VULNERABLE: stunned by Mockingbird each is discarded, not defeated: encounter discard pile, Alert Level keeps its 3 threat, no defeat logged", () => {
    for (const code of [GUARD, PATROL]) {
      const { t, id } = engagedMinion(alertSet(game(), 3), code);
      const run = stunWith(DEPS, t.state, id);
      expect(types(run.events, "characterDefeated")).toEqual([]);
      expect(types(run.events, "vulnerableDiscarded")).toHaveLength(1);
      expect(piles(run.state).discard).toContain(id);
      expect(threat(run.state, alertOf(run.state))).toBe(3);
      expect(run.state.victoryDisplay).not.toContain(id);
    }
  });

  it("When Defeated: 1 threat on Alert Level, and Alert Level's own response places 1 more: 0 -> 2 (Low) and 3 -> 5 (High)", () => {
    for (const code of [GUARD, PATROL]) {
      for (const [from, flipped] of [
        [0, false],
        [3, true],
      ] as const) {
        const { t, id } = engagedMinion(alertSet(game(), from, flipped), code);
        const state = defeatWithAttack(DEPS, t.state, id);
        expect(threat(state, alertOf(state))).toBe(from + 2);
        expect(piles(state).discard).toContain(id);
      }
    }
  });
});

describe("Commandeer Security Office (50095)", () => {
  const sideScheme = (s: GameState) => inPlayCard(s, COMMANDEER)!;

  it("data: 3 per player starting threat, an acceleration icon, 2 boost icons, no keywords", () => {
    const card = dataOf(COMMANDEER);
    expect(card.startingThreat).toEqual({ base: 0, perPlayer: 3 });
    expect(card.icons).toEqual(["acceleration"]);
    expect(card.boostIcons).toBe(2);
    expect(card.keywords).toEqual([]);
  });

  it("revealed on Low: 3 threat at one player, no acceleration token; 6 at two players", () => {
    const one = villainPhase(game(1), firstLegal, BLANK, COMMANDEER);
    expect(threat(one.state, sideScheme(one.state))).toBe(3);
    expect(inst(one.state, sideScheme(one.state)).counters.acceleration ?? 0).toBe(0);
    const two = villainPhase(game(2), firstLegal, BLANK, BLANK, COMMANDEER, ONE_ICON);
    expect(threat(two.state, sideScheme(two.state))).toBe(6);
    expect(inst(two.state, sideScheme(two.state)).counters.acceleration ?? 0).toBe(0);
  });

  it("revealed on High: 1 acceleration token is placed on it", () => {
    const run = villainPhase(alertSet(game(1), 0, true), firstLegal, BLANK, COMMANDEER);
    expect(inst(run.state, sideScheme(run.state)).counters.acceleration).toBe(1);
  });

  it("When Defeated: remove 1 per hero threat from Alert Level: 5 -> 3 at two players, 3 -> 2 at one", () => {
    for (const [players, from, expected] of [
      [2, 5, 3],
      [1, 3, 2],
    ] as const) {
      const base = alertSet(game(players), from);
      const { state: staged, id } = encounterCardInVillainArea(base.state, COMMANDEER, 1);
      const { state } = heroThwarts(DEPS, ready(staged), id);
      expect(inPlayCard(state, COMMANDEER)).toBeUndefined();
      expect(threat(state, alertOf(state))).toBe(expected);
    }
  });
});

describe("Leaping Kick (50096)", () => {
  it("data: no stats or keywords, 2 boost icons, one Alter-Ego and one Hero When Revealed", () => {
    const card = dataOf(KICK);
    expect([card.boostIcons, card.keywords]).toEqual([2, []]);
    expect(abilityRefIds(AOS_CARDS.find((c) => c.id === KICK)!)).toEqual([
      "50096.when-revealed-alter-ego",
      "50096.when-revealed-hero",
    ]);
  });

  it("Hero, no allies in play: Batroc attacks you (a second attack on the hero), 2 + 1 threat on Alert Level from his two attacks (Q5 not involved)", () => {
    const t = game(1);
    const { state, events } = villainPhase(t, firstLegal, BLANK, KICK, BLANK);
    const attacks = attacksOf(state, events, t.villain);
    expect(attacks.map((a) => a.targetInstanceId)).toEqual([identityOf(t.state, P1), identityOf(t.state, P1)]);
    expect(attacks.map((a) => a.damageDealt)).toEqual([2, 2]);
    expect(threat(state, alertOf(state))).toBe(2);
  });

  it("Hero, one ally (a captive with 5 left): Batroc attacks it, with the 1-icon boost card: 2 + 1 = 3 damage; his Forced Response answers (Q5 = A): 1 + 1 threat on Alert Level", () => {
    const { t, id } = withCaptive(game(1), P1);
    const { state, events } = villainPhase(t, firstLegal, BLANK, KICK, ONE_ICON);
    const attacks = attacksOf(state, events, t.villain);
    expect(attacks.map((a) => a.targetInstanceId)).toEqual([identityOf(t.state, P1), id]);
    expect(attacks[1]).toMatchObject({ baseAtk: 2, boostIcons: 1, damageDealt: 3 });
    expect(inst(state, id).damage).toBe(3);
    // The ally's controller is the attacked player: Batroc's "After Batroc attacks" resolved for this attack too.
    expect(threat(state, alertOf(state))).toBe(2);
  });

  it("the attack gains overkill: a captive with 1 hit point left is defeated, the 1 excess goes to its controller's hero; Alert Level gets 1 + 1 (attack) + 1 (defeat)", () => {
    const { t, id } = withCaptive(game(1), P1, 4);
    const hero = identityOf(t.state, P1);
    const { state, events } = villainPhase(t, firstLegal, BLANK, KICK, BLANK);
    const attacks = attacksOf(state, events, t.villain);
    expect(attacks[1]).toMatchObject({ targetInstanceId: id, damageDealt: 2 });
    expect(types(events, "characterDefeated").map((e) => e.instanceId)).toEqual([id]);
    expect(state.victoryDisplay).toContain(id);
    // The activation's 2 on the hero, plus the 1 excess damage.
    expect(inst(state, hero).damage).toBe(inst(t.state, hero).damage + 3);
    expect(threat(state, alertOf(state))).toBe(3);
  });

  it("several allies: the one with the most remaining hit points is attacked (captive 5 over Black Cat 2), whoever controls it (P2)", () => {
    const base = game();
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const { t, id } = withCaptive(withState(base, cat.state), P2);
    expect(remainingHitPoints(t.state, cat.id, DEPS)).toBe(2);
    expect(remainingHitPoints(t.state, id, DEPS)).toBe(5);
    const { state, events } = villainPhase(t, firstLegal, FILL, FILL, KICK, BLANK, BLANK);
    const attacks = attacksOf(state, events, t.villain);
    expect(attacks).toHaveLength(3);
    expect(attacks[2]!.targetInstanceId).toBe(id);
    expect(inst(state, cat.id).damage).toBe(0);
    expect(inst(state, id).damage).toBe(2);
  });

  it("allies tied for the most remaining hit points: the first player (P1) chooses, offered exactly the tied allies (not Black Cat)", () => {
    const base = game();
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const one = withCaptive(withState(base, cat.state), P1);
    const two = withCaptive(one.t, P2);
    const asked: { player: PlayerId; cards: string[] }[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget") {
        asked.push({
          player: choice.playerId,
          cards: choice.options.map((o) => (o.ref.kind === "card" ? o.ref.instanceId : "?")).sort(),
        });
        return picking(two.id)(s);
      }
      return firstLegal(s);
    };
    const { state, events } = villainPhase(two.t, pick, FILL, FILL, KICK, BLANK, BLANK);
    expect(asked).toEqual([{ player: P1, cards: [one.id, two.id].sort() }]);
    expect(attacksOf(state, events, two.t.villain)[2]!.targetInstanceId).toBe(two.id);
    expect(inst(state, one.id).damage).toBe(0);
    expect(inst(state, cat.id).damage).toBe(0);
  });

  it("allies compare remaining hit points, not maximum: a captive with 1 left (4 damage) is passed over for an undamaged Black Cat (2)", () => {
    const base = game(1);
    const cat = playFromHand(DEPS, base.state, BLACK_CAT, 2);
    const { t, id } = withCaptive(withState(base, cat.state), P1, 4);
    expect(remainingHitPoints(t.state, id, DEPS)).toBe(1);
    const { state, events } = villainPhase(t, firstLegal, BLANK, KICK, BLANK);
    expect(attacksOf(state, events, t.villain)[1]!.targetInstanceId).toBe(cat.id);
    expect(inst(state, id).damage).toBe(4);
  });

  it("Alter-Ego: Batroc schemes (a second scheme on the main scheme: 6 + 1 acceleration + 1 + 1 = 9 at one player)", () => {
    const t = alterEgo(game(1));
    const { state, events } = villainPhase(t, firstLegal, BLANK, KICK, BLANK);
    expect(types(events, "schemeResolved").filter((e) => e.enemyInstanceId === t.villain)).toHaveLength(2);
    expect(types(events, "attackResolved")).toEqual([]);
    expect(threat(state, t.main)).toBe(9);
  });
});

const EXHAUST = "Exhaust that character";
const THREAT = "Place 1 threat on Alert Level (2 on its High side)";
/**
 * Answers Security Cameras: each option prompt with the next of `options` (recorded in `asked`), each "which character
 * is next" prompt with the next of `order`; with `defend` the attacked hero defends Batroc's attack (and so is
 * exhausted when the card is revealed). Everything else as `firstLegal`.
 */
const cameras = (
  options: readonly string[],
  order: readonly InstanceId[] = [],
  asked: string[][] = [],
  defend = false,
): Picker => {
  const nextOptions = [...options];
  const nextCards = [...order];
  return (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender" && defend) {
      const hero = identityOf(s, choice.playerId);
      const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === hero);
      if (option) return [option.optionId];
    }
    if (choice.prompt.kind === "chooseOption") {
      asked.push(choice.options.map((o) => o.label));
      const label = nextOptions.shift();
      const hit = choice.options.find((o) => o.label === label);
      return hit ? [hit.optionId] : firstLegal(s);
    }
    if (choice.prompt.kind === "chooseTarget" && choice.prompt.slot === "character") {
      const next = nextCards.shift();
      const hit = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === next);
      return hit ? [hit.optionId] : firstLegal(s);
    }
    return firstLegal(s);
  };
};
/** The character each pass of Security Cameras was about, in order. */
const passesOf = (events: ReturnType<typeof villainPhase>["events"]): InstanceId[] =>
  types(events, "targetChosen")
    .filter((e) => e.slot === "character")
    .flatMap((e) => [...e.instanceIds]);

describe("Security Cameras (50097)", () => {
  it("data: no stats or keywords, 2 boost icons, a Hero and an Alter-Ego When Revealed", () => {
    const card = dataOf(CAMERAS);
    expect([card.boostIcons, card.keywords]).toEqual([2, []]);
    expect(abilityRefIds(AOS_CARDS.find((c) => c.id === CAMERAS)!)).toEqual([
      "50097.when-revealed-alter-ego",
      "50097.when-revealed-hero",
    ]);
  });

  it("Alter-Ego: remove 1 threat from Alert Level (3 -> 2) and the card gains surge, so the next card is revealed too", () => {
    const t = alertSet(alterEgo(game(1)), 3);
    const { state, events } = villainPhase(t, firstLegal, BLANK, CAMERAS, BLANK);
    expect(revealedCodes(state, events)).toEqual([CAMERAS, BLANK]);
    expect(threat(state, alertOf(state))).toBe(2);
  });

  it("Alter-Ego with Alert Level at 0 threat: nothing to remove, still surge", () => {
    const t = alterEgo(game(1));
    const { state, events } = villainPhase(t, firstLegal, BLANK, CAMERAS, BLANK);
    expect(revealedCodes(state, events)).toEqual([CAMERAS, BLANK]);
    expect(threat(state, alertOf(state))).toBe(0);
  });

  it("Alter-Ego on the High side removes only 1 as well (5 -> 4)", () => {
    const t = alertSet(alterEgo(game(1)), 3, true);
    const { state } = villainPhase(t, firstLegal, BLANK, CAMERAS, BLANK);
    expect(threat(state, alertOf(state))).toBe(2);
  });

  // Hero half. Batroc's activation attack comes first and places 1 threat on Alert Level (his Forced Response), so
  // every count below starts 1 above what the test staged. Threshold with one player: 4.
  it("Hero, identity only, exhaust chosen: one prompt with both options, the hero is exhausted, Alert Level 0 -> 1 (the attack only)", () => {
    const t = game(1);
    const asked: string[][] = [];
    const { state, events } = villainPhase(t, cameras([EXHAUST], [], asked), BLANK, CAMERAS, BLANK);
    expect(revealedCodes(state, events)).toEqual([CAMERAS]);
    expect(asked).toEqual([[EXHAUST, THREAT]]);
    expect(inst(state, identityOf(t.state, P1)).exhausted).toBe(true);
    expect(threat(state, alertOf(state))).toBe(1);
  });

  it("Hero, identity only, threat chosen: the hero stays ready, Alert Level 0 -> 1 (attack) -> 2", () => {
    const t = game(1);
    const { state } = villainPhase(t, cameras([THREAT]), BLANK, CAMERAS, BLANK);
    expect(inst(state, identityOf(t.state, P1)).exhausted).toBe(false);
    expect(threat(state, alertOf(state))).toBe(2);
    expect(side(state)).toBe("Low");
  });

  it("Hero on the High side: the threat option places 2 instead, 0 -> 1 (attack) -> 3", () => {
    const t = alertSet(game(1), 0, true);
    const { state } = villainPhase(t, cameras([THREAT]), BLANK, CAMERAS, BLANK);
    expect(threat(state, alertOf(state))).toBe(3);
    expect(side(state)).toBe("High");
    expect(state.outcome).toBeNull();
  });

  it("Hero, identity plus two allies, mixed: the player picks the order; exhaust the hero, threat for the first captive, exhaust the second: 0 -> 1 -> 2", () => {
    const first = withCaptive(game(1), P1);
    const second = withCaptive(first.t, P1);
    const t = second.t;
    const hero = identityOf(t.state, P1);
    const asked: string[][] = [];
    const { state, events } = villainPhase(
      t,
      cameras([EXHAUST, THREAT, EXHAUST], [hero, first.id], asked),
      BLANK,
      CAMERAS,
      BLANK,
    );
    expect(passesOf(events)).toEqual([hero, first.id, second.id]);
    expect(asked).toEqual([
      [EXHAUST, THREAT],
      [EXHAUST, THREAT],
      [EXHAUST, THREAT],
    ]);
    expect([hero, first.id, second.id].map((id) => inst(state, id).exhausted)).toEqual([true, false, true]);
    expect(threat(state, alertOf(state))).toBe(2);
  });

  it("Hero, three characters all paying threat from Low at 1: 2 (attack), 3, 4 flips to High with no threat, and the third pass places 2", () => {
    const first = withCaptive(game(1), P1);
    const second = withCaptive(first.t, P1);
    const t = alertSet(second.t, 1);
    const { state } = villainPhase(t, cameras([THREAT, THREAT, THREAT]), BLANK, CAMERAS, BLANK);
    expect(side(state)).toBe("High");
    expect(threat(state, alertOf(state))).toBe(2);
    expect(state.outcome).toBeNull();
    for (const id of [identityOf(t.state, P1), first.id, second.id]) expect(inst(state, id).exhausted).toBe(false);
  });

  it("Hero, a character already exhausted (the hero defended Batroc's attack): no prompt, it cannot be exhausted again, 1 threat placed: 0 -> 1 -> 2", () => {
    const t = game(1);
    const hero = identityOf(t.state, P1);
    const asked: string[][] = [];
    const { state, events } = villainPhase(t, cameras([EXHAUST], [], asked, true), BLANK, CAMERAS, BLANK);
    // Spider-Man defended (DEF 3 against ATK 2) and is exhausted for it.
    expect(types(events, "attackResolved")[0]).toMatchObject({ targetInstanceId: hero, defenseReduction: 3 });
    expect(passesOf(events)).toEqual([hero]);
    expect(asked).toEqual([]);
    expect(inst(state, hero).exhausted).toBe(true);
    expect(threat(state, alertOf(state))).toBe(2);
  });

  it("Hero, an exhausted hero and a ready ally: only the ally is offered the exhaust; exhausting it leaves 0 -> 1 -> 2", () => {
    const { t, id } = withCaptive(game(1), P1);
    const hero = identityOf(t.state, P1);
    const asked: string[][] = [];
    const { state } = villainPhase(t, cameras([EXHAUST], [hero], asked, true), BLANK, CAMERAS, BLANK);
    expect(asked).toEqual([[EXHAUST, THREAT]]);
    expect([hero, id].map((c) => inst(state, c).exhausted)).toEqual([true, true]);
    expect(threat(state, alertOf(state))).toBe(2);
  });

  it("two players, P1 in alter-ego and P2 in hero form, each revealing a copy: P1's removes 1 and surges, P2's asks P2 only: 2 -> 3 (attack on P2) -> 2 -> 3", () => {
    const t = alertSet(alterEgo(game()), 2);
    const askedOf: PlayerId[] = [];
    const pick = cameras([THREAT]);
    const { state, events } = villainPhase(
      t,
      (s) => {
        if (s.pendingChoice!.prompt.kind === "chooseOption") askedOf.push(s.pendingChoice!.playerId);
        return pick(s);
      },
      FILL,
      FILL,
      CAMERAS,
      CAMERAS,
      BLANK,
    );
    expect(revealedCodes(state, events)).toEqual([CAMERAS, BLANK, CAMERAS]);
    expect(askedOf).toEqual([P2]);
    expect(passesOf(events)).toEqual([identityOf(t.state, P2)]);
    expect(threat(state, alertOf(state))).toBe(3);
    expect([P1, P2].map((p) => inst(state, identityOf(t.state, p)).exhausted)).toEqual([false, false]);
  });
});
