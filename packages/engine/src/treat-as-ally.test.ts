/**
 * docs/phase7-wave4.md §3.29: a minion treated as an ally, the mirror of §3.9. Synthetic cards shaped like Mind Control
 * (`phoenix` 34009: "Attach to a non-[Elite] minion. Take control of attached minion and treat it as a [Controlled] ally
 * with a blank text box. Its THW is equal to its printed SCH and it takes 1 consequential damage after it thwarts or
 * attacks.") and Karma (`rogue` 38011: "… While Karma is in play, take control of that minion and treat it as a
 * [Controlled] ally …").
 *
 * Sources: the cards' own text; ruling, Dec 17, 2025 (1) #3 (treating a card as another type is "essentially a status
 * change": nothing enters or leaves play); RRG 1.8 "Consequential Damage" (p. 14), "Blank" (p. 10); §4 Q21.
 */

import { trait, type UpgradeCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { characterProfile, isMinion, locateCard, minionsEngagedWith, mustInstance, mustPlayer } from "./query.js";
import { activeAbilityRefs, categoriesOf, controllerOf, traitsOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { giveCard } from "./testing/scenario.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const CONTROLLED = trait("CONTROLLED");
const THUG_CONSTANT = stubAbility("thug.constant", {
  trigger: { kind: "constant", rules: [{ kind: "excludedFromAllyLimit", target: { self: true } }] },
  effects: [],
});
const THUG = stubMinion({ id: "thug", atk: 2, sch: 3, hp: 5, abilities: [THUG_CONSTANT.ref] });

const MIND_CONSTANT = stubAbility("mind-control.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "treatHostAsAlly", traits: [CONTROLLED], thwFromSch: true, consequential: 1 }],
  },
  effects: [],
});
const MIND_CONTROL: UpgradeCard = {
  ...stubUpgrade({ id: "mind-control", cost: 0, abilities: [MIND_CONSTANT.ref] }),
  attachesTo: { kind: "minion" },
};
const KARMA_ACTION = stubAbility("karma.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "treatAsAlly",
      target: { kind: "each", query: { categories: ["minion"] } },
      traits: [CONTROLLED],
      thwFromSch: true,
      consequential: 2,
    },
  ],
});
const KARMA = stubSupport({ id: "karma", cost: 0, abilities: [KARMA_ACTION.ref] });
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const DISCARD_UPGRADES = event("discard-upgrades", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["upgrade"] } } },
]);
const REVEAL = event("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const DISCARD_SUPPORTS = event("discard-supports", [
  { kind: "discardFromPlay", target: { kind: "each", query: { categories: ["support"] } } },
]);
/** "After a minion engages a player": places a counter on the main scheme, so a test can see who heard what. */
const ENGAGE_WATCH = stubAbility("engage-watch.response", {
  trigger: { kind: "response", forced: true, on: { on: "minionEngaged" } },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "each", query: { categories: ["mainScheme"] } },
      counterType: "engaged",
      amount: { kind: "const", value: 1 },
    },
  ],
});
const WATCHER = stubSupport({ id: "engage-watcher", cost: 0, abilities: [ENGAGE_WATCH.ref] });
const deps: EngineDeps = depsOf(
  THUG_CONSTANT,
  MIND_CONSTANT,
  KARMA_ACTION,
  DISCARD_UPGRADES.ability,
  DISCARD_SUPPORTS.ability,
  REVEAL.ability,
  ENGAGE_WATCH,
);

function start(): { state: GameState; thug: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [THUG, MIND_CONTROL, KARMA, DISCARD_UPGRADES.card, DISCARD_SUPPORTS.card, REVEAL.card, WATCHER],
    deps,
    encounter: [THUG.id, ...copiesOf(THUG.id, 5)],
    deck: [MIND_CONTROL.id, KARMA.id, DISCARD_UPGRADES.card.id, DISCARD_SUPPORTS.card.id, REVEAL.card.id, WATCHER.id],
  });
  const hero = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
  };
  const engaged = minionEngagedWith(hero, THUG.id, P1);
  return { state: engaged.state, thug: engaged.id };
}

function mindControlled(): { state: GameState; thug: InstanceId; session: ReturnType<typeof driveSession>["session"] } {
  const { state, thug } = start();
  const given = giveCard(state, P1, MIND_CONTROL.id);
  const { session } = driveSession(startSession(given.state), deps, [
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: thug },
  ]);
  return { state: session.state, thug, session };
}

describe("§3.29 a minion treated as an ally", () => {
  it("Mind Control: the minion is the player's ally, bare, [Controlled], THW = printed SCH, still attached", () => {
    const { state, thug, session } = mindControlled();
    expect(categoriesOf(state, thug)).toEqual(["ally", "character"]);
    expect(isMinion(state, thug)).toBe(false);
    expect(controllerOf(state, thug)).toBe(P1);
    expect(minionsEngagedWith(state, P1)).not.toContain(thug);
    expect(locateCard(state, thug)).toEqual({ kind: "playArea", playerId: P1 });
    expect(traitsOf(state, thug)).toEqual([CONTROLLED]);
    expect(activeAbilityRefs(state, thug, deps)).toEqual([]);
    const profile = characterProfile(state, thug, deps)!;
    expect(profile.kind).toBe("ally");
    expect(profile.thw).toBe(3);
    expect(profile.atk).toBe(2);
    expect(mustInstance(state, thug).attachments).toHaveLength(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("it thwarts with its printed SCH and takes 1 consequential damage after", () => {
    const { state, thug } = mindControlled();
    const scheme = state.mainScheme.instanceId;
    const primed = {
      ...state,
      instances: { ...state.instances, [scheme]: { ...mustInstance(state, scheme), threat: 5 } },
    };
    const thwart: Command = { type: "basicThwart", playerId: P1, thwarterInstanceId: thug, schemeInstanceId: scheme };
    const { session } = driveSession(startSession(primed), deps, [thwart]);
    expect(mustInstance(session.state, scheme).threat).toBe(2);
    expect(mustInstance(session.state, thug).damage).toBe(1);
  });

  it("when the attachment goes it is a minion again, engaged with the player who controlled it (§4 Q21)", () => {
    const { state, thug } = mindControlled();
    const freed = playFree(state, deps, DISCARD_UPGRADES.card.id).state;
    expect(categoriesOf(freed, thug)).toEqual(["minion", "enemy", "character"]);
    expect(controllerOf(freed, thug)).toBeNull();
    expect(mustInstance(freed, thug).engagedWith).toBe(P1);
    expect(minionsEngagedWith(freed, P1)).toContain(thug);
  });

  it("becoming a minion again is not an engagement: 'after a minion engages' does not hear it (§4 Q21)", () => {
    // RRG 1.8 "Engage" (p. 18): a minion engages by entering play in a player's area or by an ability telling it to.
    // Neither happens here (ruling Dec 17, 2025 (1) #3: a status change, nothing enters play).
    const { state, thug } = mindControlled();
    const watching = playerCardIntoPlay(state, WATCHER.id).state;
    const { state: freed, events } = playFree(watching, deps, DISCARD_UPGRADES.card.id);
    expect(mustInstance(freed, thug).engagedWith).toBe(P1);
    expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "minionEngaged")).toBe(false);
    expect(mustInstance(freed, freed.mainScheme.instanceId).counters.engaged ?? 0).toBe(0);
    // The control: in the same state, a minion entering play engaged with the player is heard.
    const revealed = playFree(onTopOfEncounterDeck(freed, THUG.id), deps, REVEAL.card.id).state;
    expect(mustInstance(revealed, revealed.mainScheme.instanceId).counters.engaged).toBe(1);
  });

  it("Karma: an effect's minion is an ally while its card is in play, and a minion again once it leaves", () => {
    const { state, thug } = start();
    const placed = playerCardIntoPlay(state, KARMA.id);
    const { session } = driveSession(startSession(placed.state), deps, [
      { type: "useAbility", playerId: P1, cardInstanceId: placed.id, abilityId: KARMA_ACTION.ref.id, payment: [] },
    ]);
    const taken = session.state;
    expect(categoriesOf(taken, thug)).toEqual(["ally", "character"]);
    expect(controllerOf(taken, thug)).toBe(P1);
    expect(mustPlayer(taken, P1).playArea).toContain(thug);
    const released = playFree(taken, deps, DISCARD_SUPPORTS.card.id).state;
    expect(categoriesOf(released, thug)).toEqual(["minion", "enemy", "character"]);
    expect(mustInstance(released, thug).engagedWith).toBe(P1);
  });
});
