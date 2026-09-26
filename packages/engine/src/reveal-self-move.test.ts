/**
 * docs/phase7-wave4.md §3.45: a treachery whose own When Revealed moves it ("Remove this card from the game", Field
 * Recruitment, `hood` 24012; "shuffle it into the encounter deck") stays where it went; only a treachery still where its
 * reveal found it is discarded when the reveal finishes.
 *
 * Sources: RRG 1.8 "Treachery" (p. 45: "after resolving, it is placed in its discard pile"), "Reveal" (p. 37).
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { activeEncounterDeck, locateCard } from "./query.js";
import type { EffectSpec } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubTreachery } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, onTopOfEncounterDeck, playFree } from "./testing/wave3.js";

const self = { kind: "ref", ref: { kind: "self" } } as const;
const treachery = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.when-revealed`, { trigger: { kind: "whenRevealed" }, effects });
  return { card: stubTreachery({ id, boostIcons: 0, abilities: [ability.ref] }), ability };
};
const GONE = treachery("gone", [{ kind: "moveCards", cards: self, to: "removedFromGame" }]);
const BACK = treachery("back", [{ kind: "moveCards", cards: self, to: "encounterDeckShuffle" }]);
const STAY = treachery("stay", []);
const REVEAL = stubAbility("reveal.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "revealEncounterCard", player: { kind: "controller" } }],
});
const REVEAL_CARD = stubEvent({ id: "reveal", cost: 0, abilities: [REVEAL.ref] });
const deps: EngineDeps = depsOf(GONE.ability, BACK.ability, STAY.ability, REVEAL);

function revealed(top: typeof GONE) {
  const base = gameAtFirstTurn({
    cards: [GONE.card, BACK.card, STAY.card, REVEAL_CARD],
    deps,
    encounter: [GONE.card.id, BACK.card.id, STAY.card.id, ...copiesOf(TREACHERY.id, 10)],
    deck: [REVEAL_CARD.id],
  });
  const state = playFree(onTopOfEncounterDeck(base, top.card.id), deps, REVEAL_CARD.id).state;
  const id = Object.values(state.instances).find((i) => i.cardId === top.card.id)!.instanceId;
  return { state, id };
}

describe("§3.45 a revealed treachery that moved itself stays where it went", () => {
  it("'Remove this card from the game' sticks", () => {
    const { state, id } = revealed(GONE);
    expect(locateCard(state, id)).toEqual({ kind: "removedFromGame" });
  });

  it("'shuffle it into the encounter deck' sticks", () => {
    const { state, id } = revealed(BACK);
    expect(activeEncounterDeck(state).deck).toContain(id);
    expect(activeEncounterDeck(state).discard).not.toContain(id);
  });

  it("a treachery that did not move itself is still discarded", () => {
    const { state, id } = revealed(STAY);
    expect(activeEncounterDeck(state).discard).toContain(id);
  });
});
