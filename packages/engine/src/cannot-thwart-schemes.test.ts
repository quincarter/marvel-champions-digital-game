/**
 * `RuleSpec cannotThwart` scoped with `schemes`: "The engaged player cannot thwart side schemes." (Life-Size Decoy,
 * `sm` 27142). Synthetic minion of that shape. The unscoped rule ("you cannot thwart", Baron Zemo) is covered in
 * `triggers-wave1.test.ts`.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cannotThwart } from "./rules.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const DECOY_RULE = stubAbility("decoy.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "cannotThwart",
        player: { kind: "engagedWith", of: { kind: "self" } },
        schemes: { categories: ["sideScheme"] },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const DECOY = stubMinion({ id: "decoy", atk: 0, sch: 0, hp: 5, boostIcons: 0, abilities: [DECOY_RULE.ref] });
const SIDE = stubSideScheme({ id: "side", startingThreat: 5 });

/** "(thwart): Remove 1 threat from a scheme." */
const PROBE_ACTION = stubAbility("probe.action", {
  trigger: { kind: "action" },
  label: ["thwart"],
  effects: [
    { kind: "chooseTarget", slot: "scheme", query: { categories: ["scheme"] }, chooser: { kind: "controller" } },
    { kind: "thwart", target: { kind: "slot", slot: "scheme" }, amount: { kind: "const", value: 1 } },
  ] as EffectSpec[],
});
const PROBE = stubEvent({ id: "probe", cost: 0, abilities: [PROBE_ACTION.ref] });

/** "Remove 1 threat from each scheme." as a thwart. */
const SWEEP_ACTION = stubAbility("sweep.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "thwart",
      target: { kind: "each", query: { categories: ["scheme"] } },
      amount: { kind: "const", value: 1 },
    },
  ] as EffectSpec[],
});
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [SWEEP_ACTION.ref] });

const deps: EngineDeps = depsOf(DECOY_RULE, PROBE_ACTION, SWEEP_ACTION);

/** P1 (and P2) in hero form, a side scheme with 5 threat, the main scheme at 5, and a decoy engaged with P1. */
function start(players: 1 | 2 = 1) {
  const base = gameAtFirstTurn({
    cards: [DECOY, SIDE, PROBE, SWEEP],
    deps,
    encounter: [DECOY.id, SIDE.id],
    deck: [PROBE.id, SWEEP.id],
    players,
  });
  const main = base.mainScheme.instanceId;
  const heroes: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...base.instances, [main]: { ...mustInstance(base, main), threat: 5 } },
  };
  const side = encounterCardInVillainArea(heroes, SIDE.id, 5);
  const decoy = minionEngagedWith(side.state, DECOY.id, P1);
  return { state: decoy.state, side: side.id, decoy: decoy.id, main };
}

const basicThwart = (state: GameState, scheme: InstanceId, player: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: player,
  thwarterInstanceId: mustPlayer(state, player).identity.instanceId,
  schemeInstanceId: scheme,
});

function heroThwart(state: GameState, player: PlayerId = P1) {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn") throw new Error(`not ${player}'s turn: ${actions.kind}`);
  const hero = mustPlayer(state, player).identity.instanceId;
  const legal = actions.legal.find((a) => a.action.kind === "basicThwart" && a.action.instanceId === hero);
  const illegal = actions.illegal.find((a) => a.action.kind === "basicThwart" && a.action.instanceId === hero);
  return { targets: legal?.targets ?? [], blocked: legal?.blockedTargets ?? illegal?.blockedTargets ?? [] };
}

const play = (card: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: null,
});

describe("cannotThwart scoped to side schemes", () => {
  it("refuses the engaged player's basic thwart of a side scheme before any cost; the main scheme stays legal", () => {
    const { state, side, main } = start();
    const refused = applyCommand(state, basicThwart(state, side), deps);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
    const { targets, blocked } = heroThwart(state);
    expect(targets).toContain(main);
    expect(targets).not.toContain(side);
    expect(blocked.find((b) => b.instanceId === side)?.reason).toBe("no_valid_target");

    const { session } = driveSession(startSession(state), deps, [basicThwart(state, main)]);
    expect(mustInstance(session.state, main).threat).toBeLessThan(5);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a thwart effect's target choice leaves the side scheme out", () => {
    const { state: bare, side, main } = start();
    const { state, id: probe } = giveCard(bare, P1, PROBE.id);
    const offered: InstanceId[] = [];
    const pick = (s: GameState): readonly string[] => {
      const choice = s.pendingChoice;
      if (choice?.prompt.kind === "chooseTarget") {
        for (const o of choice.options) if (o.ref.kind === "card") offered.push(o.ref.instanceId);
      }
      return defaultPick(s);
    };
    const { session } = driveSession(startSession(state), deps, [play(probe)], pick);
    expect(offered).toContain(main);
    expect(offered).not.toContain(side);
    expect(mustInstance(session.state, side).threat).toBe(5);
    expect(mustInstance(session.state, main).threat).toBe(4);
  });

  it("a thwart of each scheme thwarts the main scheme only, and logs the side scheme as blocked", () => {
    const { state: bare, side, main } = start();
    const { state, id: sweep } = giveCard(bare, P1, SWEEP.id);
    const { session, events } = driveSession(startSession(state), deps, [play(sweep)]);
    expect(mustInstance(session.state, side).threat).toBe(5);
    expect(mustInstance(session.state, main).threat).toBe(4);
    expect(events).toContainEqual({ type: "threatRemovalBlocked", schemeInstanceId: side, reason: "rule" });
    const thwartedSide = events.some(
      (e) => e.type === "triggerEvent" && e.event.kind === "thwart" && e.event.schemeInstanceId === side,
    );
    expect(thwartedSide).toBe(false);
  });

  it("binds only the engaged player: another player may still thwart the side scheme", () => {
    const { state: p1Turn, side } = start(2);
    expect(cannotThwart(p1Turn, deps, P1, side)).toBe(true);
    expect(cannotThwart(p1Turn, deps, P2, side)).toBe(false);
    // A scoped rule never reads as "cannot thwart at all".
    expect(cannotThwart(p1Turn, deps, P1)).toBe(false);
    const { session } = driveSession(startSession(p1Turn), deps, [{ type: "endTurn", playerId: P1 }]);
    const state = session.state;
    expect(heroThwart(state, P2).targets).toContain(side);
    const thwarted = driveSession(startSession(state), deps, [basicThwart(state, side, P2)]).session.state;
    expect(mustInstance(thwarted, side).threat).toBeLessThan(5);
  });

  it("ends when the minion leaves play", () => {
    const { state: engaged, side, decoy } = start();
    const state: GameState = {
      ...engaged,
      players: engaged.players.map((p) => ({ ...p, playArea: p.playArea.filter((id) => id !== decoy) })),
    };
    expect(heroThwart(state).targets).toContain(side);
    expect(applyCommand(state, basicThwart(state, side), deps).ok).toBe(true);
  });
});
