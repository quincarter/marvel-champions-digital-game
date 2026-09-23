/**
 * docs/phase7-wave3.md §3.45: a defeated card's destination, redirected — `EffectSpec setDefeatDestination` from an
 * interrupt, `RuleSpec defeatDestination` as a constant (the general form of Time Portal's `defeatedIntoEncounterDeck`),
 * and `characterDefeated.fromAttack` for "defeated by an attack". Synthetic cards shaped like Regroup (`drax` 19032):
 * "Interrupt: When an ally is defeated by an enemy attack, return it to its owner's hand instead of discarding it."
 *
 * Sources: RRG 1.8 "Defeat" (p. 15): a defeated ally is discarded — the card replaces only that discard, so the ally is
 * still defeated. RRG 1.8 "Attack (Enemy Activation)" (p. 8) and "Defend, Defense" (p. 16): a defending ally takes the
 * attack's damage.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport, stubTreachery } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const REGROUP_INTERRUPT = stubAbility("regroup.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: false,
    on: {
      on: "characterDefeated",
      targetIs: { categories: ["ally"] },
      sourceIs: { categories: ["enemy"] },
      fromAttack: true,
    },
  },
  effects: [{ kind: "setDefeatDestination", to: "hand" }],
});
const REGROUP = stubSupport({ id: "regroup", cost: 0, abilities: [REGROUP_INTERRUPT.ref] });
/** "Grunts go back into the encounter deck": the constant form, on a minion. */
const RECYCLE_RULE = stubAbility("recycle.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "defeatDestination", target: { name: "grunt" }, to: "encounterDeckShuffle" }],
  },
  effects: [],
});
const RECYCLE = stubSupport({ id: "recycle", cost: 0, abilities: [RECYCLE_RULE.ref] });
const RECRUIT = stubAlly({ id: "recruit", cost: 0, atk: 3, thw: 1, hp: 2 });
const GRUNT = stubMinion({ id: "grunt", atk: 0, sch: 0, hp: 2 });
const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [
    { kind: "dealDamage", target: { kind: "each", query: { name: "recruit" } }, amount: { kind: "const", value: 5 } },
  ],
});
const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });
const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });

const deps: EngineDeps = depsOf(REGROUP_INTERRUPT, RECYCLE_RULE, ZAP_ACTION);
const CARDS = [REGROUP, RECYCLE, RECRUIT, GRUNT, ZAP, BLANK];
const DECK: readonly CardId[] = [REGROUP.id, RECYCLE.id, RECRUIT.id, ZAP.id];
const ENCOUNTER: readonly CardId[] = [GRUNT.id, ...copiesOf(BLANK.id, 12)];

interface Table {
  readonly state: GameState;
  readonly recruit: InstanceId;
}

/** p1 in hero form with Regroup's shape and the 2-hit-point ally in play. */
function table(): Table {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK, encounter: ENCOUNTER });
  const hero: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const regroup = playerCardIntoPlay(hero, REGROUP.id);
  const recruit = playerCardIntoPlay(regroup.state, RECRUIT.id);
  return { state: recruit.state, recruit: recruit.id };
}

/** Defends the villain's attack with the ally; takes (or declines) every optional interrupt. */
const picker =
  (ally: InstanceId, useInterrupts: boolean) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "declareDefender") {
      const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally);
      return defend ? [defend.optionId] : ["decline"];
    }
    if (choice?.prompt.kind === "chooseTriggers") return useInterrupts ? choice.options.map((o) => o.optionId) : [];
    return defaultPick(state);
  };

const defeated = (events: readonly GameEvent[], id: InstanceId): boolean =>
  events.some((e) => e.type === "characterDefeated" && e.instanceId === id);

function villainPhase(t: Table, useInterrupts: boolean) {
  const endTurn: Command = { type: "endTurn", playerId: P1 };
  return runCommandsPicking(t.state, deps, picker(t.recruit, useInterrupts), endTurn);
}

describe("§3.45 a defeat's destination", () => {
  it("an ally defeated by an enemy attack returns to its owner's hand — and is still defeated", () => {
    const t = table();
    const { state, events, session } = villainPhase(t, true);
    expect(defeated(events, t.recruit)).toBe(true);
    expect(mustPlayer(state, P1).hand).toContain(t.recruit);
    expect(mustPlayer(state, P1).discard).not.toContain(t.recruit);
    // Leaving play clears it (RRG 1.8 "Leaves Play").
    expect(mustInstance(state, t.recruit).damage).toBe(0);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("declined, the ally is discarded as usual", () => {
    const t = table();
    const { state, events } = villainPhase(t, false);
    expect(defeated(events, t.recruit)).toBe(true);
    expect(mustPlayer(state, P1).discard).toContain(t.recruit);
  });

  it("an ally defeated by something other than an enemy attack is not offered the interrupt", () => {
    const t = table();
    const given = giveCard(t.state, P1, ZAP.id);
    const { state, events } = runCommandsPicking(given.state, deps, picker(t.recruit, true), {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    expect(defeated(events, t.recruit)).toBe(true);
    expect(mustPlayer(state, P1).discard).toContain(t.recruit);
    expect(events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers")).toBe(false);
  });

  it("a constant defeatDestination redirects a defeated minion (the general form of Time Portal's rule)", () => {
    const t = table();
    const recycle = playerCardIntoPlay(t.state, RECYCLE.id);
    const grunt = minionEngagedWith(recycle.state, GRUNT.id);
    const { state, events } = runCommandsPicking(grunt.state, deps, picker(t.recruit, false), {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: t.recruit,
      targetInstanceId: grunt.id,
    });
    expect(defeated(events, grunt.id)).toBe(true);
    expect(activeEncounterDeck(state).deck).toContain(grunt.id);
    expect(activeEncounterDeck(state).discard).not.toContain(grunt.id);
  });
});
