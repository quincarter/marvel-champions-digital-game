/**
 * A support that attaches itself to a side scheme and stays under its player's control (#890 item 12), on a synthetic
 * card shaped like Juston Seyfert (the `sentinel-tw` community pack): "Action: Attach to a side scheme. Hero Action:
 * Exhaust Juston Seyfert → remove 1 threat from attached side scheme. … After attached side scheme is defeated, put
 * Juston Seyfert in play under your control. Ready Sentinel." The user's ruling (2026-11-19): he enters play in your
 * area, moves onto the scheme with his Action like an upgrade attached to a scheme (Overwatch 30019), stays a support
 * under your control, and his Hero Action resolves from the scheme. His return is `staysWhenHostLeaves: "defeated"`.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { controllerOf } from "./select.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ATTACH = stubAbility("juston.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "chooseTarget",
      slot: "scheme",
      query: { categories: ["sideScheme"] },
      chooser: { kind: "controller" },
    },
    { kind: "attach", card: { kind: "self" }, to: { kind: "slot", slot: "scheme" } },
  ],
} satisfies AbilityDefinition);
const WORK = stubAbility("juston.hero-action", {
  trigger: { kind: "action", form: "hero" },
  cost: { exhaustSelf: true },
  effects: [{ kind: "removeThreat", target: { kind: "host" }, amount: { kind: "const", value: 1 } }],
} satisfies AbilityDefinition);
const COMES_BACK = stubAbility("juston.forced-interrupt", {
  trigger: { kind: "interrupt", forced: true, on: { on: "schemeDefeated", targetIs: { hostOfSelf: true } } },
  staysWhenHostLeaves: "defeated",
  effects: [{ kind: "ready", target: { kind: "identityOf", player: { kind: "controller" } } }],
} as unknown as AbilityDefinition);
const JUSTON = stubSupport({ id: "juston", cost: 0, abilities: [ATTACH.ref, WORK.ref, COMES_BACK.ref] });
const HIDEOUT = stubSideScheme({ id: "hideout", startingThreat: 2 });
const deps: EngineDeps = depsOf(ATTACH, WORK, COMES_BACK);

function start(): { state: GameState; juston: InstanceId; scheme: InstanceId } {
  const base = gameAtFirstTurn({ cards: [JUSTON, HIDEOUT], deps, deck: [JUSTON.id], encounter: [HIDEOUT.id] });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const placed = encounterCardInVillainArea(hero, HIDEOUT.id, 1);
  const juston = playerCardIntoPlay(placed.state, JUSTON.id, P1);
  return { state: juston.state, juston: juston.id, scheme: placed.id };
}

const use = (juston: InstanceId, abilityId: string): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: juston,
  abilityId: abilityId as never,
  payment: [],
});

describe("a support attached to a side scheme, still under its player's control (#890 item 12)", () => {
  it("attaches with its Action, stays controlled, and its Hero Action works from the scheme", () => {
    const s = start();
    const driven = driveSession(startSession(s.state), deps, [use(s.juston, ATTACH.ref.id)], defaultPick);
    const attached = driven.session.state;
    expect(mustInstance(attached, s.juston).attachedTo).toBe(s.scheme);
    expect(controllerOf(attached, s.juston)).toBe(P1);
    expect(mustPlayer(attached, P1).playArea).not.toContain(s.juston);

    // The identity is exhausted, so the ready on his return is visible.
    const identity = mustPlayer(attached, P1).identity.instanceId;
    const tired: GameState = {
      ...attached,
      instances: { ...attached.instances, [identity]: { ...mustInstance(attached, identity), exhausted: true } },
    };
    const worked = driveSession(startSession(tired), deps, [use(s.juston, WORK.ref.id)], defaultPick);
    const after = worked.session.state;
    // 1 threat removed: the scheme is defeated, and Juston comes back to the play area under P1's control.
    expect(after.villainArea).not.toContain(s.scheme);
    expect(mustPlayer(after, P1).playArea).toContain(s.juston);
    expect(mustInstance(after, s.juston).attachedTo).toBeNull();
    expect(controllerOf(after, s.juston)).toBe(P1);
    expect(mustInstance(after, identity).exhausted).toBe(false);
    const replayed = replay(worked.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
  });
});
