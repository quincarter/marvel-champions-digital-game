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
  controllerOf,
  locateCard,
  paymentFor,
  playCostOf,
  tryPayment,
  type ActionRef,
  type Command,
  type CostChoices,
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
import { costHelpLines } from "./cost-help-model.js";
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
  /**
   * The cards in play the player picked to pay the cost (`view/in-play-cost-choice.ts`): "these two allies". Sent in
   * the command in place of the engine's own default picks, which are only the first `min` candidates.
   */
  readonly costChoices?: CostChoices;
  /** The Action ability of a several-ability event the player chose (RRG 1.8 "Event", p. 18); each has its own cost. */
  readonly abilityId?: AbilityId;
  /** The scenario play area an ally is played into (`view/play-destination.ts`); absent: the player's own area. */
  readonly into?: string;
  /** Why the play can only go to `into` ("Only payable at the mission"): the price note's words in place of the usual one. */
  readonly destinationNote?: string;
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
  /**
   * Another player's hand card offered toward an alliance card (RRG 1.8 "Alliance", p. 6): the hero name of the
   * hand it sits in, so the strip can say whose card it is. Null for the payer's own cards and for resource
   * abilities.
   */
  readonly helperName: string | null;
  /**
   * What the source's own cost takes, in words, from the amount it carries (`PaymentSource.costSelection`): "take 2
   * damage" on Energy Siphon spent from the hand (one source per amount the engine allows), "remove 2 threat". Null for
   * a source with no chosen amount. The tile says it so the amount is read before the card is spent.
   */
  readonly amountNote: string | null;
  /**
   * Where a picked hand card falls in the order its discard pile receives the payment, from 1: the cards go one at a
   * time in the order they were picked, so the last one ends on top (RRG 1.8 "Discard", p. 16: the player chooses the
   * order of cards a singular effect discards; `payPayment` discards in payment order). Counted per discard pile, since
   * an alliance helper's card goes to its owner's pile. Null for a card not picked, and for a resource ability, which
   * discards nothing.
   */
  readonly discardOrder: number | null;
  /**
   * The last picked card for its discard pile: the one left on top once the payment is made, which is what "the top
   * card of your discard pile" reads next (Pepper Potts, FAQ "Pepper Potts (#33)", RRG 1.8 p. 57).
   */
  readonly onTop: boolean;
  /**
   * Why this source cannot be picked yet, or null. A resource that can only be overpaid (`overpayOnly`: Mr.
   * Hollywood) never makes the payment covered, so it is held until the rest of the picks cover the cost by themselves.
   */
  readonly lockedReason: string | null;
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
  /**
   * Sources that can still be tapped, by option id — not instance id: several options can come off one card (Sync
   * Ratio, `spdr` 31001a's own "exhaust an Interface upgrade you control" resource ability offers one option per
   * ready Interface, all naming the same SP//dr Suit `instanceId`, `resourceAbilityOptionId`), and keying by
   * instance id here collapsed them to whichever option the loop below saw last. `sources`/`tableSources` (below)
   * never had this gap — each is already a flat list of every option — but this map is what a renderer reaches for
   * to answer "is *this* one still spendable" without scanning the list.
   */
  readonly spendable: ReadonlyMap<string, PaymentSource>;
  /** Picked sources, by option id (see `spendable`'s own doc comment for why not instance id). */
  readonly spent: ReadonlyMap<string, PaymentSource>;
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
   * The sources that are not in the payer's hand — a resource ability on a card in play
   * (Peter Parker's Scientist, Pepper Potts), one per option since a card could offer two, and another player's
   * hand card offered toward an alliance card. The hand is the only zone visible on every layout, so the
   * payment strip draws these beside it; otherwise, on a phone, the one resource that makes a card affordable
   * can sit on a tab you aren't looking at, and a helper's hand is drawn nowhere at all.
   */
  readonly tableSources: readonly PaymentSourceView[];
  /**
   * Whether the card being paid for is in the payer's hand, where the board
   * already tags it. False for an ability on a card in play, which needs its
   * own thumbnail in the bar.
   */
  readonly subjectInHand: boolean;
  /**
   * What the picks generate beyond the cost, as a count: "Overpaid by 2" is the note the bar shows. Only while the
   * engine accepts the selection (a payment that does not cover the cost is not overpaid, it is short), and only for a
   * count of pips: which resources the card reads as paid and which as overpaid is the engine's, asked of the player
   * when it matters (`paidResourcesChosen`), so no type is named. 0 when nothing is over.
   */
  readonly overpaid: number;
  /** Why an overpay-only source (Mr. Hollywood) is held, with its name: "Mr. Hollywood: only to overpay…"; null when none is. */
  readonly lockedNote: string | null;
  /** The Pay button's words when nothing is picked on a play that costs nothing but could be overpaid; else null. */
  readonly payLabel: string | null;
  /** "Overpaid by 2", or null. What overpaying does for the card is not exposed by the engine, so it is not said. */
  readonly overpaidNote: string | null;
  /**
   * One line per other player whose hand cards the picks spend toward an alliance card: "Helped by Ana: 1 energy",
   * from the picked sources' own pools, then one per other player who pays a part of the cost in the user's place
   * ("Helped by Ana: the damage"; `cost-help-model.ts`). Empty for an ordinary payment.
   */
  readonly helperLines: readonly string[];
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
  costChoices?: CostChoices,
  abilityId?: AbilityId,
  into?: string,
): PaymentState | null {
  const query = paymentFor(
    state,
    playerId,
    action,
    paymentContext(target, controllerId, costSelection, costChoices, abilityId, into),
    deps,
  );
  if (!query) return null;
  return {
    action,
    target,
    controllerId,
    ...(costSelection ? { costSelection } : {}),
    ...(costChoices ? { costChoices } : {}),
    ...(abilityId ? { abilityId } : {}),
    ...(into !== undefined ? { into } : {}),
    query,
    picked: [],
    reductions: [],
  };
}

const paymentContext = (
  target: InstanceId | null,
  controllerId: PlayerId | null | undefined,
  costSelection?: CostSelection,
  costChoices?: CostChoices,
  abilityId?: AbilityId,
  into?: string,
) => ({
  target,
  ...(controllerId ? { controllerId } : {}),
  ...(costSelection ? { costSelection } : {}),
  ...(costChoices ? { costChoices } : {}),
  ...(abilityId ? { abilityId } : {}),
  ...(into !== undefined ? { into } : {}),
});

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

  const spendable = new Map<string, PaymentSource>();
  const spent = new Map<string, PaymentSource>();
  for (const source of query.sources) {
    if (picked.includes(source.optionId)) spent.set(source.optionId, source);
    else spendable.set(source.optionId, source);
  }

  const countsToCost = (optionId: string) => byOption.get(optionId)?.overpayOnly !== true;
  const paid = picked.reduce(
    (total, optionId) => total + (countsToCost(optionId) ? poolTotal(byOption.get(optionId)?.pool) : 0),
    0,
  );
  const overpayOnlyPaid = picked.reduce(
    (total, optionId) => total + (countsToCost(optionId) ? 0 : poolTotal(byOption.get(optionId)?.pool)),
    0,
  );

  const { action } = payment;
  const subject = action.kind === "playCard" || action.kind === "useAbility" ? action.instanceId : null;
  const costReductionOptions =
    action.kind === "playCard" ? costReductionOptionsFor(state, playerId, action.instanceId, deps) : [];
  const reductionAmount = costReductionTotal(payment.reductions, deps);

  const attemptWith = (ids: readonly string[]) =>
    action.kind === "playCard" && payment.reductions.length > 0
      ? tryReducedPlay(
          state,
          playerId,
          action.instanceId,
          ids,
          query.sources,
          payment.reductions,
          deps,
          payment.target,
          payment.controllerId ?? null,
          payment.costSelection,
          payment.costChoices,
          payment.abilityId,
        )
      : tryPayment(
          state,
          playerId,
          payment.action,
          ids,
          paymentContext(
            payment.target,
            payment.controllerId,
            payment.costSelection,
            payment.costChoices,
            payment.abilityId,
            payment.into,
          ),
          deps,
        );
  const attempt = attemptWith(picked);
  // The cost is covered when the picks that count toward it are accepted without the overpay-only ones.
  const covered = query.sources.some((source) => source.overpayOnly)
    ? attemptWith(picked.filter(countsToCost)).ok
    : attempt.ok;

  const requirement =
    reductionAmount > 0
      ? { ...query.requirement, generic: Math.max(0, query.requirement.generic - reductionAmount) }
      : query.requirement;
  const order = discardOrderOf(state, playerId, picked, byOption);
  const sources = query.sources.map((source) => ({
    ...source,
    spent: picked.includes(source.optionId),
    helperName: helperNameOf(state, playerId, source),
    amountNote: amountNoteOf(source),
    discardOrder: order.get(source.optionId)?.position ?? null,
    onTop: order.get(source.optionId)?.onTop ?? false,
    lockedReason:
      source.overpayOnly && !picked.includes(source.optionId) && !covered
        ? "Only to overpay: pick what pays for the card first"
        : null,
  }));
  // A chosen-size cost (`chosenResources`) spends up to `max` and overpays the rest; any other cost spends what it
  // requires. Only counted once the engine accepts the selection.
  const requiredTotal = poolTotal(requirement) + (query.chosenResources?.max ?? 0);
  const overpaid = attempt.ok ? Math.max(0, paid - requiredTotal) + overpayOnlyPaid : 0;
  return {
    headline,
    subject,
    paid,
    required: poolTotal(requirement),
    priceNote:
      payment.destinationNote ??
      (subject !== null && action.kind === "playCard" ? priceNoteFor(state, playerId, subject, deps) : null),
    outstanding: outstandingTypes({ ...query, requirement }, picked, byOption),
    spendable,
    spent,
    sources,
    tableSources: sources.filter((source) => source.kind === "resourceAbility" || source.helperName !== null),
    subjectInHand: subject !== null && locateCard(state, subject)?.kind === "hand",
    overpaid,
    lockedNote: ((held) => (held ? `${held.label}: ${held.lockedReason}` : null))(
      sources.find((source) => source.lockedReason !== null),
    ),
    payLabel:
      picked.length === 0 && poolTotal(requirement) === 0 && query.overpayMatters ? "Play without overpaying" : null,
    overpaidNote: overpaid > 0 ? `Overpaid by ${overpaid}` : null,
    // A helper's cards, then the parts of the cost a helper pays in the user's place (`costSelection.paidBy`).
    helperLines: [...helperLinesOf(sources), ...costHelpLines(state, playerId, payment.costSelection)],
    command: attempt.ok ? attempt.command : null,
    blockedBy: attempt.ok ? null : attempt.message,
    costReductionOptions,
    reductions: payment.reductions,
  };
}

/**
 * Alliance payment approval (RRG 1.8 "Alliance", p. 6; docs/phase7-wave4.md §4 Q10, "USER DECISION 2026-09-25":
 * each contributing player approves their own contribution before the command is sent).
 *
 * The engine already accepts one command naming every spent card, from any player's hand (`paymentFor`'s own
 * `sources` include another player's hand cards for an alliance card, `packages/engine/src/actions.ts`'s
 * `paymentOptions`) — this module never changes that. What's missing on the client side is consent: a payer could
 * otherwise spend a teammate's hand card with nothing more than a tap. This is the pure read of "whose cards, and
 * which ones, does the current selection spend" that the approval flow (`scenes/board/controller.ts`'s
 * `#selection.kind === "confirmingAllianceHelp"`) walks through one player at a time before dispatching.
 *
 * Hot-seat only (docs/phase7-wave4.md §4 Q10's own doc comment): this build has no multiplayer-netcode layer yet
 * (`engine/host.ts`'s own doc comment — a `WorkerEngineHost` off the main thread, not a network host), every seat
 * plays on the one local session, and the board's perspective already follows whoever must act
 * (`engine/acting-player.ts`). So "asking the other seats" is a same-device, pass-the-controller prompt addressed
 * to each helper in turn, not a request across a network boundary.
 */
export interface AllianceHelper {
  readonly playerId: PlayerId;
  /** The picked sources this player owns, in payment order. */
  readonly instanceIds: readonly InstanceId[];
}

/**
 * Every other player whose hand card or resource ability the current picks would spend, in seat order (never the
 * payer themselves — they already agreed to their own play by opening it). Empty for an ordinary payment, which is
 * every payment on a card without the alliance keyword, and for an alliance payment that only spends the payer's
 * own cards.
 */
export function allianceHelpersOf(
  state: GameState,
  payerId: PlayerId,
  payment: PaymentState,
): readonly AllianceHelper[] {
  const byOption = new Map(payment.query.sources.map((source) => [source.optionId, source] as const));
  const byPlayer = new Map<PlayerId, InstanceId[]>();
  for (const optionId of payment.picked) {
    const source = byOption.get(optionId);
    if (!source) continue;
    const owner = controllerOf(state, source.instanceId);
    if (!owner || owner === payerId) continue;
    const list = byPlayer.get(owner) ?? [];
    list.push(source.instanceId);
    byPlayer.set(owner, list);
  }
  return state.players
    .map((player) => player.playerId)
    .filter((playerId) => byPlayer.has(playerId))
    .map((playerId) => ({ playerId, instanceIds: byPlayer.get(playerId)! }));
}

/** Whose hand an alliance helper's card sits in, by hero name; null for anything the payer holds or in play. */
/**
 * The tag on a picked source: "spent", numbered for a discarded card ("spent 2"), and "on top" for the card its pile
 * will show last, which is why the order is worth seeing.
 */
export function spentTagText(source: Pick<PaymentSourceView, "discardOrder" | "onTop">): string {
  if (source.discardOrder === null) return "spent";
  return source.onTop ? `spent ${source.discardOrder} · on top` : `spent ${source.discardOrder}`;
}

/** The hover note on the "on top" card: what it means, and why the order matters. */
export const ON_TOP_NOTE =
  "Picked last, so it ends up on top of your discard pile. Pepper Potts and other cards that read the top card " +
  "use it next. To change the order, unpick a card and pick it again: it moves to the end.";

/**
 * Each picked hand card's place in its discard pile's share of the payment (`PaymentSourceView.discardOrder`), by
 * option id, and whether it is that pile's last, the one left on top.
 */
function discardOrderOf(
  state: GameState,
  payerId: PlayerId,
  picked: readonly string[],
  byOption: ReadonlyMap<string, PaymentSource>,
): ReadonlyMap<string, { readonly position: number; readonly onTop: boolean }> {
  const byPile = new Map<PlayerId, string[]>();
  for (const optionId of picked) {
    const source = byOption.get(optionId);
    if (source?.kind !== "handCard") continue;
    // A discarded player card goes to its owner's pile (RRG 1.8 "Discard", p. 16).
    const pile = state.instances[source.instanceId]?.ownerId ?? payerId;
    byPile.set(pile, [...(byPile.get(pile) ?? []), optionId]);
  }
  const order = new Map<string, { readonly position: number; readonly onTop: boolean }>();
  for (const optionIds of byPile.values()) {
    optionIds.forEach((optionId, index) =>
      order.set(optionId, { position: index + 1, onTop: index === optionIds.length - 1 }),
    );
  }
  return order;
}

function helperNameOf(state: GameState, payerId: PlayerId, source: PaymentSource): string | null {
  if (source.kind !== "handCard") return null;
  const owner = state.players.find((player) => player.hand.includes(source.instanceId));
  if (!owner || owner.playerId === payerId) return null;
  return faceUpName(state, owner.identity.instanceId) ?? "Helper";
}

/** "take 2 damage" / "remove 2 threat" from the amount a source's own cost carries; null when it carries none. */
function amountNoteOf(source: PaymentSource): string | null {
  const selection = source.costSelection;
  if (!selection) return null;
  if (selection.damageSelf !== undefined) return `take ${selection.damageSelf} damage`;
  if (selection.removeThreat !== undefined) return `remove ${selection.removeThreat} threat`;
  return null;
}

/** "Helped by Ana: 1 energy, 1 mental", one line per helper in seat order of first pick, from the picked sources. */
function helperLinesOf(sources: readonly PaymentSourceView[]): readonly string[] {
  const byHelper = new Map<string, Record<string, number>>();
  for (const source of sources) {
    if (!source.spent || source.helperName === null) continue;
    const total = byHelper.get(source.helperName) ?? {};
    for (const [type, count] of Object.entries(source.pool)) if (count > 0) total[type] = (total[type] ?? 0) + count;
    byHelper.set(source.helperName, total);
  }
  return [...byHelper].map(([name, pool]) => {
    const words = Object.entries(pool).map(([type, count]) => `${count} ${type}`);
    return `Helped by ${name}: ${words.join(", ") || "nothing"}`;
  });
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
