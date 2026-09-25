/** Applying one non-interactive effect from an effects frame. */

import { nextInt } from "../rng.js";
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
  defeatFromPlay,
  discardFromPlay,
  endGame,
  leavePlay,
  discardRandomFromHand,
  drawCards,
  drawUpTo,
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
  playerDeckResets,
  takeTopOfDeck,
} from "../effects.js";
import { EngineInvariantError } from "../errors.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { printedFormTypes, statusActive } from "../keywords.js";
import { boostIconsFor, cardEffectBonus } from "../modifiers.js";
import type { LastingDuration, LastingScope } from "../lasting.js";
import {
  activeEncounterDeckId,
  cardOf,
  characterProfile,
  currentName,
  discardZoneFor,
  encounterDeckOf,
  getInstance,
  getPlayer,
  hasStarIcon,
  inAnyEncounterDiscard,
  isMinion,
  locateCard,
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
  DEFENDER_SLOT,
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
import { campaignSeatNumber } from "../campaign-state.js";
import { campaignLogValueOf, recordCampaignRemoval, recordCampaignWrite } from "./campaign.js";
import { damageGroupFrame } from "./damage-group.js";
import { advanceToSetAsideVillain, swapVillain } from "./villain-swap.js";
import { flipToOtherFace } from "./other-face.js";
import { buildScenarioDeck, moveCardsTo, selectCards, shuffleEncounterDeck } from "./cards.js";
import {
  canHaveAttached,
  cannotBeUnattached,
  cannotChangeForm,
  cannotThwart,
  playersCannotDiscard,
  revealCannotBeCanceled,
} from "../rules.js";
import { advanceMainSchemeStage, checkDefeats, completeMainScheme } from "./defeat.js";
import {
  addVillains,
  createGameArea,
  putMainSchemeStageIntoPlay,
  removeMainSchemeStage,
  removeVillains,
  revealMainSchemeStages,
} from "./game-areas.js";
import { announceDamagePrevented, readyOrAnnounce, threatRemovalBlocked } from "./event.js";
import { heard } from "./triggers.js";
import { dealBoostCard, declareDefenderByEffect, giveBoostCard } from "./enemy-activation.js";
import { quickstrikeAttack } from "./enter-play.js";
import {
  addFrameVars,
  eventFrame,
  type Frame,
  gameAbilityFrames,
  pushEffects,
  pushEvent,
  pushEvents,
} from "./frames.js";
import { pushConsequentialDamage } from "../actions.js";
import { treatAsAlly } from "../treat-as.js";
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
    const match = matchingCardInPlay(ctx.state, card, new Set([id]), forPlayer, ctx.deps);
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

/** The encounter card types a player can be dealt (not a villain or main scheme, which are never in the deck). */
const DEALABLE_TYPES: ReadonlySet<string> = new Set([
  "attachment",
  "environment",
  "minion",
  "obligation",
  "side_scheme",
  "treachery",
]);

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
      const events = targets(effect.target).map((id): Extract<TriggerEvent, { kind: "dealDamage" }> => ({
        kind: "dealDamage",
        targetInstanceId: id,
        amount,
        sourceInstanceId: frame.selfInstanceId,
        fromAttack: effect.fromAttack === true,
        ...(effect.ignoreTough ? { ignoreTough: true } : {}),
      }));
      // One effect dealing damage to several characters ("each character", "two enemies") deals it simultaneously:
      // ruling, June 2, 2026 (2) answer 1 ("Damage is dealt simultaneously; resolve damage steps for both enemies at
      // the same time"), with RRG 1.8 "Damage" (p. 14) giving the steps. So every target is dealt its damage before
      // any defeat is checked, through the same group indirect damage uses (docs/phase7-wave3.md §4 Q1).
      if (events.length > 1) {
        pushFrames(ctx, [damageGroupFrame(ctx, events, reportTo(effect.bind))]);
        return;
      }
      pushEvents(ctx, events, reportTo(effect.bind));
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
    case "treatAsAlly": {
      // Karma (docs/phase7-wave4.md §3.29): the effect's controller takes each target minion, as an ally, for as long as
      // this card is in play (`releaseTreatedBy` when it leaves).
      const controller = frame.controllerId;
      const source = frame.selfInstanceId;
      if (!controller || !source || !cardsInPlay(ctx.state).includes(source)) return;
      for (const id of targets(effect.target)) {
        treatAsAlly(ctx, id, {
          traits: effect.traits,
          thwFromSch: effect.thwFromSch === true,
          consequential: effect.consequential,
          source,
          controller,
        });
      }
      return;
    }
    case "friendlyCharacterAttacks": {
      // docs/phase7-wave4.md §3.26 (Old Rivals). A friendly character: a hero-form identity or an ally a player controls.
      const inPlay = cardsInPlay(ctx.state);
      const [attacker] = targets(effect.attacker).filter((id) => {
        if (!inPlay.includes(id) || controllerOf(ctx.state, id) === null) return false;
        const categories = categoriesOf(ctx.state, id);
        return categories.includes("hero") || categories.includes("ally");
      });
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      const player = playerId ? getPlayer(ctx.state, playerId) : undefined;
      const noAttack = () => {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
      };
      if (!attacker || !player || player.eliminated) return noAttack();
      if (characterProfile(ctx.state, attacker, ctx.deps)?.missing.includes("atk")) return noAttack();
      if (statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        updateInstance(ctx, attacker, (i) => ({ ...i, statuses: { ...i.statuses, stunned: 0 } }));
        emit(ctx, { type: "statusRemoved", instanceId: attacker, status: "stunned", reason: "cancelledAttack" });
        return noAttack();
      }
      const consequential = pushConsequentialDamage(ctx, attacker, "attack");
      pushEvent(
        ctx,
        {
          kind: "attack",
          attackerInstanceId: attacker,
          targetInstanceId: player.identity.instanceId,
          playerId: controllerOf(ctx.state, attacker)!,
          basic: false,
          sourceInstanceId: frame.selfInstanceId,
        },
        reportTo(effect.bind) ?? consequential,
      );
      return;
    }
    case "enemyAttacksEnemy": {
      // docs/phase7-wave3.md §3.23 / §4 Q12: an attack, not an activation. The checks that decide whether the attack
      // happens at all are here, the damage itself in the event's apply step (`resolve/event.ts`).
      const inPlay = cardsInPlay(ctx.state);
      const [attacker] = targets(effect.attacker).filter((id) => inPlay.includes(id));
      const [target] = targets(effect.target).filter((id) => id !== attacker && inPlay.includes(id));
      if (!attacker || !target) return;
      if (!categoriesOf(ctx.state, attacker).includes("enemy") || !categoriesOf(ctx.state, target).includes("enemy"))
        return;
      // RRG 1.8 "Stun" (p. 41): "When this character would attack, remove each stunned status card from it instead."
      // This is an attack, so a stunned attacker spends its stun, even though it is not an activation.
      if (statusActive(ctx.state, attacker, "stunned", ctx.deps)) {
        updateInstance(ctx, attacker, (i) => ({ ...i, statuses: { ...i.statuses, stunned: 0 } }));
        emit(ctx, { type: "statusRemoved", instanceId: attacker, status: "stunned", reason: "cancelledAttack" });
        return;
      }
      pushEvents(
        ctx,
        [
          {
            kind: "enemyAttacksEnemy",
            attackerInstanceId: attacker,
            targetInstanceId: target,
            sourceInstanceId: frame.selfInstanceId,
          },
        ],
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
          ...(effect.ignorePatrol ? { ignorePatrol: true } : {}),
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
      if (effect.defenseUsesAtk) delta.defenseUsesAtk = 1;
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
    case "shuffleInSetAsideModularSet": {
      const sets = ctx.state.setAsideModularSets ?? [];
      if (sets.length === 0) {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 0 });
        return;
      }
      const [pick, rng] = nextInt(ctx.state.rng, sets.length);
      const chosen = sets[pick]!;
      ctx.state = { ...ctx.state, rng, setAsideModularSets: sets.filter((_, index) => index !== pick) };
      // Only the cards still set aside: one an ability already took out ("search … the set-aside area") stays where it is.
      const still = chosen.instanceIds.filter((id) => ctx.state.encounterSetAside.includes(id));
      moveCardsTo(ctx, still, "encounterDeckShuffle");
      emit(ctx, { type: "setAsideModularSetShuffledIn", encounterSetId: chosen.encounterSetId, instanceIds: still });
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: 1 });
      return;
    }
    case "retargetAttack": {
      const inPlay = cardsInPlay(ctx.state);
      const [character] = targets(effect.character).filter(
        (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("character"),
      );
      const playerId = character ? controllerOf(ctx.state, character) : null;
      if (!character || !playerId) return;
      const attack = ctx.state.stack.find(
        (f): f is Frame<"event"> => f.kind === "event" && f.event.kind === "enemyAttack" && !f.cancelled,
      );
      if (!attack || attack.event.kind !== "enemyAttack") return;
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack" && f.eventFrameId === attack.frameId,
      );
      // Once a defender is declared the attack has its target; "he attacks X" happens as the attack is initiated.
      if ((attack.slots[DEFENDER_SLOT] ?? []).length > 0 || (procedure && procedure.defenderInstanceId !== null))
        return;
      const retargeted = { targetInstanceId: character, targetPlayerId: playerId, attackedPlayerId: playerId };
      setFrame(ctx, { ...attack, event: { ...attack.event, ...retargeted } });
      if (procedure) setFrame(ctx, { ...procedure, ...retargeted });
      emit(ctx, {
        type: "attackRetargeted",
        enemyInstanceId: attack.event.enemyInstanceId,
        targetInstanceId: character,
        playerId,
      });
      return;
    }
    case "resolveAttackAgainst": {
      const attack = ctx.state.stack.find(
        (f): f is Frame<"event"> => f.kind === "event" && f.event.kind === "attack" && !f.cancelled,
      );
      if (!attack || attack.event.kind !== "attack") return;
      const original = attack.event;
      const inPlay = cardsInPlay(ctx.state);
      if (!inPlay.includes(original.attackerInstanceId)) return;
      const { results: _results, ...body } = original;
      pushEvents(
        ctx,
        targets(effect.targets)
          .filter(
            (id) =>
              id !== original.targetInstanceId &&
              inPlay.includes(id) &&
              canAttack(ctx.state, original.attackerInstanceId, id, ctx.deps),
          )
          .map((id) => ({ ...body, targetInstanceId: id, additionalResolution: true as const })),
      );
      return;
    }
    case "declareDefender": {
      const inPlay = cardsInPlay(ctx.state);
      const [defender] = targets(effect.character).filter(
        (id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("character"),
      );
      if (defender) declareDefenderByEffect(ctx, defender, effect.exhaust === true);
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
    case "setDefeatDestination": {
      // docs/phase7-wave3.md §3.45: "return it to its owner's hand instead of discarding it", from an interrupt to the
      // defeat. The defeat still happens; `applyDefeat` sends the card here instead of its discard pile.
      const target = frame.eventFrameId ? findFrame(ctx.state, frame.eventFrameId) : undefined;
      if (target?.kind !== "event" || target.event.kind !== "characterDefeated" || target.cancelled) return;
      setFrame(ctx, { ...target, event: { ...target.event, destination: effect.to } });
      return;
    }
    case "cancelConsequentialDamage": {
      // docs/phase7-wave3.md §3.21: the waiting consequential damage event of each character, cancelled before it applies.
      const characters = targets(effect.character);
      for (const pending of ctx.state.stack) {
        if (
          pending.kind === "event" &&
          pending.stage === "interrupts" &&
          pending.event.kind === "dealDamage" &&
          pending.event.consequential === true &&
          characters.includes(pending.event.targetInstanceId)
        ) {
          updateFrame(ctx, pending.frameId, (f) => (f.kind === "event" ? { ...f, cancelled: true } : f));
        }
      }
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
    case "discardBoostCard": {
      // docs/phase7-wave4.md §3.35 (Defiance): "discard it instead" of turning it faceup and applying it.
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") && Boolean(f.boost),
      );
      const boost = procedure?.boost;
      const made = (n: number): void => {
        if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.made`]: n });
      };
      if (
        !procedure ||
        !boost ||
        boost.step !== "window" ||
        locateCard(ctx.state, boost.instanceId)?.kind !== "boost"
      ) {
        return made(0);
      }
      setFrame(ctx, { ...procedure, boost: { ...boost, iconsCancelled: true, abilityCancelled: true } });
      const turned = ctx.state.stack.find(
        (f) =>
          f.kind === "event" &&
          f.event.kind === "boostCardTurnedFaceup" &&
          f.event.boostInstanceId === boost.instanceId,
      );
      if (turned?.kind === "event" && turned.event.kind === "boostCardTurnedFaceup")
        setFrame(ctx, { ...turned, event: { ...turned.event, boostIcons: 0 } });
      moveCard(ctx, boost.instanceId, discardZoneFor(ctx.state, boost.instanceId), "top");
      emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "discarded" });
      return made(1);
    }
    case "adjustBoostCount":
    case "replaceBoostCount": {
      // The boost card the current activation is counting (docs/phase7-wave2.md §3.6), or still resolving its own
      // "Boost:" ability (`step === "ability"`, before the count step is reached — docs/phase7-wave3.md's `gmw`
      // Badoon Warlord/Badoon Lieutenant, "[star] Boost: If this activation is an attack/scheme, this card gets +2
      // boost icons for this activation": a card's own Boost ability modifying its own count has to run while its
      // effects are still on the stack, which is before the frame's `boost.step` becomes `"count"`. `countAdjust`
      // is carried on the same procedure/boost object either way, so setting it early is equivalent to setting it
      // at the count step itself.
      const procedure = ctx.state.stack.find(
        (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
          (f.kind === "enemyAttack" || f.kind === "enemyScheme") &&
          (f.boost?.step === "count" || f.boost?.step === "ability"),
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
      for (const id of targets(effect.target)) {
        readyOrAnnounce(ctx, id, {
          readierId: frame.controllerId,
          sourceInstanceId: frame.selfInstanceId,
          costPaid: effect.readyCostPaid === true,
        });
      }
      return;
    case "giveStatus":
      for (const id of targets(effect.target)) giveStatus(ctx, id, effect.status);
      return;
    case "removeStatus":
      for (const id of targets(effect.target)) removeStatus(ctx, id, effect.status);
      return;
    case "addCounters": {
      const amount = value(effect.amount);
      const upTo = effect.upTo === undefined ? null : value(effect.upTo);
      let placed = 0;
      for (const id of targets(effect.target)) {
        // "(to a maximum of X)" is local to this effect (ruling, Mar 30, 2026 (1); docs/phase7-wave3.md §3.10).
        const held = getInstance(ctx.state, id)?.counters[effect.counterType] ?? 0;
        const count = upTo === null ? amount : Math.max(0, Math.min(amount, upTo - held));
        addCounters(ctx, id, effect.counterType, count);
        placed += Math.max(0, count);
      }
      if (effect.bind) addFrameVars(ctx, frame.frameId, { [`${effect.bind}.amount`]: placed });
      return;
    }
    case "defeat": {
      // docs/phase7-wave3.md §3.9: a defeat by effect, whatever the remaining hit points; `applyDefeat` honours
      // `byEffect`, and the rules that stop a defeat (cannotBeDefeated, permanent) still do.
      const inPlay = cardsInPlay(ctx.state);
      const defeatingPlayer = frame.controllerId;
      pushEvents(
        ctx,
        targets(effect.target)
          .filter((id) => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("character"))
          .map((id) => ({
            kind: "characterDefeated" as const,
            instanceId: id,
            byEffect: true as const,
            ...(defeatingPlayer ? { defeatedByPlayerId: defeatingPlayer } : {}),
            ...(frame.selfInstanceId ? { sourceInstanceId: frame.selfInstanceId } : {}),
          })),
      );
      return;
    }
    case "removeCounters": {
      const amount = value(effect.amount);
      // With an ability listening ("When/After the last invocation counter is removed", docs/phase7-wave4.md §3.15), each
      // removal is an event whose apply step removes them; otherwise they go at once, as before.
      const events: TriggerEvent[] = [];
      for (const id of targets(effect.target)) {
        const held = getInstance(ctx.state, id)?.counters[effect.counterType] ?? 0;
        const removing = Math.min(amount, held);
        if (removing <= 0) continue;
        const event: TriggerEvent = {
          kind: "countersRemoved",
          instanceId: id,
          counterType: effect.counterType,
          amount: removing,
          remaining: held - removing,
        };
        if (heard(ctx.state, ctx.deps, event)) events.push(event);
        else removeCounters(ctx, id, effect.counterType, amount);
      }
      if (events.length > 0) pushEvents(ctx, events);
      return;
    }
    case "attach": {
      const [host] = targets(effect.to);
      if (!host) return;
      for (const id of targets(effect.card)) {
        // "The Power Stone cannot be unattached from Ronan the Accuser" (docs/phase7-wave3.md §3.19).
        const current = getInstance(ctx.state, id)?.attachedTo ?? null;
        if (current !== null && current !== host && cannotBeUnattached(ctx.state, ctx.deps, id)) continue;
        // "Odin cannot have cards attached" (docs/phase7-wave4.md §3.8): the card stays where it was.
        if (!canHaveAttached(ctx.state, ctx.deps, host, id)) continue;
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
        // A character with ∞ hit points has no dial to set (RRG 1.8 "Hit Points", p. 22); card text sets it only after
        // flipping to a face that prints a number ("flip this card, then set Collector's hit point dial").
        if (max === undefined || !Number.isFinite(max)) continue;
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
    case "createScenarioArea":
      // docs/phase7-wave3.md §3.14: an empty area, so its count and the client read 0 rather than nothing.
      if (!ctx.state.scenarioAreas?.[effect.name])
        ctx.state = { ...ctx.state, scenarioAreas: { ...ctx.state.scenarioAreas, [effect.name]: [] } };
      return;
    case "discardFromPlay":
      for (const id of targets(effect.target)) {
        if (effect.defeated === true) defeatFromPlay(ctx, id);
        // "Players cannot discard attachments that are attached to friendly characters." (§3.44 of wave 4.)
        else if (frame.byPlayer && playersCannotDiscard(ctx.state, ctx.deps, id)) {
          emit(ctx, { type: "discardRefused", instanceId: id });
        } else discardFromPlay(ctx, id);
      }
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
    case "dealAsEncounterCard": {
      const [playerId] = resolvePlayers(ctx.state, effect.player, context);
      if (!playerId) return;
      const inPlay = new Set(cardsInPlay(ctx.state));
      for (const id of targets(effect.cards)) {
        if (inPlay.has(id)) continue;
        const type = cardOf(ctx.state, id)?.type;
        if (!type || !DEALABLE_TYPES.has(type)) continue;
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId });
      }
      return;
    }
    case "revealEncounterCard": {
      const frames: StackFrame[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const id = drawEncounterCard(ctx);
        if (!id) continue;
        // Out of the deck while it resolves, like `revealCard` below, so a When Revealed that shuffles it back into
        // the encounter deck is a move the reveal's finish can see (docs/phase7-wave4.md §3.45).
        updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
        moveCard(ctx, id, { kind: "dealtEncounter", playerId }, "top");
        frames.push(revealFrame(ctx, playerId, id));
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
        } else if (card?.otherFaceId !== undefined) {
          // docs/phase7-wave4.md §3.10. Its new face goes to "you" (the first player, for a side scheme's When Defeated).
          const playerId = context.controllerId ?? ctx.state.firstPlayerId;
          if (!flipToOtherFace(ctx, id, playerId)) continue;
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
    case "changeAdditionalForm": {
      // docs/phase7-wave4.md §3.1; RRG 1.8 "Form, Change Form" (p. 21).
      const events: TriggerEvent[] = [];
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        const player = getPlayer(ctx.state, playerId);
        if (!player || player.eliminated || cannotChangeForm(ctx.state, ctx.deps, playerId, effect.formType)) continue;
        const owned = cardsInPlay(ctx.state).filter(
          (id) => controllerOf(ctx.state, id) === playerId && printedFormTypes(ctx.state, id).includes(effect.formType),
        );
        const printedNames = (id: InstanceId): readonly string[] => {
          const card = cardOf(ctx.state, id);
          if (!card) return [];
          return "flipSide" in card && card.flipSide ? [card.name, card.flipSide.name] : [card.name];
        };
        const named = effect.to ? targets(effect.to).filter((id) => owned.includes(id)) : [];
        const target =
          named[0] ??
          (effect.toName !== undefined
            ? owned.find((id) => printedNames(id).includes(effect.toName as string))
            : owned.length === 1 && printedNames(owned[0] as InstanceId).length === 2
              ? owned[0]
              : undefined);
        if (target === undefined) continue;
        const card = cardOf(ctx.state, target);
        const instance = mustInstance(ctx.state, target);
        if (card && "flipSide" in card && card.flipSide && !instance.facedownAs) {
          // A double-sided form card (a mass form upgrade): the change is a flip, unless the named face already shows.
          if (effect.toName !== undefined && currentName(ctx.state, target) === effect.toName) continue;
          updateInstance(ctx, target, (i) => ({ ...i, flipped: !i.flipped }));
          emit(ctx, { type: "cardFlipped", instanceId: target, flipped: !instance.flipped });
          events.push({ kind: "cardFlipped", instanceId: target });
        } else {
          if (!instance.facedownAs) continue; // Already in that form: nothing changes and nothing triggers.
          // One form of a type at a time (§4 Q1): the one showing turns facedown as this one turns faceup.
          for (const other of owned) {
            if (other === target || mustInstance(ctx.state, other).facedownAs) continue;
            const otherCard = cardOf(ctx.state, other);
            if (otherCard && "flipSide" in otherCard && otherCard.flipSide) continue;
            turnFacedown(ctx, other);
          }
          updateInstance(ctx, target, (i) => ({ ...i, faceup: true, facedownAs: null }));
          emit(ctx, { type: "cardTurnedFaceup", instanceId: target });
        }
        const formName = currentName(ctx.state, target) ?? "";
        emit(ctx, { type: "additionalFormChanged", playerId, formType: effect.formType, formName, instanceId: target });
        events.push({
          kind: "formChanged",
          playerId,
          to: player.identity.form,
          change: "additional",
          formType: effect.formType,
          formName,
          formCardInstanceId: target,
        });
      }
      pushEvents(ctx, events);
      return;
    }
    case "turnFacedown": {
      const inPlay = cardsInPlay(ctx.state);
      for (const id of targets(effect.target)) {
        if (inPlay.includes(id) && !mustInstance(ctx.state, id).facedownAs) turnFacedown(ctx, id);
      }
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
    case "detach": {
      // "The first player detaches Odin from the main scheme and takes control of him" (Hall of Nastrond, `mts` 21141;
      // Find the Senator, `mut_gen` 32065a; docs/phase7-wave4.md §3.8). The card stays in play: it moves from its host to
      // its new controller's play area, which is not leaving or entering play.
      const [playerId] = resolvePlayers(ctx.state, effect.controller, context);
      if (!playerId) return;
      for (const id of targets(effect.card)) {
        const instance = getInstance(ctx.state, id);
        if (!instance || instance.attachedTo === null) continue;
        const from = instance.controllerId;
        moveCard(ctx, id, { kind: "playArea", playerId });
        updateInstance(ctx, id, (i) => ({ ...i, controllerId: playerId }));
        emit(ctx, { type: "cardDetached", instanceId: id, from: instance.attachedTo });
        if (from !== playerId)
          emit(ctx, { type: "controllerChanged", instanceId: id, from, to: playerId, reason: "effect" });
      }
      return;
    }
    case "swapVillain":
      for (const id of targets(effect.villain)) if (villainOf(ctx.state, id)) swapVillain(ctx, id);
      return;
    case "advanceToSetAsideVillain": {
      for (const id of targets(effect.villain)) {
        if (!villainOf(ctx.state, id)) continue;
        const frames = advanceToSetAsideVillain(ctx, id, frame.event);
        if (frames) pushFrames(ctx, frames);
      }
      return;
    }
    case "putMainSchemeStageIntoPlay":
      pushFrames(ctx, putMainSchemeStageIntoPlay(ctx, effect.stageNumber, effect.name, ctx.state.firstPlayerId));
      return;
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
        returnBindingsTo: frame.frameId,
        byPlayer: frame.byPlayer === true,
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
        if (effect.kind === "preventDamage" && effect.bind)
          addFrameVars(ctx, frame.frameId, { [`${effect.bind}.amount`]: prevented });
        announceDamagePrevented(ctx, {
          kind: "damagePrevented",
          targetInstanceId: target.event.targetInstanceId,
          amount: prevented,
          preventerInstanceId: frame.selfInstanceId,
          fromAttack: target.event.fromAttack,
          sourceInstanceId: target.event.sourceInstanceId,
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
      // "This effect cannot be canceled." (RRG 1.8 "'Cannot'", p. 11: "cannot" is absolute.) The cancel's costs stay paid.
      if (revealCannotBeCanceled(ctx.state, ctx.deps, reveal.instanceId)) return;
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
    case "grantTraitUntil":
    case "grantKeywordUntil": {
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
          : effect.kind === "grantKeywordUntil"
            ? { kind: "keywordGrant", keyword: effect.keyword, scope, ...reach }
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
    case "eachTimeUntil": {
      // docs/phase7-wave3.md §3.17: resolved by `eachTimeEffectsFor` at each matching event's response step.
      if (effect.until === "endOfTurn" && !turnInProgress(ctx.state)) return;
      addLastingEffect(
        ctx,
        {
          kind: "eachTime",
          on: effect.on,
          effects: effect.effects,
          scope: {
            selfInstanceId: frame.selfInstanceId,
            controllerId: frame.controllerId,
            vars: frame.vars,
            bindings: frame.bindings,
          },
        },
        { kind: effect.until },
      );
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
      const inPlayNow = cardsInPlay(ctx.state);
      // "Players cannot discard attachments that are attached to friendly characters." (§3.44 of wave 4.)
      const ids = selectCards(ctx, effect.cards, context).filter((id) => {
        const refused =
          effect.to === "discard" &&
          frame.byPlayer === true &&
          inPlayNow.includes(id) &&
          playersCannotDiscard(ctx.state, ctx.deps, id);
        if (refused) emit(ctx, { type: "discardRefused", instanceId: id });
        return !refused;
      });
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
      // Every printed "draw up to" reads "up to your hand size" (Split Personality, Grand Strategy, MC16's setup), so
      // it refills: a drawn obligation does not count toward it (`drawUpTo`).
      for (const playerId of resolvePlayers(ctx.state, effect.player, context)) {
        drawUpTo(ctx, playerId, () => value(effect.amount));
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
        for (let i = 0; i < limit; i++) {
          const id = takeTopOfDeck(ctx, playerId);
          if (!id) break;
          const resets = playerDeckResets(ctx, playerId);
          // The log already carries each move as `cardMoved`, the same record `discardEncounterUntil` leaves.
          moveCard(ctx, id, { kind: "discard", playerId }, "top");
          if (matchesQuery(ctx.state, id, effect.filter, context)) {
            found.push(id);
            break;
          }
          // This discard emptied the deck, which was reset at once (`settlePlayerDecks`): stop.
          if (playerDeckResets(ctx, playerId) > resets) break;
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
    case "setVar":
      // docs/phase7-wave4.md §3.46: a snapshot for a later comparison in the same ability.
      addFrameVars(ctx, frame.frameId, { [effect.name]: value(effect.value) });
      return;
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
    case "recordInCampaignLog": {
      // Nothing outside a campaign: the same campaign card, dropped into a standalone game, simply has no log to
      // write to (its deck legality is `validateDeck`'s job, design §8, not this effect's).
      if (!ctx.state.campaign) return;
      const logValue = campaignLogValueOf(ctx, effect.value, context);
      if (!logValue) return;
      // One value, written into each addressed column. A *different* value per seat is `forEachPlayer` around this
      // effect, which is how every other per-player effect in the DSL says it.
      const seatNumbers = effect.seat
        ? resolvePlayers(ctx.state, effect.seat, context).map((id) => campaignSeatNumber(ctx.state, id))
        : [null];
      for (const seatNumber of seatNumbers) {
        if (effect.seat && seatNumber === null) continue;
        recordCampaignWrite(ctx, { field: effect.field, seatNumber, mode: effect.mode, value: logValue });
      }
      return;
    }
    case "removeFromCampaign": {
      if (!ctx.state.campaign) return;
      for (const id of selectCards(ctx, effect.cards, context)) recordCampaignRemoval(ctx, id);
      return;
    }
  }
}

/**
 * A card in play turns facedown as nothing in particular (`FacedownRole` `blank`), keeping its controller: no title,
 * text, keywords or abilities until it turns faceup or leaves play (docs/phase7-wave4.md §3.1).
 */
function turnFacedown(ctx: Ctx, id: InstanceId): void {
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false, facedownAs: { kind: "blank", traits: [] } }));
  emit(ctx, { type: "cardTurnedFacedown", instanceId: id });
}
