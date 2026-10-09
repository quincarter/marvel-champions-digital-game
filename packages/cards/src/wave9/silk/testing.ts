import { cardId } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerSetup,
} from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { firstLegal, identityOf, P1, settle } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { wave9StarterDeckSetup } from "../setup.js";
import { SILK_ABILITIES } from "./index.js";

/**
 * Shared helpers for the Silk pack's tests: the precon (`silk-protection`, 40 cards) against Core's Rhino, with every
 * earlier script plus this pack's own. The pack's modules are scripted one at a time, so a test that needs a card of
 * another module borrows a Core card instead (`silkSeat`'s `swap`): that deck is not legal for the identity, so the
 * game is created with deck legality unchecked.
 */
export const SILK_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, SILK_ABILITIES) };

/** The printed precon as a seat, optionally with named cards swapped in for others (deck stays 40). */
export function silkSeat(swap: Readonly<Record<string, string>> = {}): PlayerSetup {
  const seat = wave9StarterDeckSetup("silk-protection");
  const remaining = { ...swap };
  const deck = seat.deck.map((id) => {
    const replacement = remaining[id as string];
    if (replacement === undefined) return id;
    delete remaining[id as string];
    return cardId(replacement);
  });
  return { ...seat, deck };
}

/** A game past setup (alter-ego form, hand of 6) for the Silk precon (and optionally a Core second seat) against Rhino. */
export function silkGame(
  opts: {
    readonly swap?: Readonly<Record<string, string>>;
    readonly seed?: number;
    readonly twoPlayers?: boolean;
  } = {},
): GameState {
  const seed = opts.seed ?? 1;
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE9_CARDS,
  } as never);
  const second = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    modularSetIds: [],
  }).players[0]!;
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: opts.twoPlayers ? [silkSeat(opts.swap), second] : [silkSeat(opts.swap)],
    },
    SILK_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", SILK_DEPS);
}

/** The same game with Silk in hero form. */
export const silkHeroGame = (opts: Parameters<typeof silkGame>[0] = {}): GameState =>
  withForm(silkGame(opts), { heroForm: 0 });

/**
 * Staging surgery: a copy of the encounter card `code` (from the encounter deck, else its discard pile) tucked under
 * the host (default P1's identity), faceup, as an earlier tuck would have left it. Returns the new instance.
 */
export function tuckEncounterCard(
  state: GameState,
  code: string,
  host: InstanceId = identityOf(state),
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const wanted = (i: InstanceId) => state.instances[i]?.cardId === cardId(code);
  const id = pile.deck.find(wanted) ?? pile.discard.find(wanted);
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
        [id]: { ...state.instances[id]!, faceup: true },
        [host]: { ...state.instances[host]!, tucked: [...state.instances[host]!.tucked, id] },
      },
      // The engine's last observation of the cap (edge-triggered, `GameState.stateChecks`): it held, with room, before.
      stateChecks: {
        ...state.stateChecks,
        [`${host}:52001a.silk-constant`]: false,
        [`${host}:52001b.cindy-moon-constant`]: false,
      },
    },
  };
}

/** Staging surgery: a copy of the minion `code` from the encounter deck, faceup and engaged with P1 (no reveal, no When Revealed). */
export function engageMinion(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = pile.deck.find((i) => state.instances[i]?.cardId === cardId(code));
  if (!id) throw new Error(`no ${code} in the encounter deck`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard },
      },
      players: state.players.map((p) => (p.playerId === P1 ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, controllerId: null, engagedWith: P1 },
      },
    },
  };
}
