import { cardId } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId, type PlayerSetup } from "@mc/engine";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { firstLegal, identityOf, moveToHand, P1, patchInstance, settle } from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../../wave8/index.js";
import { WAVE9_CARDS } from "../../cards.js";
import { wave9StarterDeckSetup } from "../../setup.js";
import { MARIA_HILL_IDENTITY } from "./identity.js";

/**
 * Shared helpers for the Maria Hill identity tests: the precon `maria-hill-leadership` (40 cards) against Core's
 * Rhino, with every earlier script plus only this module. The pack's other modules are scripted separately, so the
 * supports used here are staged with their counters and carry no abilities of their own.
 */
export const MARIA_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, MARIA_HILL_IDENTITY) };

/** A game past setup (alter-ego form, hand of 6) with the Maria Hill precon against Rhino. */
export function mariaGame(seed = 1, swap: Readonly<Record<string, string>> = {}): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const printed = wave9StarterDeckSetup("maria-hill-leadership");
  const remaining = { ...swap };
  const seat: PlayerSetup = {
    ...printed,
    deck: printed.deck.map((id) => {
      const replacement = remaining[id as string];
      if (replacement === undefined) return id;
      delete remaining[id as string];
      return cardId(replacement);
    }),
  };
  // A swapped-in card makes the deck illegal for the identity, so legality is only checked for the printed deck.
  const created = createGame(
    { ...base, players: [seat], requireLegalDecks: Object.keys(swap).length === 0 },
    MARIA_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", MARIA_DEPS);
}

/** The same game with Maria Hill in hero form. */
export const mariaHeroGame = (seed = 1, swap: Readonly<Record<string, string>> = {}): GameState =>
  withForm(mariaGame(seed, swap), { heroForm: 0 });

/**
 * Staging surgery: the first copy of `code` (from deck, hand or discard) put straight into P1's play area, faceup and
 * ready, holding `counters` (by counter type). Returns the new instance.
 */
export function inPlay(
  state: GameState,
  code: string,
  counters: Readonly<Record<string, number>> = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const s = given.state;
  const placed: GameState = {
    ...s,
    players: s.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
    ),
  };
  return { id, state: patchInstance(placed, id, { faceup: true, controllerId: P1, counters: { ...counters } }) };
}

export { identityOf };
