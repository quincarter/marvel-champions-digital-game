/**
 * A play's interrupt window (`cardBeingPlayed`) opens before a non-event card enters play, with synthetic cards. The
 * card that needs it is Spellcasting (`synthezoid` 57063): "Forced Interrupt: When you play a card, cancel its effects
 * and discard it."
 *
 * Sources: RRG 1.8 "Initiating Abilities" (p. 24): step 1, the card is faceup on the table "(This card is not in
 * play.)"; step 7, "The card enters play"; an interrupt "may be initiated just before that triggering condition becomes
 * true". "Interrupt" (p. 25). "Cancel" (p. 11): "Only the effects are prevented from initiating, and do not resolve";
 * "Abilities dependent on the canceled effect cannot trigger".
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { locateCard, mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const identity = { kind: "identityOf", player: { kind: "controller" } } as const;
const mark = (counterType: string) =>
  ({ kind: "addCounters", target: identity, counterType, amount: { kind: "const", value: 1 } }) as const;
const PLAYED = { categories: ["ally", "upgrade"] } as const;

/** Spellcasting's shape: "Forced Interrupt: When you play an ally or upgrade, cancel its effects" (no discard). */
const CANCEL = stubAbility(
  "ward.cancel",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: PLAYED },
    },
    effects: [{ kind: "cancelTriggeringEvent" }],
  }),
);
/** "Forced Interrupt: When you play an ally or upgrade, …": records whether the card is in play yet. */
const BEING = stubAbility(
  "watch.being",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: PLAYED },
    },
    effects: [mark("being")],
  }),
);
const response = (id: string, on: string, counter: string, self = false) =>
  stubAbility(
    id,
    def({
      trigger: {
        kind: "response",
        forced: true,
        on: { on: on as "cardPlayed", ...(self ? { selfIs: "target" as const } : { targetIs: PLAYED }) },
      },
      effects: [mark(counter)],
    }),
  );
/** Nick Fury's shape: "Response: After [this ally] enters play, …"; and "After you play [this card], …". */
const OWN_ENTERS = response("own.enters", "cardEntersPlay", "own.enters", true);
const OWN_PLAYED = response("own.played", "cardPlayed", "own.played", true);
const OWN_LEAVES = response("own.leaves", "cardLeavesPlay", "own.leaves", true);
/** Another card watching every ally or upgrade enter play, attach, leave play or be played. */
const SEEN_ENTERS = response("seen.enters", "cardEntersPlay", "seen.enters");
const SEEN_LEAVES = response("seen.leaves", "cardLeavesPlay", "seen.leaves");
const SEEN_PLAYED = response("seen.played", "cardPlayed", "seen.played");
const SEEN_ATTACHED = stubAbility(
  "seen.attached",
  def({ trigger: { kind: "response", forced: true, on: { on: "cardAttached" } }, effects: [mark("seen.attached")] }),
);

/** "Forced Interrupt: When you play an ally or upgrade, take 99 damage": the playing player is defeated mid-play. */
const LETHAL = stubAbility(
  "doom.lethal",
  def({
    trigger: {
      kind: "interrupt",
      forced: true,
      on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: PLAYED },
    },
    effects: [{ kind: "dealDamage", target: identity, amount: { kind: "const", value: 99 } }],
  }),
);

const OWN = [OWN_ENTERS.ref, OWN_PLAYED.ref, OWN_LEAVES.ref];
const FURY = stubAlly({ id: "fury", cost: 0, atk: 2, thw: 2, hp: 3, abilities: OWN });
const GEAR = stubUpgrade({ id: "gear", cost: 0, abilities: OWN });
const WARD = stubSupport({ id: "ward", cost: 0, abilities: [CANCEL.ref] });
const WATCH = stubSupport({
  id: "watch",
  cost: 0,
  abilities: [BEING.ref, SEEN_ENTERS.ref, SEEN_LEAVES.ref, SEEN_PLAYED.ref, SEEN_ATTACHED.ref],
});
const DOOM = stubSupport({ id: "doom", cost: 0, abilities: [LETHAL.ref] });
const CARDS = [FURY, GEAR, WARD, WATCH, DOOM];
const deps = depsOf(
  CANCEL,
  BEING,
  OWN_ENTERS,
  OWN_PLAYED,
  OWN_LEAVES,
  SEEN_ENTERS,
  SEEN_LEAVES,
  SEEN_PLAYED,
  SEEN_ATTACHED,
);
const lethalDeps = depsOf(
  LETHAL,
  OWN_ENTERS,
  OWN_PLAYED,
  OWN_LEAVES,
  SEEN_ENTERS,
  SEEN_LEAVES,
  SEEN_PLAYED,
  SEEN_ATTACHED,
  BEING,
  CANCEL,
);

function start(warded: boolean, players: 1 | 2 = 1): GameState {
  const state = gameAtFirstTurn({ cards: CARDS, deps, players, deck: CARDS.flatMap((c) => [c.id, c.id]) });
  if (players === 2) return playerCardIntoPlay(state, DOOM.id).state;
  const watched = playerCardIntoPlay(state, WATCH.id).state;
  return warded ? playerCardIntoPlay(watched, WARD.id).state : watched;
}
const identityOf = (state: GameState) => mustPlayer(state, P1).identity.instanceId;
const play = (state: GameState, card: InstanceId, attachTo: InstanceId | null = null): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: card,
  payment: [],
  attachToInstanceId: attachTo,
});
function run(state: GameState, command: Command, with_ = deps) {
  const { session, events } = driveSession(startSession(state), with_, [command], defaultPick);
  const replayed = replay(session.log, with_);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}
const counter = (state: GameState, name: string) => mustInstance(state, identityOf(state)).counters[name] ?? 0;
const counters = (state: GameState) =>
  Object.fromEntries(
    ["being", "own.enters", "own.played", "own.leaves", "seen.enters", "seen.leaves", "seen.attached"].map((n) => [
      n,
      counter(state, n),
    ]),
  );
/** Index in the log of the play's interrupt window and of the card's move into play. */
function order(events: readonly GameEvent[], id: InstanceId) {
  const window = events.findIndex(
    (e) => e.type === "triggerEvent" && e.event.kind === "cardBeingPlayed" && e.event.instanceId === id,
  );
  const entered = events.findIndex(
    (e) => e.type === "cardMoved" && e.instanceId === id && (e.to.kind === "playArea" || e.to.kind === "attachment"),
  );
  return { window, entered };
}

describe("a play's interrupt window opens before a non-event card enters play (RRG 1.8 p. 24)", () => {
  it("uncancelled ally: the interrupt resolves with the ally on the table, then it enters play and its responses fire", () => {
    const given = giveCards(start(false), P1, FURY.id);
    const fury = given.ids[0]!;
    const { state, events } = run(given.state, play(given.state, fury));
    const { window, entered } = order(events, fury);
    expect(window).toBeGreaterThanOrEqual(0);
    expect(entered).toBeGreaterThan(window);
    expect(locateCard(state, fury)).toEqual({ kind: "playArea", playerId: P1 });
    expect(counters(state)).toMatchObject({ being: 1, "own.enters": 1, "own.played": 1, "seen.enters": 1 });
    expect(counter(state, "seen.played")).toBe(1);
  });

  it("cancelled ally (Nick Fury's shape): never enters play, no enters- or leaves-play ability fires, it is discarded", () => {
    const given = giveCards(start(true), P1, FURY.id);
    const fury = given.ids[0]!;
    const { state, events } = run(given.state, play(given.state, fury));
    expect(order(events, fury).entered).toBe(-1);
    expect(mustPlayer(state, P1).discard).toContain(fury);
    expect(mustInstance(state, fury).controllerId).toBe(P1);
    expect(counters(state)).toMatchObject({
      being: 1,
      "own.enters": 0,
      "own.played": 0,
      "own.leaves": 0,
      "seen.enters": 0,
      "seen.leaves": 0,
    });
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardEntersPlay")).toBe(false);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardLeavesPlay")).toBe(false);
    // RRG 1.8 "Cancel" p. 11, "Limit" p. 27, "Max" p. 28 (rules-expert, tier 1): a card whose play is cancelled is
    // still considered played, so another card's "after you play an ally" answers; its own abilities never trigger.
    expect(counter(state, "seen.played")).toBe(1);
  });

  it("cancelled upgrade: never attaches, no enters-play or attach ability fires, it is discarded", () => {
    const given = giveCards(start(true), P1, GEAR.id);
    const gear = given.ids[0]!;
    const { state, events } = run(given.state, play(given.state, gear, identityOf(given.state)));
    expect(order(events, gear).entered).toBe(-1);
    expect(mustInstance(state, identityOf(state)).attachments).not.toContain(gear);
    expect(mustPlayer(state, P1).discard).toContain(gear);
    expect(counters(state)).toMatchObject({ "own.enters": 0, "own.played": 0, "seen.enters": 0, "seen.attached": 0 });
  });

  it("a play interrupt that defeats the playing player: the swept ally does not come back into play", () => {
    const given = giveCards(start(false, 2), P1, FURY.id);
    const fury = given.ids[0]!;
    const { state, events } = run(given.state, play(given.state, fury), lethalDeps);
    expect(mustPlayer(state, P1).eliminated).toBe(true);
    expect(order(events, fury).entered).toBe(-1);
    expect(mustPlayer(state, P1).discard).toContain(fury);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "cardEntersPlay")).toBe(false);
  });

  it("control: the uncancelled upgrade attaches after the window", () => {
    const given = giveCards(start(false), P1, GEAR.id);
    const gear = given.ids[0]!;
    const { state, events } = run(given.state, play(given.state, gear, identityOf(given.state)));
    const { window, entered } = order(events, gear);
    expect(entered).toBeGreaterThan(window);
    expect(mustInstance(state, identityOf(state)).attachments).toContain(gear);
    expect(counters(state)).toMatchObject({ being: 1, "own.enters": 1, "own.played": 1 });
  });
});
