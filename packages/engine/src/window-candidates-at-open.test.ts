/**
 * docs/phase7-wave6.md §3.79: a timing window's candidates are fixed as it opens. Synthetic cards shaped like
 * Shadowcat's mass form upgrade (Solid / Phased, `mut_gen` 32031a/b): one double-sided card whose front ("Alpha") has
 * an optional response and whose back ("Beta") has a forced response to the same occurrence that flips it back.
 *
 * RRG 1.8 "Response" (p. 38): "Response abilities may be resolved after the specified triggering condition occurs";
 * "Triggering Condition" (p. 45): "a specific occurrence that takes place in the game"; "Ability" (p. 5, Simultaneous
 * Timing Priority): forced responses before responses *to the same triggering condition*. An ability that only came
 * into play (or only matched) while the forced tier resolved did not answer that occurrence, so it is not offered in
 * the same window. One whose condition the occurrence met is still offered, unless the forced tier left it unable to
 * be initiated (RRG 1.8 "Initiating Abilities", p. 24): here, its card flipped and the ability is gone.
 *
 * Also `EventPattern.subjectIs` (the DSL's `on.youAttackOrDefend()`): "after you attack or defend" hears the
 * identity's attack, not an ally's.
 */

import { unerrataedText, type CardId, type KeywordInstance, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps, EventPattern } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { defaultPick, giveCard } from "./testing/scenario.js";

const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const count = (counterType: string): EffectSpec => ({ kind: "addCounters", target: self, counterType, amount: one });
const flipMass: EffectSpec = { kind: "changeAdditionalForm", player: { kind: "controller" }, formType: "mass" };
const toBeta: EffectSpec = { ...flipMass, toName: "Beta" } as EffectSpec;
const ability = (id: string, forced: boolean, on: EventPattern, effects: readonly EffectSpec[]): StubAbility =>
  stubAbility(id, { trigger: { kind: "response", forced, on }, effects } satisfies AbilityDefinition);

const YOU_PLAY: EventPattern = { on: "cardPlayed", playerIs: "controller" };
/** Alpha: "Response: After you play a card, …" (Solid's optional flip, as a counter). */
const ALPHA_HEARS = ability("alpha.hears", false, YOU_PLAY, [count("alphaHeard")]);
/** Beta: "Forced Response: After you play a card, flip this card" (Phased's forced flip back). */
const BETA_FLIPS = ability("beta.flips", true, YOU_PLAY, [flipMass]);

const MASS_KEYWORDS: readonly KeywordInstance[] = [{ name: "form", formType: "mass" }, { name: "permanent" }];
const MASS: UpgradeCard = {
  ...stubUpgrade({ id: "mass", cost: 0, keywords: MASS_KEYWORDS, abilities: [ALPHA_HEARS.ref] }),
  name: "Alpha",
  flipSide: {
    name: "Beta",
    traits: [],
    keywords: MASS_KEYWORDS,
    text: unerrataedText("Mass form. Permanent."),
    abilities: [BETA_FLIPS.ref],
  },
};

/** "Forced Response: After you play a card, flip your mass form card" on a support: takes Alpha's ability away. */
const FLIPPER_ABILITY = ability("flipper.flips", true, YOU_PLAY, [flipMass]);
const FLIPPER = stubSupport({ id: "flipper", cost: 0, abilities: [FLIPPER_ABILITY.ref] });

/** "(Forced) Response: After your mass form becomes Beta, …": the forced one flips it back to Alpha. */
const BECAME_BETA: EventPattern = { on: "formChanged", playerIs: "controller", targetIs: { name: "Beta" } };
const SAW_BETA = ability("watcher.saw-beta", false, BECAME_BETA, [count("sawBeta")]);
const UNDO_BETA = ability("undoer.undo-beta", true, BECAME_BETA, [flipMass]);
const WATCHER = stubSupport({ id: "watcher", cost: 0, abilities: [SAW_BETA.ref] });
const UNDOER = stubSupport({ id: "undoer", cost: 0, abilities: [UNDO_BETA.ref] });

/** "Forced Response: After you attack or defend, …", with "you" your identity (`on.youAttackOrDefend()`). */
const YOU_ATTACK_OR_DEFEND = ability(
  "listener.you",
  true,
  { on: ["attack", "defended"], playerIs: "controller", subjectIs: { categories: ["identity"], controller: "you" } },
  [count("heard")],
);
const LISTENER = stubSupport({ id: "listener", cost: 0, abilities: [YOU_ATTACK_OR_DEFEND.ref] });
const FRIEND = stubAlly({ id: "friend", cost: 0, atk: 1, thw: 1, hp: 3 });

const pingAbility = stubAbility("ping.action", { trigger: { kind: "action" }, effects: [] });
const PING = stubEvent({ id: "ping", cost: 0, abilities: [pingAbility.ref] });
const toBetaAbility = stubAbility("to-beta.action", { trigger: { kind: "action" }, effects: [toBeta] });
const TO_BETA = stubEvent({ id: "to-beta", cost: 0, abilities: [toBetaAbility.ref] });

const deps: EngineDeps = depsOf(
  ALPHA_HEARS,
  BETA_FLIPS,
  FLIPPER_ABILITY,
  SAW_BETA,
  UNDO_BETA,
  YOU_ATTACK_OR_DEFEND,
  pingAbility,
  toBetaAbility,
);

/** A game with the mass card in play (Alpha up, or Beta by flipping it), plus `extras` in play. */
function start(opts: { readonly beta?: boolean; readonly extras?: readonly CardId[] } = {}) {
  const extras = opts.extras ?? [];
  const base = gameAtFirstTurn({
    cards: [MASS, FLIPPER, WATCHER, UNDOER, LISTENER, FRIEND, PING, TO_BETA],
    deps,
    deck: [MASS.id, FLIPPER.id, WATCHER.id, UNDOER.id, LISTENER.id, FRIEND.id, PING.id, PING.id, TO_BETA.id],
  });
  const mass = playerCardIntoPlay(base, MASS.id);
  let state = mass.state;
  const ids: Record<string, InstanceId> = {};
  for (const extra of extras) {
    const placed = playerCardIntoPlay(state, extra);
    state = placed.state;
    ids[extra] = placed.id;
  }
  if (opts.beta) {
    state = {
      ...state,
      instances: { ...state.instances, [mass.id]: { ...mustInstance(state, mass.id), flipped: true } },
    };
  }
  return { state, mass: mass.id, ids };
}

/** Plays `card` for 0, accepting every optional ability offered, and records each option offered. */
function play(state: GameState, card: string) {
  const given = giveCard(state, P1, card);
  const offered: string[] = [];
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    (current) => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(current);
      offered.push(...choice.options.map((option) => option.optionId));
      return choice.options.map((option) => option.optionId);
    },
  );
  return { session, state: session.state, events, offered };
}

const counter = (state: GameState, id: InstanceId, type: string): number => mustInstance(state, id).counters[type] ?? 0;
const isBeta = (state: GameState, mass: InstanceId): boolean => mustInstance(state, mass).flipped === true;

describe("§3.79 a window's candidates are fixed as it opens", () => {
  it("an optional ability turned faceup by the window's own forced tier is not offered for that occurrence", () => {
    const { state, mass } = start({ beta: true });
    const after = play(state, PING.id);
    expect(isBeta(after.state, mass)).toBe(false); // Beta's forced response flipped it to Alpha
    expect(after.offered).toEqual([]);
    expect(counter(after.state, mass, "alphaHeard")).toBe(0);
    // The next occurrence is Alpha's: offered, and heard.
    const next = play(after.state, PING.id);
    expect(next.offered).toEqual([`${mass}:alpha.hears`]);
    expect(counter(next.state, mass, "alphaHeard")).toBe(1);
    expect(isBeta(next.state, mass)).toBe(false);
  });

  it("nor is a forced ability: the forced tier is read once, at open", () => {
    // A support flips Alpha to Beta during the forced tier; Beta's own forced flip did not hear this play.
    const { state, mass } = start({ extras: [FLIPPER.id] });
    const after = play(state, PING.id);
    expect(isBeta(after.state, mass)).toBe(true);
    // And Alpha's optional, gathered at open, is gone with its face (it can no longer be initiated).
    expect(after.offered).toEqual([]);
    expect(counter(after.state, mass, "alphaHeard")).toBe(0);
  });

  it("an optional ability whose condition the occurrence met is offered even after a forced one undid that state", () => {
    const { state, mass, ids } = start({ extras: [WATCHER.id, UNDOER.id] });
    const watcher = ids[WATCHER.id];
    if (!watcher) throw new Error("no watcher");
    const after = play(state, TO_BETA.id);
    expect(isBeta(after.state, mass)).toBe(false); // changed to Beta, then the forced response changed it back
    expect(after.offered).toContain(`${watcher}:watcher.saw-beta`);
    expect(counter(after.state, watcher, "sawBeta")).toBe(1);
  });

  it("replays deep-equal", () => {
    const { state } = start({ beta: true, extras: [WATCHER.id, UNDOER.id] });
    const first = play(state, PING.id).state;
    const { session } = play(first, TO_BETA.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.79 EventPattern.subjectIs: after you (your identity) attack or defend", () => {
  it("hears your identity's attack but not your ally's", () => {
    const { state, ids } = start({ extras: [LISTENER.id, FRIEND.id] });
    const listener = ids[LISTENER.id];
    const friend = ids[FRIEND.id];
    if (!listener || !friend) throw new Error("missing card");
    const identity = mustPlayer(state, P1).identity;
    const commands = [
      ...(identity.form === "hero" ? [] : [{ type: "changeForm", playerId: P1 } as const]),
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: friend,
        targetInstanceId: activeVillain(state).instanceId,
      } as const,
    ];
    const allyAttacked = driveSession(startSession(state), deps, commands).session.state;
    expect(counter(allyAttacked, listener, "heard")).toBe(0);
    const heroAttacked = driveSession(startSession(allyAttacked), deps, [
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: identity.instanceId,
        targetInstanceId: activeVillain(state).instanceId,
      },
    ]).session.state;
    expect(counter(heroAttacked, listener, "heard")).toBe(1);
  });
});
