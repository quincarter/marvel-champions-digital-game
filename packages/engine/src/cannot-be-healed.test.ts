/**
 * docs/phase7-wave6.md §3.12: "cannot be healed (by player card effects)". Synthetic cards shaped like Protect the
 * Senator (`mut_gen` 32065b: "Robert Kelly cannot be healed by player card effects") and Medical Emergency (32071, an
 * encounter card that heals him).
 *
 * Sources: RRG 1.8 "'Cannot'" (p. 11) is absolute; "Heal" (p. 22): moving damage off a character heals it; "Recover"
 * (p. 36). A basic recovery is the identity's own power, so its source is the identity, a player card.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, RuleSpec } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSideScheme, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import {
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const n = (value: number) => ({ kind: "const", value }) as const;
const kelly = { kind: "named", name: "kelly" } as const;
const aide = { kind: "named", name: "aide" } as const;
const ruleCard = (id: string, rule: RuleSpec) => {
  const ability = stubAbility(`${id}.constant`, def({ trigger: { kind: "constant", rules: [rule] }, effects: [] }));
  return { ability, card: stubSideScheme({ id, startingThreat: 5, abilities: [ability.ref] }) };
};

/** Protect the Senator: "kelly cannot be healed by player card effects". */
const SENATOR = ruleCard("senator", { kind: "cannotBeHealed", target: { name: "kelly" }, bySource: "playerCard" });
/** The same, only while a "guard" is in play. */
const GUARDED = ruleCard("guarded", {
  kind: "cannotBeHealed",
  target: { name: "kelly" },
  bySource: "playerCard",
  while: { kind: "exists", query: { name: "guard" } },
});
/** No `bySource`: "kelly cannot be healed". */
const SEALED = ruleCard("sealed", { kind: "cannotBeHealed", target: { name: "kelly" } });
/** "Your identity cannot be healed by player card effects." */
const LOCKED = ruleCard("locked", {
  kind: "cannotBeHealed",
  target: { categories: ["identity"] },
  bySource: "playerCard",
});
/** Medical Emergency's shape, on an encounter card: "Forced Response: after a 'signal' is played, heal 2 from kelly." */
const MEDICAL_RESPONSE = stubAbility(
  "medical.response",
  def({
    trigger: { kind: "response", forced: true, on: { on: "cardPlayed", targetIs: { name: "signal" } } },
    effects: [{ kind: "heal", target: kelly, amount: n(2) }],
  }),
);
const MEDICAL = stubSideScheme({ id: "medical", startingThreat: 5, abilities: [MEDICAL_RESPONSE.ref] });
const GUARD = stubMinion({ id: "guard", atk: 1, sch: 1, hp: 5, boostIcons: 0 });

const MEND_ACTION = stubAbility(
  "mend.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "heal", target: kelly, amount: n(2) }] }),
);
const MEND = stubEvent({ id: "mend", cost: 0, abilities: [MEND_ACTION.ref] });
const MEND_AIDE_ACTION = stubAbility(
  "mendaide.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "heal", target: aide, amount: n(2) }] }),
);
const MEND_AIDE = stubEvent({ id: "mendaide", cost: 0, abilities: [MEND_AIDE_ACTION.ref] });
const SIGNAL_ACTION = stubAbility("signal.action", def({ trigger: { kind: "action" }, effects: [] }));
const SIGNAL = stubEvent({ id: "signal", cost: 0, abilities: [SIGNAL_ACTION.ref] });
const NURSE_ACTION = stubAbility(
  "nurse.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true },
    effects: [{ kind: "heal", target: kelly, amount: n(1) }],
  }),
);
const NURSE = stubAlly({ id: "nurse", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [NURSE_ACTION.ref] });
const KIT_ACTION = stubAbility(
  "kit.action",
  def({
    trigger: { kind: "action" },
    cost: { exhaustSelf: true },
    effects: [{ kind: "heal", target: kelly, amount: n(1) }],
  }),
);
const KIT = stubSupport({ id: "kit", cost: 0, abilities: [KIT_ACTION.ref] });
const KELLY = stubAlly({ id: "kelly", cost: 0, atk: 0, thw: 1, hp: 6 });
const AIDE = stubAlly({ id: "aide", cost: 0, atk: 1, thw: 1, hp: 6 });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps = depsOf(
  SENATOR.ability,
  GUARDED.ability,
  SEALED.ability,
  LOCKED.ability,
  MEDICAL_RESPONSE,
  MEND_ACTION,
  MEND_AIDE_ACTION,
  SIGNAL_ACTION,
  NURSE_ACTION,
  KIT_ACTION,
);
const PLAYER_CARDS: readonly CardId[] = [MEND.id, MEND_AIDE.id, SIGNAL.id, NURSE.id, KIT.id, KELLY.id, AIDE.id];

function damaged(state: GameState, amounts: Readonly<Record<InstanceId, number>>): GameState {
  return {
    ...state,
    instances: {
      ...state.instances,
      ...Object.fromEntries(Object.entries(amounts).map(([id, damage]) => [id, { ...state.instances[id]!, damage }])),
    },
  };
}

/** Kelly and the aide in P1's play area with 3 damage each, and the rule cards `rules` in the villain's area. */
function start(...rules: readonly CardId[]) {
  let state = gameAtFirstTurn({
    cards: [
      SENATOR.card,
      GUARDED.card,
      SEALED.card,
      LOCKED.card,
      MEDICAL,
      GUARD,
      MEND,
      MEND_AIDE,
      SIGNAL,
      NURSE,
      KIT,
      KELLY,
      AIDE,
      BLANK,
    ],
    deps,
    deck: PLAYER_CARDS,
    encounter: [SENATOR.card.id, GUARDED.card.id, SEALED.card.id, LOCKED.card.id, MEDICAL.id, GUARD.id],
  });
  for (const rule of rules) state = encounterCardInVillainArea(state, rule, 5).state;
  const k = playerCardIntoPlay(state, KELLY.id);
  const a = playerCardIntoPlay(k.state, AIDE.id);
  return { state: damaged(a.state, { [k.id]: 3, [a.id]: 3 }), kelly: k.id, aide: a.id };
}

function play(state: GameState, card: CardId) {
  const given = giveCard(state, P1, card);
  return run(given.state, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  ]);
}
function use(state: GameState, card: CardId, abilityId: (typeof NURSE_ACTION)["ref"]["id"]) {
  const placed = playerCardIntoPlay(state, card);
  return run(placed.state, [{ type: "useAbility", playerId: P1, cardInstanceId: placed.id, abilityId, payment: [] }]);
}
function run(state: GameState, commands: readonly Command[]) {
  const driven = driveSession(startSession(state), deps, commands);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
const damageOf = (state: GameState, id: InstanceId) => mustInstance(state, id).damage;

describe("§3.12 'cannot be healed by player card effects' (Protect the Senator)", () => {
  it("a player event's heal heals 0 and logs healBlocked", () => {
    const game = start(SENATOR.card.id);
    const { state, events } = play(game.state, MEND.id);
    expect(damageOf(state, game.kelly)).toBe(3);
    const blocked = events.flatMap((e) => (e.type === "healBlocked" ? [e] : []));
    expect(blocked).toEqual([
      { type: "healBlocked", targetInstanceId: game.kelly, sourceInstanceId: expect.any(String), amount: 2 },
    ]);
    expect(mustInstance(state, blocked[0]!.sourceInstanceId!).cardId).toBe(MEND.id);
    expect(events.some((e) => e.type === "damageHealed")).toBe(false);
  });

  it("an ally's ability and a support's ability heal 0", () => {
    const game = start(SENATOR.card.id);
    const nurse = use(game.state, NURSE.id, NURSE_ACTION.ref.id);
    expect(damageOf(nurse.state, game.kelly)).toBe(3);
    expect(nurse.events.filter((e) => e.type === "healBlocked")).toHaveLength(1);
    const kit = use(nurse.state, KIT.id, KIT_ACTION.ref.id);
    expect(damageOf(kit.state, game.kelly)).toBe(3);
    expect(kit.events.filter((e) => e.type === "healBlocked")).toHaveLength(1);
  });

  it("an encounter card's heal still heals him", () => {
    const game = start(SENATOR.card.id, MEDICAL.id);
    const { state, events } = play(game.state, SIGNAL.id);
    expect(damageOf(state, game.kelly)).toBe(1);
    expect(events.filter((e) => e.type === "damageHealed")).toEqual([
      { type: "damageHealed", targetInstanceId: game.kelly, amount: 2 },
    ]);
    expect(events.some((e) => e.type === "healBlocked")).toBe(false);
  });

  it("a card the rule doesn't match heals normally", () => {
    const game = start(SENATOR.card.id);
    const { state, events } = play(game.state, MEND_AIDE.id);
    expect(damageOf(state, game.aide)).toBe(1);
    expect(damageOf(state, game.kelly)).toBe(3);
    expect(events.some((e) => e.type === "healBlocked")).toBe(false);
  });

  it("the rule's `while` ending lifts it", () => {
    const game = start(GUARDED.card.id);
    const guard = minionEngagedWith(game.state, GUARD.id);
    const blocked = play(guard.state, MEND.id);
    expect(damageOf(blocked.state, game.kelly)).toBe(3);
    // Surgery: the guard leaves play.
    const seat = mustPlayer(blocked.state, P1);
    const gone: GameState = {
      ...blocked.state,
      players: blocked.state.players.map((p) =>
        p.playerId === P1 ? { ...p, playArea: seat.playArea.filter((id) => id !== guard.id) } : p,
      ),
    };
    const healed = play(gone, MEND.id);
    expect(damageOf(healed.state, game.kelly)).toBe(1);
    expect(healed.events.some((e) => e.type === "healBlocked")).toBe(false);
  });
});

describe("§3.12 'cannot be healed' (no `bySource`)", () => {
  it("neither a player card nor an encounter card heals him", () => {
    const game = start(SEALED.card.id, MEDICAL.id);
    const { state, events } = play(game.state, SIGNAL.id);
    expect(damageOf(state, game.kelly)).toBe(3);
    expect(events.filter((e) => e.type === "healBlocked")).toEqual([
      { type: "healBlocked", targetInstanceId: game.kelly, sourceInstanceId: expect.any(String), amount: 2 },
    ]);
    expect(damageOf(play(state, MEND.id).state, game.kelly)).toBe(3);
  });
});

describe("§3.12 a basic recovery", () => {
  const identityDamaged = (state: GameState) => damaged(state, { [mustPlayer(state, P1).identity.instanceId]: 4 });

  it("is unaffected by a rule on another card", () => {
    const game = start(SENATOR.card.id);
    const state = identityDamaged(game.state);
    const identity = mustPlayer(state, P1).identity.instanceId;
    expect(mustPlayer(state, P1).identity.form).toBe("alterEgo");
    const { state: after, events } = run(state, [{ type: "basicRecover", playerId: P1 }]);
    // REC 3 (the stub hero).
    expect(damageOf(after, identity)).toBe(1);
    expect(mustInstance(after, identity).exhausted).toBe(true);
    expect(events.some((e) => e.type === "healBlocked")).toBe(false);
  });

  it("on an identity that cannot be healed by player card effects, cannot be used (its source is the identity)", () => {
    const game = start(LOCKED.card.id);
    const state = identityDamaged(game.state);
    const result = applyCommand(state, { type: "basicRecover", playerId: P1 }, deps);
    expect(result.ok ? null : result.error.message).toBe("this identity cannot be healed");
    const identity = mustPlayer(state, P1).identity.instanceId;
    expect(mustInstance(state, identity).exhausted).toBe(false);
    expect(damageOf(state, identity)).toBe(4);
  });
});
