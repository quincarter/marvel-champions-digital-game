/**
 * The deck-edit gate (docs/campaign-mode-design.md §10.2, `campaign-deck-edit-model.ts`): a campaign seat's deck,
 * as the builder screen shows it — wrapping `validateDeck(deck, pool, { campaign })` rather than re-deriving any
 * of its verdicts, and marking which rows are campaign grants and whether editing is frozen at all.
 *
 * **Assembling `CampaignDeckContext` is this module's other half.** `@mc/engine` holds neither a box name nor a
 * campaign log (design §8's own header: the engine "holds neither and never names a box"), so a caller supplies
 * the `@mc/content` `Campaign` record and the seat's `CampaignLog` column, and `campaignDeckContextOf` folds them
 * into the shape `validateDeck` reads. `frozenNonCampaignCards` (MC16 p. 5 / MC27 p. 6) has no generic source in
 * `CampaignLog` — it is a box's own rule about *when* a deck freezes, not campaign state — so it is an explicit,
 * optional input here; MC10 never freezes a deck, so its own tests never pass one.
 */
import {
  grantDeckSizesOf,
  includedGrantsOf,
  validateDeck,
  type CampaignDefinition,
  type CampaignDeckContext,
  type CampaignGrant,
  type CampaignLog,
  type DeckValidation,
} from "@mc/engine";
import type { AnyCard, Campaign, CardId, DeckCardEntry, DeckContents } from "@mc/content";

/** Assembles the campaign half of `DeckContext` from a `Campaign` content record and a seat's log column. */
export function campaignDeckContextOf(
  campaign: Campaign,
  log: CampaignLog,
  seatNumber: number,
  options: { readonly frozenNonCampaignCards?: readonly DeckCardEntry[] } = {},
): CampaignDeckContext {
  const seat = log.seats.find((candidate) => candidate.seatNumber === seatNumber);
  if (!seat) throw new Error(`campaign ${log.campaignId} has no seat ${seatNumber}`);
  return {
    campaignId: log.campaignId as string,
    campaignSetIds: [...campaign.campaignSetIds, ...(campaign.perSeatSetIds ?? [])],
    identityCardId: seat.identityCardId,
    ...grantFieldsOf(seat.grants),
    removedFromCampaign: log.removedFromCampaign,
    ...(campaign.prohibited?.cardIds ? { prohibitedCardIds: campaign.prohibited.cardIds } : {}),
    ...(campaign.prohibited?.encounterSetIds ? { prohibitedEncounterSetIds: campaign.prohibited.encounterSetIds } : {}),
    ...(options.frozenNonCampaignCards ? { frozenNonCampaignCards: options.frozenNonCampaignCards } : {}),
  };
}

/**
 * The context fields that follow from a seat's grants: the copies the deck holds (a reward left out is none of them,
 * `includedGrantsOf`), the deck-size rules and the rewards the player may leave out. `campaignDeckContextOf` builds
 * them from the log; a builder screen that flips a reward rebuilds them from its own grants.
 */
function grantFieldsOf(
  grants: readonly CampaignGrant[],
): Pick<CampaignDeckContext, "grantedCardIds" | "grantDeckSizes" | "optionalGrantCardIds"> {
  const included = includedGrantsOf(grants);
  const optional = included.filter((grant) => grant.optional === true).map((grant) => grant.cardId);
  const sizes = grantDeckSizesOf(grants);
  return {
    grantedCardIds: included.map((grant) => grant.cardId),
    // MC45 p. 24: a reward that counts toward the 50 and not the 40 (owner decision, 2026-10-08) is told to
    // `validateDeck`; absent for every earlier box.
    ...(sizes.length > 0 ? { grantDeckSizes: sizes } : {}),
    // MC45 p. 24, "They may include 1 copy of that card in their deck": the copies the player may leave out.
    ...(optional.length > 0 ? { optionalGrantCardIds: optional } : {}),
  };
}

/** `context` again after the seat's grants changed (a reward put in or left out): only the grant-derived fields move. */
export function campaignDeckContextWithGrants(
  context: CampaignDeckContext,
  grants: readonly CampaignGrant[],
): CampaignDeckContext {
  const { grantedCardIds: _g, grantDeckSizes: _s, optionalGrantCardIds: _o, ...rest } = context;
  return { ...rest, ...grantFieldsOf(grants) };
}

/**
 * Which boxes freeze deck customization at all, and when (`docs/campaign-mode-design.md` §"Changes to the
 * existing checks": "MC16 p. 5 (mandatory) / MC27 p. 6 (optional)" — no generic signal in `CampaignLog` says this,
 * it is each box's own printed rule, so it stays a short lookup here rather than a per-campaign `if` in a scene.
 * `"mandatory"` freezes automatically once an expert-mode run has played its first scenario; a box with no entry
 * (MC10, and every box not yet in this table) never freezes. `"optional"` (MC27 p. 6, "(Optional) Once a player
 * starts an expert campaign, they cannot add, remove, or change …") only freezes once the seat has opted in
 * (`deckFreezeOptedIn`) — the printed rule is a group's own house-rule-shaped choice, not automatic, so a caller
 * must supply that choice; see `campaign/deck-freeze-choice.ts` for where the client persists it.
 */
const DECK_FREEZE_POLICY: Readonly<Record<string, "mandatory" | "optional">> = {
  gmw: "mandatory",
  sm: "optional",
};

/** Whether `log.campaignId` even has a deck-freeze rule (mandatory or optional) to ask about at all. */
export function deckFreezePolicyOf(campaignId: string): "mandatory" | "optional" | null {
  return DECK_FREEZE_POLICY[campaignId] ?? null;
}

/**
 * MC16 p. 5 (mandatory) / MC27 p. 6 (optional): "Once a player starts an expert campaign, they cannot add, remove,
 * or change the aspect and/or basic cards in their deck … for the remainder of the campaign." — snapshotted from
 * the stored run itself, never guessed: `history`'s very first entry's `logBefore` is the log exactly as it stood
 * before that node's own setup instructions ran (`CampaignHistoryEntry.logBefore`'s own doc comment), i.e. the deck
 * the seat started the campaign with, before any between-games edit ever touched it. Null when the box doesn't
 * freeze, the run isn't in expert mode, scenario 1 hasn't been attempted yet (nothing to freeze against), or
 * (`"optional"` policy only) the seat hasn't opted in.
 */
export function frozenNonCampaignCardsOf(
  definition: CampaignDefinition,
  log: CampaignLog,
  seatNumber: number,
  deckFreezeOptedIn = false,
): readonly DeckCardEntry[] | null {
  const policy = DECK_FREEZE_POLICY[log.campaignId as string];
  if (policy === undefined) return null;
  if (policy === "optional" && !deckFreezeOptedIn) return null;
  if (!log.modes.campaign?.expertCampaign) return null;
  const firstNodeId = definition.graph.kind === "linear" ? definition.graph.nodes[0]?.id : undefined;
  if (!firstNodeId) return null;
  const opening = log.history.find((entry) => entry.nodeId === firstNodeId);
  if (!opening) return null;
  const seat = opening.logBefore.seats.find((candidate) => candidate.seatNumber === seatNumber);
  return seat ? seat.deck.cards : null;
}

export interface CampaignDeckEditRow {
  readonly cardId: CardId;
  readonly quantity: number;
  /**
   * True for a line the campaign granted and the player must keep (MC10 p. 3): not editable in the sense the player
   * chose it. False for a reward the player may leave out (`rewardCopies`), whose line can be changed.
   */
  readonly locked: boolean;
  readonly lockedReason: string | null;
  /**
   * How many copies of this line are a campaign reward the player may leave out (MC45 p. 24, "They may include 1
   * copy of that card in their deck"); 0 for every other line. The other copies of the line are the player's own.
   */
  readonly rewardCopies: number;
  /** What a reward line says about itself (`REWARD_ROW_NOTE`), or null. */
  readonly rewardNote: string | null;
  /** True for a line RRG 1.8 p. 29 removed from the campaign, or one MC27 p. 4's `Campaign.prohibited.cardIds` names — refused, and the deck should say why. */
  readonly refused: boolean;
  /** `validateDeck`'s own `campaign_removed_card`/`campaign_prohibited_card` message for this card, or null when the line isn't refused. */
  readonly refusedReason: string | null;
  /**
   * The printed name of the face this grant is on (MC10 p. 12's "Improved" side, MC27 p. 22's Enhanced side),
   * or null for a grant still on its front face (every non-granted row, and most grants). `CampaignGrant.face`
   * straight through — this module never decides *which* face a card is on, only carries the log's own mark.
   */
  readonly face: string | null;
}

/** One reward the seat chose (an optional grant), in or out of the deck: what a "Rewards" strip shows and toggles. */
export interface CampaignDeckRewardRow {
  readonly cardId: CardId;
  /** Whether the copy is in the deck now (`CampaignGrant.leftOut` is not set). */
  readonly included: boolean;
  readonly status: string;
  /** The button that flips `included` through `setRewardIncluded`. */
  readonly toggleLabel: string;
}

export interface CampaignDeckEditModel {
  readonly validation: DeckValidation;
  readonly rows: readonly CampaignDeckEditRow[];
  /**
   * The seat's rewards, in grant order, whether or not each is in the deck: a reward left out has no row, so this is
   * the only place it can be put back. Empty for a box with no optional grant, or when `grants` was not passed.
   */
  readonly rewards: readonly CampaignDeckRewardRow[];
  /** True once `frozenNonCampaignCards` is set — MC16 p. 5 (mandatory) / MC27 p. 6 (optional). */
  readonly editingDisabled: boolean;
  readonly editingDisabledReason: string | null;
}

const GRANT_REASON = "Added by the campaign — does not count toward deck size";
/** MC45 p. 24 and the owner decisions of 2026-10-08: a reward is not one of the 40, is one of the 50, and is optional. */
export const REWARD_ROW_NOTE = "Campaign reward. Not one of your 40 cards; one of your 50.";
export const REWARD_STATUS_IN = "In your deck";
export const REWARD_STATUS_OUT = "Left out of your deck";
export const REWARD_LEAVE_OUT_LABEL = "Leave out";
export const REWARD_ADD_LABEL = "Add to deck";
const FROZEN_REASON = "Your deck is frozen for the rest of the campaign; only campaign-granted cards can change.";

/**
 * Card ids RRG 1.8 p. 29 removed from `context` **by face** (a removal naming the other face of a double-sided
 * card leaves the front, and so the deck line, usable — ruling April 30, 2026 (4) answer 2) — the same test
 * `validateDeck`'s own `isRemovedFromCampaign` applies, read here so a builder screen can keep a removed card out
 * of what it offers to *add*, not only flag it once it's already in the deck.
 */
export function removedFromCampaignCardIds(context: CampaignDeckContext): ReadonlySet<CardId> {
  return new Set(
    (context.removedFromCampaign ?? []).filter((face) => face.face === undefined).map((face) => face.cardId),
  );
}

/**
 * `context.prohibitedCardIds` (MC27 p. 4: Venom the ally 27190, Symbiote Suit 27191), read here for the same reason
 * `removedFromCampaignCardIds` is: so a builder screen can keep a prohibited card out of what it offers to *add*,
 * not only flag it once it is already in the deck (a stale save from before the campaign prohibited it, or one
 * imported from outside the campaign editor).
 */
export function prohibitedCampaignCardIds(context: CampaignDeckContext): ReadonlySet<CardId> {
  return new Set((context.prohibitedCardIds ?? []) as readonly CardId[]);
}

/** `validateDeck` in campaign context, plus the row-level marks a builder screen needs but `DeckValidation` doesn't carry. */
export function campaignDeckEditModel(
  deck: DeckContents,
  pool: readonly AnyCard[] | Readonly<Record<string, AnyCard>>,
  context: CampaignDeckContext,
  /** This seat's own `CampaignGrant`s, for `CampaignDeckEditRow.face` — `CampaignDeckContext.grantedCardIds` is ids only (design: face is a display fact, not a legality one). Omit outside campaign mode or when no grant is ever flipped. */
  grants: readonly CampaignGrant[] = [],
): CampaignDeckEditModel {
  const validation = validateDeck(deck, pool, { campaign: context });
  const countOf = (ids: readonly string[] | undefined, cardId: string): number =>
    (ids ?? []).filter((id) => id === cardId).length;
  /** The copies of a line that are a reward the player may leave out: never more than the line holds. */
  const rewardCopiesOf = (cardId: string, quantity: number): number =>
    Math.min(quantity, countOf(context.optionalGrantCardIds, cardId));
  /** A line is locked when the campaign granted a copy of it that must stay (MC10 p. 3). */
  const mustKeep = (cardId: string): boolean =>
    countOf(context.grantedCardIds, cardId) > countOf(context.optionalGrantCardIds, cardId);
  const faceByCardId = new Map(
    grants.filter((grant) => grant.face !== undefined).map((grant) => [grant.cardId, grant.face!]),
  );
  const refusedReasonByCardId = new Map<string, string>();
  if (!validation.ok) {
    for (const problem of validation.problems) {
      if (problem.code !== "campaign_removed_card" && problem.code !== "campaign_prohibited_card") continue;
      for (const cardId of problem.cardIds) refusedReasonByCardId.set(cardId as string, problem.message);
    }
  }
  const rows: readonly CampaignDeckEditRow[] = deck.cards.map((line) => {
    const refusedReason = refusedReasonByCardId.get(line.cardId as string) ?? null;
    const locked = mustKeep(line.cardId);
    const rewardCopies = locked ? 0 : rewardCopiesOf(line.cardId, line.quantity);
    return {
      cardId: line.cardId,
      quantity: line.quantity,
      locked,
      lockedReason: locked ? GRANT_REASON : null,
      rewardCopies,
      rewardNote: rewardCopies > 0 ? REWARD_ROW_NOTE : null,
      refused: refusedReason !== null,
      refusedReason,
      face: faceByCardId.get(line.cardId) ?? null,
    };
  });
  const rewards: readonly CampaignDeckRewardRow[] = grants
    .filter((grant) => grant.optional === true)
    .map((grant) => {
      const included = grant.leftOut !== true;
      return {
        cardId: grant.cardId,
        included,
        status: included ? REWARD_STATUS_IN : REWARD_STATUS_OUT,
        toggleLabel: included ? REWARD_LEAVE_OUT_LABEL : REWARD_ADD_LABEL,
      };
    });
  const editingDisabled = context.frozenNonCampaignCards !== undefined;
  return { validation, rows, rewards, editingDisabled, editingDisabledReason: editingDisabled ? FROZEN_REASON : null };
}

/** A seat's deck and grants after a reward was put in or left out: what the campaign log is to store. */
export interface RewardInclusionEdit {
  readonly deck: DeckContents;
  readonly grants: readonly CampaignGrant[];
}

/**
 * Puts a reward in the deck or leaves it out (MC45 p. 24: "They may include 1 copy of that card in their deck for the
 * rest of the campaign"; owner decision, 2026-10-08: choosing the reward is mandatory, including it is not). The
 * grant stays in the log either way; `CampaignGrant.leftOut` and the deck line change together, so the list never
 * holds a reward the log says is out. Changes one optional grant of `cardId` at a time, and returns its inputs
 * unchanged when there is none in the other state.
 */
export function setRewardIncluded(
  deck: DeckContents,
  grants: readonly CampaignGrant[],
  cardId: CardId,
  included: boolean,
): RewardInclusionEdit {
  const index = grants.findIndex(
    (grant) => grant.cardId === cardId && grant.optional === true && (grant.leftOut === true) === included,
  );
  if (index < 0) return { deck, grants };
  const nextGrants = grants.map((grant, at) => {
    if (at !== index) return grant;
    const { leftOut: _leftOut, ...kept } = grant;
    return included ? kept : { ...kept, leftOut: true as const };
  });
  const line = deck.cards.find((entry) => entry.cardId === cardId);
  const cards = included
    ? line
      ? deck.cards.map((entry) => (entry.cardId === cardId ? { ...entry, quantity: entry.quantity + 1 } : entry))
      : [...deck.cards, { cardId, quantity: 1 }]
    : deck.cards.flatMap((entry) =>
        entry.cardId !== cardId ? [entry] : entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [],
      );
  return { deck: { ...deck, cards }, grants: nextGrants };
}

/**
 * The grants after the player edited the deck list by hand: a reward whose copy is no longer in the list is marked
 * left out, so the log agrees with the deck. A line holds its must-keep granted copies first, then its rewards; the
 * rewards the line is too short for are the ones left out. Never puts a reward back (`setRewardIncluded` does), and
 * returns `grants` itself when nothing changed.
 */
export function reconcileRewards(deck: DeckContents, grants: readonly CampaignGrant[]): readonly CampaignGrant[] {
  const room = new Map<string, number>();
  for (const line of deck.cards) room.set(line.cardId, (room.get(line.cardId) ?? 0) + line.quantity);
  for (const grant of grants) {
    if (grant.optional === true || grant.leftOut === true) continue;
    room.set(grant.cardId, (room.get(grant.cardId) ?? 0) - 1);
  }
  let changed = false;
  const next = grants.map((grant) => {
    if (grant.optional !== true || grant.leftOut === true) return grant;
    const left = room.get(grant.cardId) ?? 0;
    if (left > 0) {
      room.set(grant.cardId, left - 1);
      return grant;
    }
    changed = true;
    return { ...grant, leftOut: true as const };
  });
  return changed ? next : grants;
}

/** `model.rows` split into what counts toward deck size and what's pinned — MC10 p. 3: "Cards added to the deck as part of a campaign do not count toward a player's minimum or maximum deck size." */
export interface CampaignDeckSizeSplit {
  /** The sum of every non-granted line's quantity — what a player-facing "N cards" figure should read. */
  readonly counted: number;
  /** The sum of every granted line's quantity — cards pinned into the deck outside that count. */
  readonly pinned: number;
  /**
   * The reward copies in the deck (MC45 p. 24): not among `counted`, because a deck needs 40 cards besides them, and
   * not `pinned`, because the player may leave them out. They do count toward the 50 (owner decision, 2026-10-08).
   */
  readonly rewards: number;
}

/**
 * `model`'s deck-size split, the same way the Briefing's own "N cards + M pinned" reads it
 * (`campaign-briefing-model.ts`'s `deckRowsOf`): a whole line counts as pinned once its card is one the campaign
 * granted, never split copy-by-copy — so this screen's count always agrees with the Briefing's for the same seat.
 */
export function campaignDeckSizeSplit(model: CampaignDeckEditModel): CampaignDeckSizeSplit {
  let counted = 0;
  let pinned = 0;
  let rewards = 0;
  for (const row of model.rows) {
    if (row.locked) pinned += row.quantity;
    else {
      counted += row.quantity - row.rewardCopies;
      rewards += row.rewardCopies;
    }
  }
  return { counted, pinned, rewards };
}

/**
 * A seat's stored deck split for the Briefing's and the Dossier's "N + M pinned": the cards that count toward the 40,
 * and the campaign's copies beside them. A line with a must-keep grant is pinned whole, as it always was; a reward
 * (an optional grant, MC45 p. 24) is pinned copy by copy, so the player's own copies of its title still count, and a
 * reward left out of the deck pins nothing.
 */
export function seatDeckSizeSplit(seat: {
  readonly deck: Pick<DeckContents, "cards">;
  readonly grants: readonly CampaignGrant[];
}): { readonly counted: number; readonly pinned: number } {
  const included = includedGrantsOf(seat.grants);
  const mustKeep = new Set(included.filter((grant) => grant.optional !== true).map((grant) => grant.cardId));
  let counted = 0;
  let pinned = 0;
  for (const line of seat.deck.cards) {
    const rewards = mustKeep.has(line.cardId)
      ? line.quantity
      : Math.min(line.quantity, included.filter((grant) => grant.cardId === line.cardId).length);
    pinned += rewards;
    counted += line.quantity - rewards;
  }
  return { counted, pinned };
}

/** The deck builder's count in words: "40 cards", "40 cards + 2 pinned", "40 cards + 1 reward". */
export function campaignDeckSizeLabel(split: CampaignDeckSizeSplit): string {
  const pinned = split.pinned > 0 ? ` + ${split.pinned} pinned` : "";
  const rewards = split.rewards > 0 ? ` + ${split.rewards} ${split.rewards === 1 ? "reward" : "rewards"}` : "";
  return `${split.counted} cards${pinned}${rewards}`;
}
