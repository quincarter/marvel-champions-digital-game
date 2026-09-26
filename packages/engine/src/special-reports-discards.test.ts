/**
 * docs/phase7-wave5.md §3.7: a resolved Special reports the cards it discarded. Synthetic cards shaped like City Streets
 * (`sm` 27065: "Surging Sands — Special: Place 1 sand counter here. Discard cards from the top of the encounter deck equal
 * to the number of sand counters here") and Sandslide (27070: "Place 2 sand counters on City Streets, then resolve its
 * 'Surging Sands' ability. If at least 1 Sandman card was discarded this way, you are stunned").
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEnvironment, stubEvent, stubTreachery } from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  P1,
  playFree,
} from "./testing/wave3.js";

const FILLER = stubTreachery({ id: "filler", boostIcons: 0 });
const SAND_CARD = stubTreachery({ id: "sand-card", boostIcons: 0 });
const streets: TargetRef = { kind: "named", name: "streets" };

const SURGING_SANDS = stubAbility("streets.special", {
  trigger: { kind: "special" },
  effects: [
    { kind: "addCounters", target: { kind: "self" }, counterType: "sand", amount: { kind: "const", value: 1 } },
    {
      kind: "discardEncounterCards",
      count: { kind: "counters", of: { kind: "self" }, counterType: "sand" },
      bind: "discarded",
    },
  ],
});
const STREETS = stubEnvironment({ id: "streets", abilities: [SURGING_SANDS.ref] });

const sandslide = (sand: number): EffectSpec[] => [
  { kind: "addCounters", target: streets, counterType: "sand", amount: { kind: "const", value: sand } },
  { kind: "resolveSpecials", of: streets, bind: "sands" },
  {
    kind: "if",
    condition: {
      kind: "compare",
      left: { kind: "countInRef", cards: { kind: "slot", slot: "sands.discarded" }, query: { name: "sand-card" } },
      op: "atLeast",
      right: { kind: "const", value: 1 },
    },
    then: [{ kind: "giveStatus", target: { kind: "identityOf", player: { kind: "controller" } }, status: "stunned" }],
  },
];
const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const SLIDE_ZERO = event("slide-zero", sandslide(0));
const SLIDE_ONE = event("slide-one", sandslide(1));

const deps: EngineDeps = depsOf(SURGING_SANDS, SLIDE_ZERO.ability, SLIDE_ONE.ability);

function start(): GameState {
  const state = gameAtFirstTurn({
    cards: [FILLER, SAND_CARD, STREETS, SLIDE_ZERO.card, SLIDE_ONE.card],
    deps,
    encounter: [STREETS.id, SAND_CARD.id, ...copiesOf(FILLER.id, 20)],
    deck: [SLIDE_ZERO.card.id, SLIDE_ONE.card.id],
  });
  const inPlay = encounterCardInVillainArea(state, STREETS.id).state;
  // The encounter deck's top two: a filler, then the Sandman card.
  return onTopOfEncounterDeck(onTopOfEncounterDeck(inPlay, SAND_CARD.id), FILLER.id);
}

const stunned = (state: GameState) => mustInstance(state, mustPlayer(state, P1).identity.instanceId).statuses.stunned;

describe("§3.7 'If at least 1 Sandman card was discarded this way'", () => {
  it("reads the cards the resolved Special discarded: one card, no Sandman card, no stun", () => {
    const state = playFree(start(), deps, SLIDE_ZERO.card.id).state;
    expect(stunned(state)).toBe(0);
  });

  it("two cards, the second a Sandman card: stunned; replay deep-equal", () => {
    const { state, session } = playFree(start(), deps, SLIDE_ONE.card.id);
    expect(stunned(state)).toBe(1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
