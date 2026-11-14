/**
 * Amplify on a villainous character's boost card, on the real cards: Black Cat (63016, an ally printed with
 * villainous) and Elektra (63001a, whose hero face is villainous). Conflict between sources, settled by the owner on
 * 2026-11-14 (docs/phase7-wave11-scenarios.md §S4.0, "Amplify"): MC60 p. 4's updated Amplify text, "When a character
 * resolves a boost card while using a basic power, add one additional boost icon to that card for each amplify icon in
 * play", is followed over RRG 1.8 "Amplify Icon" (p. 7, "during an enemy activation"). The amplify icon is Ruler of
 * Limbo's (45055, an Age of Apocalypse side scheme printing one), staged in a real Rhino game.
 */

import { cardId, ELEKTRA_CARDS, PLAYABLE_CARDS } from "@mc/content";
import type { Command, GameEvent, GameState, InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { drive, intoPlay, rhino } from "./testing/qa-bench.js";
import { identityOf, P1, patchInstance } from "./testing/harness.js";
import { encounterCardInVillainArea } from "./testing/staging.js";

vi.setConfig({ testTimeout: 120_000 });

const BLACK_CAT = "63016";
const ELEKTRA = "63001a";
const RULER_OF_LIMBO = "45055";

/** The real cards this test stages, added to the game's pool (the Elektra pack is not seatable yet). */
function pooled(state: GameState): GameState {
  const extra = [...ELEKTRA_CARDS, ...PLAYABLE_CARDS].filter((c) =>
    [BLACK_CAT, ELEKTRA, RULER_OF_LIMBO].includes(c.id as string),
  );
  return { ...state, cardPool: { ...state.cardPool, ...Object.fromEntries(extra.map((c) => [c.id, c])) } };
}

/** Ruler of Limbo in the villain area with 2 threat: one amplify icon in play. */
function withLimbo(state: GameState): GameState {
  const placed = encounterCardInVillainArea(state, "01107", 2);
  return patchInstance(placed.state, placed.id, { cardId: cardId(RULER_OF_LIMBO) });
}

const flips = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { type: "characterBoostCardFlipped" }> => e.type === "characterBoostCardFlipped",
  );

const thwartMain = (state: GameState, thwarter: InstanceId): Command => ({
  type: "basicThwart",
  playerId: P1,
  thwarterInstanceId: thwarter,
  schemeInstanceId: state.mainScheme!.instanceId,
});
const attackVillain = (state: GameState, attacker: InstanceId): Command => ({
  type: "basicAttack",
  playerId: P1,
  attackerInstanceId: attacker,
  targetInstanceId: state.villains[0]!.instanceId,
});

/** The one character boost card `command` turned up, run with and without Ruler of Limbo in play. */
function bothWays(state: GameState, command: (s: GameState) => Command) {
  const plain = drive(state, command(state));
  const amplified = drive(withLimbo(state), command(state));
  expect(plain.accepted && amplified.accepted).toBe(true);
  const [without] = flips(plain.events);
  const [withIcon] = flips(amplified.events);
  expect(without).toBeDefined();
  expect(withIcon?.instanceId).toBe(without?.instanceId);
  // The outcome, not only the reported count: one more threat removed from the main scheme or damage on the villain.
  const progress = (s: GameState) =>
    s.instances[s.villains[0]!.instanceId]!.damage - s.instances[s.mainScheme!.instanceId]!.threat;
  expect(progress(amplified.state)).toBe(progress(plain.state) + 1);
  return { without: without!, withIcon: withIcon! };
}

describe("Black Cat (63016) as a villainous ally: amplify adds to her boost card (owner, 2026-11-14)", () => {
  const cat = () => intoPlay(pooled(rhino()), BLACK_CAT);

  it("her basic thwart", () => {
    const { state, id } = cat();
    const { without, withIcon } = bothWays(state, (s) => thwartMain(s, id));
    expect(without).toMatchObject({ characterInstanceId: id, power: "thwart" });
    expect(withIcon.boostIcons).toBe(without.boostIcons + 1);
  });

  it("her basic attack", () => {
    const { state, id } = cat();
    const { without, withIcon } = bothWays(state, (s) => attackVillain(s, id));
    expect(without).toMatchObject({ characterInstanceId: id, power: "attack" });
    expect(withIcon.boostIcons).toBe(without.boostIcons + 1);
  });
});

describe("Elektra (63001a) in hero form: amplify adds to her boost card (owner, 2026-11-14)", () => {
  /** Spider-Man's identity relabeled Elektra, on the instance and on the seat (the identity is read from both). */
  const elektra = () => {
    const state = pooled(rhino());
    const relabeled = patchInstance(state, identityOf(state), { cardId: cardId(ELEKTRA) });
    return {
      ...relabeled,
      players: relabeled.players.map((p) =>
        p.playerId === P1 ? { ...p, identity: { ...p.identity, cardId: cardId(ELEKTRA) } } : p,
      ),
    };
  };

  it("her basic thwart", () => {
    const state = elektra();
    const { without, withIcon } = bothWays(state, (s) => thwartMain(s, identityOf(s)));
    expect(without).toMatchObject({ power: "thwart" });
    expect(withIcon.boostIcons).toBe(without.boostIcons + 1);
  });

  it("her basic attack", () => {
    const state = elektra();
    const { without, withIcon } = bothWays(state, (s) => attackVillain(s, identityOf(s)));
    expect(without).toMatchObject({ power: "attack" });
    expect(withIcon.boostIcons).toBe(without.boostIcons + 1);
  });
});
