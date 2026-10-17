/**
 * Rules audit chunk 37 (FFG rulings post-RRG 1.5, June 30 - August 10, 2023). Audit proofs only: each `it.fails`
 * marks a place the engine does something an official source forbids, and flips to a failure when it is fixed.
 *
 * FFG ruling July 13, 2023 - Ruling 48 (Alex): Restrained (Mad Titan's Shadow #83) has no "you" or "your", so "any
 * player can use the hero action to discard the card from the attached character" (also when it is attached to
 * another player's identity or ally). RRG 1.8 p. 4 (Ability): "Only the player who controls a player card with an
 * attachment that uses the word 'you' or 'your' can trigger abilities or pay costs on that attachment."
 * The engine (`actions.ts` useAbility, "only the player it is attached to can use that card") refuses every other
 * player for every encounter attachment on a player's card (RRG 1.8 p. 8 "Attachment", last bullet, read alone).
 * RRG 1.8 conflicts with itself here: p. 8 has no "you"/"your" limit, p. 4 does. FFG ruling December 17, 2025, Ruling 1
 * (https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) says any player can trigger an Action on an encounter
 * card "with the exception of certain attachments and obligations", which fits p. 4. Contributor's rules call
 * 2026-10-16 (bluefireF5ran): follow p. 4 and the rulings (https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/).
 * Findings for the same root cause: chunk-02 (flag) and chunk-22 (22.3 / 22.4, errata cards).
 */
import {
  activeEncounterDeckId,
  applyCommand,
  cardOf,
  printedResources,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { endTurn, firstLegal, identityOf, P1, playerOf, settle, toHero, use } from "../testing/harness.js";

import { runWave4, startWave4Game, WAVE4_DEPS } from "../wave4/testing.js";
import { spectrumScenario } from "../wave4/mts/support.js";

const P2 = "p2" as PlayerId;

function attachTo(state: GameState, code: string, host: InstanceId): { state: GameState; id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = cardId(code);
  const id =
    pile.deck.find((i) => state.instances[i]?.cardId === wanted) ??
    pile.discard.find((i) => state.instances[i]?.cardId === wanted);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}

/** Two hand cards of `playerId` that pay [energy] and [physical] (a wild stands for either), moved into hand if needed. */
function energyPhysical(state: GameState, playerId: PlayerId): { state: GameState; pay: { fromHand: InstanceId }[] } {
  const player = playerOf(state, playerId);
  const pool = (id: InstanceId) => {
    const c = cardOf(state, id);
    return c ? printedResources(c) : null;
  };
  const all = [...player.hand, ...player.deck];
  const energy = all.find((id) => (pool(id)?.energy ?? 0) > 0);
  const physical = all.find((id) => id !== energy && ((pool(id)?.physical ?? 0) > 0 || (pool(id)?.wild ?? 0) > 0));
  if (!energy || !physical) throw new Error("no energy + physical payment found");
  const moved = [energy, physical].filter((id) => !player.hand.includes(id));
  const next: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId
        ? { ...p, hand: [...p.hand, ...moved], deck: p.deck.filter((id) => !moved.includes(id)) }
        : p,
    ),
  };
  return { state: next, pay: [energy, physical].map((fromHand) => ({ fromHand })) };
}

describe("audit 37.13 Restrained (21083): any player can use its hero action (ruling July 13, 2023 - Ruling 48)", () => {
  function staged(user: PlayerId) {
    const base = startWave4Game(
      spectrumScenario("ebony-maw", { seed: 5, extraPlayers: [{ starterDeckId: "adam-warlock-all-aspects" }] }),
    );
    const { state: attached, id } = attachTo(base, "21083", identityOf(base, P1));
    let state = user === P1 ? attached : settle(runWave4(attached, endTurn(P1)), firstLegal, undefined, WAVE4_DEPS);
    state = settle(runWave4(state, toHero(user)), firstLegal, undefined, WAVE4_DEPS);
    const primed = energyPhysical(state, user);
    return { state: primed.state, id, pay: primed.pay };
  }

  it("control: the player it is attached to can use it", () => {
    const { state, id, pay } = staged(P1);
    const result = applyCommand(state, use(P1, id, "21083.restrained-action", pay), WAVE4_DEPS);
    expect(result.ok ? "" : result.error.message).toBe("");
  });

  it("another player can use it on a teammate's identity", () => {
    const { state, id, pay } = staged(P2);
    const result = applyCommand(state, use(P2, id, "21083.restrained-action", pay), WAVE4_DEPS);
    // Fixed: `triggerableBy: eachPlayer` replaces the attachment rule of RRG 1.8 p. 8 for this card.
    expect(result.ok ? "" : result.error.message).toBe("");
  });
});
