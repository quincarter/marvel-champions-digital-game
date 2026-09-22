/**
 * docs/phase7-wave3.md §3.3 (Hinder X) and §1.3 (Hinder X and Uses printed with the per player icon), with synthetic
 * cards shaped like Blockade / Pincer Maneuver (`Hinder 2[per_hero]`), the expert Campaign Challenge side schemes
 * (`Hinder 4.`), Crossbones' Machine Gun (`Uses (2[per_hero] ammo counters)`) and Fanaticism (`Uses (1 fury counter,
 * plus 1[per_hero] additional fury counters)`).
 *
 * Sources: RRG 1.8 "Hinder X" (p. 22), "Uses (X 'Type')" (p. 46), "Per Player Icon" (p. 32), "Enters Play" (p. 18).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubSideScheme } from "./testing/fixtures.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, playFree } from "./testing/wave3.js";

/** "Hinder 2[per_hero]." on a side scheme printing 2 starting threat. */
const BLOCKADE = stubSideScheme({
  id: "blockade",
  startingThreat: 2,
  keywords: [{ name: "hinder", value: 0, perPlayer: 2 }],
});
/** "Hinder 4." on a side scheme printing 3 starting threat. */
const EXPERT_CHALLENGE = stubSideScheme({
  id: "expert-challenge",
  startingThreat: 3,
  keywords: [{ name: "hinder", value: 4 }],
});
/** No hinder: its starting threat alone. */
const PLAIN_SCHEME = stubSideScheme({ id: "plain-scheme", startingThreat: 2 });
/** "Attach to the villain. Uses (2[per_hero] ammo counters)." */
const MACHINE_GUN = stubAttachment({
  id: "machine-gun",
  attachesTo: { kind: "villain" },
  keywords: [{ name: "uses", count: 0, countPerPlayer: 2, counterType: "ammo" }],
});
/** "Uses (1 fury counter, plus 1[per_hero] additional fury counters)." */
const FANATICISM = stubAttachment({
  id: "fanaticism",
  attachesTo: { kind: "villain" },
  keywords: [{ name: "uses", count: 1, countPerPlayer: 1, counterType: "fury" }],
});

const reveal = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
/** "Reveal the top card of the encounter deck." */
const REVEAL = reveal("reveal", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
/** "Put [the named side scheme] into play" from the encounter deck: entering play without a reveal. */
const PUT_BLOCKADE = reveal("put-blockade", [
  {
    kind: "selectCards",
    slot: "found",
    cards: { kind: "encounter", zones: ["deck"], filter: { name: BLOCKADE.name } },
  },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "controller" } },
]);

const deps: EngineDeps = depsOf(REVEAL.ability, PUT_BLOCKADE.ability);
const CARDS = [BLOCKADE, EXPERT_CHALLENGE, PLAIN_SCHEME, MACHINE_GUN, FANATICISM, REVEAL.card, PUT_BLOCKADE.card];
const ENCOUNTER: readonly CardId[] = [
  ...copiesOf(BLOCKADE.id, 3),
  EXPERT_CHALLENGE.id,
  PLAIN_SCHEME.id,
  MACHINE_GUN.id,
  FANATICISM.id,
  ...copiesOf(CARDS[0]!.id, 20),
];

const start = (players: 1 | 2): GameState =>
  gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: [...copiesOf(REVEAL.card.id, 2), PUT_BLOCKADE.card.id],
    players,
  });

/** Reveals `card` from the top of the encounter deck and returns its instance in play. */
function revealed(state: GameState, card: CardId) {
  const after = playFree(onTopOfEncounterDeck(state, card), deps, REVEAL.card.id).state;
  const id = cardsInPlay(after).find((candidate) => after.instances[candidate]?.cardId === card);
  if (!id) throw new Error(`${card} did not enter play`);
  return mustInstance(after, id);
}

describe("§3.3 Hinder X: a card enters play with X threat on it", () => {
  it("adds to the side scheme's starting threat, scaled by the players who started (1 player)", () => {
    expect(revealed(start(1), BLOCKADE.id).threat).toBe(2 + 2);
  });

  it("…and with 2 players, the [per_hero] value doubles", () => {
    expect(revealed(start(2), BLOCKADE.id).threat).toBe(2 + 4);
  });

  it("a flat Hinder adds its value whatever the player count", () => {
    expect(revealed(start(2), EXPERT_CHALLENGE.id).threat).toBe(3 + 4);
  });

  it("a side scheme without it enters with its starting threat alone", () => {
    expect(revealed(start(1), PLAIN_SCHEME.id).threat).toBe(2);
  });

  it("applies when the scheme is put into play rather than revealed ('enters play', RRG 1.8 p. 22)", () => {
    const after = playFree(start(1), deps, PUT_BLOCKADE.card.id).state;
    const id = after.villainArea.find((candidate) => after.instances[candidate]?.cardId === BLOCKADE.id);
    expect(id).toBeDefined();
    expect(mustInstance(after, id!).threat).toBe(4);
  });
});

describe("§1.3 Uses printed with the per player icon", () => {
  it("`Uses (2[per_hero] ammo counters)` enters with 2 per player", () => {
    expect(revealed(start(1), MACHINE_GUN.id).counters["ammo"]).toBe(2);
    expect(revealed(start(2), MACHINE_GUN.id).counters["ammo"]).toBe(4);
  });

  it("`Uses (1 …, plus 1[per_hero] additional …)` enters with 1 plus 1 per player", () => {
    expect(revealed(start(1), FANATICISM.id).counters["fury"]).toBe(2);
    expect(revealed(start(2), FANATICISM.id).counters["fury"]).toBe(3);
  });
});
