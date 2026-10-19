/**
 * Keeps `CardInstance.treatedAs` in step with what causes it (docs/phase7-wave4.md §3.9, §3.29):
 *
 * - an ally with a `treatHostAsMinion` card attached to it is a minion until that card goes (Beguiled, an attachment;
 *   a minion its own When Defeated attached to the ally, docs/phase7-wave7.md §3.44);
 * - a minion with a `treatHostAsAlly` attachment on it is its controller's ally until that attachment goes (Mind
 *   Control);
 * - a minion a `treatAsAlly` effect took is its controller's ally while the effect's card stays in play (Karma).
 * - a minion whose own `treatSelfAsAlly` constant holds is the ally of the player a `takeControl` effect named, for as
 *   long as that constant holds (Black Cat, docs/phase7-wave11-scenarios.md §S3.8; `syncOwnTreatments`).
 * - a hero from a collection, an identity card that is no seat's identity, is a minion while a `treatHostAsMinion`
 *   card is attached to it, and is in play only for that long (Reluctant Foe, docs/phase7-wave9.md §3.30): when the
 *   attachment goes and the hero is not leaving play itself, the hero is removed from the game (§4.1 Q39 = A).
 *
 * `relocateCard` calls `syncTreatedAs` whenever a card moves onto or off a host, which is every attach, detach and
 * discard of an attachment, so the flag never lags a frame behind the attachment ("Attach to the ally with the highest
 * cost … Attached ally engages its controller" engages a minion in the same ability); `leavePlay` calls
 * `releaseTreatedBy` for a source leaving play. Ruling, Dec 17, 2025 (1) #3: nothing enters or leaves play; it is
 * "essentially a status change", so tokens and attachments stay.
 */

import { type Ctx, emit, moveCard, updateInstance } from "./ctx.js";
import { leavePlayAtOnce } from "./effects.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { cardOf, getInstance, isSeatlessIdentity, locateCard } from "./query.js";
import { activeAbilityRefs, activeRules, cardsInPlay, controllerOf } from "./select.js";
import type { TreatedAs, TreatedAsAlly } from "./state.js";

/** What the host's own attachments make it, if anything. */
function fromAttachments(ctx: Ctx, hostId: InstanceId, current: TreatedAs | null): TreatedAs | null {
  const host = getInstance(ctx.state, hostId);
  const type = cardOf(ctx.state, hostId)?.type;
  // A hero no player is using is treated as an ally is (docs/phase7-wave9.md §3.30); a seat's identity never is.
  const foe = type === "hero_identity" && isSeatlessIdentity(ctx.state, hostId);
  if (!host || (type !== "ally" && type !== "minion" && !foe)) return null;
  for (const attachment of host.attachments) {
    for (const ref of activeAbilityRefs(ctx.state, attachment, ctx.deps)) {
      const definition = ctx.deps.abilities[ref.id];
      if (definition?.trigger.kind !== "constant") continue;
      for (const rule of definition.trigger.rules ?? []) {
        if (rule.kind === "treatHostAsMinion" && (type === "ally" || foe)) {
          return {
            kind: "minion",
            traits: rule.traits,
            keepPrintedTraits: rule.keepPrintedTraits === true,
            schFromThw: rule.schFromThw ?? false,
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
  // Leaving play itself, its attachments discarded with it (`leaveNow`): it stays what it is until it has moved.
  if (ctx.leavingHosts?.includes(hostId)) return;
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

/** The card's own `treatSelfAsAlly` constant, if it is active and its `while` holds now. */
function ownAllyRule(ctx: Ctx, hostId: InstanceId) {
  return activeRules(ctx.state, ctx.deps, "treatSelfAsAlly").find((r) => r.context.selfInstanceId === hostId)?.rule;
}

/**
 * "Take control of Black Cat as an ally" (`EffectSpec takeControl`; docs/phase7-wave11-scenarios.md §S3.8):
 * `controller` takes control of a minion in play that its own `treatSelfAsAlly` constant treats as an ally right now
 * (RRG 1.8 "Card Types", p. 12: "When a player changes a minion to an ally, that player takes control of that ally").
 * Nothing happens to a minion whose constant does not hold, or one already treated as something by another card
 * (Karma).
 */
export function takeControlAsOwnAlly(ctx: Ctx, hostId: InstanceId, controller: PlayerId): void {
  const host = getInstance(ctx.state, hostId);
  if (!host || host.treatedAs || cardOf(ctx.state, hostId)?.type !== "minion") return;
  if (!cardsInPlay(ctx.state).includes(hostId)) return;
  const rule = ownAllyRule(ctx, hostId);
  if (!rule) return;
  apply(ctx, hostId, null, {
    kind: "ally",
    traits: rule.traits ?? [],
    thwFromSch: rule.thwFromSch === true,
    consequential: rule.consequential,
    source: hostId,
    controller,
    engagedBefore: host.engagedWith,
    keepsText: true,
  });
}

/**
 * A card its own constant made an ally (`TreatedAsAlly.keepsText`) is a minion again the moment that constant stops
 * holding: its threat fell below 4, or its text box was blanked. Checked between frames (`checkStateTriggers`), as a
 * constant ability's effects "are active anytime the specific condition is met" (RRG 1.8 "Ability", p. 5). It goes
 * back the way Karma's minion does (`apply`): nobody controls it and it is engaged with the player who controlled it,
 * with no new engage trigger (docs/phase7-wave4.md §4 Q21); it neither enters nor leaves play, so its threat and
 * damage stay (ruling Dec 17, 2025 (1) #3: "essentially a status change").
 */
export function syncOwnTreatments(ctx: Ctx): void {
  for (const id of cardsInPlay(ctx.state)) {
    const treated = getInstance(ctx.state, id)?.treatedAs;
    if (treated?.kind !== "ally" || treated.keepsText !== true || treated.source !== id) continue;
    if (ownAllyRule(ctx, id)) continue;
    apply(ctx, id, treated, null);
  }
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
  } else if (current?.kind === "minion" && isSeatlessIdentity(ctx.state, hostId)) {
    // The attachment went and nothing else treats the hero as a minion. An identity card cannot stay in play as no
    // player's identity, so it is removed from the game with the attachment (owner decision, docs/phase7-wave9.md
    // §4.1 Q39 = A), as a double-sided card leaving play is (RRG 1.8 "Double-Sided Card", p. 17). It is not defeated:
    // no When Defeated ability resolves. A hero leaving play itself does not come here (`Ctx.leavingHosts`).
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: null }));
    emit(ctx, { type: "treatedAsChanged", instanceId: hostId, as: null });
    if (cardsInPlay(ctx.state).includes(hostId)) leavePlayAtOnce(ctx, hostId, { kind: "removedFromGame" });
    return;
  } else if (current?.kind === "minion") {
    // The attachment went: an ally again, controlled by whoever controlled it before, in their play area.
    const controller = current.controllerBefore ?? host.ownerId;
    if (controller) inAreaOf(controller);
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: null, controllerId: controller, engagedWith: null }));
  } else if (current?.kind === "ally") {
    // A minion again: nobody controls it, and it is engaged with the player who controlled it. Deliberately no
    // `minionEngaged` announcement (`engagementFrame`), so "when/after you engage a minion" interrupts and responses
    // do not hear it. RRG 1.8 "Engage" (p. 18) has a minion engage a player only by entering play in their play area
    // or by an ability instructing it to; neither happens here. It does not enter play (ruling Dec 17, 2025 (1) #3:
    // "essentially a status change"), and Mind Control, Redemption and Karma print no engage instruction for when
    // they end. docs/phase7-wave4.md §4 Q21, user decision 2026-09-25: "no new engage trigger". The ally-to-minion
    // direction above sets no engagement at all: Beguiled and its kin print "Attached ally engages its controller",
    // an `engage` effect, which announces itself.
    updateInstance(ctx, hostId, (i) => ({
      ...i,
      treatedAs: null,
      controllerId: null,
      engagedWith: current.controller,
    }));
  }
  emit(ctx, { type: "treatedAsChanged", instanceId: hostId, as: next?.kind ?? null });
}
