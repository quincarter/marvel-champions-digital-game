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
 * a flip enters play; the printed faces assume it (Defensive Protocols' "Hinder 2"). docs/phase7-wave4.md §4 Q15.
 */

import type { AnyCard, CardId } from "@mc/content";
import type { EngineDeps } from "../abilities.js";
import { type Ctx, emit, moveCard, updateInstance } from "../ctx.js";
import { leavePlay } from "../effects.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { keywordTotal } from "../keywords.js";
import { cardOf, discardZoneFor, getInstance, locateCard, mustInstance, startingThreatOf } from "../query.js";
import { cardsInPlay, controllerOf } from "../select.js";
import type { TriggerEvent } from "../trigger-events.js";
import { engagedEvent } from "./apply-effect.js";
import { enterPlay } from "./enter-play.js";
import { pushEvents } from "./frames.js";
import { NO_STATUSES } from "../state.js";
import { attachmentHostCandidates } from "./reveal.js";

export function flipToOtherFace(ctx: Ctx, id: InstanceId, playerId: PlayerId, deps: EngineDeps = ctx.deps): boolean {
  const from = cardOf(ctx.state, id);
  const otherId: CardId | undefined = from?.otherFaceId;
  const to = otherId !== undefined ? ctx.state.cardPool[otherId] : undefined;
  if (!from || !to) return false;
  const typeChanged = from.type !== to.type;
  const before = mustInstance(ctx.state, id);
  if (typeChanged) {
    for (const attachment of before.attachments) {
      if (ctx.state.instances[attachment])
        leavePlay(ctx, attachment, discardZoneFor(ctx.state, attachment), "top", true);
    }
    for (const card of before.tucked) {
      if (ctx.state.instances[card]) moveCard(ctx, card, discardZoneFor(ctx.state, card), "top");
    }
  }
  updateInstance(ctx, id, (i) => ({
    ...i,
    cardId: to.id,
    flipped: false,
    faceup: true,
    ...(typeChanged
      ? { damage: 0, threat: 0, statuses: NO_STATUSES, counters: {}, tucked: [], attachments: [], exhausted: false }
      : {}),
  }));
  emit(ctx, { type: "cardFlippedToOtherFace", instanceId: id, from: from.id, to: to.id, typeChanged });
  if (typeChanged) relocate(ctx, id, to, playerId, deps);
  if (!cardsInPlay(ctx.state).includes(id)) return true;
  // The new face is treated as entering play (§4 Q15): Defensive Protocols' and Retrieve Odin's Armor's "Hinder 2" and
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
  enterPlay(ctx, id, controllerOf(ctx.state, id) ?? getInstance(ctx.state, id)?.engagedWith ?? playerId);
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
      const [host] = attachmentHostCandidates(ctx.state, to.attachesTo, context);
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
