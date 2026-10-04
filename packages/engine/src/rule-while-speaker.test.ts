/**
 * A constant rule's `while` on a card no player controls (an obligation in a player's play area) is read with that
 * player as "you" (`activeRules`, `select.ts`): RRG 1.8 "Obligation" (p. 30), "Abilities on obligations that use the
 * words 'you' or 'your' apply only to the player whose play area the obligation is in". Without it a form predicate
 * ("while you are in alter-ego form", Claustrophobia's erratum, RRG 1.8 p. 68; docs/phase7-wave6.md §3.58) reads a
 * null controller and is never true. Synthetic cards; the printed card is only named for orientation.
 */

import { cardId, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance } from "./query.js";
import { cannotChangeForm } from "./rules.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubObligation } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, P2 } from "./testing/wave3.js";

const STUCK = stubAbility("stuck.constant", {
  trigger: {
    kind: "constant",
    rules: [
      {
        kind: "cannotChangeForm",
        player: { kind: "controller" },
        while: { kind: "form", player: { kind: "controller" }, form: "alterEgo" },
      },
    ],
  },
  effects: [],
} satisfies AbilityDefinition);
const STUCK_CARD = stubObligation({ id: "stuck", abilities: [STUCK.ref] });
const deps: EngineDeps = depsOf(STUCK);

/** Two players; the obligation faceup in P2's play area with no controller, P2 in `form`. */
function start(form: "hero" | "alterEgo"): { state: GameState; id: InstanceId } {
  const base = gameAtFirstTurn({
    cards: [STUCK_CARD],
    deps,
    players: 2,
    encounter: [STUCK_CARD.id, ...copiesOf(TREACHERY.id, 30)],
  });
  const deckId = activeEncounterDeckId(base);
  const piles = base.encounterDecks[deckId]!;
  const id = piles.deck.find((c) => base.instances[c]?.cardId === (cardId("stuck") as CardId))!;
  const state: GameState = {
    ...base,
    encounterDecks: { ...base.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((c) => c !== id) } },
    players: base.players.map((p) => ({
      ...p,
      ...(p.playerId === P2 ? { playArea: [...p.playArea, id] } : {}),
      identity: { ...p.identity, form: p.playerId === P2 ? form : "hero" },
    })),
    instances: { ...base.instances, [id]: { ...mustInstance(base, id), faceup: true, controllerId: null } },
  };
  return { state, id };
}

describe("a constant rule's `while` on an uncontrolled card reads its speaker as 'you'", () => {
  it("is in force while the player whose play area holds the obligation is in alter-ego form", () => {
    const { state, id } = start("alterEgo");
    expect(mustInstance(state, id).controllerId).toBeNull();
    expect(cannotChangeForm(state, deps, P2)).toBe(true);
    // "You" is P2 only; P1 (in hero form) is never bound by it.
    expect(cannotChangeForm(state, deps, P1)).toBe(false);
  });

  it("is not in force while that player is in hero form, whatever the other player's form", () => {
    const { state } = start("hero");
    expect(cannotChangeForm(state, deps, P2)).toBe(false);
    const p1AlterEgo: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, form: "alterEgo" as const } } : p,
      ),
    };
    expect(cannotChangeForm(p1AlterEgo, deps, P2)).toBe(false);
  });
});
