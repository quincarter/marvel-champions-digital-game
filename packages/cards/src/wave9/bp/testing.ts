import { cardId } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId, type PlayerSetup } from "@mc/engine";
import { coreScenario } from "../../core/setup.js";
import { mergeRegistries } from "../../dsl/index.js";
import { firstLegal, identityOf, moveToHand, P1, settle } from "../../testing/harness.js";
import { withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import { WAVE9_CARDS } from "../cards.js";
import { BP_ABILITIES } from "./index.js";
import { wave9StarterDeckSetup } from "../setup.js";

/**
 * Shared helpers for the Black Panther (Shuri) pack's tests: the precon (`bp-justice`, 40 cards) against Core's Rhino,
 * with every earlier script plus this pack's own. The pack's modules are scripted one at a time, so a test that needs a
 * card of another module borrows a Core card instead (`bpSeat`'s `swap`): that deck is not legal for the identity, so
 * the game is created with deck legality unchecked.
 */
export const BP_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, BP_ABILITIES) };

/** The printed precon as a seat, optionally with named cards swapped in for others (deck stays 40). */
export function bpSeat(swap: Readonly<Record<string, string>> = {}): PlayerSetup {
  const seat = wave9StarterDeckSetup("bp-justice");
  const remaining = { ...swap };
  const deck = seat.deck.map((id) => {
    const replacement = remaining[id as string];
    if (replacement === undefined) return id;
    delete remaining[id as string];
    return cardId(replacement);
  });
  return { ...seat, deck };
}

/** A game past setup (alter-ego form, hand of 6) for `seats` (the first the Black Panther precon) against Rhino. */
export function bpGame(
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
    { ...base, requireLegalDecks: false, players: opts.twoPlayers ? [bpSeat(opts.swap), second] : [bpSeat(opts.swap)] },
    BP_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", BP_DEPS);
}

/** The same game with Black Panther in hero form. */
export const bpHeroGame = (opts: Parameters<typeof bpGame>[0] = {}): GameState =>
  withForm(bpGame(opts), { heroForm: 0 });

/**
 * Staging surgery: a copy of the upgrade `code` from P1's deck or hand attached to P1's identity, faceup and ready (no
 * cost, no enter-play), for a test that needs several upgrades at once. Returns the new instance.
 */
export function attachUpgrade(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const host = identityOf(given.state);
  const s = given.state;
  return {
    id,
    state: {
      ...s,
      players: s.players.map((p) => (p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id) } : p)),
      instances: {
        ...s.instances,
        [id]: { ...s.instances[id]!, faceup: true, attachedTo: host },
        [host]: { ...s.instances[host]!, attachments: [...s.instances[host]!.attachments, id] },
      },
    },
  };
}

/** Staging surgery: a copy of the ally or support `code` put straight into P1's play area, faceup and ready. */
export function putInPlay(state: GameState, code: string): { readonly state: GameState; readonly id: InstanceId } {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const s = given.state;
  return {
    id,
    state: {
      ...s,
      players: s.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: p.hand.filter((i) => i !== id), playArea: [...p.playArea, id] } : p,
      ),
      instances: { ...s.instances, [id]: { ...s.instances[id]!, faceup: true, controllerId: P1 } },
    },
  };
}
