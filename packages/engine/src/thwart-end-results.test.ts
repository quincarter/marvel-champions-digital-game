/**
 * docs/phase7-wave11-hero-packs.md H3.12 (HT7): `EffectSpec atEndOfThwart`, effects an interrupt to a thwart holds on
 * that thwart, resolved as it finishes with its results (`defeated`, `threatRemoved`). A synthetic upgrade shaped like
 * Stakeout (61014: "When a character thwarts attached scheme, that thwart removes 2 additional threat. If that thwart
 * defeats attached scheme, place 2 evidence counters."), attached to a side scheme. The defeat discards it with its
 * host before the thwart ends, so the check was set up by the interrupt and still resolves.
 *
 * Control: a scheme the thwart leaves with threat places nothing, and the extra threat still applies.
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25), "Delayed Effect" (p. 16), "Thwart" (p. 44), "Attachments" (p. 8: an
 * attachment leaves play when its host does).
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubSideScheme, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const STAKE = stubAbility("stake.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "thwart", targetIs: { hostOfSelf: true } } },
  effects: [
    { kind: "modifyThwart", extraThreat: { kind: "const", value: 2 } },
    {
      kind: "atEndOfThwart",
      effects: [
        {
          kind: "if",
          condition: { kind: "eventResultAtLeast", key: "defeated", amount: 1 },
          then: [
            {
              kind: "addCounters",
              target: { kind: "each", query: { categories: ["identity"], controller: "you" } },
              counterType: "evidence",
              amount: { kind: "const", value: 2 },
            },
          ],
        },
      ],
    },
  ],
} satisfies AbilityDefinition);
const STAKEOUT = stubUpgrade({ id: "stakeout", cost: 0, abilities: [STAKE.ref] });
/** "Interrupt: When a side scheme would be defeated, cancel that defeat." */
const SPARE = stubAbility("spare.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "schemeDefeated" } },
  effects: [{ kind: "cancelTriggeringEvent" }],
} satisfies AbilityDefinition);
const REPRIEVE = stubSupport({ id: "reprieve", cost: 0, abilities: [SPARE.ref] });
const SIDE = stubSideScheme({ id: "side", startingThreat: 0, boostIcons: 0 });
const deps = depsOf(STAKE, SPARE);

/** P1 in hero form (the fixture hero's THW 2), the upgrade attached to a side scheme at `threat`. */
function table(threat: number, { reprieve = false } = {}) {
  let state = gameAtFirstTurn({
    cards: [STAKEOUT, SIDE, REPRIEVE],
    deps,
    encounter: [SIDE.id],
    deck: [STAKEOUT.id, REPRIEVE.id],
  });
  if (reprieve) state = playerCardIntoPlay(state, REPRIEVE.id).state;
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const side = encounterCardInVillainArea(state, SIDE.id, threat);
  const up = playerCardIntoPlay(side.state, STAKEOUT.id);
  const seat = mustPlayer(up.state, P1);
  state = {
    ...up.state,
    players: up.state.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: seat.playArea.filter((id) => id !== up.id) } : p,
    ),
    instances: {
      ...up.state.instances,
      [up.id]: { ...mustInstance(up.state, up.id), attachedTo: side.id },
      [side.id]: { ...mustInstance(up.state, side.id), attachments: [up.id] },
    },
  };
  return { state, side: side.id, stakeout: up.id };
}

/** Uses the stakeout's interrupt and the reprieve's whenever offered. */
const useStakeout = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  const ids = [STAKE.ref.id, SPARE.ref.id];
  const wanted = choice?.options.filter((o) => ids.some((id) => o.optionId.includes(id))).map((o) => o.optionId) ?? [];
  return wanted.length > 0 ? wanted.slice(0, Math.max(1, choice?.maxSelections ?? 1)) : defaultPick(state);
};

function thwart(state: GameState, scheme: InstanceId) {
  const identity = mustPlayer(state, P1).identity.instanceId;
  const result = runCommandsPicking(state, deps, useStakeout, {
    type: "basicThwart",
    playerId: P1,
    thwarterInstanceId: identity,
    schemeInstanceId: scheme,
  });
  const replayed = replay(result.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(result.state);
  return { ...result, identity };
}

const evidence = (state: GameState, id: InstanceId) => mustInstance(state, id).counters.evidence ?? 0;
const thwartOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;

describe("H3.12 `atEndOfThwart`: an interrupt reads whether that thwart defeated the scheme", () => {
  it("a thwart that defeats the scheme at 3 (THW 2 + 2) places the counters; the upgrade left with its host", () => {
    const t = table(3);
    const { state, events, identity } = thwart(t.state, t.side);
    expect(state.villainArea).not.toContain(t.side);
    expect(mustInstance(state, t.stakeout).attachedTo).toBeNull();
    expect(mustPlayer(state, P1).discard).toContain(t.stakeout);
    expect(evidence(state, identity)).toBe(2);
    const resolved = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart" ? [e.event.results] : [],
    );
    expect(resolved[0]).toMatchObject({ defeated: 1 });
  });

  it("a defeat an interrupt cancels is no defeat: no `defeated` result, no counters", () => {
    const t = table(3, { reprieve: true });
    const { state, events, identity } = thwart(t.state, t.side);
    expect(mustInstance(state, t.side).threat).toBe(0);
    expect(mustInstance(state, t.stakeout).attachedTo).toBe(t.side);
    expect(evidence(state, identity)).toBe(0);
    const resolved = events.flatMap((e) =>
      e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart" ? [e.event.results] : [],
    );
    expect(resolved[0]?.defeated).toBeUndefined();
  });

  it("control: a thwart that leaves threat removes the extra 2 but places nothing", () => {
    const t = table(5);
    const { state } = thwart(t.state, t.side);
    // THW 2 + 2.
    expect(mustInstance(state, t.side).threat).toBe(1);
    expect(mustInstance(state, t.stakeout).attachedTo).toBe(t.side);
    expect(evidence(state, thwartOf(state))).toBe(0);
  });
});
