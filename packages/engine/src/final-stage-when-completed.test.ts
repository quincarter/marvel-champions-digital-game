/**
 * The final main scheme stage's "When Completed" abilities resolve before its completion loses the game. RRG 1.8 "When
 * Completed Abilities" (p. 48): "When a main scheme is complete, all 'When Completed' abilities on the card resolve.
 * The 'When Completed' timing trigger is equivalent to the following trigger: 'Forced Interrupt: When this scheme is
 * completed...'"; "Main Scheme" (p. 27): "If the villain completes the final stage of the main scheme deck, the villain
 * wins the game." An interrupt resolves before its triggering condition, so the ability is not skipped by the loss.
 *
 * The card this is for: The Injured Senator 2B (`mut_gen` 32064b), "When Completed: Defeat Robert Kelly. If Robert
 * Kelly leaves play, the players lose the game." (docs/phase7-wave6.md §3.75). Synthetic cards shaped like it: a
 * captive ally attached to the main scheme, or detached and controlled by the first player.
 */

import { flat, type AllyCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAlly, stubEvent, stubMainScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, TREACHERY } from "./testing/scenario.js";
import { copiesOf, P1, playFree } from "./testing/wave3.js";
import { createGame } from "./setup.js";
import { driveSession } from "./testing/drive.js";

const self: TargetRef = { kind: "self" };
const senatorRef: TargetRef = { kind: "named", name: "Senator" };
const notAttached = { kind: "not", of: { kind: "isAttached", of: self } } as const;
const CAPTIVE = stubAbility("senator.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "controlledByFirstPlayer", target: { self: true }, while: notAttached },
      { kind: "excludedFromAllyLimit", target: { self: true }, while: notAttached },
      { kind: "leavingPlayLoses", target: { self: true } },
    ],
  },
  effects: [],
});
const SENATOR: AllyCard = {
  ...stubAlly({ id: "senator", cost: 0, atk: 0, thw: 0, hp: 9, abilities: [CAPTIVE.ref] }),
  name: "Senator",
  unique: true,
};
/** A captive with no rule of its own: the scheme holding it says "If the Witness leaves play, the players lose the game." */
const WITNESS: AllyCard = {
  ...stubAlly({ id: "witness", cost: 0, atk: 0, thw: 0, hp: 9 }),
  name: "Witness",
  unique: true,
};
const witnessRef: TargetRef = { kind: "named", name: "Witness" };
const SETUP_WITNESS = stubAbility("watch.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "witness", cards: { kind: "encounterSetAside", filter: { name: "Witness" } } },
    { kind: "attach", card: { kind: "slot", slot: "witness" }, to: self },
  ],
});
const WATCH = stubAbility("watch.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "leavingPlayLoses", target: { categories: ["ally"], name: "Witness" } }],
  },
  effects: [],
});
/** "The players lose the game.", scripted on a card as an effect. */
const DOOM = stubAbility("doom.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "endGame", result: "loss", reason: "cardAbility" }],
});
const SETUP = stubAbility("scheme.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "senator", cards: { kind: "encounterSetAside", filter: { name: "Senator" } } },
    { kind: "attach", card: { kind: "slot", slot: "senator" }, to: self },
  ],
});
/** "When Completed: Defeat [the Senator]." */
const DEFEAT_SENATOR = stubAbility("scheme.when-completed", {
  trigger: { kind: "whenCompleted" },
  effects: [{ kind: "defeat", target: senatorRef }],
});
/** "When Completed: Deal 1 damage to the villain." */
const LAST_BLOW = stubAbility("blow.when-completed", {
  trigger: { kind: "whenCompleted" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
});
const stage = { startingThreat: flat(0), targetThreat: flat(5), acceleration: flat(0) };
const SCHEMES = {
  defeats: stubMainScheme({
    id: "injured-senator",
    stages: [{ ...stage, aSideAbilities: [SETUP.ref], abilities: [DEFEAT_SENATOR.ref] }],
  }),
  blow: stubMainScheme({ id: "last-blow", stages: [{ ...stage, abilities: [LAST_BLOW.ref] }] }),
  plain: stubMainScheme({ id: "plain", stages: [stage] }),
  holds: stubMainScheme({ id: "holds", stages: [{ ...stage, aSideAbilities: [SETUP.ref] }] }),
  watches: stubMainScheme({
    id: "watches",
    stages: [{ ...stage, aSideAbilities: [SETUP_WITNESS.ref], abilities: [WATCH.ref] }],
  }),
} as const;

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const RESCUE = event("rescue", [{ kind: "detach", card: senatorRef, controller: { kind: "firstPlayer" } }]);
/** Puts the main scheme at its target threat: it completes. */
const ADVANCE = event("advance", [
  { kind: "placeThreat", target: { kind: "mainScheme" }, amount: { kind: "const", value: 5 } },
]);
/** An encounter card's "Defeat [the Senator]", used here from an event. */
const EXECUTE = event("execute", [{ kind: "defeat", target: senatorRef }]);
const SILENCE = event("silence", [{ kind: "defeat", target: witnessRef }]);
const EVENTS = [RESCUE, ADVANCE, EXECUTE, SILENCE];
const DOOM_CARD = stubEvent({ id: "doom", cost: 0, abilities: [DOOM.ref] });
const deps: EngineDeps = depsOf(
  CAPTIVE,
  SETUP,
  SETUP_WITNESS,
  WATCH,
  DOOM,
  DEFEAT_SENATOR,
  LAST_BLOW,
  ...EVENTS.map((e) => e.ability),
);

function start(scheme: keyof typeof SCHEMES): GameState {
  const result = createGame(
    {
      seed: 4,
      cards: [...DEFAULT_CARDS, SENATOR, WITNESS, DOOM_CARD, ...Object.values(SCHEMES), ...EVENTS.map((e) => e.card)],
      villainCardId: DEFAULT_CARDS.find((card) => card.type === "villain")!.id,
      mainSchemeCardId: SCHEMES[scheme].id,
      encounterDeck: copiesOf(TREACHERY.id, 10),
      setAside: [SENATOR.id, WITNESS.id],
      includeIdentitySets: false,
      players: [
        {
          identityCardId: HERO.id,
          deck: [...DEFAULT_DECK, ...EVENTS.flatMap((e) => copiesOf(e.card.id, 2)), DOOM_CARD.id],
        },
      ],
    },
    deps,
  );
  if (!result.ok) throw new Error(result.error.message);
  return driveSession(startSession(result.state), deps).session.state;
}
const senatorId = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === SENATOR.id)!.instanceId;
const defeats = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "characterDefeated" ? [e.instanceId] : []));

describe("RRG 1.8 'When Completed Abilities' (p. 48): the final stage's When Completed resolves before the loss", () => {
  it("'When Completed: Defeat X' on the final stage defeats X, detached and controlled by the first player", () => {
    const rescued = playFree(start("defeats"), deps, RESCUE.card.id).state;
    const senator = senatorId(rescued);
    expect(locateCard(rescued, senator)).toEqual({ kind: "playArea", playerId: P1 });
    const { state, events, session } = playFree(rescued, deps, ADVANCE.card.id);
    expect(defeats(events)).toEqual([senator]);
    expect(cardsInPlay(state)).not.toContain(senator);
    // "If X leaves play, the players lose the game": the defeat is what ends it, before the completion would.
    expect(state.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: senator });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("the same ability reaches X while it is attached to a scheme, under no player's control", () => {
    const state = start("defeats");
    const senator = senatorId(state);
    expect(mustInstance(state, senator).attachedTo).toBe(state.mainScheme.instanceId);
    expect(mustInstance(state, senator).controllerId).toBeNull();
    const after = playFree(state, deps, ADVANCE.card.id);
    expect(defeats(after.events)).toEqual([senator]);
    expect(mustInstance(after.state, state.mainScheme.instanceId).attachments).not.toContain(senator);
    expect(after.state.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: senator });
  });

  it("a When Completed that does not end the game resolves, and then the completion loses it (p. 27)", () => {
    const state = start("blow");
    const { state: after, events } = playFree(state, deps, ADVANCE.card.id);
    expect(mustInstance(after, after.villains[0]!.instanceId).damage).toBe(1);
    expect(after.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    const order = events.flatMap((e) => (e.type === "damageDealt" || e.type === "gameEnded" ? [e.type] : []));
    expect(order).toEqual(["damageDealt", "gameEnded"]);
  });

  it("control: a final stage with no When Completed loses at once, as before", () => {
    const { state: after, events } = playFree(start("plain"), deps, ADVANCE.card.id);
    expect(after.outcome).toEqual({ result: "loss", reason: "mainSchemeCompleted" });
    expect(events.filter((e) => e.type === "mainSchemeCompleted")).toHaveLength(1);
  });
});

describe("docs/phase7-wave6.md §3.75: 'Defeat X' on an ally attached to a scheme", () => {
  it("defeats it as printed (RRG 1.8 'Defeat', p. 15): it leaves the scheme and play, and its 'leaves play' rule loses the game", () => {
    const state = start("holds");
    const senator = senatorId(state);
    expect(mustInstance(state, senator).attachedTo).toBe(state.mainScheme.instanceId);
    const { state: after, events } = playFree(state, deps, EXECUTE.card.id);
    expect(defeats(events)).toEqual([senator]);
    expect(cardsInPlay(after)).not.toContain(senator);
    // His own rule lost it, so he is the source and no other card is named as the cause.
    expect(after.outcome).toEqual({ result: "loss", reason: "cardAbility", sourceInstanceId: senator });
  });
});

describe("a loss a card's text causes always names that card (GameOutcome.sourceInstanceId)", () => {
  it("'If X leaves play, the players lose' on another card: the card that says so is the source, X the cause", () => {
    const state = start("watches");
    const witness = Object.values(state.instances).find((i) => i.cardId === WITNESS.id)!.instanceId;
    expect(mustInstance(state, witness).attachedTo).toBe(state.mainScheme.instanceId);
    const { state: after, events, session } = playFree(state, deps, SILENCE.card.id);
    const outcome = {
      result: "loss",
      reason: "cardAbility",
      sourceInstanceId: state.mainScheme.instanceId,
      causeInstanceId: witness,
    };
    expect(after.outcome).toEqual(outcome);
    expect(events).toContainEqual({ type: "gameEnded", outcome });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a loss a card scripts as an effect names the card whose ability it is", () => {
    const state = start("plain");
    const { state: after } = playFree(state, deps, DOOM_CARD.id);
    expect(after.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
    const source = after.outcome?.reason === "cardAbility" ? after.outcome.sourceInstanceId : null;
    expect(source && mustInstance(after, source).cardId).toBe(DOOM_CARD.id);
  });
});
