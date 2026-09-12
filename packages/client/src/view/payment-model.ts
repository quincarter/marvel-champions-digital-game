/**
 * Paying for a card, as the player's own decision.
 *
 * Until now the client played a card with whatever payment the engine happened
 * to find first (`LegalAction.example`). That is a legal payment, but it is not
 * the player's — spending the wrong card is how you lose a turn two rounds
 * later, and choosing what to spend is a real part of the game.
 *
 * The design makes this a *mode over the hand*, not a dialog (`Board - Phone`:
 * a red bar reading "PAYING 1 / 3 — Photon Blast → Klaw. Tap cards to spend."
 * above a hand whose cards you tap). So this module is the state of that mode,
 * and the Board draws it.
 *
 * Every judgement belongs to the engine: `paymentFor` says what may be spent
 * and what it is worth, and `tryPayment` is the only thing that decides whether
 * a selection is enough. This model counts pips for the bar and nothing else.
 */

import type { ResourceIconType } from "@mc/content";
import {
  paymentFor,
  tryPayment,
  type ActionRef,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PaymentQuery,
  type PaymentSource,
  type PlayerId,
} from "@mc/engine";

export interface PaymentState {
  readonly action: ActionRef;
  /** The target already chosen for the action, if it needed one. */
  readonly target: InstanceId | null;
  readonly query: PaymentQuery;
  /** Option ids picked so far, in the order they were picked. */
  readonly picked: readonly string[];
}

/**
 * One source, as `PaymentView.sources` lists it: everything `PaymentSource`
 * already carries (`instanceId`, `kind`, `pool`, ...) plus whether it is
 * currently picked. `spendable`/`spent` (below) split the same sources into
 * two maps keyed by instance id, which is what the hand already draws by; this
 * is the same information as one flat, ordered list, for a renderer that wants
 * every source as a card regardless of which zone it lives in — the gap the
 * two maps don't cover is a `"resourceAbility"` source (Aunt May, Genius, a
 * resource ability on a card already in play), which is not a hand card at
 * all and so never appears in anything keyed only to the hand.
 */
export interface PaymentSourceView extends PaymentSource {
  readonly spent: boolean;
}

export interface PaymentView {
  /** "Photon Blast → Klaw", for the bar's one line of prose. */
  readonly headline: string;
  /**
   * The card being paid for. It is never one of its own sources, but it is the
   * subject of the whole mode — the design rings it rather than dimming it.
   *
   * This is an id, not a name, on purpose: `cardOf`/`artFor` turn it into the
   * same art a hand or play-area card renders with, so the mode can show the
   * card itself rather than repeat its name in prose. For a `playCard` action
   * the subject is in the hand the board already draws and can be tagged in
   * place; for a `useAbility` action it is a card already in play (e.g. Iron
   * Man's identity ability), outside the hand fan entirely, so nothing tags it
   * today unless the board also renders a small thumbnail for it — the change
   * this file's owner cannot make (`scenes/board.ts`).
   */
  readonly subject: InstanceId | null;
  /** Resources the picked sources add up to. The bar's numerator. */
  readonly paid: number;
  /** Resources the action costs. The bar's denominator. */
  readonly required: number;
  /** Typed requirements still outstanding, e.g. "1 energy". Empty when only generic is left. */
  readonly outstanding: readonly string[];
  /** Sources that can still be tapped, by instance id, so the board can light them. */
  readonly spendable: ReadonlyMap<InstanceId, PaymentSource>;
  /** Picked sources, by instance id, so the board can ring them. */
  readonly spent: ReadonlyMap<InstanceId, PaymentSource>;
  /**
   * Every source the query offers, in the engine's own order, spendable and
   * spent alike, each carrying whether it is currently picked. This is
   * `spendable` and `spent` merged back into one list — for a renderer that
   * wants to lay out "what you can pay with" as a row of cards (a
   * `resourceAbility` source included) rather than reconstruct that list
   * from two maps keyed to the hand.
   */
  readonly sources: readonly PaymentSourceView[];
  /**
   * The command to send, when the engine accepts this exact selection. Null
   * while it does not — with the engine's reason in `blockedBy`.
   */
  readonly command: Command | null;
  readonly blockedBy: string | null;
}

/**
 * Opens payment for an action, with nothing picked yet. Null when the action
 * needs no payment, in which case the caller should just dispatch it.
 *
 * It deliberately does *not* start from `query.suggested`, the engine's own
 * smallest working payment. Opening a payment that is already paid reads as the
 * game having decided for you: the bar says "PAYING 2 / 2" the instant you tap
 * a card, and a resource you never chose is already marked as spent. The count
 * is meant to fill up as you pick, the way the design canvas shows it.
 */
export function beginPayment(
  state: GameState,
  playerId: PlayerId,
  action: ActionRef,
  target: InstanceId | null,
  deps: EngineDeps,
): PaymentState | null {
  const query = paymentFor(state, playerId, action, { target }, deps);
  if (!query) return null;
  return { action, target, query, picked: [] };
}

/** Toggles one source in or out of the payment. */
export function togglePayment(payment: PaymentState, optionId: string): PaymentState {
  const picked = payment.picked.includes(optionId)
    ? payment.picked.filter((id) => id !== optionId)
    : [...payment.picked, optionId];
  return { ...payment, picked };
}

/** Clears the selection, so a player can start the payment over without cancelling. */
export const clearPayment = (payment: PaymentState): PaymentState => ({ ...payment, picked: [] });

export function paymentView(
  state: GameState,
  playerId: PlayerId,
  payment: PaymentState,
  headline: string,
  deps: EngineDeps,
): PaymentView {
  const { query, picked } = payment;
  const byOption = new Map(query.sources.map((source) => [source.optionId, source] as const));

  const spendable = new Map<InstanceId, PaymentSource>();
  const spent = new Map<InstanceId, PaymentSource>();
  for (const source of query.sources) {
    if (picked.includes(source.optionId)) spent.set(source.instanceId, source);
    else spendable.set(source.instanceId, source);
  }

  const paid = picked.reduce((total, optionId) => total + poolTotal(byOption.get(optionId)?.pool), 0);
  const attempt = tryPayment(state, playerId, payment.action, picked, { target: payment.target }, deps);

  const { action } = payment;
  return {
    headline,
    subject: action.kind === "playCard" || action.kind === "useAbility" ? action.instanceId : null,
    paid,
    required: poolTotal(query.requirement),
    outstanding: outstandingTypes(query, picked, byOption),
    spendable,
    spent,
    sources: query.sources.map((source) => ({ ...source, spent: picked.includes(source.optionId) })),
    command: attempt.ok ? attempt.command : null,
    blockedBy: attempt.ok ? null : attempt.message,
  };
}

/** The three typed requirements. `generic` takes any icon, `wild` pays any type. */
const TYPED = ["physical", "mental", "energy"] as const satisfies readonly ResourceIconType[];

/**
 * Typed requirements the selection doesn't cover yet, counting wild toward any
 * of them. This is an *advisory* count for the bar — the engine decides whether
 * a payment works, and a wild spent against one requirement here may be
 * assigned differently when `applyCommand` actually resolves it.
 */
function outstandingTypes(
  query: PaymentQuery,
  picked: readonly string[],
  byOption: ReadonlyMap<string, PaymentSource>,
): readonly string[] {
  const pools = picked.flatMap((optionId) => {
    const source = byOption.get(optionId);
    return source ? [source.pool] : [];
  });
  let wild = pools.reduce((total, pool) => total + pool.wild, 0);

  const short: string[] = [];
  for (const type of TYPED) {
    const need = query.requirement[type];
    if (need <= 0) continue;
    const have = pools.reduce((total, pool) => total + pool[type], 0);
    let missing = need - have;
    if (missing > 0) {
      const covered = Math.min(missing, wild);
      wild -= covered;
      missing -= covered;
    }
    if (missing > 0) short.push(`${missing} ${type}`);
  }
  return short;
}

const poolTotal = (pool: Readonly<Record<string, number>> | undefined): number =>
  pool ? Object.values(pool).reduce((total, count) => total + count, 0) : 0;
