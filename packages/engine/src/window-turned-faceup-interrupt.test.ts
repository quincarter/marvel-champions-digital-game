/**
 * docs/phase7-wave9.md §3.8: an interrupt window offers an optional interrupt on a face its own forced tier turned
 * faceup (`Frame<"window">.facesAtOpen`). Synthetic cards shaped like a suit form upgrade: one double-sided permanent
 * card whose front ("Cover") has nothing to say about an attack and whose back ("Strike") reads "Interrupt: When you
 * attack, remove up to 3 threat from here → this attack deals 1 additional damage for each threat removed this way",
 * with a "Forced Interrupt: When you attack, change to Strike suit form" on another card.
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25): an interrupt "resolves immediately before that triggering condition resolves",
 * so the attack is still to happen once the forced interrupt has turned the face up; "Ability", Simultaneous Timing
 * Priority (p. 5): forced interrupts before interrupts to the same triggering condition. docs/phase7-wave6.md §3.79
 * (its §4.1 Q48) stands for everything else, pinned again here: a response window (its occurrence is over), a card
 * that came into play during the forced tier, and the forced tier itself, which is read once.
 */

import { unerrataedText, type KeywordInstance, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const SELF: TargetRef = { kind: "self" };
const REMOVED = { kind: "var", name: "cost.removeThreat" } as const;
const YOU_ATTACK: EventPattern = {
  on: "attack",
  playerIs: "controller",
  sourceIs: { categories: ["identity"], controller: "you" },
};
const toFace = (toName: string): EffectSpec =>
  ({ kind: "changeAdditionalForm", player: { kind: "controller" }, formType: "suit", toName }) as EffectSpec;
const tally = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "identityOf", player: { kind: "controller" } },
  counterType,
  amount: one,
});
const triggered = (
  id: string,
  kind: "interrupt" | "response",
  forced: boolean,
  effects: readonly EffectSpec[],
  cost?: AbilityDefinition["cost"],
) =>
  stubAbility(id, {
    trigger: { kind, forced, on: YOU_ATTACK },
    ...(cost ? { cost } : {}),
    effects,
  } satisfies AbilityDefinition);

/** Strike: "Interrupt: When you attack, remove up to 3 threat from here → +1 damage for each threat removed." */
const STRIKE_INTERRUPT = triggered(
  "strike.interrupt",
  "interrupt",
  false,
  [{ kind: "modifyAttack", extraDamage: REMOVED } as never],
  { removeThreat: { from: SELF, amount: { choose: { min: 1, max: 3 } } } },
);
/** Strike: "Forced Interrupt: When you attack, …": the forced tier is read once, so this one never hears the flip. */
const STRIKE_FORCED = triggered("strike.forced-interrupt", "interrupt", true, [tally("strikeForced")]);
/** Strike: "Response: After you attack, …": a response on the turned-up face, offered in the attack's response window. */
const STRIKE_RESPONSE = triggered("strike.response", "response", false, [tally("strikeResponse")]);
const SUIT_KEYWORDS: readonly KeywordInstance[] = [{ name: "form", formType: "suit" }, { name: "permanent" }];
const SUIT: UpgradeCard = {
  ...stubUpgrade({ id: "suit", cost: 0, keywords: SUIT_KEYWORDS, abilities: [] }),
  name: "Cover",
  flipSide: {
    name: "Strike",
    traits: [],
    keywords: SUIT_KEYWORDS,
    text: unerrataedText("Suit form. Permanent."),
    abilities: [STRIKE_INTERRUPT.ref, STRIKE_FORCED.ref, STRIKE_RESPONSE.ref],
  },
};

/** "Forced Interrupt: When you attack, change to Strike suit form." */
const BREAK_INTERRUPT = triggered("breaker.forced-interrupt", "interrupt", true, [toFace("Strike")]);
const BREAKER = stubSupport({ id: "breaker", cost: 0, abilities: [BREAK_INTERRUPT.ref] });
/** The same change made by a forced response: the attack is over when Strike turns up. */
const BREAK_RESPONSE = triggered("after-breaker.forced-response", "response", true, [toFace("Strike")]);
const AFTER_BREAKER = stubSupport({ id: "after-breaker", cost: 0, abilities: [BREAK_RESPONSE.ref] });
/** "Forced Interrupt: When you attack, change to Strike suit form. Then, change to Cover suit form." */
const THERE_AND_BACK = triggered("waverer.forced-interrupt", "interrupt", true, [toFace("Strike"), toFace("Cover")]);
const WAVERER = stubSupport({ id: "waverer", cost: 0, abilities: [THERE_AND_BACK.ref] });

/** A support with "Interrupt: When you attack, …", put into play from hand by a forced interrupt to the attack. */
const LATE_INTERRUPT = triggered("latecomer.interrupt", "interrupt", false, [tally("latecomer")]);
const LATECOMER = stubSupport({ id: "latecomer", cost: 0, abilities: [LATE_INTERRUPT.ref] });
const you = { kind: "controller" } as const;
const SUMMON_INTERRUPT = triggered("summoner.forced-interrupt", "interrupt", true, [
  {
    kind: "selectCards",
    slot: "found",
    cards: { kind: "zone", zone: "hand", player: you, filter: { name: LATECOMER.name } },
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: you },
]);
const SUMMONER = stubSupport({ id: "summoner", cost: 0, abilities: [SUMMON_INTERRUPT.ref] });

/** An attack event: "Hero Action (attack): Deal 4 damage to the villain." */
const JAB_ACTION = stubAbility("jab.action", {
  trigger: { kind: "action" },
  label: ["attack"],
  effects: [{ kind: "attack", target: { kind: "villain" }, amount: { kind: "const", value: 4 } }],
} satisfies AbilityDefinition);
const JAB = stubEvent({ id: "jab", cost: 0, abilities: [JAB_ACTION.ref] });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 20 });

const CARDS = [SUIT, BREAKER, AFTER_BREAKER, WAVERER, LATECOMER, SUMMONER, JAB, BRUTE];
const deps = depsOf(
  STRIKE_INTERRUPT,
  STRIKE_FORCED,
  STRIKE_RESPONSE,
  BREAK_INTERRUPT,
  BREAK_RESPONSE,
  THERE_AND_BACK,
  LATE_INTERRUPT,
  SUMMON_INTERRUPT,
  JAB_ACTION,
);

/** Hero form, the minion engaged, the suit in play Cover side up with `threat` on it, and these supports in play. */
function table(supports: readonly { readonly id: string }[], threat = 4) {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: CARDS.filter((card) => card !== BRUTE).map((card) => card.id),
    encounter: [BRUTE.id],
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  const suit = playerCardIntoPlay(state, SUIT.id);
  state = suit.state;
  state = {
    ...state,
    instances: { ...state.instances, [suit.id]: { ...mustInstance(state, suit.id), threat } },
  };
  for (const card of supports) state = playerCardIntoPlay(state, card.id as never).state;
  const brute = minionEngagedWith(state, BRUTE.id);
  return { state: brute.state, brute: brute.id, suit: suit.id };
}

/**
 * Runs `command`, taking every trigger offered unless `decline` names it and answering the cost's number with
 * `remove`; records each offer round.
 */
function run(state: GameState, command: Command, opts: { decline?: readonly string[]; remove?: number } = {}) {
  const rounds: { readonly timing: string; readonly abilities: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind === "chooseNumber") return [String(opts.remove ?? 1)];
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(current);
    const abilities = choice.options.map((o) => (o.ref.kind === "ability" ? String(o.ref.abilityId) : o.optionId));
    rounds.push({ timing: choice.prompt.timing, abilities });
    return choice.options
      .filter((o) => !(o.ref.kind === "ability" && (opts.decline ?? []).includes(String(o.ref.abilityId))))
      .map((o) => o.optionId);
  };
  const { session } = driveSession(startSession(state), deps, [command], pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  const counters = mustInstance(session.state, mustPlayer(session.state, P1).identity.instanceId).counters;
  return { state: session.state, rounds, counters };
}

const basicAttack = (state: GameState, target: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: mustPlayer(state, P1).identity.instanceId,
  targetInstanceId: target,
});
/** The identity's basic attack damage with nothing added: the Cover face up and nothing else in play. */
const atk = (_state: GameState): number => {
  const { state, brute } = table([]);
  return mustInstance(run(state, basicAttack(state, brute)).state, brute).damage;
};
const damageOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).damage;
const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
const isStrike = (state: GameState, suit: InstanceId): boolean => mustInstance(state, suit).flipped === true;
const interrupts = (rounds: readonly { timing: string; abilities: readonly string[] }[]) =>
  rounds.filter((round) => round.timing === "interrupt").map((round) => round.abilities);

describe("§3.8 an interrupt on a face the window's own forced interrupt turned faceup", () => {
  it("a basic attack from Cover with 4 threat: Strike is faceup, its interrupt is offered, 3 removed is +3 damage", () => {
    const { state, brute, suit } = table([BREAKER]);
    const after = run(state, basicAttack(state, brute), { remove: 3 });
    expect(isStrike(after.state, suit)).toBe(true);
    expect(interrupts(after.rounds)).toEqual([["strike.interrupt"]]);
    expect(damageOn(after.state, brute)).toBe(atk(state) + 3);
    expect(threatOn(after.state, suit)).toBe(1);
  });

  it("removing 1 is +1 damage and leaves 3", () => {
    const { state, brute, suit } = table([BREAKER]);
    const after = run(state, basicAttack(state, brute), { remove: 1 });
    expect(damageOn(after.state, brute)).toBe(atk(state) + 1);
    expect(threatOn(after.state, suit)).toBe(3);
  });

  it("declined: the attack deals its own damage and the 4 threat stays", () => {
    const { state, brute, suit } = table([BREAKER]);
    const after = run(state, basicAttack(state, brute), { decline: ["strike.interrupt"] });
    expect(isStrike(after.state, suit)).toBe(true);
    expect(interrupts(after.rounds)).toEqual([["strike.interrupt"]]);
    expect(damageOn(after.state, brute)).toBe(atk(state));
    expect(threatOn(after.state, suit)).toBe(4);
  });

  it("the same for an attack event: 4 + 3 = 7 damage, 1 threat left", () => {
    const { state, suit } = table([BREAKER]);
    const jab = giveCard(state, P1, JAB.id);
    const after = run(
      jab.state,
      { type: "playCard", playerId: P1, cardInstanceId: jab.id, payment: [], attachToInstanceId: null },
      { remove: 3 },
    );
    expect(isStrike(after.state, suit)).toBe(true);
    expect(interrupts(after.rounds)).toEqual([["strike.interrupt"]]);
    expect(damageOn(after.state, activeVillain(after.state).instanceId)).toBe(7);
    expect(threatOn(after.state, suit)).toBe(1);
  });

  it("with 0 threat the face still turns up and its interrupt cannot be paid for: not offered", () => {
    const { state, brute, suit } = table([BREAKER], 0);
    const after = run(state, basicAttack(state, brute));
    expect(isStrike(after.state, suit)).toBe(true);
    expect(interrupts(after.rounds)).toEqual([]);
    expect(damageOn(after.state, brute)).toBe(atk(state));
  });

  it("offered once: the next attack, already in Strike, offers it as any interrupt", () => {
    const { state, brute, suit } = table([BREAKER]);
    const first = run(state, basicAttack(state, brute), { remove: 3 });
    const ready = {
      ...first.state,
      instances: Object.fromEntries(
        Object.entries(first.state.instances).map(([id, instance]) => [id, { ...instance, exhausted: false }]),
      ),
    } as GameState;
    const second = run(ready, basicAttack(ready, brute), { remove: 1 });
    expect(interrupts(second.rounds)).toEqual([["strike.interrupt"]]);
    expect(threatOn(second.state, suit)).toBe(0);
    expect(damageOn(second.state, brute)).toBe(2 * atk(state) + 3 + 1);
  });
});

describe("§3.8 what the at-open rule (wave 6 §3.79) still holds", () => {
  it("the forced tier is read once: a forced interrupt on the turned-up face does not hear this attack", () => {
    const { state, brute } = table([BREAKER]);
    const after = run(state, basicAttack(state, brute), { remove: 1 });
    expect(after.counters.strikeForced ?? 0).toBe(0);
  });

  it("a face turned up and back down by the forced tier offers nothing", () => {
    const { state, brute, suit } = table([WAVERER]);
    const after = run(state, basicAttack(state, brute));
    expect(isStrike(after.state, suit)).toBe(false);
    expect(interrupts(after.rounds)).toEqual([]);
    expect(damageOn(after.state, brute)).toBe(atk(state));
    expect(threatOn(after.state, suit)).toBe(4);
  });

  it("a response window is unchanged: a response on a face its forced response turned up is not offered", () => {
    const { state, brute, suit } = table([AFTER_BREAKER]);
    const after = run(state, basicAttack(state, brute));
    expect(isStrike(after.state, suit)).toBe(true);
    expect(after.rounds).toEqual([]);
    expect(after.counters.strikeResponse ?? 0).toBe(0);
    expect(damageOn(after.state, brute)).toBe(atk(state));
  });

  it("a face turned up in the interrupt window had its response live as the response window opened: offered there", () => {
    const { state, brute } = table([BREAKER]);
    const after = run(state, basicAttack(state, brute), { decline: ["strike.interrupt"] });
    expect(after.rounds.filter((round) => round.timing === "response")).toEqual([
      { timing: "response", abilities: ["strike.response"] },
    ]);
    expect(after.counters.strikeResponse).toBe(1);
  });

  it("a card a forced interrupt put into play is not a turned-up face: its interrupt does not hear this attack", () => {
    const { state, brute } = table([SUMMONER], 0);
    const held = giveCard(state, P1, LATECOMER.id);
    const after = run(held.state, basicAttack(held.state, brute));
    expect(mustPlayer(after.state, P1).hand).not.toContain(held.id);
    expect(interrupts(after.rounds)).toEqual([]);
    expect(after.counters.latecomer ?? 0).toBe(0);
  });
});
