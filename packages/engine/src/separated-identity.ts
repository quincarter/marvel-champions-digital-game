/**
 * A separated identity: one identity split across two physical cards that share one hit point dial
 * (`HeroIdentityCard.separatedIdentity`; docs/phase7-wave5.md §3.24).
 *
 * The SP//dr insert, "New Rule: Separated Identity Card": "Start the game with the Peni Parker alter-ego in play and,
 * following her 'Setup' instructions, put the INACTIVE support side of the SP//dr Suit card into play. While in alter-ego
 * form, to change to hero form, flip Peni Parker from her alter-ego side to her SP//dr upgrade side and flip the SP//dr
 * Suit card from its INACTIVE support side to its ACTIVE hero side. While in hero form, to change to alter-ego form, flip
 * the SP//dr Suit card from its ACTIVE hero side to its INACTIVE support side and flip the SP//dr upgrade side to its
 * Peni Parker alter-ego side. Both identity cards share a single hit point dial, with damage persisting on the dial
 * between forms. Additionally, if one form is defeated, both forms are considered to be defeated simultaneously and the
 * player is eliminated from the game."
 *
 * **The model.** Two instances. The identity instance (`IdentityState.instanceId`) is whichever physical card shows an
 * identity face — the alter-ego in alter-ego form, the hero in hero form — so it holds the dial, statuses, counters and
 * attachments exactly as any identity does, and a defeat of it is the player's elimination with nothing extra
 * (RRG 1.8 "Player Elimination", p. 34, step 4 sends the other card to the discard pile with the rest). The other
 * instance (`IdentityState.separatedCardInstanceId`) is the other physical card's non-identity side, played as a card
 * of its own type: the hero card's support side in alter-ego form, the alter-ego card's upgrade side (attached to the
 * identity) in hero form. Each side is a card of its own in `GameState.cardPool` (`separatedSideCard`, added by
 * `createGame`), so every reader of type, title, traits, keywords, abilities and blanks — including §3.31's
 * `textBoxCannotBeBlanked` — sees an ordinary support or upgrade, and a form change swaps its card id as §3.23's
 * `swapIdentity` swaps the identity's.
 *
 * **What a form change moves** (`flipSeparatedCard`, run by `setForm`):
 * - The printed "When you flip to this side" interrupts (Suit Up!, Return to Base as errata'd on RRG 1.8 p. 68) move
 *   every counter on, and card attached to, the card that stops being the identity onto the card that becomes it. Those
 *   are already on the identity instance, so they stay; the interrupts are this transition, not abilities of their own
 *   (script them `coveredByEngineRule()`).
 * - Counters on, and cards attached to, the other card (the support in alter-ego form, the upgrade in hero form) move to
 *   the identity too, as the same printed interrupts word it ("moving all counters on this card and cards attached to
 *   this card to her" / "… to SP//dr Suit"): user ruling, docs/phase7-wave5.md §4.1 Q38, over RRG 1.8 "Flip" (p. 20),
 *   which would discard them from a card that flips to another card type. An attachment the identity cannot take
 *   (`canHaveAttached`) is discarded as "Flip" would. "Counters" are all-purpose counters (RRG 1.8 "All-Purpose
 *   Counter", p. 6); the other card's damage and threat tokens, tucked cards and status cards are none of those, so
 *   "Flip" still discards them.
 * - Status cards on the identity stay with it: RRG 1.8 "Form, Change Form" (p. 21), "The character retains their
 *   sustained damage, status cards, …". Open as docs/phase7-wave5.md §3.24's status notes.
 * - Ready/exhausted follows the physical card, since the two cards "can be exhausted and ready independently": the
 *   identity takes the other card's state and the other card the identity's (an exhausted Peni who flips to an
 *   unexhausted Suit is a ready hero; Maintenance's "Exhaust SP//dr Suit" leaves the hero exhausted). A community
 *   reading, not an FFG ruling; RRG "Form, Change Form" keeps the character's state for an ordinary one-card identity.
 *   Open as docs/phase7-wave5.md §3.24's status notes.
 */

import {
  cardId,
  type CardId,
  type HeroIdentityCard,
  type SeparatedIdentitySide,
  type SupportCard,
  type UpgradeCard,
} from "@mc/content";
import { type Ctx, emit, moveCard, updateInstance } from "./ctx.js";
import { leavePlayAtOnce, moveCounters } from "./effects.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { discardZoneFor, getInstance, locateCard, mustInstance, mustPlayer } from "./query.js";
import { enterPlay } from "./resolve/enter-play.js";
import { canHaveAttached } from "./rules.js";
import { NO_STATUSES, type Form } from "./state.js";

/** Which physical card's non-identity side: the hero card's (a support) or the alter-ego card's (an upgrade). */
export type SeparatedSide = "heroCardOtherSide" | "alterEgoCardOtherSide";

/** The side the other card shows in a form: the hero card's support side in alter-ego form, and the reverse. */
export const separatedSideIn = (form: Form): SeparatedSide =>
  form === "hero" ? "alterEgoCardOtherSide" : "heroCardOtherSide";

/**
 * The pool id of a separated identity's non-identity side. Not a printed card code: the sides have none of their own
 * in the data (they are fields of the identity record), so the id is the identity's with the side's field name.
 */
export const separatedSideCardId = (identityId: CardId, side: SeparatedSide): CardId => cardId(`${identityId}:${side}`);

/**
 * A separated identity's non-identity side as a card of its own type (docs/phase7-wave5.md §3.24). It is never in a
 * deck: its cost is "—" (so no play rule can play it), its aspect is none, and it is unique as the identity is (both
 * printed sides carry the unique icon).
 */
export function separatedSideCard(identity: HeroIdentityCard, side: SeparatedSide): SupportCard | UpgradeCard {
  const separated = identity.separatedIdentity;
  if (!separated) throw new Error(`${identity.id} is not a separated identity`);
  const face: SeparatedIdentitySide<"support" | "upgrade"> = separated[side];
  const common = {
    id: separatedSideCardId(identity.id, side),
    name: face.name,
    ...(face.subtitle !== undefined ? { subtitle: face.subtitle } : {}),
    setCode: identity.setCode,
    cycleId: identity.cycleId,
    collectorNumber: side === "heroCardOtherSide" ? identity.collectorNumber : separated.alterEgoCardNumber,
    quantityInSet: 1,
    unique: identity.unique,
    ...(face.image !== undefined ? { images: { front: face.image } } : {}),
    aspect: "none" as const,
    traits: face.traits,
    keywords: face.keywords,
    text: face.text,
    ...(face.flavor !== undefined ? { flavor: face.flavor } : {}),
    abilities: face.abilities,
    ...(face.schemeIcons !== undefined ? { schemeIcons: face.schemeIcons } : {}),
    deckLimit: 1,
    cost: 0,
    specialCost: "dash" as const,
    resourceIcons: face.resourceIcons ?? {},
  };
  return face.cardType === "support" ? { ...common, type: "support" } : { ...common, type: "upgrade" };
}

/** Both non-identity sides of a separated identity, for `createGame` to add to the game's card pool. */
export const separatedSideCards = (identity: HeroIdentityCard): readonly (SupportCard | UpgradeCard)[] =>
  identity.separatedIdentity
    ? [separatedSideCard(identity, "heroCardOtherSide"), separatedSideCard(identity, "alterEgoCardOtherSide")]
    : [];

/**
 * The alter-ego's "Setup: Put [the hero card] into play, INACTIVE side faceup" (RRG 1.8 Appendix II step 16, p. 51):
 * the other card leaves the player's set-aside area for their play area and enters play. The printed Setup ability is
 * this step (script it `coveredByEngineRule()`).
 */
export function putSeparatedCardIntoPlay(ctx: Ctx, playerId: PlayerId): void {
  const player = mustPlayer(ctx.state, playerId);
  const id = player.identity.separatedCardInstanceId;
  if (!id || player.eliminated || locateCard(ctx.state, id)?.kind !== "setAside") return;
  moveCard(ctx, id, { kind: "playArea", playerId });
  updateInstance(ctx, id, (i) => ({ ...i, faceup: true, controllerId: playerId }));
  enterPlay(ctx, id, playerId);
}

/**
 * The other card's half of a form change (see the file comment): move its counters and attachments to the identity
 * (Q38), discard the rest of what the RRG "Flip" rule discards from it, swap ready states with the identity, show the
 * side for the new form, and attach it to the identity (hero form) or return it to the play area (alter-ego form).
 * Neither card enters or leaves play. A no-op for any other identity, and before the setup step has put the other card
 * into play.
 */
export function flipSeparatedCard(ctx: Ctx, playerId: PlayerId, to: Form): void {
  const player = mustPlayer(ctx.state, playerId);
  const id = player.identity.separatedCardInstanceId;
  const identityId = player.identity.instanceId;
  if (!id || !getInstance(ctx.state, id)) return;
  const where = locateCard(ctx.state, id);
  if (where?.kind !== "playArea" && where?.kind !== "attachment") return;
  const before = mustInstance(ctx.state, id);
  const toCardId = separatedSideCardId(player.identity.cardId, separatedSideIn(to));
  if (before.cardId === toCardId) return;
  // docs/phase7-wave5.md §4.1 Q38: the printed interrupts move the other card's counters and attachments to the
  // identity rather than RRG "Flip" discarding them. A move, not a removal (`moveCounters`).
  moveCounters(ctx, id, identityId);
  const movedAttachments: InstanceId[] = [];
  for (const attachment of before.attachments) {
    if (!ctx.state.instances[attachment]) continue;
    if (canHaveAttached(ctx.state, ctx.deps, identityId, attachment)) {
      moveCard(ctx, attachment, { kind: "attachment", hostInstanceId: identityId });
      movedAttachments.push(attachment);
    } else leavePlayAtOnce(ctx, attachment, discardZoneFor(ctx.state, attachment), "top", true);
  }
  // RRG 1.8 "Flip" (p. 20): what no printed text moves (tucked cards, status cards, damage and threat) is discarded.
  for (const card of before.tucked) {
    if (ctx.state.instances[card]) moveCard(ctx, card, discardZoneFor(ctx.state, card), "top");
  }
  const identityExhausted = mustInstance(ctx.state, identityId).exhausted;
  updateInstance(ctx, identityId, (i) => ({ ...i, exhausted: before.exhausted }));
  updateInstance(ctx, id, (i) => ({
    ...i,
    cardId: toCardId,
    exhausted: identityExhausted,
    damage: 0,
    threat: 0,
    statuses: NO_STATUSES,
    counters: {},
    tucked: [],
    attachments: [],
  }));
  if (to === "hero") moveCard(ctx, id, { kind: "attachment", hostInstanceId: identityId });
  else moveCard(ctx, id, { kind: "playArea", playerId });
  emit(ctx, {
    type: "separatedCardFlipped",
    playerId,
    instanceId: id,
    fromCardId: before.cardId,
    toCardId,
    identityExhausted: before.exhausted,
    cardExhausted: identityExhausted,
    ...(Object.keys(before.counters).length > 0 ? { movedCounters: before.counters } : {}),
    ...(movedAttachments.length > 0 ? { movedAttachments } : {}),
  });
}
