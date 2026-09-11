/** Playing a player card: entering play, resolving an event's abilities, discarding it. */

import type { AbilityId } from "@mc/content";
import { type Ctx, moveCard, popFrame, pushFrames, setFrame, updateInstance } from "../ctx.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { getInstance, mustCardOf, mustPlayer, scale } from "../query.js";
import { printedAbilityRefs } from "../select.js";
import type { Bindings, StackFrame, Vars } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { enterPlay } from "./enter-play.js";
import { abilityFrame, announce, base, type Frame, pushEvent } from "./frames.js";

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
      setFrame(ctx, { ...frame, stage: "discardEvent" });
      // RRG "Event": an event's effects resolve while it is out of play, then it is discarded.
      if (card.type !== "event") return;
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
      if (card.type === "event" && getInstance(ctx.state, frame.instanceId)) {
        moveCard(ctx, frame.instanceId, { kind: "discard", playerId: frame.playerId }, "top");
      }
      announce(ctx, { kind: "cardPlayed", instanceId: frame.instanceId, playerId: frame.playerId });
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}
