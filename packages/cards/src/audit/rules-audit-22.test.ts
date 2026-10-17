/**
 * Rules audit chunk 22 (Appendix V errata, SUPERHUMAN LAW DIVISION ... ASTEROID M). Audit proofs only: each `it.fails`
 * marks a place the engine or card data does not follow the source, and flips to a failure when it is fixed.
 *
 * RRG 1.8 Appendix V p. 66 (printed): "THE POISON (#125) Should read: 'Hero Action: Spend 3 resources of different types
 * -> discard this card. Any player can do this.' (Changed reminder text to rules text.)" and OBEDIENCE POTION (#123)
 * "Hero Action: Take 1 damage and spend [mental][mental] resources -> discard this card. Any player can do this."
 * FFG ruling after RRG 1.5 (Hall of Heroes "Latest FFG Rulings (post RRG 1.5)", Alex): "Any player can do this" is
 * rules text, so the card text beats the "you/your attachment" exception of RRG 1.8 p. 4 (Ability). The engine
 * (`actions.ts` useAbility, "only the player it is attached to can use that card") refuses every other player.
 *
 * RRG 1.8 Appendix V p. 65 (printed): "WARNING (#21) ... (Removed '(defense)' and the Defense trait.)" The card data
 * keeps `traits: [DEFENSE]`.
 */
import { WAVE8_CARDS } from "../wave8/index.js";
import {
  activeEncounterDeckId,
  cardOf,
  printedResources,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { applyCommand } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { endTurn, identityOf, P1, playerOf, toHero, use } from "../testing/harness.js";
import { runWave3, startWave3Game, WAVE3_DEPS } from "../wave3/testing.js";
import { wave3Scenario } from "../wave3/setup.js";

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

/** `n` hand cards of `playerId` that can pay `mental` (their own printed type or wild), moved into hand if needed. */
function mentalPayment(
  state: GameState,
  playerId: PlayerId,
  n: number,
): { state: GameState; pay: { fromHand: InstanceId }[] } {
  const player = playerOf(state, playerId);
  const ok = (id: InstanceId) => {
    const c = cardOf(state, id);
    if (!c) return false;
    const pool = printedResources(c);
    return pool.mental > 0 || pool.wild > 0;
  };
  const inHand = player.hand.filter(ok);
  const fromDeck = player.deck.filter(ok).slice(0, Math.max(0, n - inHand.length));
  const next: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === playerId
        ? { ...p, hand: [...p.hand, ...fromDeck], deck: p.deck.filter((id) => !fromDeck.includes(id)) }
        : p,
    ),
  };
  const usable = [...inHand, ...fromDeck].slice(0, n);
  if (usable.length < n) throw new Error(`not enough mental cards for ${playerId}`);
  return { state: next, pay: usable.map((fromHand) => ({ fromHand })) };
}

describe("audit 22.4 THE POISON / 22.3 OBEDIENCE POTION: 'Any player can do this' is rules text (RRG 1.8 p. 66)", () => {
  const twoPlayers = () =>
    startWave3Game(
      wave3Scenario("infiltrate-the-museum", {
        players: [{ starterDeckId: "groot-protection" }, { starterDeckId: "rocket-raccoon-aggression" }],
        seed: 2026,
      }),
    );

  function staged(user: PlayerId) {
    const base = twoPlayers();
    const p1Identity = identityOf(base, P1);
    const { state: attached, id: potion } = attachTo(base, "16123", p1Identity);
    let state = user === P1 ? attached : runWave3(attached, endTurn(P1));
    state = runWave3(state, toHero(user));
    const primed = mentalPayment(state, user, 2);
    state = primed.state;
    return { state, potion, pay: primed.pay };
  }

  it("control: the player it is attached to can use Obedience Potion's Hero Action", () => {
    const { state, potion, pay } = staged(P1);
    const result = applyCommand(state, use(P1, potion, "16123.obedience-potion-action", pay), WAVE3_DEPS);
    expect(result.ok).toBe(true);
  });

  it.fails("another player can use Obedience Potion's Hero Action on a teammate's identity", () => {
    const { state, potion, pay } = staged(P2);
    const result = applyCommand(state, use(P2, potion, "16123.obedience-potion-action", pay), WAVE3_DEPS);
    // Today: ok === false, "only the player it is attached to can use that card".
    expect(result.ok ? "" : result.error.message).toBe("");
  });
});

describe("audit 22.2 WARNING: the Defense trait was removed (RRG 1.8 p. 65)", () => {
  it("Warning (09021) has no Defense trait", () => {
    const warning = WAVE8_CARDS.find((c) => (c.id as string) === "09021") as unknown as { traits: readonly string[] };
    expect(warning).toBeDefined();
    expect(warning.traits).not.toContain("DEFENSE");
  });
});
