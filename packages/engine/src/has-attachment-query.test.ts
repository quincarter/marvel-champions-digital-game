/**
 * docs/phase7-wave3.md §3.40: `TargetQuery.hasAttachment`, "a character that has an attachment matching X" — the other
 * direction of `host`. Synthetic cards shaped like Target Practice (`stld` 17017): "Interrupt: When an ally with a
 * weapon attachment upgrade makes an attack, discard Target Practice → that ally gets +2 ATK for that attack."
 *
 * The filter is part of the trigger, so the interrupt is never offered (and its cost never paid) for an ally without a
 * weapon: RRG 1.8 "Initiating Abilities" (p. 24) — a triggered ability is only initiated when its triggering condition
 * is met.
 */

import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { explainQuery, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const WEAPON = trait("WEAPON");

const ALLY_WITH_WEAPON: TargetQuery = {
  categories: ["ally"],
  hasAttachment: { categories: ["upgrade"], trait: WEAPON },
};

const PRACTICE_INTERRUPT = stubAbility("practice.interrupt", {
  trigger: { kind: "interrupt", forced: false, on: { on: "attack", sourceIs: ALLY_WITH_WEAPON } },
  cost: { discardSelf: true },
  effects: [
    {
      kind: "modifyStatUntil",
      stat: "atk",
      amount: { kind: "const", value: 2 },
      target: { kind: "eventSource" },
      until: "endOfAttack",
    },
  ],
});
const PRACTICE = stubSupport({ id: "practice", cost: 0, abilities: [PRACTICE_INTERRUPT.ref] });
const GUNNER = stubAlly({ id: "gunner", cost: 0, atk: 1, thw: 1, hp: 4 });
const BRAWLER = stubAlly({ id: "brawler", cost: 0, atk: 1, thw: 1, hp: 4 });
const BLASTER = stubUpgrade({ id: "blaster", cost: 0, traits: [WEAPON] });
const TRINKET = stubUpgrade({ id: "trinket", cost: 0 });

const deps: EngineDeps = depsOf(PRACTICE_INTERRUPT);
const CARDS = [PRACTICE, GUNNER, BRAWLER, BLASTER, TRINKET];
const DECK: readonly CardId[] = CARDS.map((card) => card.id);

/** Attaches `upgrade` (already in play) to `host` (surgery). */
function attach(state: GameState, upgrade: InstanceId, host: InstanceId): GameState {
  return {
    ...state,
    instances: {
      ...state.instances,
      [host]: { ...mustInstance(state, host), attachments: [...mustInstance(state, host).attachments, upgrade] },
      [upgrade]: { ...mustInstance(state, upgrade), attachedTo: host },
    },
  };
}

interface Table {
  readonly state: GameState;
  readonly gunner: InstanceId;
  readonly brawler: InstanceId;
  readonly practice: InstanceId;
}

/** Gunner carries the Weapon upgrade, Brawler a non-Weapon one; Target Practice's shape is in play. */
function table(): Table {
  let state = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK });
  const put = (card: CardId): InstanceId => {
    const placed = playerCardIntoPlay(state, card);
    state = placed.state;
    return placed.id;
  };
  const practice = put(PRACTICE.id);
  const gunner = put(GUNNER.id);
  const brawler = put(BRAWLER.id);
  state = attach(state, put(BLASTER.id), gunner);
  state = attach(state, put(TRINKET.id), brawler);
  return { state, gunner, brawler, practice };
}

const acceptTriggers = (state: GameState): readonly string[] => {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
  return defaultPick(state);
};

const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

function attackWith(t: Table, attacker: InstanceId) {
  return runCommandsPicking(t.state, deps, acceptTriggers, {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: attacker,
    targetInstanceId: t.state.villains[0]!.instanceId,
  });
}

describe("§3.40 TargetQuery.hasAttachment", () => {
  it("matches a card with a matching attachment and says why another does not", () => {
    const t = table();
    const context: EffectContext = { selfInstanceId: t.practice, controllerId: P1, event: null, bindings: {}, deps };
    expect(explainQuery(t.state, t.gunner, ALLY_WITH_WEAPON, context)).toBeNull();
    expect(explainQuery(t.state, t.brawler, ALLY_WITH_WEAPON, context)).toBe("missingAttachment");
    const identity = mustPlayer(t.state, P1).identity.instanceId;
    expect(explainQuery(t.state, identity, { hasAttachment: {} }, context)).toBe("missingAttachment");
  });

  it("an ally with a Weapon attachment triggers the interrupt: +2 ATK for that attack, and the support is discarded", () => {
    const t = table();
    const { state, session } = attackWith(t, t.gunner);
    expect(villainDamage(state)).toBe(3);
    expect(mustPlayer(state, P1).discard).toContain(t.practice);
    // "For that attack": gone once the attack ends.
    expect(state.lastingEffects).toEqual([]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an ally whose only attachment is not a Weapon is never offered the interrupt", () => {
    const t = table();
    const { state, events } = attackWith(t, t.brawler);
    expect(villainDamage(state)).toBe(1);
    expect(mustPlayer(state, P1).playArea).toContain(t.practice);
    expect(events.some((e) => e.type === "choiceRequested" && e.choice.prompt.kind === "chooseTriggers")).toBe(false);
  });
});
