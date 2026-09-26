/**
 * Keeps `CardInstance.treatedAs` in step with what causes it (docs/phase7-wave4.md §3.9, §3.29):
 *
 * - an ally with a `treatHostAsMinion` attachment on it is a minion until that attachment goes (Beguiled);
 * - a minion with a `treatHostAsAlly` attachment on it is its controller's ally until that attachment goes (Mind
 *   Control);
 * - a minion a `treatAsAlly` effect took is its controller's ally while the effect's card stays in play (Karma).
 *
 * `relocateCard` calls `syncTreatedAs` whenever a card moves onto or off a host, which is every attach, detach and
 * discard of an attachment, so the flag never lags a frame behind the attachment ("Attach to the ally with the highest
 * cost … Attached ally engages its controller" engages a minion in the same ability); `leavePlay` calls
 * `releaseTreatedBy` for a source leaving play. Ruling, Dec 17, 2025 (1) #3: nothing enters or leaves play; it is
 * "essentially a status change", so tokens and attachments stay.
 */

import { type Ctx, emit, moveCard, updateInstance } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardOf, getInstance, locateCard } from "./query.js";
import { activeAbilityRefs, cardsInPlay, controllerOf } from "./select.js";
import type { TreatedAs, TreatedAsAlly } from "./state.js";

/** What the host's own attachments make it, if anything. */
function fromAttachments(ctx: Ctx, hostId: InstanceId, current: TreatedAs | null): TreatedAs | null {
  const host = getInstance(ctx.state, hostId);
  const type = cardOf(ctx.state, hostId)?.type;
  if (!host || (type !== "ally" && type !== "minion")) return null;
  for (const attachment of host.attachments) {
    for (const ref of activeAbilityRefs(ctx.state, attachment, ctx.deps)) {
      const definition = ctx.deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant") continue;
      for (const rule of definition.trigger.rules ?? []) {
        if (rule.kind === "treatHostAsMinion" && type === "ally") {
          return {
            kind: "minion",
            traits: rule.traits,
            keepPrintedTraits: rule.keepPrintedTraits === true,
            schFromThw: rule.schFromThw === true,
            source: attachment,
            controllerBefore: current?.kind === "minion" ? current.controllerBefore : host.controllerId,
          };
        }
        const controller = controllerOf(ctx.state, attachment);
        if (rule.kind === "treatHostAsAlly" && type === "minion" && controller) {
          return {
            kind: "ally",
            traits: rule.traits,
            thwFromSch: rule.thwFromSch === true,
            consequential: rule.consequential,
            source: attachment,
            controller,
            engagedBefore: current?.kind === "ally" ? current.engagedBefore : host.engagedWith,
          };
        }
      }
    }
  }
  return null;
}

export function syncTreatedAs(ctx: Ctx, hostId: InstanceId): void {
  const host = getInstance(ctx.state, hostId);
  if (!host) return;
  const current = host.treatedAs ?? null;
  // An effect's (Karma's) lasts while its card is in play, whatever attachments come and go.
  if (current && !host.attachments.includes(current.source) && cardsInPlay(ctx.state).includes(current.source)) {
    return;
  }
  apply(ctx, hostId, current, fromAttachments(ctx, hostId, current));
}

/** A card left play: whatever it was treating as another type goes back (Karma leaving play). */
export function releaseTreatedBy(ctx: Ctx, sourceId: InstanceId): void {
  for (const instance of Object.values(ctx.state.instances)) {
    if (instance.treatedAs?.source === sourceId) syncTreatedAs(ctx, instance.instanceId);
  }
}

/** "Take control of that minion and treat it as a [Controlled] ally" from an effect (`EffectSpec treatAsAlly`). */
export function treatAsAlly(ctx: Ctx, hostId: InstanceId, spec: Omit<TreatedAsAlly, "kind" | "engagedBefore">): void {
  const host = getInstance(ctx.state, hostId);
  if (!host || cardOf(ctx.state, hostId)?.type !== "minion" || host.treatedAs) return;
  apply(ctx, hostId, null, { kind: "ally", ...spec, engagedBefore: host.engagedWith });
}

function apply(ctx: Ctx, hostId: InstanceId, current: TreatedAs | null, next: TreatedAs | null): void {
  const host = getInstance(ctx.state, hostId);
  if (!host) return;
  if (current === null && next === null) return;
  if (current !== null && next !== null && current.source === next.source) return;
  const inAreaOf = (playerId: PlayerId): void => {
    const where = locateCard(ctx.state, hostId);
    if (where?.kind === "playArea" && where.playerId !== playerId) {
      moveCard(ctx, hostId, { kind: "playArea", playerId });
    }
  };
  if (next?.kind === "ally") {
    // "Take control of": into the controller's play area, no longer engaged with anyone.
    inAreaOf(next.controller);
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: next, controllerId: next.controller, engagedWith: null }));
  } else if (next) {
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: next }));
  } else if (current?.kind === "minion") {
    // The attachment went: an ally again, controlled by whoever controlled it before, in their play area.
    const controller = current.controllerBefore ?? host.ownerId;
    if (controller) inAreaOf(controller);
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: null, controllerId: controller, engagedWith: null }));
  } else if (current?.kind === "ally") {
    // A minion again: nobody controls it, and it is engaged with the player who controlled it (§4 Q20).
    updateInstance(ctx, hostId, (i) => ({
      ...i,
      treatedAs: null,
      controllerId: null,
      engagedWith: current.controller,
    }));
  }
  emit(ctx, { type: "treatedAsChanged", instanceId: hostId, as: next?.kind ?? null });
}
