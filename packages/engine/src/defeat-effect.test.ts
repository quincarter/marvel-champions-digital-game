/**
 * docs/phase7-wave3.md §3.9: `EffectSpec defeat`, a character defeated by an effect that says "defeat" rather than by
 * damage. Synthetic cards shaped like Nova Prime ("Response: After you play Nova Prime from your hand, defeat a
 * non-[Elite] minion.", `stld` 17002).
 *
 * Sources: RRG 1.8 "Defeat" (p. 15), "Villain Defeat" (p. 47), "Victory X" (p. 46), "'Cannot'" (p. 11).
 */

import { flat, trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { activeEncounterDeck, activeVillain } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubVillain } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, playFree } from "./testing/wave3.js";

const ELITE = trait("Elite");

const TROOPER = stubMinion({ id: "trooper", atk: 1, sch: 1, hp: 9 });
const CAPTAIN = stubMinion({ id: "captain", atk: 1, sch: 1, hp: 9, traits: [ELITE] });
const BOUNTY = stubMinion({ id: "bounty", atk: 1, sch: 1, hp: 9, keywords: [{ name: "victory", value: 1 }] });
const WARD_RULE = stubAbility("warded.constant", {
  trigger: { kind: "constant", rules: [{ kind: "cannotBeDefeated", target: { self: true } }] },
  effects: [],
});
const WARDED = stubMinion({ id: "warded", atk: 1, sch: 1, hp: 9, abilities: [WARD_RULE.ref] });
const TWO_STAGE = stubVillain({
  id: "two-stage",
  stages: [
    { hp: flat(20), atk: 1, sch: 1 },
    { hp: flat(25), atk: 2, sch: 1 },
  ],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const nonEliteMinions: TargetRef = { kind: "each", query: { categories: ["minion"], withoutTrait: ELITE } };
/** "Defeat a non-[Elite] minion." (each, for the test). */
const NOVA = actionEvent("nova", [{ kind: "defeat", target: nonEliteMinions }]);
const DEFEAT_VILLAIN = actionEvent("defeat-villain", [{ kind: "defeat", target: { kind: "villain" } }]);
const EVENTS = [NOVA, DEFEAT_VILLAIN];

const deps: EngineDeps = depsOf(WARD_RULE, ...EVENTS.map((e) => e.ability));
const CARDS = [TROOPER, CAPTAIN, BOUNTY, WARDED, TWO_STAGE, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [TROOPER.id, CAPTAIN.id, BOUNTY.id, WARDED.id, ...copiesOf(TROOPER.id, 20)];

const start = (villain = TWO_STAGE): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    villain,
    encounter: ENCOUNTER,
    deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)),
  });

describe("§3.9 `EffectSpec defeat`", () => {
  it("defeats an undamaged minion outright, and it is discarded", () => {
    const trooper = minionEngagedWith(start(), TROOPER.id);
    const { state, events } = playFree(trooper.state, deps, NOVA.card.id);
    expect(activeEncounterDeck(state).discard).toContain(trooper.id);
    expect(events).toContainEqual(expect.objectContaining({ type: "characterDefeated", instanceId: trooper.id }));
  });

  it("the target query still filters: an Elite minion is left alone", () => {
    const captain = minionEngagedWith(start(), CAPTAIN.id);
    const { state } = playFree(captain.state, deps, NOVA.card.id);
    expect(activeEncounterDeck(state).discard).not.toContain(captain.id);
  });

  it("a defeat by effect is a defeat: Victory X sends the minion to the victory display", () => {
    const bounty = minionEngagedWith(start(), BOUNTY.id);
    const { state } = playFree(bounty.state, deps, NOVA.card.id);
    expect(state.victoryDisplay).toContain(bounty.id);
  });

  it("'cannot be defeated' stops it", () => {
    const warded = minionEngagedWith(start(), WARDED.id);
    const { state } = playFree(warded.state, deps, NOVA.card.id);
    expect(activeEncounterDeck(state).discard).not.toContain(warded.id);
    expect(state.villainArea.concat(state.players.flatMap((p) => p.playArea))).toContain(warded.id);
  });

  it("a villain defeated by effect falls to its next stage (RRG 1.8 'Villain Defeat', p. 47)", () => {
    const { state } = playFree(start(), deps, DEFEAT_VILLAIN.card.id);
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(state.outcome).toBeNull();
  });

  it("replays to the same state", () => {
    const trooper = minionEngagedWith(start(), TROOPER.id);
    const { session } = playFree(trooper.state, deps, NOVA.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
