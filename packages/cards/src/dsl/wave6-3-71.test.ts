/**
 * docs/phase7-wave6.md §3.71: an ally with an encounter back under a player's control (Longshot, `mojo` 39071; the
 * Captive allies, `mut_gen` 32089–32092). The engine side is driven by `packages/engine/src/encounter-backed-ally.test.ts`:
 * control changes, ownership does not (§4 Q41), unless a campaign makes the card a player's (`grantOwnedCards`, Q14).
 */

import { describe, expect, it } from "vitest";
import { setup, uncancellable, whenRevealed } from "./abilities.js";
import { encounterSetAside, grantOwnedCards, revealSetAside, surge } from "./effects.js";
import { validateDefinition } from "./validate.js";
import { firstPlayer } from "./values.js";

describe("§3.71 encounter-backed allies", () => {
  it("Longshot's When Revealed: the reveal puts him into play under your control; he gains surge, uncancellable", () => {
    const definition = uncancellable(whenRevealed(surge()));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition).toEqual({
      trigger: { kind: "whenRevealed" },
      uncancellable: true,
      effects: [{ kind: "gainSurge" }],
    });
  });

  it("`revealSetAside` (Q42): one player reveals him from the set-aside cards during setup", () => {
    const definition = setup(revealSetAside({ name: "Longshot" }, firstPlayer));
    expect(validateDefinition(definition)).toEqual([]);
    expect(definition.effects).toEqual([
      { kind: "selectCards", slot: "revealed", cards: { kind: "encounterSetAside", filter: { name: "Longshot" } } },
      { kind: "revealCard", cards: { kind: "slot", slot: "revealed" }, player: { kind: "firstPlayer" } },
    ]);
  });

  it("Q14: a Captive ally shuffled into the first player's deck is theirs for the game", () => {
    const effect = grantOwnedCards(encounterSetAside({ name: "Rictor" }), "deckShuffle", firstPlayer);
    expect(effect).toEqual({
      kind: "moveCards",
      cards: { kind: "encounterSetAside", filter: { name: "Rictor" } },
      to: "deckShuffle",
      assignOwnerTo: { kind: "firstPlayer" },
    });
  });
});
