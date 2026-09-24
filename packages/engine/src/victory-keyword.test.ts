/**
 * docs/phase7-wave3.md §3.4: the victory X keyword. A defeated character or side scheme with it goes to the victory
 * display instead of its discard pile; an attachment with it goes there when its host is defeated; a card with both
 * uses and victory goes there when its last counter goes. Synthetic cards shaped like Badoon Headhunter (`Victory 2`),
 * the Galactic Artifacts side schemes (`Hinder 2[per_hero]. Victory 0. When Defeated: …`) and the Badoon Blitz
 * challenge (`Victory 1`).
 *
 * Sources: RRG 1.8 "Victory X" and "Victory Display" (p. 46), "Defeat" (p. 15), "Uses (X 'Type')" (p. 46).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeck } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMinion, stubSideScheme } from "./testing/fixtures.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, minionEngagedWith, playFree } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const each = (categories: readonly ("minion" | "sideScheme" | "attachment")[]): TargetRef => ({
  kind: "each",
  query: { categories },
});

const HEADHUNTER = stubMinion({ id: "headhunter", atk: 1, sch: 1, hp: 7, keywords: [{ name: "victory", value: 2 }] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 7 });
/** "When Defeated: The player who defeated this scheme may draw 2 cards." — here, draw 2 for the first player. */
const ARTIFACT_DEFEATED = stubAbility("artifact.when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [{ kind: "draw", player: { kind: "firstPlayer" }, amount: n(2) }],
});
const ARTIFACT = stubSideScheme({
  id: "artifact",
  startingThreat: 3,
  keywords: [{ name: "victory", value: 0 }],
  abilities: [ARTIFACT_DEFEATED.ref],
});
/** "Victory 1." on an attachment: to the victory display when the card it is attached to is defeated. */
const TROPHY = stubAttachment({
  id: "trophy",
  attachesTo: { kind: "minion" },
  keywords: [{ name: "victory", value: 1 }],
});
/** "Uses (1 charge counter). Victory 1." */
const CHARGED_RELIC = stubAttachment({
  id: "charged-relic",
  attachesTo: { kind: "villain" },
  keywords: [
    { name: "uses", count: 1, counterType: "charge" },
    { name: "victory", value: 1 },
  ],
});

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const SMASH = actionEvent("smash", [{ kind: "dealDamage", target: each(["minion"]), amount: n(10) }]);
const THWART = actionEvent("thwart-all", [{ kind: "removeThreat", target: each(["sideScheme"]), amount: n(10) }]);
const DISCARD_SCHEME = actionEvent("discard-scheme", [{ kind: "discardFromPlay", target: each(["sideScheme"]) }]);
const DRAIN = actionEvent("drain", [
  { kind: "removeCounters", target: each(["attachment"]), counterType: "charge", amount: n(1) },
]);
const EVENTS = [SMASH, THWART, DISCARD_SCHEME, DRAIN];

const deps: EngineDeps = depsOf(ARTIFACT_DEFEATED, ...EVENTS.map((e) => e.ability));
const CARDS = [HEADHUNTER, GRUNT, ARTIFACT, TROPHY, CHARGED_RELIC, ...EVENTS.map((e) => e.card)];
const ENCOUNTER: readonly CardId[] = [
  HEADHUNTER.id,
  GRUNT.id,
  ARTIFACT.id,
  TROPHY.id,
  CHARGED_RELIC.id,
  ...copiesOf(GRUNT.id, 20),
];

const start = (): GameState =>
  gameAtFirstTurn({ cards: CARDS, deps, encounter: ENCOUNTER, deck: EVENTS.flatMap((e) => copiesOf(e.card.id, 2)) });

const inDisplay = (state: GameState, id: InstanceId): boolean => state.victoryDisplay.includes(id);
const inEncounterDiscard = (state: GameState, id: InstanceId): boolean =>
  activeEncounterDeck(state).discard.includes(id);

/** Attaches an encounter card already taken into play to a host (surgery). */
function attach(state: GameState, attachment: InstanceId, host: InstanceId): GameState {
  const deckPiles = activeEncounterDeck(state);
  const deckId = Object.keys(state.encounterDecks)[0]!;
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [deckId]: { ...deckPiles, deck: deckPiles.deck.filter((id) => id !== attachment) },
    },
    instances: {
      ...state.instances,
      [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, attachment] },
      [attachment]: { ...state.instances[attachment]!, faceup: true, attachedTo: host },
    },
  };
}
const firstInDeck = (state: GameState, card: CardId): InstanceId => {
  const id = activeEncounterDeck(state).deck.find((candidate) => state.instances[candidate]?.cardId === card);
  if (!id) throw new Error(`no ${card} in the encounter deck`);
  return id;
};

describe("§3.4 Victory X", () => {
  it("a defeated minion with it goes to the victory display, not the discard pile", () => {
    const hunter = minionEngagedWith(start(), HEADHUNTER.id);
    const after = playFree(hunter.state, deps, SMASH.card.id).state;
    expect(inDisplay(after, hunter.id)).toBe(true);
    expect(inEncounterDiscard(after, hunter.id)).toBe(false);
  });

  it("a defeated minion without it is discarded as before", () => {
    const grunt = minionEngagedWith(start(), GRUNT.id);
    const after = playFree(grunt.state, deps, SMASH.card.id).state;
    expect(inEncounterDiscard(after, grunt.id)).toBe(true);
    expect(after.victoryDisplay).toEqual([]);
  });

  it("a defeated side scheme with it goes there after its When Defeated resolves", () => {
    const scheme = encounterCardInVillainArea(start(), ARTIFACT.id, 3);
    const { state: after, events } = playFree(scheme.state, deps, THWART.card.id);
    expect(inDisplay(after, scheme.id)).toBe(true);
    const order = events.flatMap((event) =>
      event.type === "abilityResolved" && event.abilityId === ARTIFACT_DEFEATED.ref.id
        ? ["whenDefeated"]
        : event.type === "cardMoved" && event.instanceId === scheme.id
          ? [event.to.kind]
          : [],
    );
    expect(order).toEqual(["whenDefeated", "victoryDisplay"]);
  });

  it("a side scheme with it that is discarded, not defeated, goes to the discard pile", () => {
    const scheme = encounterCardInVillainArea(start(), ARTIFACT.id, 3);
    const after = playFree(scheme.state, deps, DISCARD_SCHEME.card.id).state;
    expect(inEncounterDiscard(after, scheme.id)).toBe(true);
    expect(inDisplay(after, scheme.id)).toBe(false);
  });

  it("an attachment with it goes there when its host is defeated; the host is discarded as normal", () => {
    const grunt = minionEngagedWith(start(), GRUNT.id);
    const trophy = firstInDeck(grunt.state, TROPHY.id);
    const state = attach(grunt.state, trophy, grunt.id);
    const after = playFree(state, deps, SMASH.card.id).state;
    expect(inDisplay(after, trophy)).toBe(true);
    expect(inEncounterDiscard(after, grunt.id)).toBe(true);
  });

  it("a card with uses and victory goes there when its last counter is removed", () => {
    let state = start();
    const relic = firstInDeck(state, CHARGED_RELIC.id);
    const villain = state.villains[0]!.instanceId;
    state = attach(state, relic, villain);
    state = {
      ...state,
      instances: { ...state.instances, [relic]: { ...state.instances[relic]!, counters: { charge: 1 } } },
    };
    const after = playFree(state, deps, DRAIN.card.id).state;
    expect(inDisplay(after, relic)).toBe(true);
  });

  it("replays to the same state", () => {
    const hunter = minionEngagedWith(start(), HEADHUNTER.id);
    const { session } = playFree(hunter.state, deps, SMASH.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
