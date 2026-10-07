/**
 * `AbilityCost.resourcesEqualTo` on a triggered ability reads the event the ability answers: synthetic cards shaped
 * like Head of Steam (`next_evol` 40123: "Hero Response: After Juggernaut attacks you, spend 1 resource for each
 * damage dealt by that attack → discard this card"), in play and as an event played from hand.
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): the triggering condition is met before the cost is determined
 * (step 3) and paid (step 5); "Cost" (p. 13): a cost that cannot be paid in full means the ability cannot be
 * initiated.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, characterProfile, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard, giveCards, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

/** "1 resource for each damage dealt by that attack." */
const DAMAGE_DEALT: ValueSpec = { kind: "eventResult", key: "damage" };
/** "Deal 10 damage to the villain, plus the resources spent this way": a mark that the ability resolved, and with what X. */
const MARK: EffectSpec = {
  kind: "dealDamage",
  target: { kind: "villain" },
  amount: {
    kind: "sum",
    values: [
      { kind: "var", name: "cost.resources" },
      { kind: "const", value: 10 },
    ],
  },
};
const AFTER_YOU_ATTACK = { on: "attack", playerIs: "controller" } as const;

/** "Response: After you attack, spend 1 resource for each damage dealt by that attack → …" */
const STEAM_ABILITY = stubAbility("steam.response", {
  trigger: { kind: "response", forced: false, on: AFTER_YOU_ATTACK },
  cost: { resourcesEqualTo: DAMAGE_DEALT },
  effects: [MARK],
});
const STEAM = stubSupport({ id: "steam", cost: 0, abilities: [STEAM_ABILITY.ref] });
/** The same, forced. */
const FORCED_ABILITY = stubAbility("forced-steam.response", {
  trigger: { kind: "response", forced: true, on: AFTER_YOU_ATTACK },
  cost: { resourcesEqualTo: DAMAGE_DEALT },
  effects: [MARK],
});
const FORCED = stubSupport({ id: "forced-steam", cost: 0, abilities: [FORCED_ABILITY.ref] });
/** The same on an event played from hand, printed cost 1: 1 + X in all. */
const RIPOSTE_ABILITY = stubAbility("riposte.response", {
  trigger: { kind: "response", forced: false, on: AFTER_YOU_ATTACK },
  cost: { resourcesEqualTo: DAMAGE_DEALT },
  effects: [MARK],
});
const RIPOSTE = stubEvent({ id: "riposte", cost: 1, abilities: [RIPOSTE_ABILITY.ref] });

const deps: EngineDeps = depsOf(STEAM_ABILITY, FORCED_ABILITY, RIPOSTE_ABILITY);

interface Table {
  readonly state: GameState;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
  /** The resource cards in hand (1 wild resource each). */
  readonly wilds: readonly InstanceId[];
  /** The card under test: in play, or in hand for the event. */
  readonly card: InstanceId;
}

/** Hero form, `wilds` one-resource cards as the whole hand apart from the event under test, the card placed. */
function table(card: typeof STEAM | typeof FORCED | typeof RIPOSTE, wilds: number): Table {
  const base = gameAtFirstTurn({
    cards: [STEAM, FORCED, RIPOSTE],
    deps,
    deck: [STEAM.id, FORCED.id, RIPOSTE.id, ...copiesOf(RESOURCE.id, 6)],
  });
  const toHero = applyCommand(base, { type: "changeForm", playerId: P1 }, deps);
  if (!toHero.ok) throw new Error(toHero.error.message);
  const placed = card === RIPOSTE ? giveCard(toHero.state, P1, card.id) : playerCardIntoPlay(toHero.state, card.id);
  const given = giveCards(placed.state, P1, ...copiesOf(RESOURCE.id, wilds));
  const keep = [...given.ids, ...(card === RIPOSTE ? [placed.id] : [])];
  const state: GameState = {
    ...given.state,
    players: given.state.players.map((p) =>
      p.playerId === P1
        ? { ...p, hand: keep, deck: [...p.hand, ...p.deck].filter((id) => !keep.includes(id) && id !== placed.id) }
        : p,
    ),
  };
  return {
    state,
    hero: mustPlayer(state, P1).identity.instanceId,
    villain: activeVillain(state).instanceId,
    wilds: given.ids,
    card: placed.id,
  };
}

/** The basic attack, the ability accepted where it is offered, and `pay` resource cards chosen at the payment prompt. */
function attack(at: Table, abilityId: string, pay: number) {
  const prompts: { kind: string; cost?: number; offered?: readonly string[] }[] = [];
  const pick = (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    const prompt = choice.prompt;
    if (prompt.kind === "chooseTriggers") {
      prompts.push({ kind: prompt.kind, offered: choice.options.map((o) => o.optionId.split(":")[1]!) });
      return choice.options.filter((o) => o.optionId.endsWith(`:${abilityId}`)).map((o) => o.optionId);
    }
    if (prompt.kind === "payForAbility" || prompt.kind === "payForCard") {
      prompts.push({ kind: prompt.kind, cost: prompt.cost });
      const wilds = choice.options.filter((o) => at.wilds.some((id) => o.optionId === `hand:${id}`));
      return wilds.slice(0, pay).map((o) => o.optionId);
    }
    return defaultPick(state);
  };
  const command: Command = {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: at.hero,
    targetInstanceId: at.villain,
  };
  const run = runCommandsPicking(at.state, deps, pick, command);
  const spent = at.wilds.filter((id) => mustPlayer(run.state, P1).discard.includes(id)).length;
  return { ...run, prompts, spent, villainDamage: mustInstance(run.state, at.villain).damage };
}
const offered = (prompts: readonly { kind: string; offered?: readonly string[] }[], abilityId: string) =>
  prompts.some((p) => p.kind === "chooseTriggers" && p.offered?.includes(abilityId));
const attackDamage = (events: readonly GameEvent[], villain: InstanceId) =>
  events
    .filter((e): e is Extract<GameEvent, { type: "damageDealt" }> => e.type === "damageDealt")
    .filter((e) => e.targetInstanceId === villain)
    .map((e) => e.amount);

describe("`resourcesEqualTo` on a response in play: X is read from the attack the response answers", () => {
  it("the fixture's hero attacks for 2", () => {
    const at = table(STEAM, 0);
    expect(characterProfile(at.state, at.hero, deps)!.atk).toBe(2);
  });

  it("an attack that dealt 2 asks for 2 resources; paying 2 resolves the ability with `cost.resources` = 2", () => {
    const at = table(STEAM, 3);
    const run = attack(at, STEAM_ABILITY.ref.id, 2);
    expect(run.prompts.filter((p) => p.kind === "payForAbility")).toEqual([{ kind: "payForAbility", cost: 2 }]);
    expect(run.spent).toBe(2);
    // The attack's 2, then the mark: 10 + X = 12.
    expect(attackDamage(run.events, at.villain)).toEqual([2, 12]);
    expect(run.villainDamage).toBe(14);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("paying 1 of the 2 is a decline: nothing is spent and the ability does not resolve", () => {
    const at = table(STEAM, 3);
    const run = attack(at, STEAM_ABILITY.ref.id, 1);
    expect(run.prompts.filter((p) => p.kind === "payForAbility")).toEqual([{ kind: "payForAbility", cost: 2 }]);
    expect(run.spent).toBe(0);
    expect(run.villainDamage).toBe(2);
  });

  it("with 1 resource to the player's name the 2-resource cost cannot be paid, so the response is not offered", () => {
    const at = table(STEAM, 1);
    const run = attack(at, STEAM_ABILITY.ref.id, 1);
    expect(offered(run.prompts, STEAM_ABILITY.ref.id)).toBe(false);
    expect(run.prompts.filter((p) => p.kind === "payForAbility")).toEqual([]);
    expect(run.spent).toBe(0);
    expect(run.villainDamage).toBe(2);
  });

  it("an attack that dealt 0 (a tough status card) costs 0: offered with an empty hand, and resolved unpaid", () => {
    const at = table(STEAM, 0);
    const villain = mustInstance(at.state, at.villain);
    const tough: GameState = {
      ...at.state,
      instances: { ...at.state.instances, [at.villain]: { ...villain, statuses: { ...villain.statuses, tough: 1 } } },
    };
    const run = attack({ ...at, state: tough }, STEAM_ABILITY.ref.id, 0);
    expect(offered(run.prompts, STEAM_ABILITY.ref.id)).toBe(true);
    expect(run.prompts.filter((p) => p.kind === "payForAbility")).toEqual([]);
    // Only the mark: 10 + 0.
    expect(attackDamage(run.events, at.villain)).toEqual([10]);
    expect(run.villainDamage).toBe(10);
  });

  it("a forced response prices its cost the same way: 2 asked for, 2 paid, the mark is 12", () => {
    const at = table(FORCED, 2);
    const run = attack(at, FORCED_ABILITY.ref.id, 2);
    expect(run.prompts.filter((p) => p.kind === "payForAbility")).toEqual([{ kind: "payForAbility", cost: 2 }]);
    expect(run.spent).toBe(2);
    expect(run.villainDamage).toBe(14);
  });
});

describe("`resourcesEqualTo` on a response event played from hand: printed cost plus X from the attack", () => {
  it("printed cost 1 and an attack that dealt 2: the prompt asks for 3, and 3 resources play it", () => {
    const at = table(RIPOSTE, 3);
    const run = attack(at, RIPOSTE_ABILITY.ref.id, 3);
    expect(run.prompts.filter((p) => p.kind === "payForCard")).toEqual([{ kind: "payForCard", cost: 3 }]);
    expect(run.spent).toBe(3);
    expect(mustPlayer(run.state, P1).discard).toContain(at.card);
    expect(attackDamage(run.events, at.villain)).toEqual([2, 12]);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });

  it("2 resources do not cover 1 + 2: the card stays in hand and nothing is spent", () => {
    const at = table(RIPOSTE, 3);
    const run = attack(at, RIPOSTE_ABILITY.ref.id, 2);
    expect(run.prompts.filter((p) => p.kind === "payForCard")).toEqual([{ kind: "payForCard", cost: 3 }]);
    expect(run.spent).toBe(0);
    expect(mustPlayer(run.state, P1).hand).toContain(at.card);
    expect(run.villainDamage).toBe(2);
  });

  it("with 2 resource cards in hand the 3-resource play cannot be paid, so the event is not offered", () => {
    const at = table(RIPOSTE, 2);
    const run = attack(at, RIPOSTE_ABILITY.ref.id, 2);
    expect(offered(run.prompts, RIPOSTE_ABILITY.ref.id)).toBe(false);
    expect(mustPlayer(run.state, P1).hand).toContain(at.card);
    expect(run.villainDamage).toBe(2);
  });
});
