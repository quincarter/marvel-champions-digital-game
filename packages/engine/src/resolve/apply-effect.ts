/** Applying one non-interactive effect from an effects frame. */

import {
  type Ctx,
  emit,
  findFrame,
  moveCard,
  pushFrames,
  setFrame,
  updateFrame,
  updateInstance,
  updatePlayer,
} from "../ctx.js";
import {
  addAccelerationToken,
  addCounters,
  addLastingEffect,
  discardFromPlay,
  endGame,
  leavePlay,
  discardRandomFromHand,
  drawCards,
  drawEncounterCard,
  exhaustCard,
  giveStatus,
  healDamage,
  removeAccelerationToken,
  removeCounters,
  flipVillain,
  removeStatus,
  setActiveVillain,
  shuffleZone,
  takeTopOfDeck,
} from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { statusActive } from "../keywords.js";
import { boostIconsFor, cardEffectBonus } from "../modifiers.js";
import type { LastingDuration, LastingScope } from "../lasting.js";
import {
  activeEncounterDeckId,
  cardOf,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  getPlayer,
  hasStarIcon,
  inAnyEncounterDiscard,
  isMinion,
  maxHitPoints,
  mustInstance,
  mustPlayer,
  turnInProgress,
  villainOf,
} from "../query.js";
import { addPools, EMPTY_POOL, printedResources } from "../resources.js";
import {
  canAttack,
  cardsInPlay,
  categoriesOf,
  contextArea,
  controllerOf,
  type EffectContext,
  evaluate,
  matchesQuery,
  resolvePlayers,
  resolveRef,
  resolveValue,
} from "../select.js";
import type { EffectSpec, StatName } from "../spec.js";
import { currentActivationFrameId, type DeferredEffects, type ReportTarget, type StackFrame } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { matchingCardInPlay } from "../unique.js";
import { buildScenarioDeck, moveCardsTo, selectCards, shuffleEncounterDeck } from "./cards.js";
import { cannotThwart } from "../rules.js";
import { advanceMainSchemeStage, checkDefeats, completeMainScheme } from "./defeat.js";
import {
  addVillains,
  createGameArea,
  removeMainSchemeStage,
  removeVillains,
  revealMainSchemeStages,
} from "./game-areas.js";
import { readyOrAnnounce, threatRemovalBlocked } from "./event.js";
import { heard } from "./triggers.js";
import { dealBoostCard, giveBoostCard } from "./enemy-activation.js";
import { quickstrikeAttack } from "./enter-play.js";
import { addFrameVars, eventFrame, type Frame, gameAbilityFrames, pushEffects, pushEvents } from "./frames.js";
import { enterPlayOnReveal, revealFrame } from "./reveal.js";

/**
 * RRG 1.8 "Unique Icon" (pp. 45–46), the *put into play* half of the rule, quoted:
 *
 *   "A non-villain card in an out-of-play state that matches a card in play cannot enter
 *    play. If the out-of-play card is:
 *      - A player card, it cannot be played or put into play. Any effect that attempts to
 *        do so has no effect.
 *      - A non-villain encounter card, it is discarded and any effects of it entering play
 *        are ignored."
 *
 * So the two dispositions differ and neither is a failure the caller can see: a player card
 * (Make the Call reaching into a discard pile) is left exactly where it was and the rest of
 * the effect still resolves; a non-villain encounter card is discarded. A villain card is
 * exempt — the restriction is on the *entering* card being non-villain, and FFG's ruling on
 * the Ronan the Accuser minion vs. the Ronan the Accuser villain confirms a villain already
 * in play still blocks (that direction is the scan below, not this carve-out).
 *
 * Returns the ids that may proceed, and records every refusal in the game log.
 */
function admitUniqueEntry(
  ctx: Ctx,
  ids: readonly InstanceId[],
  forPlayer: PlayerId | null = null,
): readonly InstanceId[] {
  const admitted: InstanceId[] = [];
  for (const id of ids) {
    const card = cardOf(ctx.state, id);
    // A villain entering play is exempt; so is a card with no data to match on.
    if (!card || card.type === "villain") {
      admitted.push(id);
      continue;
    }
    // `ignore` keeps a card already in play from matching itself.
    const match = matchingCardInPlay(ctx.state, card, new Set([id]), forPlayer);
    if (!match) {
      admitted.push(id);
      continue;
    }
    const isPlayerCard = getInstance(ctx.state, id)?.ownerId !== null;
    emit(ctx, {
      type: "uniqueEntryBlocked",
      instanceId: id,
      cardId: card.id,
      matchedInstanceId: match,
      disposition: isPlayerCard ? "noEffect" : "discarded",
    });
    // Already in the encounter discard (a `discardEncounterUntil` search left it there):
    // nothing to move, and a no-op `cardMoved` would only muddy the log.
    if (!isPlayerCard && !inAnyEncounterDiscard(ctx.state, id)) moveCard(ctx, id, discardZoneFor(ctx.state, id));
  }
  return admitted;
}

/** A `minionEngaged` announcement for a minion now engaged with a player, when something could respond to it. */
export function engagedEvent(ctx: Ctx, id: InstanceId): readonly TriggerEvent[] {
  const playerId = getInstance(ctx.state, id)?.engagedWith;
  if (!playerId || !isMinion(ctx.state, id)) return [];
  const event: TriggerEvent = { kind: "minionEngaged", minionInstanceId: id, playerId };
  return heard(ctx.state, ctx.deps, event) ? [event] : [];
}

export function applyEffect(ctx: Ctx, effect: EffectSpec, context: EffectContext, frame: Frame<"effects">): void {
  const targets = (ref: Parameters<typeof resolveRef>[1]): readonly InstanceId[] =>
    resolveRef(ctx.state, ref, context).filter((id) => getInstance(ctx.state, id) !== undefined);
  const value = (spec: Parameters<typeof resolveValue>[1]): number => resolveValue(ctx.state, spec, context, ctx.deps);
  const reportTo = (bind: string | undefined): ReportTarget | null =>
    bind ? { frameId: frame.frameId, prefix: bind } : null;

  switch (effect.kind) {
    case "dealDamage": {
      // "Increase the amount of damage that event deals by 2" (Embiggen!): every instance this card deals (RRG 1.8
      // "Event", p. 19; FAQ "Embiggen (#10)", p. 59).
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, frame.selfInstanceId, "damage");
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "dealDamage",
          targetInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
          fromAttack: effect.fromAttack === true,
          ...(effect.ignoreTough ? { ignoreTough: true } : {}),
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "heal": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({ kind: "healDamage", targetInstanceId: id, amount })),
        reportTo(effect.bind),
      );
      return;
    }
    case "placeThreat": {
      const amount = value(effect.amount);
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "placeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "removeThreat": {
      // "Increase the amount of threat that event removes by 2" (Shrink): every instance this card removes.
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, frame.selfInstanceId, "threatRemoved");
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "removeThreat",
          schemeInstanceId: id,
          amount,
          sourceInstanceId: frame.selfInstanceId,
          ...(effect.ignoreCrisis ? { ignoreCrisis: true } : {}),
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "attack": {
      const controller = frame.controllerId;
      const [attacker] = targets(effect.attacker ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !attacker) return;
      let amount = value(effect.amount);
      if (effect.moveDamageFrom) {
        // RRG "Move": moved damage is healed from the source and dealt to the destination; no source, no move.
        const [from] = targets(effect.moveDamageFrom);
        amount = Math.min(amount, from ? mustInstance(ctx.state, from).damage : 0);
        if (!from || amount <= 0) return;
        healDamage(ctx, from, amount);
      }
      // "Increase the amount of damage that event deals by 2" (Embiggen!): an "(attack)" event's damage is an instance
      // too, like `dealDamage` above (RRG 1.8 "Event", p. 19; FAQ "Embiggen (#10)", p. 59). Added after a move is capped,
      // so it raises the damage dealt without healing more from the source.
      amount += cardEffectBonus(ctx.state, frame.selfInstanceId, "damage");
      // RRG 1.8 "Stun" (p. 41): "If a stunned identity or ally attempts to attack or use an attack ability, discard
      // the stunned card instead. Costs associated with the attack attempt … must still be paid." An ability that
      // creates several attacks spends the stun on the first of them only — FAQ "Dance of Death (#4)" (p. 59):
      // "Because Dance of Death creates three separate attacks, a stun status card on Black Widow will only prevent
      // the first attack. The second and third attack can be performed as normal." An "(attack)"-labeled ability
      // never reaches here: its label cancels the whole ability first (`labelCancels`), which is the RRG's rule for
      // labeled abilities and is what Dance of Death's missing label distinguishes it from.
      if (statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        updateInstance(ctx, attacker, (i) => ({ ...i, statuses: { ...i.statuses, stunned: 0 } }));
        emit(ctx, { type: "statusRemoved", instanceId: attacker, status: "stunned", reason: "cancelledAttack" });
        return;
      }
      // RRG "Attack (Player Ability Type)": attacks can target any enemy unless guard prevents it.
      const attacked = targets(effect.target).filter((id) => canAttack(ctx.state, attacker, id, ctx.deps));
      pushEvents(
        ctx,
        attacked.map((id) => ({
          kind: "attack",
          attackerInstanceId: attacker,
          targetInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          overkill: effect.overkill === true,
          ...(effect.keywords && effect.keywords.length > 0 ? { keywords: effect.keywords } : {}),
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "thwart": {
      const controller = frame.controllerId;
      const [thwarter] = targets(effect.thwarter ?? { kind: "identityOf", player: { kind: "controller" } });
      if (!controller || !thwarter || cannotThwart(ctx.state, ctx.deps, controller)) return;
      // A "(thwart)" event's threat removal is an instance too (RRG 1.8 "Thwart", p. 44).
      const amount = value(effect.amount) + cardEffectBonus(ctx.state, frame.selfInstanceId, "threatRemoved");
      pushEvents(
        ctx,
        targets(effect.target).map((id) => ({
          kind: "thwart",
          thwarterInstanceId: thwarter,
          schemeInstanceId: id,
          playerId: controller,
          amount,
          basic: false,
          ...(effect.ignoreCrisis ? { ignoreCrisis: true } : {}),
          sourceInstanceId: frame.selfInstanceId,
        })),
        reportTo(effect.bind),
      );
      return;
    }
    case "modifyAttack": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const delta: Record<string, number> = {};
      if (effect.overkill) delta.overkill = 1;
      // "The attack gains piercing": one var per keyword on the activation's own event frame, read when it deals
      // damage (`attackKeywordsOf`). `overkill` has always used this var name, so `keywords: ["overkill"]` is the same.
      for (const keyword of effect.keywords ?? []) delta[keyword] = 1;
      if (effect.preventAllDamage) delta.preventAllDamage = 1;
      if (effect.atkBonus) delta.atkBonus = value(effect.atkBonus);
      if (effect.threatBonus) delta.threatBonus = value(effect.threatBonus);
      const extra =
        effect.extraBoostCards === undefined
          ? 0
          : typeof effect.extraBoostCards === "number"
            ? effect.extraBoostCards
            : Math.max(0, value(effect.extraBoostCards));
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && f.eventFrameId === activation,
      );
      if (extra > 0 && procedure && procedure.stage !== "giveBoost") {
        // Boost cards are already being flipped: the extra card joins the pile and is flipped too.
        for (let i = 0; i < extra; i++) giveBoostCard(ctx, procedure.enemyInstanceId);
      } else if (extra > 0) {
        delta.extraBoost = extra;
      }
      addFrameVars(ctx, activation, delta);
      return;
    }
    case "modifyBasicPower": {
      // "Get +N to that power for this use": which power is read off the `basicPowerUsing` event this effect is
      // resolving inside (docs/phase7-wave2.md §17.4), so one effect serves every basic power a card names at once.
      const using = ctx.state.stack.find(
        (f): f is Frame<"event"> => f.kind === "event" && f.event.kind === "basicPowerUsing",
      );
      if (!using || using.event.kind !== "basicPowerUsing") return;
      const stat: StatName =
        using.event.power === "attack"
          ? "atk"
          : using.event.power === "thwart"
            ? "thw"
            : using.event.power === "defense"
              ? "def"
              : "rec";
      // "For this use": the activation the power belongs to (its own `attack`/`thwart` event, or the enemy attack a
      // basic defense answers), which is on the stack beneath this window and ends when that use does.
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      addLastingEffect(
        ctx,
        {
          kind: "statModifier",
          stat,
          amount: effect.amount,
          targets: [using.event.characterInstanceId],
          affects: null,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: "endOfEvent", frameId: activation },
      );
      return;
    }
    case "cancelBoostIcons":
    case "cancelBoostAbility": {
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && Boolean(f.boost),
      );
      const boost = procedure?.boost;
      const report = (made: number, amount?: number): void => {
        if (effect.bind)
          addFrameVars(ctx, frame.frameId, {
            [`${effect.bind}.made`]: made,
            ...(amount !== undefined ? { [`${effect.bind}.amount`]: amount } : {}),
          });
      };
      if (!procedure || !boost) return report(0);
      if (effect.kind === "cancelBoostAbility") {
        // Its ability resolves as soon as the turned-faceup windows close; after that there is nothing to cancel.
        if (boost.step !== "window" || boost.abilityCancelled) return report(0);
        setFrame(ctx, { ...procedure, boost: { ...boost, abilityCancelled: true } });
        return report(1);
      }
      const icons = boost.iconsCancelled ? 0 : boostIconsFor(ctx.state, ctx.deps, boost.instanceId);
      if (icons <= 0) return report(0);
      setFrame(ctx, { ...procedure, boost: { ...boost, iconsCancelled: true } });
      // Later windows on the same card see no icons left to cancel.
      const turned = ctx.state.stack.find(
        (f) =>
          f.kind === "event" &&
          f.event.kind === "boostCardTurnedFaceup" &&
          f.event.boostInstanceId === boost.instanceId,
      );
      if (turned?.kind === "event" && turned.event.kind === "boostCardTurnedFaceup")
        setFrame(ctx, { ...turned, event: { ...turned.event, boostIcons: 0 } });
      emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "icons" });
      return report(1, icons);
    }
    case "adjustBoostCount":
    case "replaceBoostCount": {
      // The boost card the current activation is counting (docs/phase7-wave2.md §3.6).
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && f.boost?.step === "count",
      );
      const boost = procedure?.boost;
      if (!procedure || !boost) return;
      if (effect.kind === "adjustBoostCount") {
        setFrame(ctx, {
          ...procedure,
          boost: { ...boost, countAdjust: (boost.countAdjust ?? 0) + value(effect.delta) },
        });
      } else {
        const [card] = resolveRef(ctx.state, effect.card, context);
        if (card) setFrame(ctx, { ...procedure, boost: { ...boost, countFrom: card } });
      }
      return;
    }
    case "atEndOfAttack":
    case "atEndOfActivation": {
      const activation = currentActivationFrameId(ctx.state.stack);
      if (!activation) return;
      const deferred: DeferredEffects = {
        effects: effect.effects,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        bindings: frame.bindings,
        vars: frame.vars,
      };
      updateFrame(ctx, activation, (f) => (f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f));
      return;
    }
    case "draw": {
      const amount = value(effect.amount);
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        drawCards(ctx, playerId, amount);
      }
      return;
    }
    case "discardFromHand": {
      // Only the `random` form lands here; the choosing form stops for a choice per player in `effects-frame.ts`.
      const amount = value(effect.amount);
      const filter = effect.filter;
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        // A filter narrows the pool the random pick draws from, by excluding everything that doesn't match.
        const excluded = filter
          ? mustPlayer(ctx.state, playerId).hand.filter((id) => !matchesQuery(ctx.state, id, filter, context))
          : [];
        discardRandomFromHand(ctx, playerId, amount, excluded);
      }
      return;
    }
    case "revealTopOfEncounterDeck": {
      for (let i = 0; i < effect.count; i++) {
        const id = drawEncounterCard(ctx);
        if (!id) return;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        if (effect.then === "discard") moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
      }
      return;
    }
    case "exhaust":
      for (const id of targets(effect.target)) exhaustCard(ctx, id);
      return;
    case "ready":
      for (const id of targets(effect.target)) readyOrAnnounce(ctx, id);
      return;
    case "giveStatus":
      for (const id of targets(effect.target)) giveStatus(ctx, id, effect.status);
      return;
    case "removeStatus":
      for (const id of targets(effect.target)) removeStatus(ctx, id, effect.status);
      return;
    case "addCounters": {
      const amount = value(effect.amount);
      for (const id of targets(effect.target)) addCounters(ctx, id, effect.counterType, amount);
      return;
    }
    case "removeCounters": {
      const amount = value(effect.amount);
      for (const id of targets(effect.target)) removeCounters(ctx, id, effect.counterType, amount);
      return;
    }
    case "attach": {
      const [host] = targets(effect.to);
      if (!host) return;
      for (const id of targets(effect.card)) {
        moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
        // "Attach 1 card from your hand facedown here" (Bruno Carrelli): no title, traits, keywords or abilities
        // while it is facedown; it is itself again when it leaves play (`leavePlay`).
        if (effect.facedown)
          updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
        // Otherwise it is faceup in play, whatever zone it came from ("search the top 5 cards of your deck for an
        // [Arrow] event and attach it faceup to this card", Hawkeye's Quiver; docs/phase7-wave2.md §3.10).
        else if (!mustInstance(ctx.state, id).faceup) updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
      }
      return;
    }
    case "engage": {
      // RRG 1.8 "Engage" (p. 18): an ability telling a player to engage a minion counts as that minion engaging them,
      // and a minion already engaged with that player cannot engage them again.
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      const engaged: TriggerEvent[] = [];
      for (const id of targets(effect.minion)) {
        const instance = getInstance(ctx.state, id);
        if (!instance || !isMinion(ctx.state, id) || instance.engagedWith === playerId) continue;
        moveCard(ctx, id, { kind: "playArea", playerId });
        updateInstance(ctx, id, (i) => ({ ...i, engagedWith: playerId, controllerId: null }));
        engaged.push(...engagedEvent(ctx, id));
      }
      pushEvents(ctx, engaged);
      return;
    }
    case "setRemainingHitPoints": {
      // "Set his hit point dial to 1 instead": the dial is remaining hit points (RRG 1.8 "Hit Points", p. 22), so
      // sustained damage becomes maximum hit points minus that. Not a heal, so no heal event (§3.13).
      const remaining = Math.max(0, value(effect.amount));
      for (const id of targets(effect.target)) {
        const max = maxHitPoints(ctx.state, id, ctx.deps);
        if (max === undefined) continue;
        const damage = Math.max(0, max - remaining);
        updateInstance(ctx, id, (instance) => ({ ...instance, damage }));
        emit(ctx, { type: "hitPointsSet", instanceId: id, remaining: Math.min(remaining, max), damage });
      }
      return;
    }
    case "modifyCardEffect": {
      const damage = effect.damage ? value(effect.damage) : 0;
      const threatRemoved = effect.threatRemoved ? value(effect.threatRemoved) : 0;
      if (damage === 0 && threatRemoved === 0) return;
      for (const id of targets(effect.card)) {
        addLastingEffect(
          ctx,
          { kind: "cardEffectBonus", sourceInstanceId: id, damage, threatRemoved },
          { kind: "endOfCardResolution", instanceId: id },
        );
      }
      return;
    }
    case "discardFromPlay":
      for (const id of targets(effect.target)) discardFromPlay(ctx, id);
      return;
    case "putIntoPlay": {
      const [controller] = resolvePlayers(ctx.state, effect.controller, context);
      if (!controller) return;
      const admitted = admitUniqueEntry(ctx, targets(effect.card), controller);
      const placed: InstanceId[] = [];
      for (const id of admitted) {
        const card = cardOf(ctx.state, id);
        // Encounter cards other than minions enter where their type goes (villain area, host, play area).
        if (
          card &&
          card.type !== "minion" &&
          getInstance(ctx.state, id)?.ownerId === null &&
          !cardsInPlay(ctx.state).includes(id)
        ) {
          updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
          enterPlayOnReveal(ctx, id, controller);
          placed.push(id);
        }
      }
      const entering = admitted.filter((id) => !placed.includes(id));
      for (const id of entering) {
        // A minion belongs to the encounter side even while it sits in a player's area.
        const isMinion = cardOf(ctx.state, id)?.type === "minion";
        moveCard(ctx, id, { kind: "playArea", playerId: controller });
        updateInstance(ctx, id, (instance) => ({
          ...instance,
          controllerId: isMinion ? null : controller,
          engagedWith: isMinion ? controller : instance.engagedWith,
          faceup: true,
        }));
      }
      const entered: TriggerEvent[] = entering.map((id) => ({
        kind: "cardEntersPlay",
        instanceId: id,
        playerId: controller,
      }));
      for (const id of entering) {
        const quickstrike = quickstrikeAttack(ctx.state, id);
        if (quickstrike) entered.push(quickstrike);
      }
      // After the keywords: "After you engage a minion" (ruling, Jan 17, 2026 (3) answer 2).
      for (const id of entering) entered.push(...engagedEvent(ctx, id));
      pushEvents(ctx, entered);
      return;
    }
    case "dealEncounterCard":
      // Dealing asks the first player for the order when several players receive cards (`executeDealEncounterCards`).
      throw new EngineInvariantError("dealEncounterCard is handled before applyEffect");
    case "revealEncounterCard": {
      const frames: StackFrame[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const id = drawEncounterCard(ctx);
        if (id) frames.push(revealFrame(ctx, playerId, id));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "giveBoostCard": {
      const count = effect.count ? Math.max(0, value(effect.count)) : 1;
      // Only an enemy in play can hold a boost card (RRG 1.8 "Boost, Boost Icon", p. 11: "dealt a boost card … remains
      // facedown on that enemy until that enemy activates"). Any enemy qualifies, villainous or not: the card text names
      // the recipient, and the villainous gate is only about the activation's automatic card (`giveBoostCard`).
      const inPlay = cardsInPlay(ctx.state);
      const enemies = targets(effect.enemy).filter(
        (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("enemy"),
      );
      for (const enemyId of enemies) {
        for (let i = 0; i < count; i++) dealBoostCard(ctx, enemyId, true);
      }
      return;
    }
    case "addAccelerationToken": {
      const count = effect.count ? Math.max(0, value(effect.count)) : 1;
      // "Place 1 acceleration token here for each side scheme in play": `target` absent is the central main scheme.
      const schemes = effect.target ? targets(effect.target) : [ctx.state.mainScheme.instanceId];
      for (const scheme of schemes) for (let i = 0; i < count; i++) addAccelerationToken(ctx, scheme);
      return;
    }
    case "flipCard": {
      const inPlay = cardsInPlay(ctx.state);
      const frames: StackFrame[] = [];
      for (const id of targets(effect.target)) {
        if (!inPlay.includes(id)) continue;
        const card = cardOf(ctx.state, id);
        const villain = villainOf(ctx.state, id);
        if (villain && card?.type === "villain") {
          // "Flip" names the other face of a two-faced card. A three-sided villain has two others, so card text names the
          // face by form instead (`changeVillainForm`; docs/phase7-wave2.md §6.9).
          if (card.sides.length !== 2) continue;
          const other = card.sides.find((side) => side.side !== villain.side);
          // Both faces of a double-sided stage card list the same stages (docs/phase7-wave1.md §1.3).
          if (!other?.stages[villain.stageIndex]) continue;
          flipVillain(ctx, id, other.side);
          frames.push(...gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId));
        } else if (card && "flipSide" in card && card.flipSide) {
          const flipped = !mustInstance(ctx.state, id).flipped;
          updateInstance(ctx, id, (i) => ({ ...i, flipped }));
          emit(ctx, { type: "cardFlipped", instanceId: id, flipped });
        } else {
          continue;
        }
        frames.push(eventFrame(ctx, { kind: "cardFlipped", instanceId: id }));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "changeVillainForm": {
      // "Change Apocalypse to [Giant] form" (Staggering Strength; The Age of Apocalypse): the face of the same stage card
      // whose traits include the form. RRG 1.8 "Flip" (p. 20): "A foldable, 'three-sided' card is considered to have
      // flipped any time the faceup side of the card changes", so it is a flip, with the same When Revealed and
      // `cardFlipped` as `flipCard`. Already in that form: nothing changes and nothing triggers.
      const inPlay = cardsInPlay(ctx.state);
      const frames: StackFrame[] = [];
      for (const id of targets(effect.villain)) {
        const card = cardOf(ctx.state, id);
        const villain = villainOf(ctx.state, id);
        if (!inPlay.includes(id) || !villain || card?.type !== "villain") continue;
        const face = card.sides.find((side) =>
          side.stages[villain.stageIndex]?.traits.includes(effect.toFaceWithTrait),
        );
        if (!face || face.side === villain.side) continue;
        flipVillain(ctx, id, face.side);
        frames.push(...gameAbilityFrames(ctx, id, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId));
        frames.push(eventFrame(ctx, { kind: "cardFlipped", instanceId: id }));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "setActiveVillain": {
      const [to] = targets(effect.villain).filter((id) => villainOf(ctx.state, id)?.defeated === false);
      if (!to) return;
      // The counter leaving a defeated villain is the insert's replacement rule, not an ability moving it.
      const reason = villainOf(ctx.state, ctx.state.activeVillainId)?.defeated ? "activeVillainDefeated" : "effect";
      setActiveVillain(ctx, to, reason);
      return;
    }
    case "removeAccelerationToken":
      removeAccelerationToken(ctx);
      return;
    case "advanceMainScheme": {
      // "The main scheme" of this effect's area unless named; `to` names the stage (docs/phase7-wave2.md §3.4).
      const [scheme] = effect.scheme ? targets(effect.scheme) : resolveRef(ctx.state, { kind: "mainScheme" }, context);
      if (scheme) advanceMainSchemeStage(ctx, scheme, effect.to);
      return;
    }
    case "completeMainScheme":
      for (const scheme of targets(effect.scheme)) completeMainScheme(ctx, scheme);
      return;
    case "endGame":
      endGame(
        ctx,
        effect.result === "win"
          ? { result: "win", reason: "villainDefeated" }
          : { result: "loss", reason: effect.reason ?? "mainSchemeCompleted" },
      );
      return;
    case "addVillain": {
      const actor = context.scopedPlayerId ?? context.controllerId ?? ctx.state.firstPlayerId;
      pushFrames(
        ctx,
        addVillains(ctx, targets(effect.villain), contextArea(ctx.state, context), effect.reveal ?? false, actor),
      );
      return;
    }
    case "removeVillain":
      removeVillains(ctx, targets(effect.villain));
      return;
    case "removeMainSchemeStage":
      for (const scheme of targets(effect.scheme)) removeMainSchemeStage(ctx, scheme);
      return;
    case "revealMainSchemeStage": {
      if (!ctx.state.scenarioRules.separateGameAreas) return;
      const players = resolvePlayers(ctx.state, effect.player, context);
      pushFrames(ctx, revealMainSchemeStages(ctx, players, effect.stageNumber, effect.removeUnused ?? false));
      return;
    }
    case "createGameArea": {
      const player = context.scopedPlayerId ?? context.controllerId;
      if (!player) return;
      for (const scheme of targets(effect.scheme)) createGameArea(ctx, scheme, player);
      return;
    }
    case "joinGameArea":
      throw new EngineInvariantError("joinGameArea is handled before applyEffect");
    case "atEndOfPhase":
      addLastingEffect(
        ctx,
        {
          kind: "delayedEffects",
          effects: effect.effects,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: "endOfPhase" },
      );
      return;
    case "moveThreat": {
      const [from] = targets(effect.from);
      const [to] = targets(effect.to);
      const available = from ? mustInstance(ctx.state, from).threat : 0;
      const amount = Math.min(available, effect.amount ? Math.max(0, value(effect.amount)) : available);
      // RRG 1.8 "Move" (p. 30): no move to the current placement, and none without a valid source and destination.
      const blocked = from ? threatRemovalBlocked(ctx.state, ctx.deps, from, frame.selfInstanceId) : null;
      if (!from || !to || from === to || amount <= 0 || blocked) {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
        return;
      }
      // Removed from the source, then placed on the destination; only the placement reports to `bind`.
      pushFrames(ctx, [
        eventFrame(ctx, {
          kind: "removeThreat",
          schemeInstanceId: from,
          amount,
          sourceInstanceId: frame.selfInstanceId,
        }),
        eventFrame(
          ctx,
          { kind: "placeThreat", schemeInstanceId: to, amount, sourceInstanceId: frame.selfInstanceId },
          reportTo(effect.bind),
        ),
      ]);
      return;
    }
    case "if": {
      const branch = evaluate(ctx.state, effect.condition, context) ? effect.then : (effect.otherwise ?? []);
      pushEffects(ctx, {
        effects: branch,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: frame.eventFrameId,
        bindings: frame.bindings,
        vars: frame.vars,
        scopedPlayerId: frame.scopedPlayerId,
      });
      return;
    }
    case "cancelTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) =>
        target.kind === "event" ? { ...target, cancelled: true } : target,
      );
      // RRG 1.8 "Cancel" (p. 13): cancelling the "when you play this card" event cancels *the card's* effects —
      // "Only the effects are prevented from initiating, and do not resolve", while "the card is still considered
      // played, and it is discarded". The play frame carries the flag the way a reveal frame carries
      // `effectsCancelled` for an encounter card, so this is one rule rather than a per-card branch.
      if (frame.event?.kind === "cardBeingPlayed") {
        const played = frame.event.instanceId;
        const play = ctx.state.stack.find((f) => f.kind === "playCard" && f.instanceId === played);
        if (play?.kind === "playCard") setFrame(ctx, { ...play, effectsCancelled: true });
      }
      return;
    }
    case "preventDamage":
    case "preventThreat": {
      const kind = effect.kind === "preventDamage" ? "dealDamage" : "placeThreat";
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== kind || target.cancelled) return;
      const pending = target.event.amount;
      const prevented = effect.amount === undefined ? pending : Math.min(pending, Math.max(0, value(effect.amount)));
      if (prevented <= 0) return;
      setFrame(ctx, { ...target, event: { ...target.event, amount: pending - prevented } });
      if (target.event.kind === "dealDamage") {
        emit(ctx, {
          type: "damagePrevented",
          targetInstanceId: target.event.targetInstanceId,
          amount: prevented,
          reason: "effect",
        });
      } else if (target.event.kind === "placeThreat") {
        emit(ctx, { type: "threatPrevented", schemeInstanceId: target.event.schemeInstanceId, amount: prevented });
      }
      return;
    }
    case "replaceTriggeringEvent": {
      if (!frame.eventFrameId) return;
      updateFrame(ctx, frame.eventFrameId, (target) =>
        target.kind === "event" ? { ...target, cancelled: true } : target,
      );
      pushEffects(ctx, {
        effects: effect.with,
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        event: frame.event,
        eventFrameId: null,
        bindings: frame.bindings,
        vars: frame.vars,
      });
      return;
    }
    case "cancelWhenRevealed":
    case "cancelRevealedCard": {
      const revealing = frame.event?.kind === "encounterCardRevealing" ? frame.event.instanceId : null;
      const reveal = ctx.state.stack.find(
        (f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === revealing,
      );
      if (!reveal) return;
      const all = effect.kind === "cancelRevealedCard";
      setFrame(ctx, all ? { ...reveal, effectsCancelled: true } : { ...reveal, whenRevealedCancelled: true });
      emit(ctx, { type: "revealCancelled", instanceId: reveal.instanceId, scope: all ? "allEffects" : "whenRevealed" });
      return;
    }
    case "placeDamage": {
      const amount = value(effect.amount);
      if (amount <= 0) return;
      for (const id of targets(effect.target)) {
        updateInstance(ctx, id, (i) => ({ ...i, damage: i.damage + amount }));
        emit(ctx, { type: "damagePlaced", targetInstanceId: id, amount, sourceInstanceId: frame.selfInstanceId });
      }
      checkDefeats(ctx);
      return;
    }
    case "bindTargets": {
      const ids = targets(effect.target);
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects" ? { ...f, bindings: { ...f.bindings, [effect.slot]: ids } } : f,
      );
      return;
    }
    case "modifyStatUntil":
    case "grantTraitUntil": {
      let duration: LastingDuration;
      if (effect.until === "endOfAttack") {
        const activation = currentActivationFrameId(ctx.state.stack);
        if (!activation) return;
        duration = { kind: "endOfEvent", frameId: activation };
      } else {
        // "Until the end of this turn" outside a turn cannot be initiated (RRG 1.8 "Lasting Effects", p. 26; §13).
        if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
        duration = { kind: effect.until };
      }
      const reach = {
        targets: effect.target ? targets(effect.target) : null,
        affects: effect.affects ?? null,
      };
      const scope: LastingScope = {
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        vars: frame.vars,
        bindings: frame.bindings,
      };
      addLastingEffect(
        ctx,
        effect.kind === "modifyStatUntil"
          ? { kind: "statModifier", stat: effect.stat, amount: effect.amount, scope, ...reach }
          : { kind: "traitGrant", trait: effect.trait, scope, ...reach },
        duration,
      );
      return;
    }
    case "applyRuleUntil": {
      const scope: LastingScope = {
        selfInstanceId: frame.selfInstanceId,
        controllerId: frame.controllerId,
        vars: frame.vars,
        bindings: frame.bindings,
      };
      /**
       * A player-scoped rule's own `player` ref is **resolved now and frozen** into the lasting effect, one effect
       * per player it names. A lasting effect is read long after its ability finished, with no triggering event and
       * often no source card (docs/phase7-wave2.md §22), so a ref that depends on either — `eventPlayer` on an
       * obligation's "When Revealed", `scoped` inside `forEachPlayer` — would quietly resolve to nobody and the
       * restriction would do nothing at all. Freezing it also makes the restriction inspectable in the game state:
       * the effect names the player it binds.
       */
      const players = "player" in effect.rule ? resolvePlayers(ctx.state, effect.rule.player, context) : [null];
      for (const rulePlayerId of players) {
        let duration: LastingDuration;
        if (effect.until === "endOfNextTurn") {
          // "Until your next turn ends": whose turn, and whether a turn of theirs is already under way — one that
          // is under way is not their *next* one (§22).
          const [playerId] = effect.player
            ? resolvePlayers(ctx.state, effect.player, context)
            : [rulePlayerId ?? frame.controllerId];
          if (!playerId) continue;
          const step = ctx.state.step;
          const ownTurnNow = step.phase === "player" && step.kind === "turn" && step.activePlayerId === playerId;
          duration = { kind: "endOfPlayerTurn", playerId, ...(ownTurnNow ? { skipRound: ctx.state.round } : {}) };
        } else {
          // "Until the end of this turn" outside a turn cannot be initiated (RRG 1.8 "Lasting Effects", p. 26; §13.3).
          if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
          duration = { kind: effect.until };
        }
        const rule =
          rulePlayerId && "player" in effect.rule
            ? { ...effect.rule, player: { kind: "id" as const, playerId: rulePlayerId } }
            : effect.rule;
        addLastingEffect(ctx, { kind: "ruleGrant", rule, scope }, duration);
      }
      return;
    }
    case "blankTextBox": {
      const ids = targets(effect.target);
      const activation = effect.until === "endOfAttack" ? currentActivationFrameId(ctx.state.stack) : null;
      if (ids.length === 0 || (effect.until === "endOfAttack" && !activation)) return;
      if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
      const duration: LastingDuration = activation
        ? { kind: "endOfEvent", frameId: activation }
        : { kind: effect.until === "endOfRound" || effect.until === "endOfTurn" ? effect.until : "endOfPhase" };
      addLastingEffect(ctx, { kind: "blankTextBox", targets: ids }, duration);
      return;
    }
    case "atEndOfRound":
      addLastingEffect(
        ctx,
        {
          kind: "delayedEffects",
          effects: effect.effects,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: "endOfRound" },
      );
      return;
    case "moveCards": {
      const ids = selectCards(ctx, effect.cards, context);
      if (effect.bind) {
        // Record what moved (and its printed resources / boost icons) before it moves.
        const pool = ids.reduce((sum, id) => {
          const card = cardOf(ctx.state, id);
          return card ? addPools(sum, printedResources(card)) : sum;
        }, EMPTY_POOL);
        // "… takes 1 damage for each boost icon discarded this way" (Hit Squad, `cap` pack): the printed count plus
        // any "gets +1 boost icon if …" modifier (§3.9's `boostIconsFor`), summed across every card this bind moved.
        const boostIcons = ids.reduce((sum, id) => sum + boostIconsFor(ctx.state, ctx.deps, id), 0);
        // A star icon is not a boost icon (RRG 1.8 "Boost, Boost Icon", p. 11), so this is its own total over the
        // same cards; a card printing both pips and a star adds to both.
        const starIcons = ids.filter((id) => hasStarIcon(ctx.state, id)).length;
        const bind = effect.bind;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [bind]: ids },
                vars: {
                  ...f.vars,
                  [`${bind}.count`]: ids.length,
                  [`${bind}.physical`]: pool.physical,
                  [`${bind}.mental`]: pool.mental,
                  [`${bind}.energy`]: pool.energy,
                  [`${bind}.wild`]: pool.wild,
                  [`${bind}.boostIcons`]: boostIcons,
                  [`${bind}.starIcons`]: starIcons,
                },
              }
            : f,
        );
      }
      moveCardsTo(ctx, ids, effect.to);
      return;
    }
    case "shuffleDeck":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const order = shuffleZone(ctx, { kind: "deck", playerId }, mustPlayer(ctx.state, playerId).deck);
        updatePlayer(ctx, playerId, (p) => ({ ...p, deck: order }));
      }
      return;
    case "changeForm":
      throw new EngineInvariantError("changeForm is handled before applyEffect");
    case "drawUpTo":
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const missing = value(effect.amount) - mustPlayer(ctx.state, playerId).hand.length;
        if (missing > 0) drawCards(ctx, playerId, missing);
      }
      return;
    case "forEachPlayer": {
      const players = resolvePlayers(ctx.state, effect.players, context);
      // Pushed in reverse so the first player's pass resolves first.
      for (const playerId of [...players].reverse()) {
        pushEffects(ctx, {
          effects: effect.effects,
          selfInstanceId: frame.selfInstanceId,
          controllerId: frame.controllerId,
          event: frame.event,
          eventFrameId: frame.eventFrameId,
          bindings: frame.bindings,
          vars: frame.vars,
          scopedPlayerId: playerId,
        });
      }
      return;
    }
    case "enemyAttack":
    case "enemyScheme": {
      if (effect.after === "currentActivation") {
        const activation = currentActivationFrameId(ctx.state.stack);
        if (activation) {
          // Queued behind the activation in progress: its end-of-event effects run after its response window, so its
          // Retaliate and responses resolve first (ruling, Feb 28, 2026 (1) answer 2).
          const { after, ...now } = effect;
          void after;
          const deferred: DeferredEffects = {
            effects: [now],
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            bindings: frame.bindings,
            vars: frame.vars,
          };
          updateFrame(ctx, activation, (f) =>
            f.kind === "event" ? { ...f, endEffects: [...f.endEffects, deferred] } : f,
          );
          return;
        }
      }
      const attacking = effect.kind === "enemyAttack";
      const against = effect.against ? resolvePlayers(ctx.state, effect.against, context) : null;
      const inPlayNow = cardsInPlay(ctx.state);
      const [character] =
        effect.kind === "enemyAttack" && effect.targetCharacter
          ? targets(effect.targetCharacter).filter(
              (id) => inPlayNow.includes(id) && categoriesOf(ctx.state, id).includes("character"),
            )
          : [];
      const characterController = character ? controllerOf(ctx.state, character) : null;
      const noBoost = effect.boost === false ? { noBoost: true } : {};
      const events: TriggerEvent[] = [];
      for (const enemy of targets(effect.enemies)) {
        const categories = categoriesOf(ctx.state, enemy);
        if (!categories.includes("enemy") || !cardsInPlay(ctx.state).includes(enemy)) continue;
        if (villainOf(ctx.state, enemy)?.defeated) continue;
        const players =
          effect.kind === "enemyAttack" && effect.targetCharacter
            ? [characterController].filter((p): p is PlayerId => p !== null)
            : (against ??
              [getInstance(ctx.state, enemy)?.engagedWith ?? frame.controllerId].filter(
                (p): p is PlayerId => p !== null,
              ));
        for (const playerId of players) {
          const player = getPlayer(ctx.state, playerId);
          if (!player || player.eliminated) continue;
          // Status first, then initiate even with a "—" stat (see `activateEnemy`, FAQ "Norman Osborn (#1A)", p. 58).
          const status = attacking ? "stunned" : "confused";
          if (statusActive(ctx.state, enemy, status, ctx.deps)) {
            // RRG "Stun"/"Confuse": the status is discarded instead; the enemy did not attack/scheme.
            updateInstance(ctx, enemy, (i) => ({ ...i, statuses: { ...i.statuses, [status]: 0 } }));
            emit(ctx, {
              type: "statusRemoved",
              instanceId: enemy,
              status,
              reason: attacking ? "cancelledAttack" : "cancelledSchemeOrThwart",
            });
            continue;
          }
          events.push(
            attacking
              ? {
                  kind: "enemyAttack",
                  enemyInstanceId: enemy,
                  attackedPlayerId: playerId,
                  targetPlayerId: playerId,
                  targetInstanceId: character ?? player.identity.instanceId,
                  ...(effect.kind === "enemyAttack" && effect.additionalResolution
                    ? { additionalResolution: true }
                    : {}),
                  ...noBoost,
                }
              : { kind: "enemyScheme", enemyInstanceId: enemy, playerId, ...noBoost },
          );
        }
      }
      // "Green Goblin attacks with +X ATK" / "schemes with +X SCH": evaluated once, now, and carried by each
      // activation this effect initiates, so it applies to exactly those and never leaks into a later one.
      const bonus =
        effect.kind === "enemyAttack"
          ? effect.atkBonus
            ? { atkBonus: value(effect.atkBonus) }
            : {}
          : effect.schBonus
            ? { schBonus: value(effect.schBonus) }
            : {};
      pushEvents(ctx, events, reportTo(effect.bind), bonus);
      return;
    }
    case "selectCards": {
      const ids = selectCards(ctx, effect.cards, context);
      const slot = effect.slot;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects"
          ? { ...f, bindings: { ...f.bindings, [slot]: ids }, vars: { ...f.vars, [`${slot}.count`]: ids.length } }
          : f,
      );
      return;
    }
    case "revealCard": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      const frames: StackFrame[] = [];
      for (const id of targets(effect.cards)) {
        // Park it with the revealing player's dealt cards while it resolves (out of the deck/discard it came from).
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        frames.push(revealFrame(ctx, playerId, id));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "takeIntoHand": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      for (const id of selectCards(ctx, effect.cards, context)) {
        const instance = getInstance(ctx.state, id);
        const card = cardOf(ctx.state, id);
        if (!instance || !card || !("deckLimit" in card)) continue;
        if (instance.ownerId !== playerId) {
          updateInstance(ctx, id, (i) => ({ ...i, ownerId: playerId, home: { kind: "player" } }));
          emit(ctx, { type: "ownershipChanged", instanceId: id, playerId });
        }
        if (cardsInPlay(ctx.state).includes(id)) leavePlay(ctx, id, { kind: "hand", playerId });
        else moveCard(ctx, id, { kind: "hand", playerId });
        updateInstance(ctx, id, (i) => ({ ...i, faceup: true, controllerId: playerId }));
      }
      return;
    }
    case "buildScenarioDeck":
      buildScenarioDeck(ctx, effect.name);
      return;
    case "shuffleEncounterDeck":
      shuffleEncounterDeck(ctx);
      return;
    case "discardEncounterUntil": {
      // Bounded by the number of encounter cards, so a deck with no match can't loop forever.
      const deckId = activeEncounterDeckId(ctx.state);
      const piles = encounterDeckOf(ctx.state, deckId);
      const limit = piles.deck.length + piles.discard.length;
      let found: InstanceId | null = null;
      for (let i = 0; i < limit && found === null; i++) {
        const id = drawEncounterCard(ctx, deckId);
        if (!id) break;
        updateInstance(ctx, id, (inst) => ({ ...inst, faceup: true }));
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
        if (matchesQuery(ctx.state, id, effect.filter, context)) found = id;
      }
      const bind = effect.bind;
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects"
          ? {
              ...f,
              bindings: { ...f.bindings, [bind]: found ? [found] : [] },
              vars: { ...f.vars, [`${bind}.count`]: found ? 1 : 0 },
            }
          : f,
      );
      return;
    }
    case "discardDeckUntil": {
      // RRG 1.8 "Player Deck" (p. 33), read on its own rather than carried over from the encounter deck (p. 17): "if
      // the player's deck empties while the player was discarding cards from their deck, no further cards are
      // discarded from the newly shuffled deck". A deck that was already empty when the effect began is reset first
      // (`takeTopOfDeck`) and the discarding happens from the new deck — the same split `discardEncounterCards` makes.
      const bind = effect.bind;
      // One player per "your deck"; several ("each player") each search their own deck, in player order, and every
      // match lands in the one slot, so `<bind>.count` is how many were found.
      const found: InstanceId[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const player = getPlayer(ctx.state, playerId);
        if (!player || player.eliminated) continue;
        // Bounded by the cards that exist, so a deck with no match can't loop forever.
        const limit = player.deck.length + player.discard.length;
        let discarded = 0;
        for (let i = 0; i < limit; i++) {
          if (discarded > 0 && mustPlayer(ctx.state, playerId).deck.length === 0) break;
          const id = takeTopOfDeck(ctx, playerId);
          if (!id) break;
          // The log already carries each move as `cardMoved`, the same record `discardEncounterUntil` leaves.
          moveCard(ctx, id, { kind: "discard", playerId }, "top");
          discarded++;
          if (matchesQuery(ctx.state, id, effect.filter, context)) {
            found.push(id);
            break;
          }
        }
      }
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "effects"
          ? { ...f, bindings: { ...f.bindings, [bind]: found }, vars: { ...f.vars, [`${bind}.count`]: found.length } }
          : f,
      );
      return;
    }
    case "discardEncounterCards": {
      // RRG 1.8 "Encounter Deck" (p. 17): discard until the count is met or the deck is emptied *by this effect*, and
      // then "do not continue the discard effect with the newly shuffled encounter deck". A deck that was already
      // empty when the effect began is reset first (with its acceleration token), as any draw from it would be.
      const deckId = activeEncounterDeckId(ctx.state);
      const count = Math.max(0, value(effect.count));
      const discarded: InstanceId[] = [];
      // "… for each boost icon discarded this way" (Power Drain, Lightning Bolt, Shock Therapy): summed across every
      // card this discard actually reached — so a discard cut short by the empty-deck rule above counts only what it
      // got. Each card's icons are read the moment it is discarded, before it moves, exactly as `moveCards` does.
      let boostIcons = 0;
      // "For each star icon in the boost area discarded this way" (Slipping Sanity, `scw`): counted over exactly the
      // cards this discard reached, and separately from `boostIcons` — RRG 1.8 "Boost, Boost Icon" (p. 11), "A star
      // icon is not itself considered a boost icon". Printed data, never the ability registry (§18.6).
      let starIcons = 0;
      let pool = EMPTY_POOL;
      for (let i = 0; i < count; i++) {
        if (discarded.length > 0 && encounterDeckOf(ctx.state, deckId).deck.length === 0) break;
        const id = drawEncounterCard(ctx, deckId);
        if (!id) break;
        updateInstance(ctx, id, (instance) => ({ ...instance, faceup: true }));
        boostIcons += boostIconsFor(ctx.state, ctx.deps, id);
        if (hasStarIcon(ctx.state, id)) starIcons += 1;
        const card = cardOf(ctx.state, id);
        if (card) pool = addPools(pool, printedResources(card));
        // Each card goes to its own deck's discard pile (its `home`), not necessarily the deck it came from.
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
        discarded.push(id);
      }
      const bind = effect.bind;
      if (bind) {
        const totals = pool;
        const icons = boostIcons;
        const stars = starIcons;
        updateFrame(ctx, frame.frameId, (f) =>
          f.kind === "effects"
            ? {
                ...f,
                bindings: { ...f.bindings, [bind]: discarded },
                vars: {
                  ...f.vars,
                  [`${bind}.count`]: discarded.length,
                  [`${bind}.boostIcons`]: icons,
                  [`${bind}.starIcons`]: stars,
                  [`${bind}.physical`]: totals.physical,
                  [`${bind}.mental`]: totals.mental,
                  [`${bind}.energy`]: totals.energy,
                  [`${bind}.wild`]: totals.wild,
                },
              }
            : f,
        );
      }
      const each = effect.forEachDiscarded;
      if (each) {
        // "Each time a card is discarded this way": one pass per discarded card, in discard order. Every discard
        // happens first; no wave 1 card reads the deck between two of them.
        for (const id of [...discarded].reverse()) {
          pushEffects(ctx, {
            effects: each.effects,
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            event: frame.event,
            eventFrameId: frame.eventFrameId,
            bindings: { ...frame.bindings, [each.slot]: [id] },
            vars: frame.vars,
            scopedPlayerId: frame.scopedPlayerId,
          });
        }
      }
      return;
    }
    case "tuckCards": {
      const [host] = targets(effect.under);
      if (!host) return;
      const inPlay = cardsInPlay(ctx.state);
      for (const id of selectCards(ctx, effect.cards, context)) {
        // A card tucked out of play leaves play properly: its attachments are discarded and it is a new copy (RRG 1.8
        // "Leaves Play", p. 27): Marked for Death "tucks her faceup beneath this card" (docs/phase7-wave2.md §3.10).
        if (inPlay.includes(id)) leavePlay(ctx, id, { kind: "tucked", hostInstanceId: host });
        else moveCard(ctx, id, { kind: "tucked", hostInstanceId: host });
        updateInstance(ctx, id, (i) => ({
          ...i,
          faceup: effect.facedown !== true,
          controllerId: i.ownerId,
          attachedTo: null,
        }));
      }
      return;
    }
    case "putIntoPlayFacedown": {
      const count = effect.count ? value(effect.count) : 1;
      const entered: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        for (let i = 0; i < count; i++) {
          const id = takeTopOfDeck(ctx, playerId);
          if (!id) break;
          moveCard(ctx, id, { kind: "playArea", playerId });
          // Engaged with that player like any minion; it belongs to the encounter side while facedown.
          updateInstance(ctx, id, (inst) => ({
            ...inst,
            faceup: false,
            controllerId: null,
            engagedWith: playerId,
            facedownAs: effect.as,
          }));
          emit(ctx, { type: "cardPutIntoPlayFacedown", instanceId: id, playerId, as: effect.as.kind });
          entered.push({ kind: "cardEntersPlay", instanceId: id, playerId }, ...engagedEvent(ctx, id));
        }
      }
      pushEvents(ctx, entered);
      checkDefeats(ctx);
      return;
    }
    case "gainSurge": {
      const reveal = ctx.state.stack.find(
        (f): f is Frame<"reveal"> => f.kind === "reveal" && f.instanceId === frame.selfInstanceId,
      );
      if (reveal) setFrame(ctx, { ...reveal, surgeGained: true });
      return;
    }
    case "chooseCards":
    case "chooseOne":
    case "choosePlayer":
    case "resolveSpecials":
    case "assignDamage":
    case "dealIndirectDamage":
    case "reorderCards":
      throw new EngineInvariantError(`${effect.kind} is handled before applyEffect`);
    case "reduceNextCardCost": {
      const amount = value(effect.amount);
      // Signed: a positive amount reduces, a negative one increases ("costs N additional resources"). 0 does nothing.
      if (amount === 0) return;
      if (effect.duration === "turn" && !turnInProgress(ctx.state)) return;
      const filter = effect.cardFilter ? { cardFilter: effect.cardFilter } : {};
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        addLastingEffect(
          ctx,
          { kind: "costReduction", playerId, amount, ...filter },
          effect.duration === "untilPlayed"
            ? { kind: "untilCardPlayed", playerId, ...filter }
            : {
                kind:
                  effect.duration === "phase" ? "endOfPhase" : effect.duration === "turn" ? "endOfTurn" : "endOfRound",
              },
        );
      }
      return;
    }
    case "afterNextCardPlayed": {
      const filter = effect.cardFilter ? { cardFilter: effect.cardFilter } : {};
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        addLastingEffect(
          ctx,
          {
            kind: "delayedEffects",
            effects: effect.effects,
            scope: {
              selfInstanceId: frame.selfInstanceId,
              controllerId: frame.controllerId,
              vars: frame.vars,
              bindings: frame.bindings,
            },
          },
          { kind: "untilCardPlayed", playerId, ...filter },
        );
      }
      return;
    }
    case "chooseTarget":
      throw new EngineInvariantError("chooseTarget is handled before applyEffect");
    case "spendResources":
      throw new EngineInvariantError("spendResources is handled before applyEffect");
  }
}
