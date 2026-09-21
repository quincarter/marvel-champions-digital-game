/**
 * Reading the campaign log **from inside a game** (design §6.1).
 *
 * Every function here reads `GameState.campaign`, the `CampaignGameInput` the campaign runner froze into this game at
 * setup (design §7.1) — never a live `CampaignLog`, never storage. That is the whole point of the boundary: a saved
 * campaign game replays byte for byte without the campaign existing any more, and `applyCommand` stays pure.
 *
 * All of it is total: a missing campaign, a missing field, a field of the wrong kind and an unseated player each read
 * as "nothing" rather than throwing, because a campaign instruction is written against the *box's* log schema and the
 * engine has no way to check that schema (it never sees a `CampaignDefinition`).
 */

import type { CardId } from "@mc/content";
import type { CampaignCardFace, LogValue } from "./campaign.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { encounterFace, getInstance, getPlayer } from "./query.js";
import type { GameState } from "./state.js";

/**
 * The seat number the campaign gave this player, or null when the game has no campaign.
 *
 * `CampaignGameInput.seats` is in `GameSetupConfig.players` order (checked at setup), so a player's `seatIndex` is
 * its index there. The number itself is *not* the index: MC10 p. 17's "player number" is a campaign-log attribute
 * with rules consequences (it selects a numbered Expert Campaign Set), so the log's own numbering is what a per-seat
 * read addresses.
 */
export function campaignSeatNumber(state: GameState, playerId: PlayerId): number | null {
  const player = getPlayer(state, playerId);
  if (!player) return null;
  return state.campaign?.seats[player.seatIndex]?.seatNumber ?? null;
}

/** One field of the frozen log view: the shared field, or the named seat's column. */
export function campaignLogField(state: GameState, field: string, seatNumber: number | null): LogValue | undefined {
  const log = state.campaign?.log;
  if (!log) return undefined;
  if (seatNumber === null) return log.shared[field];
  return log.perSeat.find((seat) => seat.seatNumber === seatNumber)?.fields[field];
}

/**
 * A field as a number.
 *
 * | `of`      | `number` | `flag` | `cardRef` / `choice` | list kinds | `text` |
 * | --------- | -------- | ------ | -------------------- | ---------- | ------ |
 * | absent    | value    | 1 / 0  | 0                    | 0          | 0      |
 * | `"count"` | 0        | 0      | 1 if set, else 0     | entries    | 0      |
 *
 * Deliberately not "a list falls back to its length": "the number of X recorded" and "the number recorded in X" are
 * different sentences in the rulebooks, and a silent fallback would make a misspelled field read as a plausible
 * number instead of 0.
 */
export function campaignLogNumber(value: LogValue | undefined, of?: "count"): number {
  if (!value) return 0;
  if (of === "count") {
    switch (value.kind) {
      case "cardList":
        return value.cardIds.length;
      case "strikeList":
        return value.struck.length;
      case "instructionList":
        return value.ids.length;
      case "cardState":
        return Object.keys(value.cards).length;
      case "cardRef":
        return 1;
      case "choice":
        return value.option === "" ? 0 : 1;
      case "number":
      case "flag":
      case "text":
        return 0;
    }
  }
  if (value.kind === "number") return value.value;
  if (value.kind === "flag") return value.value ? 1 : 0;
  return 0;
}

/** Whether a field holds anything at all: a checked box, a non-zero number, a chosen option, a non-empty list. */
export function campaignLogIsSet(value: LogValue | undefined): boolean {
  if (!value) return false;
  switch (value.kind) {
    case "number":
      return value.value !== 0;
    case "flag":
      return value.value;
    case "cardList":
      return value.cardIds.length > 0;
    case "cardRef":
      return true;
    case "choice":
      return value.option !== "";
    case "strikeList":
      return value.struck.length > 0;
    case "cardState":
      return Object.keys(value.cards).length > 0;
    case "instructionList":
      return value.ids.length > 0;
    case "text":
      return value.value !== "";
  }
}

/** Whether a field names this card id, option or instruction id ("If Cosmo is in the campaign pool", MC21 p. 17). */
export function campaignLogContains(value: LogValue | undefined, needle: string): boolean {
  if (!value) return false;
  switch (value.kind) {
    case "cardList":
      return value.cardIds.includes(needle as CardId);
    case "cardRef":
      return value.cardId === needle;
    case "choice":
      return value.option === needle;
    case "strikeList":
      return value.struck.includes(needle);
    case "instructionList":
      return value.ids.includes(needle);
    case "cardState":
      return Object.hasOwn(value.cards, needle);
    case "number":
    case "flag":
    case "text":
      return false;
  }
}

/**
 * The card ids a field names, in recorded order and **with duplicates kept**: ruling June 2, 2026 (3) answer 3,
 * "Record each copy individually (titles can appear multiple times)."
 */
export function campaignLogCardIds(value: LogValue | undefined): readonly CardId[] {
  if (!value) return [];
  switch (value.kind) {
    case "cardList":
      return value.cardIds;
    case "cardRef":
      return [value.cardId];
    case "cardState":
      return Object.keys(value.cards) as CardId[];
    case "number":
    case "flag":
    case "choice":
    case "strikeList":
    case "instructionList":
    case "text":
      return [];
  }
}

/**
 * The face a card instance is showing, as a campaign removal records it (`CampaignCardFace`).
 *
 * `face` is present only while the card shows its `flipSide` (RRG 1.8 "Flip", p. 20); the front face is recorded as
 * no face at all, which is every single-sided card. A villain's side is not a campaign removal any rulebook makes,
 * so it is deliberately not encoded here rather than guessed at.
 */
export function campaignFaceOf(state: GameState, id: InstanceId): CampaignCardFace | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  const face = encounterFace(state, id)?.name;
  return face === undefined ? { cardId: instance.cardId } : { cardId: instance.cardId, face };
}

/** Two removals name the same thing when they name the same card id and the same face. */
export const sameCampaignFace = (a: CampaignCardFace, b: CampaignCardFace): boolean =>
  a.cardId === b.cardId && a.face === b.face;
