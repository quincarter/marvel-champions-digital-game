/**
 * docs/phase7-wave3.md §3.7: a character that cannot have a status card sheds the ones it holds the moment that
 * becomes true — the stalwart keyword gained from an attachment (Drang's Spear, Nebula's Technique attachments,
 * Universal Weapon: "gains stalwart") — and `RuleSpec cannotHaveStatus` ("Ronan the Accuser cannot be stunned", Kree
 * Fanatic 90001).
 *
 * Sources: RRG 1.8 "Stalwart" (p. 40), "Status Cards" (p. 42), "Steady" (p. 41).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMinion } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playFree } from "./testing/wave3.js";

const theVillain: TargetRef = { kind: "villain" };
const eachMinion: TargetRef = { kind: "each", query: { categories: ["minion"] } };

/** "Attach to the villain. The villain gains stalwart." */
const SPEAR_GRANT = stubAbility("spear.constant", {
  trigger: { kind: "constant", keywordGrants: [{ keyword: { name: "stalwart" }, target: { hostOfSelf: true } }] },
  effects: [],
});
const SPEAR = stubAttachment({ id: "spear", attachesTo: { kind: "villain" }, abilities: [SPEAR_GRANT.ref] });
/** "Ronan the Accuser cannot be stunned." */
const RONAN_RULE = stubAbility("ronan.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotHaveStatus", target: { self: true }, statuses: ["stunned"] }] },
  effects: [],
});
const RONAN = stubMinion({ id: "ronan", atk: 3, sch: 3, hp: 9, abilities: [RONAN_RULE.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const STUN_AND_CONFUSE_VILLAIN = actionEvent("disorient-villain", [
  { kind: "giveStatus", target: theVillain, status: "stunned" },
  { kind: "giveStatus", target: theVillain, status: "confused" },
]);
const STUN_MINIONS = actionEvent("stun-minions", [{ kind: "giveStatus", target: eachMinion, status: "stunned" }]);
const CONFUSE_MINIONS = actionEvent("confuse-minions", [
  { kind: "giveStatus", target: eachMinion, status: "confused" },
]);
const NOTHING = actionEvent("nothing", [
  { kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 0 } },
]);
const EVENTS = [STUN_AND_CONFUSE_VILLAIN, STUN_MINIONS, CONFUSE_MINIONS, NOTHING];

const deps: EngineDeps = depsOf(SPEAR_GRANT, RONAN_RULE, ...EVENTS.map((e) => e.ability));
const CARDS = [SPEAR, RONAN, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [SPEAR.id, RONAN.id, ...copiesOf(RONAN.id, 10)];

const start = (): GameState =>
  gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)) });

/** Attaches the spear to the villain by surgery: the villain "gains stalwart" with no event at all. */
function spearOnVillain(state: GameState): GameState {
  const piles = activeEncounterDeck(state);
  const spear = piles.deck.find((id) => state.instances[id]?.cardId === SPEAR.id)!;
  const villain = state.villains[0]!.instanceId;
  const deckId = state.encounterDeckOrder[0]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((id) => id !== spear) } },
    instances: {
      ...state.instances,
      [villain]: { ...mustInstance(state, villain), attachments: [...mustInstance(state, villain).attachments, spear] },
      [spear]: { ...mustInstance(state, spear), attachedTo: villain, faceup: true },
    },
  };
}

const statusesOf = (state: GameState, id: InstanceId) => mustInstance(state, id).statuses;
const removals = (events: readonly GameEvent[]) =>
  events.filter((event) => event.type === "statusRemoved" && event.reason === "cannotHave");

describe("§3.7 stalwart gained, and cannotHaveStatus", () => {
  it("a villain that gains stalwart while stunned and confused sheds both at once (RRG 1.8 p. 40)", () => {
    const disoriented = playFree(start(), deps, STUN_AND_CONFUSE_VILLAIN.card.id).state;
    const villain = disoriented.villains[0]!.instanceId;
    expect(statusesOf(disoriented, villain)).toMatchObject({ stunned: 1, confused: 1 });
    const { state, events } = playFree(spearOnVillain(disoriented), deps, NOTHING.card.id);
    expect(statusesOf(state, villain)).toMatchObject({ stunned: 0, confused: 0 });
    expect(
      removals(events)
        .map((event) => (event as { status: string }).status)
        .sort(),
    ).toEqual(["confused", "stunned"]);
  });

  it("a stalwart villain is not given either status", () => {
    const state = playFree(spearOnVillain(start()), deps, STUN_AND_CONFUSE_VILLAIN.card.id).state;
    expect(statusesOf(state, state.villains[0]!.instanceId)).toMatchObject({ stunned: 0, confused: 0 });
  });

  it("'cannot be stunned' refuses a stun but not a confuse", () => {
    const ronan = minionEngagedWith(start(), RONAN.id);
    const stunned = playFree(ronan.state, deps, STUN_MINIONS.card.id).state;
    expect(statusesOf(stunned, ronan.id).stunned).toBe(0);
    const confused = playFree(ronan.state, deps, CONFUSE_MINIONS.card.id).state;
    expect(statusesOf(confused, ronan.id).confused).toBe(1);
  });

  it("a board with no status cards emits nothing", () => {
    const { events } = playFree(start(), deps, NOTHING.card.id);
    expect(removals(events)).toEqual([]);
  });
});
