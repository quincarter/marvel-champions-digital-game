/**
 * docs/phase7-wave11-scenarios.md §S7 item 40: while a plain "Threat cannot be removed from this scheme" rule is
 * active (The Thunderbolts, `synthezoid` 57021, and others), the scheme is no target for a basic thwart or a targeted
 * threat removal. RRG 1.8 "Target" (p. 43): "not valid ... if that ability would cause the target to perform a game
 * function that another ability says the target cannot perform"; "Thwart" (p. 44); "'Cannot'" (p. 11). A confused
 * hero may still attempt the basic thwart (RRG 1.8 "Confuse, Confused", p. 13), and a "remove 1 threat from each
 * scheme" effect is still usable and skips the scheme. Synthetic cards of that shape.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1 } from "./testing/wave3.js";

const LOCKER = stubMinion({ id: "locker", atk: 0, sch: 0, hp: 5, boostIcons: 0 });
/** "While a locker is in play, threat cannot be removed from this scheme." */
const LOCK_RULE = stubAbility("locked.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "threatCannotBeRemoved",
        target: { self: true },
        while: { kind: "exists", query: { categories: ["minion"] } },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const LOCKED = stubSideScheme({ id: "locked", startingThreat: 5, abilities: [LOCK_RULE.ref] });

/** "Remove 1 threat from a side scheme." */
const PROBE_ACTION = stubAbility("probe.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["sideScheme"] }, chooser: { kind: "controller" } },
    { kind: "removeThreat", target: { kind: "slot", slot: "scheme" }, amount: { kind: "const", value: 1 } },
  ] as EffectSpec[],
});
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });

/** "Remove 1 threat from each scheme." */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "removeThreat",
      target: { kind: "each", query: { categories: ["scheme"] } },
      amount: { kind: "const", value: 1 },
    },
  ] as EffectSpec[],
});
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });

const deps: EngineDeps = depsOf(LOCK_RULE, PROBE_ACTION, SWEEP_ACTION);

/** P1 in hero form, the main scheme at 5, the locked side scheme at 5, and a locker minion when `active`. */
function start(active: boolean) {
  const base = gameAtFirstTurn({
    cards: [LOCKER, LOCKED, PROBE, SWEEP],
    deps,
    encounter: [LOCKER.id, LOCKED.id],
    deck: [PROBE.id, SWEEP.id],
  });
  const main = base.mainScheme.instanceId;
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 5 } },
  };
  const side = encounterCardInVillainArea(heroes, LOCKED.id, 5);
  const state = active ? minionEngagedWith(side.state, LOCKER.id, P1).state : side.state;
  return { state, side: side.id, main, hero: mustPlayer(state, P1).identity.instanceId };
}

const basicThwart = (state: GameState, scheme: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: mustPlayer(state, P1).identity.instanceId,
  schemeInstanceId: scheme,
});
const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

describe("a plain threatCannotBeRemoved rule makes the scheme no target (§S7 item 40)", () => {
  it("refuses a basic thwart of the scheme while the rule is active", () => {
    const { state, side } = start(true);
    expect(applyCommand(state, basicThwart(state, side), deps)).toMatchObject({
      ok: false,
      error: { code: "no_valid_target" },
    });
  });

  it("refuses a targeted remove-threat event whose only candidate is the scheme", () => {
    const { state: bare, side } = start(true);
    const { state, id } = giveCard(bare, P1, PROBE.id);
    expect(applyCommand(state, play(id), deps)).toMatchObject({ ok: false, error: { code: "no_valid_target" } });
    expect(mustInstance(state, side).threat).toBe(5);
  });

  it("a confused hero may still attempt the basic thwart: the confused card goes, no threat is removed", () => {
    const { state: bare, side, hero } = start(true);
    const state: GameState = {
      ...bare,
      instances: {
        ...bare.instances,
        [hero]: { ...mustInstance(bare, hero), statuses: { ...mustInstance(bare, hero).statuses, confused: 1 } },
      },
    };
    expect(applyCommand(state, basicThwart(state, side), deps).ok).toBe(true);
    const { session } = driveSession(startSession(state), deps, [basicThwart(state, side)], defaultPick);
    expect(mustInstance(session.state, hero).statuses.confused).toBe(0);
    expect(mustInstance(session.state, side).threat).toBe(5);
  });

  it("a 'remove 1 threat from each scheme' effect is still usable and skips the scheme", () => {
    const { state: bare, side, main } = start(true);
    const { state, id } = giveCard(bare, P1, SWEEP.id);
    const { session } = driveSession(startSession(state), deps, [play(id)], defaultPick);
    expect(mustInstance(session.state, main).threat).toBe(4);
    expect(mustInstance(session.state, side).threat).toBe(5);
  });

  it("with the rule inactive, the basic thwart and the targeted event are allowed and remove threat", () => {
    const { state: bare, side } = start(false);
    const thwarted = driveSession(startSession(bare), deps, [basicThwart(bare, side)], defaultPick);
    expect(mustInstance(thwarted.session.state, side).threat).toBeLessThan(5);
    const { state, id } = giveCard(bare, P1, PROBE.id);
    const played = driveSession(startSession(state), deps, [play(id)], defaultPick);
    expect(mustInstance(played.session.state, side).threat).toBe(4);
  });
});
