/** Playing a player card: entering play, resolving an event's abilities, discarding it. */

import type { AbilityId } from "@mc/content";
import { type Ctx, moveCard, popFrame, pushFrames, setFrame, updateInstance } from "../ctx.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { locateCard, mustCardOf, mustPlayer, scale } from "../query.js";
import { printedAbilityRefs } from "../select.js";
import type { Bindings, StackFrame, Vars } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { endUntilCardPlayedEffects, expireCardResolutionEffects } from "../effects.js";
import { checkDefeats } from "./defeat.js";
import { enterPlay } from "./enter-play.js";
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
  cost?: { readonly bindings: Bindings; readonly vars: Vars },
  controllerId: PlayerId = playerId,
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "playCard",
      instanceId: id,
      playerId,
      controllerId,
      attachToInstanceId,
      stage: "enterPlay",
      triggeredAbilityId: triggered?.triggeredAbilityId ?? null,
      event: triggered?.event ?? null,
      eventFrameId: triggered?.eventFrameId ?? null,
      effectsCancelled: false,
      bindings: cost?.bindings ?? {},
      vars: cost?.vars ?? {},
    },
  ]);
}

export function executePlayCardFrame(ctx: Ctx, frame: Frame<"playCard">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  switch (frame.stage) {
    case "enterPlay": {
      setFrame(ctx, { ...frame, stage: "effects" });
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, controllerId: frame.controllerId, faceup: true }));
      switch (card.type) {
        case "ally":
        case "support":
          moveCard(ctx, frame.instanceId, { kind: "playArea", playerId: frame.controllerId });
          enterPlay(ctx, frame.instanceId, frame.controllerId);
          break;
        case "upgrade": {
          const host = frame.attachToInstanceId ?? mustPlayer(ctx.state, frame.controllerId).identity.instanceId;
          moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
          enterPlay(ctx, frame.instanceId, frame.controllerId);
          break;
        }
        case "player_side_scheme":
          moveCard(ctx, frame.instanceId, { kind: "villainArea" });
          enterPlay(ctx, frame.instanceId, frame.playerId);
          pushEvent(ctx, {
            kind: "placeThreat",
            schemeInstanceId: frame.instanceId,
            amount: scale(card.startingThreat, ctx.state.startingPlayerCount),
            sourceInstanceId: null,
          });
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
      if (frame.effectsCancelled) return;
      // RRG "Event": an event's effects resolve while it is out of play, then it is discarded.
      const frames: StackFrame[] = [];
      for (const ref of printedAbilityRefs(card)) {
        const definition = ctx.deps.abilities[ref.id];
        if (!definition) continue;
        // An event played inside a timing window resolves only the ability that
        // matched that window, and it keeps the triggering event's context so a
        // "cancel" effect knows what it is cancelling.
        const wanted = frame.triggeredAbilityId
          ? ref.id === frame.triggeredAbilityId
          : definition.trigger.kind === "action";
        if (!wanted) continue;
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
      // §3.11). RRG 1.8 "Event" (p. 19): an event is placed in the discard pile once its effects resolve.
      const location = locateCard(ctx.state, frame.instanceId);
      if (card.type === "event" && location?.kind === "resolving") {
        moveCard(ctx, frame.instanceId, { kind: "discard", playerId: frame.playerId }, "top");
      }
      announce(ctx, { kind: "cardPlayed", instanceId: frame.instanceId, playerId: frame.playerId });
      return;
    }
    case "done": {
      // "That event" bonuses (Embiggen!, Shrink) last exactly as long as this card's play.
      expireCardResolutionEffects(ctx, frame.instanceId);
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
