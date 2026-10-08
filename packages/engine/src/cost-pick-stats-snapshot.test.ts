/**
 * `InPlayCostPick.snapshotStats` (docs/phase7-wave8.md §3.81): a cost that discards a character records its powers as
 * they stood in play. Synthetic cards shaped like "Discard an ally you control → deal damage to the villain equal to
 * that ally's ATK", and an ally whose own constant gives it +1 ATK while it is in play.
 *
 * Sources: RRG 1.8 "Cost" (p. 13): a cost is paid before the effects, so the discarded card is out of play, without
 * its modifiers, when the effects read it; "Dash (Value)" (p. 15): a dash is an unmodifiable 0.
 */

import { describe, expect, it } from "vitest";
import type { AbilityCost, EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, StatName } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubAlly, stubEvent } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const VILLAIN_REF = { kind: "each", query: { categories: ["villain"] } } as const;
const hitFor = (name: string): EffectSpec => ({
  kind: "dealDamage",
  target: VILLAIN_REF,
  amount: { kind: "var", name },
});
const discardAlly = (snapshot: boolean): AbilityCost => ({
  discardCards: {
    slot: "discarded",
    query: { categories: ["ally"] },
    min: 1,
    max: 1,
    ...(snapshot ? { snapshotStats: true as const } : {}),
  },
});
const event = (id: string, stat: StatName | "printedAtk") => {
  const effects: EffectSpec[] =
    stat === "printedAtk"
      ? [
          {
            kind: "dealDamage",
            target: VILLAIN_REF,
            amount: { kind: "stat", of: { kind: "slot", slot: "discarded" }, stat: "atk" },
          },
        ]
      : [hitFor(`discarded.${stat}`)];
  const ability = stubAbility(`${id}.action`, {
    trigger: { kind: "action" },
    cost: discardAlly(stat !== "printedAtk"),
    effects,
  });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
// "Discard an ally you control → deal damage to the villain equal to that ally's ATK / THW."
const BY_ATK = event("by-atk", "atk");
const BY_THW = event("by-thw", "thw");
// The same without the snapshot: the discarded card's stat is read from the discard pile.
const UNSNAPPED = event("unsnapped", "printedAtk");
// "This ally gets +1 ATK." Its own constant: in force only while it is in play.
const KEEN_CONSTANT = stubAbility("veteran.constant", {
  trigger: { kind: "constant", modifiers: [{ stat: "atk", amount: 1, target: { self: true } }] },
  effects: [],
});
const VETERAN = stubAlly({ id: "veteran", cost: 0, atk: 2, thw: 1, hp: 3, abilities: [KEEN_CONSTANT.ref] });
const SCOUT = stubAlly({ id: "scout", cost: 0, atk: 2, thw: 1, hp: 3 });
// A dash for THW.
const BRAWLER = stubAlly({ id: "brawler", cost: 0, atk: 3, thw: null, hp: 3 });
const EVENTS = [BY_ATK, BY_THW, UNSNAPPED];

const deps: EngineDeps = depsOf(KEEN_CONSTANT, ...EVENTS.map((e) => e.ability));

function start(ally: { readonly id: string }) {
  const state: GameState = gameAtFirstTurn({
    cards: [VETERAN, SCOUT, BRAWLER, ...EVENTS.map((e) => e.card)],
    deps,
    deck: [VETERAN.id, SCOUT.id, BRAWLER.id, ...EVENTS.map((e) => e.card.id)],
  });
  const placed = playerCardIntoPlay(state, ally.id as never);
  return { state: placed.state, ally: placed.id };
}
function play(state: GameState, card: { readonly id: string }, ally: InstanceId) {
  const given = giveCard(state, P1, card.id);
  const command: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
    costChoices: { discarded: [ally] },
  };
  return driveSession(startSession(given.state), deps, [command]).session.state;
}
const villainDamage = (state: GameState): number => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("a discard cost records the powers its picks had in play", () => {
  it("an ally with its own +1 ATK in play: its discarded ATK is read as 3, not its printed 2", () => {
    const table = start(VETERAN);
    const after = play(table.state, BY_ATK.card, table.ally);
    expect(mustPlayer(after, P1).discard).toContain(table.ally);
    expect(villainDamage(after)).toBe(3);
  });

  it("without the snapshot the effects read the card in the discard pile: its printed 2", () => {
    const table = start(VETERAN);
    expect(villainDamage(play(table.state, UNSNAPPED.card, table.ally))).toBe(2);
  });

  it("unmodified, the snapshot is the printed power; each power is its own var", () => {
    const table = start(SCOUT);
    expect(villainDamage(play(table.state, BY_ATK.card, table.ally))).toBe(2);
    expect(villainDamage(play(table.state, BY_THW.card, table.ally))).toBe(1);
  });

  it("a dash is 0", () => {
    const table = start(BRAWLER);
    expect(villainDamage(play(table.state, BY_THW.card, table.ally))).toBe(0);
    expect(villainDamage(play(table.state, BY_ATK.card, table.ally))).toBe(3);
  });
});
