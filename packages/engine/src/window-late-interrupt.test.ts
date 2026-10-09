/**
 * An interrupt window offers an optional interrupt that was listening as the window opened once its condition is
 * completed while the window is still open (`Frame<"window">.heardAtOpen`). Synthetic cards shaped like "Interrupt:
 * When you make a basic attack, put a mark on the enemy" and "Interrupt: When you make a basic attack against a marked
 * enemy, …": the second is not playable as the window opens and is after the first resolves.
 *
 * Sources: RRG 1.8 "Interrupt" (p. 25): an interrupt resolves "immediately before that triggering condition resolves",
 * so the condition is still imminent while the window is open; "Initiating Abilities" (p. 24): an ability is checked as
 * it is initiated. docs/phase7-wave6.md §3.79 stands for an ability that was not live as the window opened, and for
 * response windows, whose occurrence is over.
 */
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EventPattern } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const MARKED = { categories: ["enemy"], hasCounter: "mark" } as const;
const YOUR_BASIC_ATTACK: EventPattern = {
  on: "attack",
  playerIs: "controller",
  attackKind: "basic",
  sourceIs: { categories: ["identity"], controller: "you" },
};
const interrupt = (id: string, on: EventPattern, effects: readonly EffectSpec[], forced = false) =>
  stubAbility(id, { trigger: { kind: "interrupt", forced, on }, effects } satisfies AbilityDefinition);
const response = (id: string, on: EventPattern, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "response", forced: false, on }, effects } satisfies AbilityDefinition);
const mark: EffectSpec = { kind: "addCounters", target: { kind: "eventTarget" }, counterType: "mark", amount: one };
const tally = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: { kind: "identityOf", player: { kind: "controller" } },
  counterType,
  amount: one,
});

/** "Interrupt: When you make a basic attack, put a mark on that enemy." */
const TAGGER_INTERRUPT = interrupt("tagger.interrupt", YOUR_BASIC_ATTACK, [mark]);
const TAGGER = stubSupport({ id: "tagger", cost: 0, abilities: [TAGGER_INTERRUPT.ref] });
/** The same, forced. */
const BRAND_INTERRUPT = interrupt("brand.forced-interrupt", YOUR_BASIC_ATTACK, [mark], true);
const BRAND = stubSupport({ id: "brand", cost: 0, abilities: [BRAND_INTERRUPT.ref] });
/** An event: "Interrupt: When you make a basic attack against a marked enemy, …". */
const POUNCE_INTERRUPT = interrupt("pounce.interrupt", { ...YOUR_BASIC_ATTACK, targetIs: MARKED }, [tally("pounced")]);
const POUNCE = stubEvent({ id: "pounce", cost: 0, abilities: [POUNCE_INTERRUPT.ref] });
/** The same on a card in play. */
const STALK_INTERRUPT = interrupt("stalk.interrupt", { ...YOUR_BASIC_ATTACK, targetIs: MARKED }, [tally("stalked")]);
const STALK = stubSupport({ id: "stalk", cost: 0, abilities: [STALK_INTERRUPT.ref] });
/** "Response: After you make a basic attack, put a mark on that enemy" and one that needs the mark. */
const AFTER_TAG = response("after-tag.response", YOUR_BASIC_ATTACK, [mark]);
const AFTER_TAGGER = stubSupport({ id: "after-tagger", cost: 0, abilities: [AFTER_TAG.ref] });
const AFTER_STALK = response("after-stalk.response", { ...YOUR_BASIC_ATTACK, targetIs: MARKED }, [
  tally("afterStalked"),
]);
const AFTER_STALKER = stubSupport({ id: "after-stalker", cost: 0, abilities: [AFTER_STALK.ref] });
const BRUTE = stubMinion({ id: "brute", atk: 1, sch: 1, hp: 9 });

const CARDS = [TAGGER, BRAND, POUNCE, STALK, AFTER_TAGGER, AFTER_STALKER, BRUTE];
const deps = depsOf(TAGGER_INTERRUPT, BRAND_INTERRUPT, POUNCE_INTERRUPT, STALK_INTERRUPT, AFTER_TAG, AFTER_STALK);

/** Hero form, the minion engaged, these supports in play; `pounce` puts the event in hand. */
function table(supports: readonly { readonly id: string }[], pounce = false) {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    deck: CARDS.filter((card) => card !== BRUTE).map((card) => card.id),
    encounter: [BRUTE.id],
  });
  state = { ...state, players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })) };
  for (const card of supports) state = playerCardIntoPlay(state, card.id as never).state;
  const brute = minionEngagedWith(state, BRUTE.id);
  state = brute.state;
  const event = pounce ? giveCard(state, P1, POUNCE.id) : null;
  return { state: event?.state ?? state, brute: brute.id, pounce: event?.id ?? null };
}

/** Makes the basic attack, taking every trigger offered unless `decline` names it; records each offer round. */
function attack(state: GameState, target: InstanceId, decline: readonly string[] = []) {
  const rounds: { readonly timing: string; readonly abilities: readonly string[] }[] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(current);
    const abilities = choice.options.map((o) => (o.ref.kind === "ability" ? String(o.ref.abilityId) : o.optionId));
    rounds.push({ timing: choice.prompt.timing, abilities });
    return choice.options
      .filter((o) => !(o.ref.kind === "ability" && decline.includes(String(o.ref.abilityId))))
      .map((o) => o.optionId);
  };
  const command: Command = {
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: mustPlayer(state, P1).identity.instanceId,
    targetInstanceId: target,
  };
  const { session } = driveSession(startSession(state), deps, [command], pick);
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  const counters = mustInstance(session.state, mustPlayer(session.state, P1).identity.instanceId).counters;
  return { state: session.state, rounds, counters };
}

describe("an interrupt window offers a listener once its condition is completed", () => {
  it("an event in hand: not offered as the window opens, offered after the interrupt that marks the enemy resolves", () => {
    const t = table([TAGGER], true);
    const run = attack(t.state, t.brute);
    expect(run.rounds).toEqual([
      { timing: "interrupt", abilities: ["tagger.interrupt"] },
      { timing: "interrupt", abilities: ["pounce.interrupt"] },
    ]);
    expect(run.counters.pounced).toBe(1);
    expect(mustPlayer(run.state, P1).hand).not.toContain(t.pounce);
  });

  it("the same for an ability on a card in play", () => {
    const t = table([TAGGER, STALK]);
    const run = attack(t.state, t.brute);
    expect(run.rounds.map((round) => round.abilities)).toEqual([["tagger.interrupt"], ["stalk.interrupt"]]);
    expect(run.counters.stalked).toBe(1);
  });

  it("nothing completed its condition: the first interrupt declined, the listener is never offered", () => {
    const t = table([TAGGER, STALK]);
    const run = attack(t.state, t.brute, ["tagger.interrupt"]);
    expect(run.rounds.map((round) => round.abilities)).toEqual([["tagger.interrupt"]]);
    expect(run.counters.stalked).toBeUndefined();
  });

  it("a forced interrupt that completes it: the listener joins the optional round", () => {
    const t = table([BRAND, STALK]);
    const run = attack(t.state, t.brute);
    expect(run.rounds.map((round) => round.abilities)).toEqual([["stalk.interrupt"]]);
    expect(run.counters.stalked).toBe(1);
  });

  it("offered once: declined in its late round, it is not asked again", () => {
    const t = table([TAGGER, STALK]);
    const run = attack(t.state, t.brute, ["stalk.interrupt"]);
    expect(run.rounds.map((round) => round.abilities)).toEqual([["tagger.interrupt"], ["stalk.interrupt"]]);
    expect(run.counters.stalked).toBeUndefined();
  });

  it("a response window is unchanged: its occurrence is over, so a response completed by another is not offered", () => {
    const t = table([AFTER_TAGGER, AFTER_STALKER]);
    const run = attack(t.state, t.brute);
    expect(run.rounds).toEqual([{ timing: "response", abilities: ["after-tag.response"] }]);
    expect(run.counters.afterStalked).toBeUndefined();
  });
});
