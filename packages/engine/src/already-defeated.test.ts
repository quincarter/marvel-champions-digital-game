/**
 * A card that has been defeated stays in play while its When Defeated abilities resolve (RRG 1.8 "When Defeated
 * Abilities", p. 48: "A defeated card leaves play after its 'When Defeated' ability is resolved, if any"). Its defeat is
 * one occurrence (RRG 1.8 "Defeat", p. 15), so until it leaves it cannot be defeated again, its When Defeated abilities
 * resolve once, and it is not a valid target for an ability whose only effect on it is to defeat it (RRG 1.8 "Target",
 * p. 42). The shape that found this: "When Defeated: Defeat a non-[ELITE] minion" on a card that is itself a minion,
 * which chose itself for ever (`resolve/defeat.ts` `alreadyDefeated`).
 *
 * Where the RRG is silent the defeated card is still a card in play: another effect (damage here) can still choose it.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession, type GameSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const ALLIES: TargetQuery = { categories: ["ally"] };
const MINIONS: TargetQuery = { categories: ["minion"] };

const whenDefeated = (id: string, effects: readonly EffectSpec[]) =>
  stubAbility(id, { trigger: { kind: "whenDefeated" }, effects });

/** "When Defeated: Defeat an ally." */
const MARTYR_DEFEATED = whenDefeated("martyr.when-defeated", [
  { kind: "chooseTarget", slot: "victim", chooser: { kind: "controller" }, query: ALLIES },
  { kind: "defeat", target: { kind: "slot", slot: "victim" } },
]);
const MARTYR = stubAlly({ id: "ad-martyr", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [MARTYR_DEFEATED.ref] });
/** "When Defeated: Defeat each ally." */
const ZEALOT_DEFEATED = whenDefeated("zealot.when-defeated", [
  { kind: "defeat", target: { kind: "each", query: ALLIES } },
]);
const ZEALOT = stubAlly({ id: "ad-zealot", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [ZEALOT_DEFEATED.ref] });
/** "When Defeated: Deal 1 damage to an ally." */
const SPITE_DEFEATED = whenDefeated("spite.when-defeated", [
  { kind: "chooseTarget", slot: "victim", chooser: { kind: "controller" }, query: ALLIES },
  { kind: "dealDamage", target: { kind: "slot", slot: "victim" }, amount: n(1) },
]);
const SPITE = stubAlly({ id: "ad-spite", cost: 0, atk: 1, thw: 1, hp: 2, abilities: [SPITE_DEFEATED.ref] });
const BUDDY = stubAlly({ id: "ad-buddy", cost: 0, atk: 1, thw: 1, hp: 9 });
/** "When Defeated: Defeat a minion." (an encounter card: the first player chooses). */
const BOMBER_DEFEATED = whenDefeated("bomber.when-defeated", [
  { kind: "chooseTarget", slot: "victim", chooser: { kind: "firstPlayer" }, query: MINIONS },
  { kind: "defeat", target: { kind: "slot", slot: "victim" } },
]);
const BOMBER = stubMinion({ id: "ad-bomber", atk: 1, sch: 1, hp: 2, abilities: [BOMBER_DEFEATED.ref] });
const GRUNT = stubMinion({ id: "ad-grunt", atk: 1, sch: 1, hp: 9 });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const hit = (id: string, printedId: CardId) =>
  actionEvent(id, [{ kind: "dealDamage", target: { kind: "each", query: { printedId } }, amount: n(5) }]);
const HIT_MARTYR = hit("ad-hit-martyr", MARTYR.id);
const HIT_ZEALOT = hit("ad-hit-zealot", ZEALOT.id);
const HIT_SPITE = hit("ad-hit-spite", SPITE.id);
const HIT_BOMBER = hit("ad-hit-bomber", BOMBER.id);
const EVENTS = [HIT_MARTYR, HIT_ZEALOT, HIT_SPITE, HIT_BOMBER];

const deps: EngineDeps = depsOf(
  MARTYR_DEFEATED,
  ZEALOT_DEFEATED,
  SPITE_DEFEATED,
  BOMBER_DEFEATED,
  ...EVENTS.map((e) => e.ability),
);
const CARDS = [MARTYR, ZEALOT, SPITE, BUDDY, BOMBER, GRUNT, ...EVENTS.map((e) => e.card)];

const start = (): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: [BOMBER.id, GRUNT.id, ...copiesOf(GRUNT.id, 20)],
    deck: [MARTYR.id, ZEALOT.id, ZEALOT.id, SPITE.id, BUDDY.id, ...EVENTS.map((e) => e.card.id)],
  });

interface Played {
  readonly session: GameSession;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** The options of each "victim" prompt, in the order asked. */
  readonly offered: readonly (readonly string[])[];
}

/** Plays `card` for 0; a "victim" prompt takes `prefer` when it is offered, else the default. */
function play(state: GameState, card: CardId, prefer?: InstanceId): Played {
  const given = giveCard(state, P1, card);
  const offered: string[][] = [];
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "chooseTarget" || choice.prompt.slot !== "victim") return defaultPick(current);
    const ids = choice.options.map((option) => option.optionId);
    offered.push(ids);
    return prefer !== undefined && ids.includes(prefer) ? [prefer] : defaultPick(current);
  };
  const { session, events } = driveSession(
    startSession(given.state),
    deps,
    [{ type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null }],
    pick,
  );
  return { session, state: session.state, events, offered };
}

const defeats = (events: readonly GameEvent[], id: InstanceId): number =>
  events.filter((event) => event.type === "characterDefeated" && event.instanceId === id).length;
const resolutions = (events: readonly GameEvent[], abilityId: string): number =>
  events.filter((event) => event.type === "abilityResolved" && event.abilityId === abilityId).length;
const discardOf = (state: GameState): readonly InstanceId[] => state.players[0]!.discard;

describe("a defeated card whose When Defeated is resolving cannot be defeated again (RRG 1.8 pp. 15, 48)", () => {
  it("'When Defeated: Defeat an ally' with no other ally: nothing is offered, it resolves once and the game goes on", () => {
    const martyr = playerCardIntoPlay(start(), MARTYR.id);
    const { state, events, offered } = play(martyr.state, HIT_MARTYR.card.id);
    expect(offered).toEqual([]);
    expect(defeats(events, martyr.id)).toBe(1);
    expect(resolutions(events, MARTYR_DEFEATED.ref.id)).toBe(1);
    expect(state.pendingChoice).toBeNull();
    expect(state.stack).toEqual([]);
    expect(cardsInPlay(state)).not.toContain(martyr.id);
    expect(discardOf(state)).toContain(martyr.id);
  });

  it("with another ally in play: only that one is offered, and it is defeated", () => {
    const martyr = playerCardIntoPlay(start(), MARTYR.id);
    const buddy = playerCardIntoPlay(martyr.state, BUDDY.id);
    const { state, events, offered } = play(buddy.state, HIT_MARTYR.card.id, martyr.id);
    expect(offered).toEqual([[buddy.id]]);
    expect(defeats(events, martyr.id)).toBe(1);
    expect(defeats(events, buddy.id)).toBe(1);
    expect(resolutions(events, MARTYR_DEFEATED.ref.id)).toBe(1);
    expect(discardOf(state)).toEqual(expect.arrayContaining([martyr.id, buddy.id]));
    expect(state.stack).toEqual([]);
  });

  it("an encounter minion's 'When Defeated: Defeat a minion': it is not its own target, another minion is", () => {
    const alone = minionEngagedWith(start(), BOMBER.id);
    const solo = play(alone.state, HIT_BOMBER.card.id);
    expect(solo.offered).toEqual([]);
    expect(defeats(solo.events, alone.id)).toBe(1);
    expect(resolutions(solo.events, BOMBER_DEFEATED.ref.id)).toBe(1);
    expect(activeEncounterDeck(solo.state).discard).toContain(alone.id);

    const grunt = minionEngagedWith(alone.state, GRUNT.id);
    const both = play(grunt.state, HIT_BOMBER.card.id, alone.id);
    expect(both.offered).toEqual([[grunt.id]]);
    expect(defeats(both.events, alone.id)).toBe(1);
    expect(defeats(both.events, grunt.id)).toBe(1);
    expect(activeEncounterDeck(both.state).discard).toEqual(expect.arrayContaining([alone.id, grunt.id]));
  });

  it("a second defeat effect that reaches it mid-resolution does nothing ('Defeat each ally')", () => {
    const zealot = playerCardIntoPlay(start(), ZEALOT.id);
    const buddy = playerCardIntoPlay(zealot.state, BUDDY.id);
    const { state, events } = play(buddy.state, HIT_ZEALOT.card.id);
    expect(defeats(events, zealot.id)).toBe(1);
    expect(defeats(events, buddy.id)).toBe(1);
    expect(resolutions(events, ZEALOT_DEFEATED.ref.id)).toBe(1);
    // No second defeat event either: no window opened for a defeat that cannot happen.
    expect(
      events.filter(
        (event) =>
          event.type === "triggerEvent" &&
          event.phase === "initiated" &&
          event.event.kind === "characterDefeated" &&
          event.event.instanceId === zealot.id,
      ),
    ).toHaveLength(1);
    expect(discardOf(state)).toEqual(expect.arrayContaining([zealot.id, buddy.id]));
    expect(state.stack).toEqual([]);
  });

  it("two defeated together, each 'Defeat each ally': each is defeated once and its When Defeated resolves once", () => {
    const first = playerCardIntoPlay(start(), ZEALOT.id);
    const second = playerCardIntoPlay(first.state, ZEALOT.id);
    expect(second.id).not.toBe(first.id);
    const { state, events } = play(second.state, HIT_ZEALOT.card.id);
    expect(defeats(events, first.id)).toBe(1);
    expect(defeats(events, second.id)).toBe(1);
    expect(resolutions(events, ZEALOT_DEFEATED.ref.id)).toBe(2);
    expect(discardOf(state)).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(state.stack).toEqual([]);
  });

  it("another effect can still choose it: 'When Defeated: Deal 1 damage to an ally' offers the defeated card", () => {
    const spite = playerCardIntoPlay(start(), SPITE.id);
    const buddy = playerCardIntoPlay(spite.state, BUDDY.id);
    const { state, events, offered } = play(buddy.state, HIT_SPITE.card.id, spite.id);
    expect(offered).toHaveLength(1);
    expect([...offered[0]!].sort()).toEqual([spite.id, buddy.id].sort());
    expect(defeats(events, spite.id)).toBe(1);
    expect(resolutions(events, SPITE_DEFEATED.ref.id)).toBe(1);
    expect(cardsInPlay(state)).toContain(buddy.id);
    expect(discardOf(state)).toContain(spite.id);
  });

  it("replays to the same state", () => {
    const martyr = playerCardIntoPlay(start(), MARTYR.id);
    const buddy = playerCardIntoPlay(martyr.state, BUDDY.id);
    for (const table of [martyr.state, buddy.state]) {
      const { session } = play(table, HIT_MARTYR.card.id);
      const replayed = replay(session.log, deps);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    }
  });
});
