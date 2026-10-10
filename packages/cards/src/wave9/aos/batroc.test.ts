import { AOS_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
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
import { defeatWithAttack, driveEventsPicking, playFromHand, withForm } from "../../testing/staging.js";
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
  types,
} from "../testing.js";
import { wave9Scenario } from "../setup.js";
import { BATROC, BATROC_SKIPPED } from "./batroc.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Batroc, first half (docs/phase7-wave9.md sections 2.3, 3.5, 3.13 to 3.16): the villain 50086a/b, the three main scheme
 * stages 50087a/b to 50089a/b and Alert Level 50090a/b. The real `batroc` scenario (Spider-Man and Iron Man preconstructed
 * decks from Core), every seat in hero form. Rescued Captive 50091 is the second half: its ally limit exception and its
 * action are not scripted yet, so tests put at most two captives under one player.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, BATROC) };
const SEATS = [SPIDER_MAN, IRON_MAN] as const;
const SECOND_HALF = ["50091", "50092", "50093", "50094", "50095", "50096", "50097"];
const REGISTERED = [
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
  it("registers exactly the first half's refs, each a valid definition; the second half is skipped with its reason", () => {
    expect(Object.keys(BATROC).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(BATROC)) expect(validateDefinition(def), id).toEqual([]);
    const refs = SECOND_HALF.flatMap((code) => abilityRefIds(AOS_CARDS.find((c) => c.id === code)!));
    expect(Object.keys(BATROC_SKIPPED).sort()).toEqual([...refs].sort());
    expect(new Set(Object.values(BATROC_SKIPPED))).toEqual(new Set(["second half of the module, not started"]));
  });

  it("the data names exactly the registered refs", () => {
    const refs = ["50086a", "50087a", "50090a"].flatMap((code) => abilityRefIds(AOS_CARDS.find((c) => c.id === code)!));
    expect([...refs].sort()).toEqual([...REGISTERED].sort());
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
    expect(threat(state, alertOf(state))).toBe(0);
    expect(statBonus(state, DEPS, t.villain, "sch")).toBe(1);
    expect(statBonus(state, DEPS, t.villain, "atk")).toBe(1);
    expect(state.outcome).toBeNull();
  });

  it("Low at 3 (two players): a minion defeated gives 4 and nothing flips; at one player the threshold is 4 and it flips", () => {
    const { t, id } = engagedMinion(alertAt(game(), 3));
    const state = defeatWithAttack(DEPS, t.state, id);
    expect(side(state)).toBe("Low");
    expect(threat(state, alertOf(state))).toBe(4);
    const m = engagedMinion(alertAt(game(1), 3));
    const s1 = defeatWithAttack(DEPS, m.t.state, m.id);
    expect(side(s1)).toBe("High");
    expect(threat(s1, alertOf(s1))).toBe(0);
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

  it("an ally defeated by its own consequential damage places no threat; a minion defeated by an attack places 1", () => {
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
    expect(threat(killed, alertOf(killed))).toBe(1);
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
