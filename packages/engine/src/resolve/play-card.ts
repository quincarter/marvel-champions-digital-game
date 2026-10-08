/** Playing a player card: entering play, resolving an event's abilities, discarding it. */

import type { AbilityId } from "@mc/content";
import { type Ctx, emit, moveCard, popFrame, pushFrames, setFrame, updateInstance } from "../ctx.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { discardZoneFor, locateCard, mustCardOf, mustInstance, mustPlayer, scenarioPlayAreaOf } from "../query.js";
import { controllerOf, printedAbilityRefs } from "../select.js";
import { paymentVarsIn, type Bindings, type StackFrame, type UndeclaredWilds, type Vars } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import {
  endUntilCardPlayedEffects,
  expireCardResolutionEffects,
  expirePaidForEffects,
  placeExhausted,
} from "../effects.js";
import { recordAbilityUse } from "./ability.js";
import { settleUpgradeControl } from "./attach.js";
import { checkDefeats } from "./defeat.js";
import { declareWildTypes } from "./declare-wilds.js";
import { enterPlay, playerSideSchemeEntersPlay } from "./enter-play.js";
import { placeInScenarioPlayArea } from "./game-areas.js";
import { abilityFrame, announce, base, pushEffects, type Frame, pushEvent } from "./frames.js";
import { heard } from "./triggers.js";

export function pushPlayCardFrame(
  ctx: Ctx,
  id: InstanceId,
  playerId: PlayerId,
  attachToInstanceId: InstanceId | null,
  triggered?: {
    readonly triggeredAbilityId: AbilityId;
    readonly event: TriggerEvent | null;
    readonly eventFrameId: FrameId | null;
  },
  cost?: {
    readonly bindings: Bindings;
    readonly vars: Vars;
    /** The payment's wilds are the player's to declare before the card does anything (docs/phase7-wave8.md §3.62). */
    readonly undeclaredWilds?: UndeclaredWilds;
  },
  controllerId: PlayerId = playerId,
  /** `playCard.into`: the in-play scenario area the card is played into (docs/phase7-wave8.md §3.34). */
  intoScenarioPlayArea?: string,
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "playCard",
      instanceId: id,
      playerId,
      controllerId,
      ...(intoScenarioPlayArea !== undefined ? { intoScenarioPlayArea } : {}),
      attachToInstanceId,
      stage: "enterPlay",
      triggeredAbilityId: triggered?.triggeredAbilityId ?? null,
      event: triggered?.event ?? null,
      eventFrameId: triggered?.eventFrameId ?? null,
      effectsCancelled: false,
      bindings: cost?.bindings ?? {},
      vars: cost?.vars ?? {},
      ...(cost?.undeclaredWilds ? { undeclaredWilds: cost.undeclaredWilds } : {}),
    },
  ]);
}

/**
 * "It enters play exhausted" (Med Lab 38028; docs/phase7-wave6.md §3.57): placed exhausted as it enters play, before
 * its "enters play" windows, so an "after this enters play" ability already sees it exhausted. Logged as a
 * `cardExhausted`, but announced as nothing: the card was not exhausted by an effect or a cost.
 */
function entersExhausted(ctx: Ctx, frame: Frame<"playCard">): void {
  if (frame.entersExhausted === true) placeExhausted(ctx, frame.instanceId);
}

export function executePlayCardFrame(ctx: Ctx, frame: Frame<"playCard">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  if (frame.undeclaredWilds) return declareWildTypes(ctx, frame, frame.playerId, frame.undeclaredWilds);
  switch (frame.stage) {
    case "enterPlay": {
      setFrame(ctx, { ...frame, stage: "effects" });
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, controllerId: frame.controllerId, faceup: true }));
      switch (card.type) {
        case "ally":
        case "support":
          // Played into an in-play scenario area (the mission area, MC45 p. 5; docs/phase7-wave8.md §3.34): in play
          // under no player's control. Still this player's play, so its entering play is announced for them.
          if (
            frame.intoScenarioPlayArea === undefined ||
            placeInScenarioPlayArea(ctx, frame.instanceId, frame.intoScenarioPlayArea) !== "entered"
          )
            moveCard(ctx, frame.instanceId, { kind: "playArea", playerId: frame.controllerId });
          entersExhausted(ctx, frame);
          enterPlay(ctx, frame.instanceId, frame.controllerId);
          break;
        case "upgrade": {
          const host = frame.attachToInstanceId ?? mustPlayer(ctx.state, frame.controllerId).identity.instanceId;
          moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
          // RRG 1.8 p. 31: on a card another player controls, that player controls it from the moment it is attached,
          // so the enter-play checks (restricted) count it for them.
          settleUpgradeControl(ctx, frame.instanceId, frame.controllerId);
          // On a card in an in-play scenario area it is in the area with its host, "under no player's control" (MC45
          // p. 5; docs/phase7-wave8.md §3.34). Its owner is unchanged, so it leaves play to their discard pile.
          if (scenarioPlayAreaOf(ctx.state, host) !== null)
            updateInstance(ctx, frame.instanceId, (i) => ({ ...i, controllerId: null }));
          entersExhausted(ctx, frame);
          enterPlay(ctx, frame.instanceId, controllerOf(ctx.state, frame.instanceId) ?? frame.controllerId);
          break;
        }
        case "player_side_scheme":
          playerSideSchemeEntersPlay(ctx, frame.instanceId, frame.controllerId, frame.playerId);
          break;
        default:
          break;
      }
      return;
    }
    case "effects": {
      // "When you play an [Attack] event" (Embiggen!, Shrink): an interrupt window before the card's own abilities
      // resolve, so a modifier can apply to every instance of damage the event deals (RRG 1.8 "Event", p. 19). It
      // is also where a cancel lands ("When you play an event, cancel its effects and discard it", Counterspell),
      // so the card's own ability frames are pushed in the *next* stage, after this window has resolved — pushing
      // them first would queue them past anything the interrupt could do (RRG 1.8 "Cancel", p. 13: "Only the
      // effects are prevented from initiating, and do not resolve").
      setFrame(ctx, { ...frame, stage: card.type === "event" ? "abilities" : "discardEvent" });
      const beingPlayed: TriggerEvent = {
        kind: "cardBeingPlayed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
      };
      if (heard(ctx.state, ctx.deps, beingPlayed)) pushEvent(ctx, beingPlayed);
      return;
    }
    case "abilities": {
      setFrame(ctx, { ...frame, stage: "discardEvent" });
      // RRG 1.8 "Cancel" (p. 13): "If the effects of an event card are canceled, the card is still considered
      // played, and it is discarded." So only the ability frames are skipped — `discardEvent` still runs and still
      // announces `cardPlayed`, and the cost paid in `commitPlay` stands.
      if (frame.effectsCancelled) {
        // RRG 1.8 "Max, Maximum" (p. 28): "If a card with a maximum is canceled, the card is still counted toward the
        // maximum"; "Limit" (p. 27): a canceled effect "counts toward the limit". The ability frame that would have
        // counted it is skipped, so it is counted here.
        const cancelled = frame.triggeredAbilityId ? ctx.deps.abilities[frame.triggeredAbilityId] : undefined;
        if (frame.triggeredAbilityId && cancelled) {
          recordAbilityUse(ctx, frame.instanceId, frame.triggeredAbilityId, cancelled, frame.event, frame.playerId);
        }
        return;
      }
      // RRG "Event": an event's effects resolve while it is out of play, then it is discarded.
      // RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it chooses
      // one of those abilities to trigger". Exactly one resolves: the Action ability the play triggered, or the
      // interrupt or response that matched the timing window, which keeps the triggering event's context so a "cancel"
      // effect knows what it is cancelling. A frame that names none (a state saved before plays recorded their Action
      // ability) resolves the first printed Action ability.
      const refs = printedAbilityRefs(card);
      const only =
        frame.triggeredAbilityId ?? refs.find((ref) => ctx.deps.abilities[ref.id]?.trigger.kind === "action")?.id;
      const frames: StackFrame[] = [];
      for (const ref of refs) {
        if (ref.id !== only || !ctx.deps.abilities[ref.id]) continue;
        frames.push(
          abilityFrame(
            ctx,
            {
              instanceId: frame.instanceId,
              abilityId: ref.id,
              controllerId: frame.playerId,
              forced: true,
              fromHand: false,
            },
            frame.event,
            frame.eventFrameId,
            frame.bindings,
            frame.vars,
          ),
        );
      }
      pushFrames(ctx, frames);
      return;
    }
    case "discardEvent": {
      setFrame(ctx, { ...frame, stage: "done" });
      // An event its own ability moved on ("If this is the first card you have played this round, return this card to
      // your hand", Clobber / Impede, `gam`) is no longer being resolved, so it is not discarded (docs/phase7-wave3.md
      // §3.11). RRG 1.8 "Event" (p. 19): an event is placed in the discard pile once its effects resolve; "Ownership
      // and Control" (p. 31): "That card is an event that was played, it is placed in its owner's discard pile", not
      // the player's who played it (Rogue's Superpower Adaptation plays an event another player owns).
      const location = locateCard(ctx.state, frame.instanceId);
      if (card.type === "event" && location?.kind === "resolving") {
        // "Return that event to your hand after resolving its effects" (`EffectSpec afterResolving`,
        // docs/phase7-wave7.md §3.68): the card goes to its owner's hand instead, so it never reaches the discard pile.
        // Canceled effects never resolved, and RRG 1.8 "Cancel" (p. 11) has that event discarded.
        const ownerId = mustInstance(ctx.state, frame.instanceId).ownerId;
        if (frame.afterResolving === "hand" && !frame.effectsCancelled && ownerId) {
          emit(ctx, { type: "playedEventReturned", instanceId: frame.instanceId, playerId: ownerId });
          moveCard(ctx, frame.instanceId, { kind: "hand", playerId: ownerId });
        } else {
          moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
        }
        // In its owner's out-of-play area it is its owner's to control again (RRG 1.8 "Ownership and Control", p. 31:
        // "A player controls the cards in their own out-of-play areas"), whoever played it.
        if (ownerId && mustInstance(ctx.state, frame.instanceId).controllerId !== ownerId) {
          updateInstance(ctx, frame.instanceId, (i) => ({ ...i, controllerId: ownerId }));
        }
      }
      // The payment goes with the announcement, so "after you play" reads what paid for "that event" from the event it
      // answers (`TriggerEvent cardPlayed.payment`, docs/phase7-wave8.md §3.62).
      const payment = paymentVarsIn(frame.vars);
      announce(ctx, {
        kind: "cardPlayed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
        ...(Object.keys(payment).length > 0 ? { payment } : {}),
      });
      return;
    }
    case "done": {
      // "That event" bonuses (Embiggen!, Shrink) last exactly as long as this card's play.
      expireCardResolutionEffects(ctx, frame.instanceId);
      expirePaidForEffects(ctx, frame.frameId);
      // "…after you play an event": a lasting effect whose timing point is this player's next matching play reaches
      // it now, once the card has finished resolving (and after its own `cardPlayed` responses, announced above).
      const delayed = endUntilCardPlayedEffects(ctx, ctx.deps, frame.playerId, frame.instanceId);
      popFrame(ctx);
      for (const effect of [...delayed].reverse()) pushEffects(ctx, { effects: effect.effects, ...effect.scope });
      // RRG 1.8 "Damage" (p. 14): "If a character has zero or fewer remaining hit points, it is defeated." An ally printed
      // with 0 hit points (Ant-Man 12011, Wasp 13012) gets them from counters its "When [this ally] enters play" places,
      // so the check waits until its play and those windows have resolved (docs/phase7-wave2.md §3.9, §4.9 proposed).
      if (card.type === "ally") checkDefeats(ctx);
      return;
    }
  }
}
