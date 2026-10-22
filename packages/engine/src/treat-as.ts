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
 * - an ally a `treatAsMinion` constant's query matches is a minion while the rule is active and still matches it
 *   (Baron Zemo, "each ally with threat on it", docs/phase7-wave11-scenarios.md §S3.9; `syncRuleTreatments`).
 * - a hero from a collection, an identity card that is no seat's identity, is a minion while a `treatHostAsMinion`
 *   card is attached to it, and is in play only for that long (Reluctant Foe, docs/phase7-wave9.md §3.30): when the
 *   attachment goes and the hero is not leaving play itself, the hero is removed from the game (§4.1 Q39 = A).
 * - a villain card that is not one of the game's villains (`isLooseVillainCard`) is a minion while a
 *   `treatHostAsMinion` card is attached to it, keeping its own text when the rule says so (Whisper in the Dark,
 *   Shadowland 65040); when that card goes without it, it stays in play as one of the game's villains
 *   (`promoteLooseVillain`).
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
import {
  cardOf,
  getInstance,
  isHostOnlyCard,
  isLooseVillainCard,
  isSeatlessIdentity,
  locateCard,
  looseVillainSide,
} from "./query.js";
import { promoteLooseVillain } from "./resolve/game-areas.js";
import { type ActiveRule, activeAbilityRefs, activeRules, cardsInPlay, controllerOf, matchesQuery } from "./select.js";
import type { GameState, TreatedAs, TreatedAsAlly, ZoneId } from "./state.js";

/** What the host's own attachments make it, if anything. */
function fromAttachments(ctx: Ctx, hostId: InstanceId, current: TreatedAs | null): TreatedAs | null {
  const host = getInstance(ctx.state, hostId);
  const type = cardOf(ctx.state, hostId)?.type;
  // A hero no player is using is treated as an ally is (docs/phase7-wave9.md §3.30); a seat's identity never is. So is
  // a villain card that is not one of the game's villains (Whisper in the Dark); a villain never is.
  const foe = isHostOnlyCard(ctx.state, hostId);
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
            ...(rule.keepsText === true ? { keepsText: true as const } : {}),
            ...(rule.printedHp !== undefined ? { printedHp: rule.printedHp } : {}),
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

/**
 * The card as it would be with nothing treating it as another type: an ally its controller controls again. A
 * `treatAsMinion` query ("each ally with threat on it") is read of this, so the card it made a minion keeps matching.
 */
function untreatedView(state: GameState, id: InstanceId): GameState {
  const instance = state.instances[id];
  const treated = instance?.treatedAs;
  if (!instance || treated?.kind !== "minion") return state;
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, treatedAs: null, controllerId: treated.controllerBefore } },
  };
}

/** The first active `treatAsMinion` rule (of `source` only, when given) whose query matches the untreated card. */
function matchingMinionRule(
  ctx: Ctx,
  rules: readonly ActiveRule<"treatAsMinion">[],
  id: InstanceId,
  source?: InstanceId,
) {
  const view = untreatedView(ctx.state, id);
  return rules.find(
    ({ rule, context }) =>
      context.selfInstanceId !== null &&
      (source === undefined || context.selfInstanceId === source) &&
      matchesQuery(view, id, rule.cards, context),
  );
}

/**
 * Every ally a `RuleSpec treatAsMinion` matches is a minion while it does (Baron Zemo, `fne` 60145; docs/phase7-wave11-
 * scenarios.md §S3.9), checked between frames as `syncOwnTreatments` is. First the cards a rule made minions whose rule
 * no longer matches them go back to being allies (`apply`: under their owner's control, engaged with no one, threat
 * and damage kept); then each ally card in play that nothing treats as anything and an active rule matches becomes
 * that rule's minion, keeping its controller as `controllerBefore` (who "its controller" still names while it is a
 * minion, as for an ally an attachment made a minion). In play order, the first matching rule taking it.
 */
export function syncRuleTreatments(ctx: Ctx): void {
  const rules = activeRules(ctx.state, ctx.deps, "treatAsMinion");
  const byRule = cardsInPlay(ctx.state).filter((id) => {
    const treated = getInstance(ctx.state, id)?.treatedAs;
    return treated?.kind === "minion" && treated.byRule === true;
  });
  if (rules.length === 0 && byRule.length === 0) return;
  for (const id of byRule) {
    const treated = getInstance(ctx.state, id)?.treatedAs;
    if (treated?.kind !== "minion") continue;
    if (matchingMinionRule(ctx, rules, id, treated.source)) continue;
    apply(ctx, id, treated, null);
  }
  if (rules.length === 0) return;
  // A card something else already treats is skipped (owner Q206 = A, 2026-10-19): an ally that Converted (`fne` 60100)
  // has made an Influenced minion is no longer an ally, so Zemo's "each ally with threat on it" does not reach it; if
  // Converted leaves while Zemo stays, it is an ally again and Zemo makes it a Deceived minion. RRG 1.8 p. 4 (a
  // constant is checked continuously against what the card is now); ruling Dec 17, 2025 (Beguiled: a status change, not
  // leaving play). The July 8, 2022 ruling (Mind Control vs. Beguiled: the effect that entered play last wins) does not
  // force a both-or-latest reading here, because Zemo's effect needs an ally and the card is already a minion.
  for (const id of cardsInPlay(ctx.state)) {
    const host = getInstance(ctx.state, id);
    if (!host || host.treatedAs || host.facedownAs || cardOf(ctx.state, id)?.type !== "ally") continue;
    const found = matchingMinionRule(ctx, rules, id);
    if (!found?.context.selfInstanceId) continue;
    apply(ctx, id, null, {
      kind: "minion",
      traits: found.rule.traits,
      keepPrintedTraits: found.rule.keepPrintedTraits === true,
      schFromThw: found.rule.schFromThw ?? false,
      source: found.context.selfInstanceId,
      controllerBefore: host.controllerId,
      byRule: true,
    });
  }
}

/**
 * Where a host-only card (`isHostOnlyCard`) goes when the attachment that would have made it a minion was refused
 * (`putIntoPlayAsHost`), so that it never was in play as anything.
 *
 * - An identity card no seat is using is removed from the game, as a double-sided card leaving play is (RRG 1.8
 *   "Double-Sided Card", p. 17; owner decision, docs/phase7-wave9.md §4.1 Q39 = A).
 * - A villain card that is not one of the game's villains goes back where it was taken from, the encounter set-aside
 *   area (`putIntoPlayAsHost` takes one from nowhere else).
 */
export function hostOnlyReleaseZone(state: GameState, id: InstanceId): ZoneId {
  return isLooseVillainCard(state, id) ? { kind: "encounterSetAside" } : { kind: "removedFromGame" };
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
  } else if (current?.kind === "minion" && isLooseVillainCard(ctx.state, hostId)) {
    // A villain card the attachment made a minion (Whisper in the Dark) is a villain card again where it is, one of the
    // game's villains: a status change, not a zone change (`promoteLooseVillain`, which cites the rules expert's
    // reading; owner confirmation pending). The side that was up stays up. A card leaving play itself does not come
    // here (`Ctx.leavingHosts`).
    const side = looseVillainSide(ctx.state, hostId)?.side ?? "A";
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: null }));
    emit(ctx, { type: "treatedAsChanged", instanceId: hostId, as: null });
    if (cardsInPlay(ctx.state).includes(hostId)) promoteLooseVillain(ctx, hostId, side);
    return;
  } else if (current?.kind === "minion" && isSeatlessIdentity(ctx.state, hostId)) {
    // The attachment went and nothing else treats the hero as a minion. An identity card cannot stay in play as no
    // player's identity, so it is removed from the game with the attachment (owner decision, docs/phase7-wave9.md
    // §4.1 Q39 = A), as a double-sided card leaving play is (RRG 1.8 "Double-Sided Card", p. 17). It is not defeated:
    // no When Defeated ability resolves. A hero leaving play itself does not come here (`Ctx.leavingHosts`).
    updateInstance(ctx, hostId, (i) => ({ ...i, treatedAs: null }));
    emit(ctx, { type: "treatedAsChanged", instanceId: hostId, as: null });
    if (cardsInPlay(ctx.state).includes(hostId)) leavePlayAtOnce(ctx, hostId, hostOnlyReleaseZone(ctx.state, hostId));
    return;
  } else if (current?.kind === "minion") {
    // An ally again, in its owner's play area, under its owner's control, whoever controlled it before. MC60 FAQ p. 26
    // (Baron Zemo leaving play: "allies again, under their owner's control", keeping the threat); RRG 1.8 "Ownership
    // and Control" (p. 31): a change of control that ends reverts the card to its owner (an attachment that changed
    // control being removed included). `controllerBefore` is only "its controller" while it is a minion.
    const controller = host.ownerId ?? current.controllerBefore;
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
