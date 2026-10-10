/**
 * `TriggerEvent cardLeavesPlay.by` (`LeaveCauseSide`): whose card effect makes a card leave play, so that "When an
 * encounter card effect would discard a card you control, discard [this card] instead of discarding that card" is an
 * interrupt on `cardLeavesPlay` with `eventIs: { to: "discard", by: "encounterCard" }` and `replaceTriggeringEvent`
 * (RRG 1.8 "Replacement Effect", p. 37).
 *
 * The side is the source card's printed type (RRG 1.8 "Card Types", p. 12), read from the `sourceCardId` the leave
 * paths already carry for the Permanent keyword. No card effect, so no `by`: a defeat at zero hit points, whatever
 * dealt the damage (RRG 1.8 "Defeat", p. 15: the game discards a defeated ally); an attachment going with its host
 * ("Leaves Play", p. 27); a uses card emptied ("Uses", p. 46: the keyword's own rule); and an ability's cost ("Cost",
 * p. 13: the arrow "distinguishes a cost from an effect").
 *
 * Synthetic cards only: a ward with that interrupt, a witness that hears every leaving, and the things that leave.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import { replay, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubAlly, stubEvent, stubSupport, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  P2,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const you = { kind: "controller" } as const;
const WARD_ID = "ward.interrupt";
/** "Forced Interrupt: When an encounter card effect would discard a card you control, discard this card instead." */
const WARD_INTERRUPT = stubAbility(WARD_ID, {
  trigger: {
    kind: "interrupt",
    forced: true,
    would: true,
    on: {
      on: "cardLeavesPlay",
      eventIs: { to: "discard", by: "encounterCard" },
      targetIs: { controlledBy: you },
    },
  },
  effects: [{ kind: "replaceTriggeringEvent", with: [{ kind: "discardFromPlay", target: { kind: "self" } }] }],
});
/** "Forced Response: After a card leaves play, place 1 seen counter here." It makes every leaving an announced event. */
const WITNESS_RESPONSE = stubAbility("witness.response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay" } },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "seen", amount: { kind: "const", value: 1 } },
  ],
});
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [WARD_INTERRUPT.ref] });
const WITNESS = stubSupport({ id: "witness", cost: 0, abilities: [WITNESS_RESPONSE.ref] });
const BUDDY = stubAlly({ id: "buddy", cost: 0, atk: 1, thw: 1, hp: 3 });
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
const GIZMO = stubUpgrade({ id: "gizmo", cost: 0 });
/** "Uses (1 charge counter)." */
const BATTERY = stubSupport({ id: "battery", cost: 0, keywords: [{ name: "uses", count: 1, counterType: "charge" }] });
const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });

/** A player event and a treachery (When Revealed) that each resolve `effects`. */
function sources(id: string, effects: readonly EffectSpec[], cost?: AbilityCost) {
  const action = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects, ...(cost ? { cost } : {}) });
  const revealed = stubAbility(`bad-${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects });
  return {
    abilities: [action, revealed],
    event: stubEvent({ id, cost: 0, abilities: [action.ref] }),
    treachery: stubTreachery({ id: `bad-${id}`, boostIcons: 0, abilities: [revealed.ref] }),
  };
}

// "Discard Buddy."
const DISCARD = sources("discard", [{ kind: "discardFromPlay", target: named("buddy") }]);
// "Put Buddy into its owner's discard pile." / "Return Buddy to its owner's hand."
const TO_DISCARD = sources("to-discard", [
  { kind: "moveCards", cards: { kind: "ref", ref: named("buddy") }, to: "discard" },
]);
const TO_HAND = sources("to-hand", [{ kind: "moveCards", cards: { kind: "ref", ref: named("buddy") }, to: "hand" }]);
// "Defeat Buddy."
const DEFEAT = sources("defeat", [{ kind: "defeat", target: named("buddy") }]);
// "Deal 5 damage to Buddy."
const ZAP = sources("zap", [{ kind: "dealDamage", target: named("buddy"), amount: { kind: "const", value: 5 } }]);
// "The villain attacks you."
const SMITE = sources("smite", [{ kind: "enemyAttack", enemies: { kind: "villain" }, against: you }]);
// "Discard Pal."
const DISCARD_PAL = sources("discard-pal", [{ kind: "discardFromPlay", target: named("pal") }]);
// "Remove 1 charge counter from Battery."
const DRAIN = sources("drain", [
  { kind: "removeCounters", target: named("battery"), counterType: "charge", amount: { kind: "const", value: 1 } },
]);
// "Reveal the top card of the encounter deck."
const REVEAL = sources("reveal", [{ kind: "revealEncounterCard", player: you }]);
// "Discard an ally you control → place 1 seen counter on the witness."
const SACRIFICE = sources(
  "sacrifice",
  [{ kind: "addCounters", target: named("witness"), counterType: "paid", amount: { kind: "const", value: 1 } }],
  { discardCards: { slot: "paid", query: { name: "buddy" }, min: 1, max: 1 } },
);
const ALL = [DISCARD, TO_DISCARD, TO_HAND, DEFEAT, ZAP, SMITE, DISCARD_PAL, DRAIN, REVEAL, SACRIFICE];

const deps: EngineDeps = depsOf(WARD_INTERRUPT, WITNESS_RESPONSE, ...ALL.flatMap((set) => set.abilities));

interface Table {
  readonly state: GameState;
  readonly ward: InstanceId | null;
  readonly witness: InstanceId;
  readonly buddy: InstanceId;
  readonly gizmo: InstanceId;
  readonly battery: InstanceId;
  readonly pal: InstanceId;
}

/**
 * P1 controls the witness, Buddy with the Gizmo attached, the Battery with its 1 charge counter and, with `ward`, the
 * ward. P2 (in a two-player game) controls Pal.
 */
function table(options: { readonly ward?: boolean; readonly players?: 1 | 2 } = {}): Table {
  const players = options.players ?? 1;
  const start = gameAtFirstTurn({
    players,
    cards: [WARD, WITNESS, BUDDY, PAL, GIZMO, BATTERY, FILLER, ...ALL.flatMap((set) => [set.event, set.treachery])],
    deps,
    deck: [WARD.id, WITNESS.id, BUDDY.id, PAL.id, GIZMO.id, BATTERY.id, ...ALL.map((set) => set.event.id)],
    encounter: [...ALL.map((set) => set.treachery.id), ...copiesOf(FILLER.id, 20)],
  });
  const witness = playerCardIntoPlay(start, WITNESS.id);
  const buddy = playerCardIntoPlay(witness.state, BUDDY.id);
  const gizmo = playerCardIntoPlay(buddy.state, GIZMO.id);
  const battery = playerCardIntoPlay(gizmo.state, BATTERY.id);
  const pal = playerCardIntoPlay(battery.state, PAL.id, players === 2 ? P2 : P1);
  const ward = options.ward === false ? null : playerCardIntoPlay(pal.state, WARD.id);
  const s = ward?.state ?? pal.state;
  // Surgery: the Gizmo attached to Buddy, and the Battery's uses counter (it did not enter play through the engine).
  const state: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, playArea: p.playArea.filter((id) => id !== gizmo.id) } : p,
    ),
    instances: {
      ...s.instances,
      [gizmo.id]: { ...mustInstance(s, gizmo.id), attachedTo: buddy.id },
      [buddy.id]: { ...mustInstance(s, buddy.id), attachments: [gizmo.id] },
      [battery.id]: { ...mustInstance(s, battery.id), counters: { charge: 1 } },
    },
  };
  return {
    state,
    ward: ward?.id ?? null,
    witness: witness.id,
    buddy: buddy.id,
    gizmo: gizmo.id,
    battery: battery.id,
    pal: pal.id,
  };
}

/** Resolves a source's effects from its player event, or from its treachery revealed off the encounter deck. */
function resolve(state: GameState, source: ReturnType<typeof sources>, from: "player" | "encounter") {
  if (from === "player") return playFree(state, deps, source.event.id);
  return playFree(onTopOfEncounterDeck(state, source.treachery.id), deps, REVEAL.event.id);
}

/** The cause each announced leaving of `id` carried: `"none"` for an event with no `by`. */
const causes = (events: readonly GameEvent[], id: InstanceId): readonly string[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" &&
    e.phase === "initiated" &&
    e.event.kind === "cardLeavesPlay" &&
    e.event.instanceId === id
      ? [e.event.by ?? "none"]
      : [],
  );
const wardResolved = (events: readonly GameEvent[]) =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === WARD_ID).length;
const wardOffered = (events: readonly GameEvent[]) =>
  events.some((e) => e.type === "windowOpened" && e.candidates.some((c) => `${c.abilityId}` === WARD_ID));
const discardOf = (state: GameState, player = P1) => mustPlayer(state, player).discard;
function expectReplays(session: GameSession) {
  const replayed = replay(session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
}

describe("cardLeavesPlay.by: whose card effect makes a card leave play", () => {
  it("an encounter card's discard is replaced: the ward is discarded, the card and its attachment stay", () => {
    const t = table();
    const { state, events, session } = resolve(t.state, DISCARD, "encounter");

    expect(wardResolved(events)).toBe(1);
    expect(causes(events, t.buddy)).toEqual(["encounterCard"]);
    expect(cardsInPlay(state)).toEqual(expect.arrayContaining([t.buddy, t.gizmo]));
    expect(mustInstance(state, t.gizmo).attachedTo).toBe(t.buddy);
    expect(cardsInPlay(state)).not.toContain(t.ward);
    expect(discardOf(state)).toContain(t.ward);
    expect(discardOf(state)).not.toContain(t.buddy);
    // The ward's own discard is the ward's effect, a player card's.
    expect(causes(events, t.ward!)).toEqual(["playerCard"]);
    // Only the ward left play: the witness heard 1 leaving.
    expect(mustInstance(state, t.witness).counters).toEqual({ seen: 1 });
    expect(state.stack).toEqual([]);
    expectReplays(session);
  });

  it("an encounter card's move to the discard pile is the same discard", () => {
    const t = table();
    const { state, events } = resolve(t.state, TO_DISCARD, "encounter");
    expect(wardResolved(events)).toBe(1);
    expect(cardsInPlay(state)).toContain(t.buddy);
    expect(discardOf(state)).toContain(t.ward);
  });

  it("a player card's discard is not offered: the card and its attachment are discarded", () => {
    const t = table();
    const { state, events, session } = resolve(t.state, DISCARD, "player");

    expect(wardOffered(events)).toBe(false);
    expect(wardResolved(events)).toBe(0);
    expect(causes(events, t.buddy)).toEqual(["playerCard"]);
    // The attachment goes with its host by the game's rule (RRG 1.8 "Leaves Play", p. 27), not by the effect.
    expect(causes(events, t.gizmo)).toEqual(["none"]);
    expect(discardOf(state)).toEqual(expect.arrayContaining([t.buddy, t.gizmo]));
    expect(cardsInPlay(state)).toContain(t.ward);
    expect(mustInstance(state, t.witness).counters).toEqual({ seen: 2 });
    expectReplays(session);
  });

  it("an encounter card's discard takes the attachment by the game's rule: only the host's leaving is its effect", () => {
    const t = table({ ward: false });
    const { state, events } = resolve(t.state, DISCARD, "encounter");
    expect(causes(events, t.buddy)).toEqual(["encounterCard"]);
    expect(causes(events, t.gizmo)).toEqual(["none"]);
    expect(discardOf(state)).toEqual(expect.arrayContaining([t.buddy, t.gizmo]));
  });

  it("an encounter card's discard of another player's card is not 'a card you control'", () => {
    const t = table({ players: 2 });
    const { state, events } = resolve(t.state, DISCARD_PAL, "encounter");
    expect(causes(events, t.pal)).toEqual(["encounterCard"]);
    expect(wardOffered(events)).toBe(false);
    expect(discardOf(state, P2)).toContain(t.pal);
    expect(cardsInPlay(state)).toContain(t.ward);
  });

  it("an encounter card's return to hand is its effect, but not a discard", () => {
    const t = table();
    const { state, events } = resolve(t.state, TO_HAND, "encounter");
    expect(causes(events, t.buddy)).toEqual(["encounterCard"]);
    expect(wardOffered(events)).toBe(false);
    expect(mustPlayer(state, P1).hand).toContain(t.buddy);
    expect(cardsInPlay(state)).toContain(t.ward);
  });

  it("damage from an encounter card's effect defeats by the game's rule: no cause, not offered", () => {
    const t = table();
    const { state, events } = resolve(t.state, ZAP, "encounter");
    expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === t.buddy)).toBe(true);
    expect(causes(events, t.buddy)).toEqual(["none"]);
    expect(wardOffered(events)).toBe(false);
    expect(discardOf(state)).toEqual(expect.arrayContaining([t.buddy, t.gizmo]));
    expect(cardsInPlay(state)).toContain(t.ward);
  });

  it("a defeat by an enemy attack's damage has no cause and is not offered", () => {
    const t = table();
    const given = giveCard(t.state, P1, SMITE.event.id);
    const pick = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind !== "declareDefender") return defaultPick(state);
      const defend = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === t.buddy);
      return defend ? [defend.optionId] : ["decline"];
    };
    // Buddy has 3 hit points and 2 damage: the villain's 2 ATK (plus any boost) defeats it.
    const wounded: GameState = {
      ...given.state,
      instances: { ...given.state.instances, [t.buddy]: { ...mustInstance(given.state, t.buddy), damage: 2 } },
    };
    const { state, events, session } = runCommandsPicking(wounded, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });

    expect(events.some((e) => e.type === "characterDefeated" && e.instanceId === t.buddy)).toBe(true);
    expect(causes(events, t.buddy)).toEqual(["none"]);
    expect(wardOffered(events)).toBe(false);
    expect(discardOf(state)).toEqual(expect.arrayContaining([t.buddy, t.gizmo]));
    expect(cardsInPlay(state)).toContain(t.ward);
    expectReplays(session);
  });

  it("a 'defeat' effect is its card's effect: the leaving names that card's side", () => {
    const encounter = table({ ward: false });
    expect(causes(resolve(encounter.state, DEFEAT, "encounter").events, encounter.buddy)).toEqual(["encounterCard"]);
    const player = table({ ward: false });
    expect(causes(resolve(player.state, DEFEAT, "player").events, player.buddy)).toEqual(["playerCard"]);
  });

  it("a cost is not an effect: a card discarded to pay one has no cause", () => {
    const t = table();
    const given = giveCard(t.state, P1, SACRIFICE.event.id);
    const { state, events, session } = runCommandsPicking(given.state, deps, defaultPick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
      costChoices: { paid: [t.buddy] },
    });

    expect(causes(events, t.buddy)).toEqual(["none"]);
    expect(wardOffered(events)).toBe(false);
    expect(discardOf(state)).toContain(t.buddy);
    // The cost was paid and the effect resolved: 1 paid counter, and Buddy's and the Gizmo's leavings heard.
    expect(mustInstance(state, t.witness).counters).toEqual({ paid: 1, seen: 2 });
    expectReplays(session);
  });

  it("a uses card emptied by an encounter card's effect is discarded by its own keyword: no cause, not offered", () => {
    const t = table();
    const { state, events } = resolve(t.state, DRAIN, "encounter");
    expect(causes(events, t.battery)).toEqual(["none"]);
    expect(wardOffered(events)).toBe(false);
    expect(discardOf(state)).toContain(t.battery);
    expect(cardsInPlay(state)).toContain(t.ward);
    expect(mustInstance(state, t.witness).counters).toEqual({ seen: 1 });
  });
});
