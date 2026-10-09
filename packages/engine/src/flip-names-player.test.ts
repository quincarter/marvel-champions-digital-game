/**
 * `TriggerEvent cardFlipped.playerId` (docs/phase7-wave8.md §2.5, §3.6): a flip names the player whose effect flipped
 * the card, so "After you flip to this side" on an uncontrolled card resolves as that player. The fixture mirrors a
 * counted environment that flips (RRG 1.8 "Flip", p. 20; "All-Purpose Counter", p. 6): side A's Forced Response to a
 * counter placed on it flips the card, and side B's Forced Response to that flip deals 1 damage to "you" and flips back.
 * The engine names no card.
 *
 * What is pinned: the player subject of `cardFlipped` is the "you" of the flipping effect (a player's event, an
 * encounter card's Forced Response that already had a "you", an ability cost paid by a player, the first player for a
 * state-check ability on an uncontrolled card, which resolves as the first player); a flip with no "you" names nobody;
 * and a flip is still not a reveal (ruling June 25, 2026 – Ruling 4 (3):
 * "Environments flip, they are not revealed").
 */
import { describe, expect, it } from "vitest";
import type { AnyCard } from "@mc/content";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { sessionApply, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId, type PlayerId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { cardFlippedEvent, eventSubjects } from "./trigger-events.js";
import { stubEnvironment, stubEvent, stubTreachery, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, newGame } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const one = { kind: "const", value: 1 } as const;
const self: TargetRef = { kind: "self" };
const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
const theEnvironment: TargetRef = { kind: "each", query: { categories: ["environment"] } };

/** Side A: "Forced Response: After you place a mark counter here, flip this card over." */
const SIDE_A = stubAbility("past.side-a", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "countersPlaced", selfIs: "target", eventIs: { counterType: "mark" } },
  },
  effects: [{ kind: "flipCard", target: self }],
});
/** Side B: "Forced Response: After you flip to this side, deal 1 damage to your identity. Flip this card over." */
const SIDE_B = stubAbility("past.side-b", {
  trigger: { kind: "response", forced: true, on: { on: "cardFlipped", selfIs: "target" } },
  effects: [
    { kind: "dealDamage", target: yourIdentity, amount: one },
    { kind: "addCounters", target: self, counterType: "answered", amount: one },
    { kind: "flipCard", target: self },
  ],
});
/** A When Revealed on side B: a flip must never resolve it. */
const SIDE_B_REVEALED = stubAbility("past.side-b-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [{ kind: "addCounters", target: self, counterType: "revealed", amount: one }],
});
/** "If there is a spark counter here, remove it and flip this card": a flip the card's own condition makes. */
const SPARK = stubAbility("past.spark", {
  trigger: { kind: "stateCheck", when: { kind: "counterAtLeast", of: self, counterType: "spark", amount: 1 } },
  effects: [
    { kind: "removeCounters", target: self, counterType: "spark", amount: one },
    { kind: "flipCard", target: self },
  ],
});
const PAST = stubEnvironment({
  id: "past",
  name: "Past",
  keywords: [{ name: "setup" }],
  abilities: [SIDE_A.ref, SPARK.ref],
  flipSide: { name: "Past Returned", abilities: [SIDE_B.ref, SIDE_B_REVEALED.ref] },
});

const actionEvent = (id: string, effects: readonly EffectSpec[]): { card: AnyCard; ability: StubAbility } => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Action: Flip the environment." */
const FLIP = actionEvent("flip-it", [{ kind: "flipCard", target: theEnvironment }]);
/** "Action: Place 1 mark counter on the environment." */
const MARK = actionEvent("mark-it", [
  { kind: "addCounters", target: theEnvironment, counterType: "mark", amount: one },
]);
/** "Action: Place 1 spark counter on the environment." */
const SPARK_IT = actionEvent("spark-it", [
  { kind: "addCounters", target: theEnvironment, counterType: "spark", amount: one },
]);

/** A double-sided upgrade: "Action: Flip this card → place 1 paid counter here." */
const BLADE_FLIP = stubAbility("blade.flip-cost", {
  trigger: { kind: "action" },
  cost: { flipSelf: true } satisfies AbilityCost,
  effects: [{ kind: "addCounters", target: self, counterType: "paid", amount: one }],
});
const BLADE: AnyCard = {
  ...stubUpgrade({ id: "blade", cost: 0, abilities: [BLADE_FLIP.ref] }),
  flipSide: { name: "Edge", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [BLADE_FLIP.ref] },
};

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
const EVENTS = [FLIP, MARK, SPARK_IT];
const deps: EngineDeps = depsOf(SIDE_A, SIDE_B, SIDE_B_REVEALED, SPARK, BLADE_FLIP, ...EVENTS.map((e) => e.ability));

/** Two players at p1's first turn, the environment in play on side A. */
const game = (): GameState =>
  newGame({
    players: 2,
    deps,
    extraCards: [PAST, BLANK, BLADE, ...EVENTS.map((e) => e.card)],
    encounterDeck: [PAST.id, ...Array.from({ length: 12 }, () => BLANK.id)],
    deck: [
      ...EVENTS.flatMap((e) => [e.card.id, e.card.id]),
      BLADE.id,
      ...Array.from({ length: 8 }, () => FLIP.card.id),
    ],
  });

function run(state: GameState, ...commands: readonly Command[]) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  for (const command of commands) {
    apply(command);
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 100) throw new Error("choices did not settle");
      const choice = session.state.pendingChoice;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: defaultPick(session.state),
      });
    }
  }
  return { state: session.state, events };
}

/** `player` plays a copy of `card` for 0 (p2 after p1 ends their turn). */
function play(state: GameState, player: PlayerId, card: AnyCard) {
  const given = giveCard(state, player, card.id);
  const playIt: Command = {
    type: "playCard",
    playerId: player,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  };
  return player === p1 ? run(given.state, playIt) : run(given.state, { type: "endTurn", playerId: p1 }, playIt);
}

const environmentId = (state: GameState): InstanceId => {
  const id = state.villainArea.find((candidate) => state.instances[candidate]?.cardId === PAST.id);
  if (!id) throw new Error("no environment");
  return id;
};
const damageOn = (state: GameState, player: PlayerId): number =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const countersOn = (state: GameState, counterType: string): number =>
  mustInstance(state, environmentId(state)).counters[counterType] ?? 0;
/** Each `cardFlipped` announcement for `id` (an announcement is logged once, as resolved), as `playerId` or "nobody". */
const flippers = (events: readonly GameEvent[], id: InstanceId): string[] =>
  events.flatMap((event) =>
    event.type === "triggerEvent" &&
    event.phase === "resolved" &&
    event.event.kind === "cardFlipped" &&
    event.event.instanceId === id
      ? [event.event.playerId ?? "nobody"]
      : [],
  );

describe("cardFlipped names the player whose effect flipped the card", () => {
  it.each([p1, p2])("%s's event flips the environment: side B's 'you' is that player", (player) => {
    const start = game();
    const { state, events } = play(start, player, FLIP.card);
    const other = player === p1 ? p2 : p1;
    expect(damageOn(state, player)).toBe(1);
    expect(damageOn(state, other)).toBe(0);
    // The flip there, and side B's own flip back, both by that player.
    expect(flippers(events, environmentId(start))).toEqual([player, player]);
    expect(mustInstance(state, environmentId(state)).flipped).toBe(false);
    expect(countersOn(state, "answered")).toBe(1);
  });

  it("through side A's Forced Response: the player who placed the counter is the one who flipped", () => {
    const start = game();
    const { state, events } = play(start, p2, MARK.card);
    expect(countersOn(state, "mark")).toBe(1);
    expect(flippers(events, environmentId(start))).toEqual([p2, p2]);
    expect(damageOn(state, p2)).toBe(1);
    expect(damageOn(state, p1)).toBe(0);
  });

  it("a state-check ability on an uncontrolled card resolves as the first player, so its flip names the first player", () => {
    const start = game();
    // Player 2 placed the counter, but nobody's effect flipped the card: the card's own condition did.
    const { state, events } = play(start, p2, SPARK_IT.card);
    expect(state.firstPlayerId).toBe(p1);
    expect(flippers(events, environmentId(start))).toEqual([p1, p1]);
    expect(countersOn(state, "answered")).toBe(1);
    expect(damageOn(state, p1)).toBe(1);
    expect(damageOn(state, p2)).toBe(0);
  });

  it("a flip with no 'you' names no player: the event has no player subject and no playerId key", () => {
    const id = environmentId(game());
    for (const by of [null, undefined]) {
      const event = cardFlippedEvent(id, by);
      expect(event).toEqual({ kind: "cardFlipped", instanceId: id });
      expect(eventSubjects(event)).toEqual({ sources: [], targets: [id], players: [] });
    }
    expect(eventSubjects(cardFlippedEvent(id, p2)).players).toEqual([p2]);
  });

  it("a flip paid as a cost names the paying player", () => {
    const given = giveCard(game(), p1, BLADE.id);
    const inPlay = run(given.state, {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    });
    const { state, events } = run(inPlay.state, {
      type: "useAbility",
      playerId: p1,
      cardInstanceId: given.id,
      abilityId: BLADE_FLIP.ref.id,
      payment: [],
    });
    expect(mustInstance(state, given.id).flipped).toBe(true);
    expect(flippers(events, given.id)).toEqual([p1]);
  });

  it("is still not a reveal: side B's When Revealed never resolves", () => {
    const { state } = play(game(), p1, FLIP.card);
    expect(countersOn(state, "revealed")).toBe(0);
  });
});
