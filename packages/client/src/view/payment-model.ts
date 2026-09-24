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

import type { AbilityId, ResourceIconType } from "@mc/content";
import {
  locateCard,
  paymentFor,
  playCostOf,
  tryPayment,
  type ActionRef,
  type Command,
  type CostSelection,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PaymentQuery,
  type PaymentSource,
  type PlayerId,
} from "@mc/engine";
import {
  costReductionOptionsFor,
  costReductionTotal,
  tryReducedPlay,
  type CostReductionOption,
} from "./cost-reduction-model.js";
import { faceUpName } from "./names.js";

export interface PaymentState {
  readonly action: ActionRef;
  /** The target already chosen for the action, if it needed one. */
  readonly target: InstanceId | null;
  /** The seat a "play under any player's control" card was sent to, when it isn't the payer's own. */
  readonly controllerId?: PlayerId | null;
  /**
   * The either/or branch and "up to N" counter count, made up front like every other cost pick
   * (docs/phase7-wave3.md §3.32, §3.36) — chosen before payment opens (`view/cost-choice-model.ts`), since it can
   * change what `query` even offers (an either/or branch's own components, an "up to N" cost's own size).
   */
  readonly costSelection?: CostSelection;
  readonly query: PaymentQuery;
  /** Option ids picked so far, in the order they were picked. */
  readonly picked: readonly string[];
  /**
   * `playCostReduction` abilities named on this play (docs/phase7-wave3.md §3.20; Star-Lord's "What could go
   * wrong?") — opted into here, not guessed, since spending an interrupt's own cost (dealing yourself a facedown
   * encounter card) is a real decision the player makes, not a free saving the game applies on its own. Empty for
   * every action but `playCard`.
   */
  readonly reductions: readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[];
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
  /**
   * Why the denominator isn't the number printed on the card — "Steve Rogers: 3 → 2" — or null when it is.
   *
   * Without this the bar counts to a total nothing on the table explains, and the player is left to guess
   * whether the game is wrong or they have forgotten an ability. It names the source card wherever the engine
   * can attribute one; a pending "reduce the cost of your next card" effect has no source card, so that reads
   * as a bare reduction.
   */
  readonly priceNote: string | null;
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
   * The sources that are not hand cards — a resource ability on a card in play
   * (Peter Parker's Scientist, Pepper Potts) — one per option, since a card
   * could offer two. The hand is the only zone visible on every layout, so the
   * payment strip draws these beside it; otherwise, on a phone, the one
   * resource that makes a card affordable can sit on a tab you aren't looking at.
   */
  readonly tableSources: readonly PaymentSourceView[];
  /**
   * Whether the card being paid for is in the payer's hand, where the board
   * already tags it. False for an ability on a card in play, which needs its
   * own thumbnail in the bar.
   */
  readonly subjectInHand: boolean;
  /**
   * The command to send, when the engine accepts this exact selection. Null
   * while it does not — with the engine's reason in `blockedBy`.
   */
  readonly command: Command | null;
  readonly blockedBy: string | null;
  /**
   * `playCostReduction` abilities the player could name on this play (docs/phase7-wave3.md §3.20), for a
   * "reduce the cost" toggle beside the bar. Empty for anything but `playCard`, and for a `playCard` with none in
   * play — the overwhelmingly common case, which draws nothing extra.
   */
  readonly costReductionOptions: readonly CostReductionOption[];
  /** Which of `costReductionOptions` are currently named on the play. */
  readonly reductions: readonly { readonly instanceId: InstanceId; readonly abilityId: AbilityId }[];
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
  controllerId: PlayerId | null = null,
  costSelection?: CostSelection,
): PaymentState | null {
  const query = paymentFor(state, playerId, action, paymentContext(target, controllerId, costSelection), deps);
  if (!query) return null;
  return {
    action,
    target,
    controllerId,
    ...(costSelection ? { costSelection } : {}),
    query,
    picked: [],
    reductions: [],
  };
}

const paymentContext = (
  target: InstanceId | null,
  controllerId: PlayerId | null | undefined,
  costSelection?: CostSelection,
) => ({ target, ...(controllerId ? { controllerId } : {}), ...(costSelection ? { costSelection } : {}) });

/** Toggles one source in or out of the payment. */
export function togglePayment(payment: PaymentState, optionId: string): PaymentState {
  const picked = payment.picked.includes(optionId)
    ? payment.picked.filter((id) => id !== optionId)
    : [...payment.picked, optionId];
  return { ...payment, picked };
}

/**
 * Toggles one `playCostReduction` ability in or out of the play (docs/phase7-wave3.md §3.20). A no-op for anything
 * but a `playCard` action — nothing else carries `costReductionAbilities`.
 */
export function toggleCostReduction(payment: PaymentState, option: CostReductionOption): PaymentState {
  if (payment.action.kind !== "playCard") return payment;
  const matches = (r: { readonly instanceId: InstanceId; readonly abilityId: AbilityId }) =>
    r.instanceId === option.instanceId && r.abilityId === option.abilityId;
  const reductions = payment.reductions.some(matches)
    ? payment.reductions.filter((r) => !matches(r))
    : [...payment.reductions, { instanceId: option.instanceId, abilityId: option.abilityId }];
  return { ...payment, reductions };
}

/** Clears the selection, so a player can start the payment over without cancelling. */
export const clearPayment = (payment: PaymentState): PaymentState => ({ ...payment, picked: [], reductions: [] });

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

  const { action } = payment;
  const subject = action.kind === "playCard" || action.kind === "useAbility" ? action.instanceId : null;
  const costReductionOptions =
    action.kind === "playCard" ? costReductionOptionsFor(state, playerId, action.instanceId, deps) : [];
  const reductionAmount = costReductionTotal(payment.reductions, deps);

  const attempt =
    action.kind === "playCard" && payment.reductions.length > 0
      ? tryReducedPlay(
          state,
          playerId,
          action.instanceId,
          picked,
          query.sources,
          payment.reductions,
          deps,
          payment.target,
          payment.controllerId ?? null,
          payment.costSelection,
        )
      : tryPayment(
          state,
          playerId,
          payment.action,
          picked,
          paymentContext(payment.target, payment.controllerId, payment.costSelection),
          deps,
        );

  const requirement =
    reductionAmount > 0
      ? { ...query.requirement, generic: Math.max(0, query.requirement.generic - reductionAmount) }
      : query.requirement;
  const sources = query.sources.map((source) => ({ ...source, spent: picked.includes(source.optionId) }));
  return {
    headline,
    subject,
    paid,
    required: poolTotal(requirement),
    priceNote: subject !== null && action.kind === "playCard" ? priceNoteFor(state, playerId, subject, deps) : null,
    outstanding: outstandingTypes({ ...query, requirement }, picked, byOption),
    spendable,
    spent,
    sources,
    tableSources: sources.filter((source) => source.kind === "resourceAbility"),
    subjectInHand: subject !== null && locateCard(state, subject)?.kind === "hand",
    command: attempt.ok ? attempt.command : null,
    blockedBy: attempt.ok ? null : attempt.message,
    costReductionOptions,
    reductions: payment.reductions,
  };
}

/**
 * The one line that explains a price the card does not print: "Steve Rogers: 3 → 2". Null when the card costs
 * what it says, which is the overwhelmingly common case and wants no words at all.
 */
function priceNoteFor(state: GameState, playerId: PlayerId, subject: InstanceId, deps: EngineDeps): string | null {
  const price = playCostOf(state, playerId, subject, deps);
  if (!price || price.current === price.printed) return null;
  const names: string[] = [];
  for (const { sourceInstanceId } of price.contributions) {
    if (sourceInstanceId === subject) continue;
    const name = faceUpName(state, sourceInstanceId);
    if (name && !names.includes(name)) names.push(name);
  }
  const why = names.length > 0 ? `${names.join(", ")}: ` : "";
  return `${why}${price.printed} → ${price.current}`;
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
