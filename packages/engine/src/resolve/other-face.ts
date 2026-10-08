/**
 * Flipping a card whose other face is emitted as a card of its own (`BaseCard.otherFaceId`, docs/phase7-wave4.md §1.7,
 * §3.10): Secure the Landing Pad → Cosmo (an ally), Save the Shawarma Place → Black Swan (a minion), Open the Dungeons →
 * Jormungand (an attachment), Hack Sanctuary's Computer → Defensive Protocols (a side scheme), `mts` 21180–21189.
 *
 * RRG 1.8 "Flip" (p. 20): "if the new faceup side of that card has … a different card type from the previous face, all
 * attached cards, tucked cards, status cards, and tokens are discarded from the card"; the same type keeps them. The
 * card never leaves play. On another type it goes where its new type lives, as a revealed card of that type would
 * (`enterPlayOnReveal`): a minion engaged with `playerId`, an ally or other player-type card under `playerId`'s control,
 * an attachment on its first legal host (none: it leaves play, and a double-sided card leaving play is removed from the
 * game), a scheme or environment in the villain's area. Either way the new face is then treated as entering play: a
 * side scheme gets its starting threat and hinder, a minion engages, "enters play" triggers fire. The RRG does not say
 * a flip enters play; the printed faces assume it (Defensive Protocols' "Hinder 2"). docs/phase7-wave4.md §4 Q17 (user decision 2026-09-24).
 *
 * `reveal` ("flip this card and reveal [its other face]", `flipCard.reveal`; docs/phase7-wave7.md §3.34): the new face
 * is also revealed where it is (`revealNewFaceFrame`), after it has entered play as above, so a side scheme face holds
 * the threat the card kept plus its starting threat when its When Revealed resolves (§4.1 Q19). The flip then pushes
 * the `cardFlipped` event itself, under the reveal, and the caller pushes none.
 */

import type { AnyCard, CardId } from "@mc/content";
import type { EngineDeps } from "../abilities.js";
import { type Ctx, emit, moveCard, pushFrames, updateInstance } from "../ctx.js";
import { leavePlay, leavePlayAtOnce, waitsForHostStep } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { keywordTotal } from "../keywords.js";
import { cardOf, discardZoneFor, getInstance, locateCard, mustInstance, startingThreatOf } from "../query.js";
import { cardsInPlay, controllerOf } from "../select.js";
import { cardFlippedEvent, type HostStep, type TriggerEvent } from "../trigger-events.js";
import { engagedEvent } from "./apply-effect.js";
import { announceNewFaceEntersPlay, eventFrame, pushEvents } from "./frames.js";
import { NO_STATUSES } from "../state.js";
import { attachmentHostCandidates, revealNewFaceFrame } from "./reveal.js";

export function flipToOtherFace(
  ctx: Ctx,
  id: InstanceId,
  playerId: PlayerId,
  deps: EngineDeps = ctx.deps,
  reveal = false,
  /** The player whose effect flipped the card (`cardFlipped.playerId`); `playerId` is who the new face goes to. */
  flippedBy: PlayerId | null = null,
): boolean | "waiting" {
  const from = cardOf(ctx.state, id);
  const otherId: CardId | undefined = from?.otherFaceId;
  const to = otherId !== undefined ? ctx.state.cardPool[otherId] : undefined;
  if (!from || !to) return false;
  const typeChanged = from.type !== to.type;
  const hostStep: HostStep = {
    kind: "flipToOtherFace",
    id,
    playerId,
    ...(reveal ? { reveal: true } : {}),
    ...(flippedBy ? { flippedBy } : {}),
  };
  // Its attachments are discarded: their "when this leaves play" interrupts first, with it unflipped (§4.1 Q32 of
  // docs/phase7-wave5.md); the flip then runs from the stack (`runHostStep`).
  if (typeChanged && waitsForHostStep(ctx, [id], hostStep)) return "waiting";
  const before = mustInstance(ctx.state, id);
  if (typeChanged) {
    for (const attachment of before.attachments) {
      if (ctx.state.instances[attachment])
        leavePlayAtOnce(ctx, attachment, discardZoneFor(ctx.state, attachment), "top", true);
    }
    for (const card of before.tucked) {
      if (ctx.state.instances[card]) moveCard(ctx, card, discardZoneFor(ctx.state, card), "top");
    }
  }
  // What the discard left stays attached, since the card flips but stays in play: an attachment whose own leaving was
  // cancelled (RRG 1.8 "Cancel", p. 11; §4.1 Q53), and a permanent or "cannot leave play" one, which the Flip rule's
  // discard cannot move (RRG 1.8 "Permanent", p. 32; "Attach To", p. 8; docs/phase7-wave5.md §4.1 Q50).
  const kept = mustInstance(ctx.state, id).attachments;
  updateInstance(ctx, id, (i) => ({
    ...i,
    cardId: to.id,
    flipped: false,
    faceup: true,
    ...(typeChanged
      ? { damage: 0, threat: 0, statuses: NO_STATUSES, counters: {}, tucked: [], attachments: kept, exhausted: false }
      : {}),
  }));
  emit(ctx, { type: "cardFlippedToOtherFace", instanceId: id, from: from.id, to: to.id, typeChanged });
  if (typeChanged) relocate(ctx, id, to, playerId, deps);
  const flippedFrame = reveal ? [eventFrame(ctx, cardFlippedEvent(id, flippedBy))] : [];
  if (!cardsInPlay(ctx.state).includes(id)) {
    pushFrames(ctx, flippedFrame);
    return true;
  }
  // Pushed first, so they resolve last: the reveal of the new face, then "after this card flips".
  if (reveal) pushFrames(ctx, [revealNewFaceFrame(ctx, id, playerId), ...flippedFrame]);
  // The new face is treated as entering play (§4 Q17, user decision): Defensive Protocols' and Retrieve Odin's Armor's "Hinder 2" and
  // starting threat, Black Swan's "After Black Swan engages you", "enters play" responses.
  const events: TriggerEvent[] = [];
  if (to.type === "side_scheme") {
    events.push({
      kind: "placeThreat",
      schemeInstanceId: id,
      amount: startingThreatOf(ctx.state, id, deps) + keywordTotal(ctx.state, id, "hinder", deps),
      sourceInstanceId: null,
    });
  }
  events.push(...engagedEvent(ctx, id));
  pushEvents(ctx, events);
  // A flip is not a move into play (RRG 1.8 "Enters Play", p. 18), so no "enters play exhausted" rule reads it.
  announceNewFaceEntersPlay(
    ctx,
    id,
    controllerOf(ctx.state, id) ?? getInstance(ctx.state, id)?.engagedWith ?? playerId,
  );
  return true;
}

function relocate(ctx: Ctx, id: InstanceId, to: AnyCard, playerId: PlayerId, deps: EngineDeps): void {
  // A side scheme that is no longer one leaves its game area's scheme list (split areas, docs/phase7-wave2.md §3.1).
  if (to.type !== "side_scheme" && ctx.state.gameAreas.some((a) => a.sideSchemeIds.includes(id))) {
    ctx.state = {
      ...ctx.state,
      gameAreas: ctx.state.gameAreas.map((a) => ({ ...a, sideSchemeIds: a.sideSchemeIds.filter((s) => s !== id) })),
    };
  }
  const where = locateCard(ctx.state, id);
  switch (to.type) {
    case "minion":
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: playerId, controllerId: null }));
      break;
    case "ally":
    case "support":
    case "upgrade":
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({ ...i, controllerId: playerId, engagedWith: null }));
      break;
    case "attachment": {
      const context = { selfInstanceId: id, controllerId: playerId, event: null, bindings: {}, deps };
      // No "attach to" text (RRG 1.8 "Reveal", p. 38): no host, so it is discarded (RRG 1.8 "Attach To", p. 8).
      const [host] = to.attachesTo ? attachmentHostCandidates(ctx.state, to.attachesTo, context) : [];
      if (host) {
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
        updateInstance(ctx, id, (i) => ({ ...i, controllerId: null, engagedWith: null }));
      } else leavePlay(ctx, id, discardZoneFor(ctx.state, id), "top", true);
      break;
    }
    default:
      if (where?.kind !== "villainArea") moveCard(ctx, id, { kind: "villainArea" });
      updateInstance(ctx, id, (i) => ({ ...i, controllerId: null, engagedWith: null }));
      break;
  }
}
