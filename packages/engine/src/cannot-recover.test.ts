/**
 * docs/phase7-wave6.md §3.14: "cannot recover". Synthetic cards shaped like Wrapped in Metal (`mut_gen` 32150:
 * "Attached identity cannot thwart, attack, defend, or recover").
 *
 * Sources: RRG 1.8 "Recover, Recovery" (p. 36) and "Basic Power" (pp. 10–11): a recovery is the alter-ego's basic power
 * (exhaust, heal REC); every "recover" in card text names it. "'Cannot'" (p. 11) is absolute. A heal, even one equal to
 * REC, is not a recovery: only "cannot be healed" (§3.12) stops it.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAttachment, stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, P1, P2 } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;

/** Wrapped in Metal's recover clause: "Attached identity cannot … recover". */
const METAL_RULE = stubAbility(
  "metal.constant",
  def({
    trigger: {
      kind: "constant",
      rules: [{ kind: "cannotRecover", player: { kind: "controllerOf", target: { kind: "host" } } }],
    },
    effects: [],
  }),
);
const METAL = stubAttachment({ id: "metal", abilities: [METAL_RULE.ref] });
/** "P1 cannot recover while a 'guard' is in play." */
const GUARDED_RULE: RuleSpec = {
  kind: "cannotRecover",
  player: { kind: "id", playerId: P1 },
  while: { kind: "exists", query: { name: "guard" } },
};
const GUARDED_ABILITY = stubAbility(
  "guarded.constant",
  def({ trigger: { kind: "constant", rules: [GUARDED_RULE] }, effects: [] }),
);
const GUARDED = stubSideScheme({ id: "guarded", startingThreat: 5, abilities: [GUARDED_ABILITY.ref] });
/** "Your identity cannot be healed" (§3.12, no `bySource`). */
const SEALED_ABILITY = stubAbility(
  "sealed.constant",
  def({
    trigger: { kind: "constant", rules: [{ kind: "cannotBeHealed", target: { categories: ["identity"] } }] },
    effects: [],
  }),
);
const SEALED = stubSideScheme({ id: "sealed", startingThreat: 5, abilities: [SEALED_ABILITY.ref] });
const GUARD = stubMinion({ id: "guard", atk: 1, sch: 1, hp: 5, boostIcons: 0 });
/** A player event: "Heal 2 damage from your identity." */
const MEND_ACTION = stubAbility(
  "mend.action",
  def({
    trigger: { kind: "action" },
    effects: [{ kind: "heal", target: { kind: "each", query: { categories: ["identity"] } }, amount: n(2) }],
  }),
);
const MEND = stubEvent({ id: "mend", cost: 0, abilities: [MEND_ACTION.ref] });

const deps = depsOf(METAL_RULE, GUARDED_ABILITY, SEALED_ABILITY, MEND_ACTION);

const identityOf = (state: GameState, player: PlayerId) => mustPlayer(state, player).identity.instanceId;

/** Each seat's identity with 4 damage, in alter-ego form (the stub hero: REC 3). */
function start(players: 1 | 2 = 1, ...rules: readonly CardId[]) {
  let state = gameAtFirstTurn({
    players,
    cards: [METAL, GUARDED, SEALED, GUARD, MEND],
    deps,
    deck: [MEND.id],
    encounter: [METAL.id, GUARDED.id, SEALED.id, GUARD.id],
  });
  for (const rule of rules) state = encounterCardInVillainArea(state, rule, 5).state;
  for (const seat of state.players) {
    const id = seat.identity.instanceId;
    expect(seat.identity.form).toBe("alterEgo");
    state = { ...state, instances: { ...state.instances, [id]: { ...mustInstance(state, id), damage: 4 } } };
  }
  return state;
}

/** Surgery: Wrapped in Metal attached to `player`'s identity. */
function wrap(state: GameState, player: PlayerId): { readonly state: GameState; readonly metal: InstanceId } {
  const taken = encounterCardInVillainArea(state, METAL.id);
  const host = identityOf(taken.state, player);
  return {
    metal: taken.id,
    state: {
      ...taken.state,
      villainArea: taken.state.villainArea.filter((id) => id !== taken.id),
      instances: {
        ...taken.state.instances,
        [taken.id]: { ...mustInstance(taken.state, taken.id), attachedTo: host },
        [host]: {
          ...mustInstance(taken.state, host),
          attachments: [...mustInstance(taken.state, host).attachments, taken.id],
        },
      },
    },
  };
}

function run(state: GameState, commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
const recover = (player: PlayerId): Command => ({ type: "basicRecover", playerId: player });
function playMend(state: GameState) {
  const given = giveCard(state, P1, MEND.id);
  return run(given.state, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}
const isRecover = (a: { readonly action: { readonly kind: string } }) => a.action.kind === "basicRecover";
function turnActions(state: GameState, player: PlayerId) {
  const actions = legalActions(state, player, deps);
  if (actions.kind !== "turn") throw new Error(`not ${player}'s turn: ${actions.kind}`);
  return actions;
}

describe("§3.14 'cannot recover' (Wrapped in Metal)", () => {
  it("the attached identity's basic recovery is refused, with no state change, and not offered", () => {
    const { state } = wrap(start(), P1);
    const identity = identityOf(state, P1);
    const result = applyCommand(state, recover(P1), deps);
    expect(result.ok ? null : { code: result.error.code, message: result.error.message }).toEqual({
      code: "no_valid_target",
      message: "you cannot recover",
    });
    expect(mustInstance(state, identity)).toMatchObject({ damage: 4, exhausted: false });

    const actions = turnActions(state, P1);
    expect(actions.legal.some(isRecover)).toBe(false);
    expect(actions.illegal.filter(isRecover)).toEqual([
      {
        action: { kind: "basicRecover" },
        reason: "no_valid_target",
        message: "you cannot recover",
        blockedTargets: [],
      },
    ]);
  });

  it("a heal on the identity still heals it (a heal is not a recovery)", () => {
    const { state } = wrap(start(), P1);
    const identity = identityOf(state, P1);
    const { state: after, events } = playMend(state);
    expect(mustInstance(after, identity).damage).toBe(2);
    expect(events.filter((e) => e.type === "damageHealed")).toEqual([
      { type: "damageHealed", targetInstanceId: identity, amount: 2 },
    ]);
  });

  it("with §3.12 'cannot be healed' too, the heal is blocked by that rule", () => {
    const { state } = wrap(start(1, SEALED.id), P1);
    const identity = identityOf(state, P1);
    const { state: after, events } = playMend(state);
    expect(mustInstance(after, identity).damage).toBe(4);
    expect(events.filter((e) => e.type === "healBlocked")).toEqual([
      { type: "healBlocked", targetInstanceId: identity, sourceInstanceId: expect.any(String), amount: 2 },
    ]);
    // Both rules refuse the recovery; "cannot recover" is checked first.
    const result = applyCommand(state, recover(P1), deps);
    expect(result.ok ? null : result.error.message).toBe("you cannot recover");
  });

  it("only the attached identity's player: the other player still recovers", () => {
    const { state } = wrap(start(2), P2);
    const identity = identityOf(state, P1);
    expect(turnActions(state, P1).legal.some(isRecover)).toBe(true);
    const { state: after, events } = run(state, [recover(P1)]);
    expect(mustInstance(after, identity)).toMatchObject({ damage: 1, exhausted: true });
    expect(events.filter((e) => e.type === "damageHealed")).toEqual([
      { type: "damageHealed", targetInstanceId: identity, amount: 3 },
    ]);
    // P2's own identity is untouched.
    expect(mustInstance(after, identityOf(after, P2))).toMatchObject({ damage: 4, exhausted: false });

    // Attached to P1's instead, in the same two-player game: P1 is the one refused.
    const p1Wrapped = wrap(start(2), P1).state;
    expect(turnActions(p1Wrapped, P1).legal.some(isRecover)).toBe(false);
  });

  it("the rule's `while` ending restores recovery", () => {
    const base = start(1, GUARDED.id);
    const guard = minionEngagedWith(base, GUARD.id);
    expect(turnActions(guard.state, P1).legal.some(isRecover)).toBe(false);
    const refused = applyCommand(guard.state, recover(P1), deps);
    expect(refused.ok ? null : refused.error.message).toBe("you cannot recover");

    // Surgery: the guard leaves play.
    const seat = mustPlayer(guard.state, P1);
    const gone: GameState = {
      ...guard.state,
      players: guard.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: seat.playArea.filter((id) => id !== guard.id) } : p,
      ),
    };
    expect(turnActions(gone, P1).legal.some(isRecover)).toBe(true);
    const identity = identityOf(gone, P1);
    const { state: after } = run(gone, [recover(P1)]);
    expect(mustInstance(after, identity)).toMatchObject({ damage: 1, exhausted: true });
  });

  it("the attachment leaving its identity restores recovery", () => {
    const { state, metal } = wrap(start(), P1);
    const identity = identityOf(state, P1);
    // Surgery: Wrapped in Metal is discarded.
    const discarded: GameState = {
      ...state,
      instances: {
        ...state.instances,
        [metal]: { ...mustInstance(state, metal), attachedTo: null },
        [identity]: { ...mustInstance(state, identity), attachments: [] },
      },
    };
    const { state: after } = run(discarded, [recover(P1)]);
    expect(mustInstance(after, identity)).toMatchObject({ damage: 1, exhausted: true });
  });
});
