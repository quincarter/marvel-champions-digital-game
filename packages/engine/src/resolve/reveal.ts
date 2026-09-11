/** Revealing encounter cards and placing them (attachment hosts included). */

import type { AttachmentHost } from "@mc/content";
import { type Ctx, emit, moveCard, popFrame, pushFrames, requestChoice, setFrame, updateInstance } from "../ctx.js";
import { dealEncounterCardTo } from "../effects.js";
import { type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import { cardOf, getInstance, mustCardOf, mustInstance, scale } from "../query.js";
import { type EffectContext, selectTargets } from "../select.js";
import type { TargetQuery } from "../spec.js";
import type { StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { enterPlay, quickstrikeAttack } from "./enter-play.js";
import { base, eventFrame, type Frame, gameAbilityFrames, pushEvent } from "./frames.js";

export const revealFrame = (ctx: Ctx, playerId: PlayerId, id: InstanceId): StackFrame => ({
  ...base(ctx),
  kind: "reveal",
  instanceId: id,
  playerId,
  whenRevealedCancelled: false,
  effectsCancelled: false,
  surgeGained: false,
  stage: "faceup",
});

export function pushRevealFrame(ctx: Ctx, playerId: PlayerId, id: InstanceId): void {
  pushFrames(ctx, [revealFrame(ctx, playerId, id)]);
}

const HOST_QUERIES: Partial<Record<AttachmentHost["kind"], TargetQuery>> = {
  sideScheme: { categories: ["sideScheme"] },
  hero: { categories: ["hero"] },
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  anyCharacter: { categories: ["character"] },
};

const printedHpOf = (state: GameState, id: InstanceId): number => {
  const card = cardOf(state, id);
  return card && "hp" in card && typeof card.hp === "number" ? card.hp : 0;
};

/**
 * Every legal host for an attachment right now, in stable order. For
 * `minionWithHighestPrintedHp` this is the set of minions tied for highest
 * printed HP (the revealing player breaks ties).
 */
export function attachmentHostCandidates(
  state: GameState,
  host: AttachmentHost,
  context: EffectContext,
): readonly InstanceId[] {
  switch (host.kind) {
    case "villain":
      return [state.villain.instanceId];
    case "mainScheme":
      return [state.mainScheme.instanceId];
    case "namedCard":
      return selectTargets(state, { name: host.name }, context);
    case "minionWithHighestPrintedHp": {
      const minions = selectTargets(state, { categories: ["minion"] }, context).filter(
        (id) =>
          host.withoutAttachmentNamed === undefined ||
          !mustInstance(state, id).attachments.some((a) => cardOf(state, a)?.name === host.withoutAttachmentNamed),
      );
      const highest = Math.max(...minions.map((id) => printedHpOf(state, id)));
      return minions.filter((id) => printedHpOf(state, id) === highest);
    }
    default: {
      const query = HOST_QUERIES[host.kind];
      return query ? selectTargets(state, query, context) : [];
    }
  }
}

export function executeRevealFrame(ctx: Ctx, frame: Frame<"reveal">): void {
  const card = mustCardOf(ctx.state, frame.instanceId);
  switch (frame.stage) {
    case "faceup": {
      updateInstance(ctx, frame.instanceId, (i) => ({ ...i, faceup: true }));
      emit(ctx, {
        type: "encounterCardRevealed",
        instanceId: frame.instanceId,
        cardId: card.id,
        playerId: frame.playerId,
      });
      setFrame(ctx, { ...frame, stage: "enterPlay" });
      // The card is faceup and about to resolve: cancel effects interrupt here
      // (FFG ruling: Black Widow triggers after the flip, before its effects).
      pushEvent(ctx, { kind: "encounterCardRevealing", instanceId: frame.instanceId, playerId: frame.playerId });
      return;
    }
    case "enterPlay": {
      if (card.type === "obligation" && !frame.effectsCancelled) {
        // RRG "Obligation": give it to the player whose identity it belongs to; that player reveals it.
        const linked = Object.values(ctx.state.cardPool).some((c) => c.type === "hero_identity" && c.obligationCardId === card.id);
        const owner = ctx.state.players.find((p) => {
          const identity = cardOf(ctx.state, p.identity.instanceId);
          return identity?.type === "hero_identity" && identity.obligationCardId === card.id;
        });
        if (linked && (!owner || owner.eliminated)) {
          // Can't be given: ignore its ability, remove it from the game, reveal another card.
          moveCard(ctx, frame.instanceId, { kind: "removedFromGame" });
          setFrame(ctx, { ...frame, stage: "done" });
          const next = dealEncounterCardTo(ctx, frame.playerId);
          if (next) pushFrames(ctx, [revealFrame(ctx, frame.playerId, next)]);
          return;
        }
        const revealer = owner && linked ? owner.playerId : frame.playerId;
        setFrame(ctx, { ...frame, playerId: revealer, answer: null, stage: "whenRevealed" });
        enterPlayOnReveal(ctx, frame.instanceId, revealer);
        return;
      }
      if (frame.effectsCancelled) {
        // RRG "Cancel": a canceled card is still revealed; it is discarded and nothing else happens.
        if (getInstance(ctx.state, frame.instanceId)) moveCard(ctx, frame.instanceId, { kind: "encounterDiscard" }, "top");
        setFrame(ctx, { ...frame, stage: "finish" });
        return;
      }
      if (card.type === "attachment" && card.attachesTo.kind !== "villain") {
        const resolved = resolveAttachmentTarget(ctx, frame, card.attachesTo);
        if (!resolved) return;
      } else {
        enterPlayOnReveal(ctx, frame.instanceId, frame.playerId);
      }
      setFrame(ctx, { ...frame, answer: null, stage: "whenRevealed" });
      return;
    }
    case "whenRevealed": {
      setFrame(ctx, { ...frame, stage: "finish" });
      // Incite and surge are "When Revealed" effects too (RRG "Incite X", "Surge").
      if (frame.whenRevealedCancelled) return;
      const revealed: TriggerEvent = {
        kind: "cardRevealed",
        instanceId: frame.instanceId,
        playerId: frame.playerId,
      };
      const frames: StackFrame[] = [];
      // RRG "Incite X" is itself a "When Revealed: place X threat on the main scheme".
      const incite = keywordTotal(ctx.state, frame.instanceId, "incite", ctx.deps);
      if (incite > 0) {
        frames.push(
          eventFrame(ctx, {
            kind: "placeThreat",
            schemeInstanceId: ctx.state.mainScheme.instanceId,
            amount: incite,
            sourceInstanceId: frame.instanceId,
          }),
        );
      }
      frames.push(...gameAbilityFrames(ctx, frame.instanceId, ["whenRevealed"], revealed, undefined, frame.playerId));
      pushFrames(ctx, frames);
      return;
    }
    case "finish": {
      setFrame(ctx, { ...frame, stage: "done" });
      if (card.type === "treachery" && getInstance(ctx.state, frame.instanceId)) {
        moveCard(ctx, frame.instanceId, { kind: "encounterDiscard" }, "top");
      }
      // RRG "Reveal": responses to any step wait until every step has completed.
      const events: TriggerEvent[] = [
        { kind: "cardRevealed", instanceId: frame.instanceId, playerId: frame.playerId },
      ];
      // RRG "Quickstrike": resolves after this minion's "When Revealed" abilities.
      const quickstrike = frame.effectsCancelled ? null : quickstrikeAttack(ctx.state, frame.instanceId);
      if (quickstrike) events.push(quickstrike);
      const frames: StackFrame[] = events.map((event) => eventFrame(ctx, event));
      // RRG "Surge": the original card is fully resolved first, then the same
      // player reveals one more — so the extra reveal is queued last.
      const surgeLive = !frame.effectsCancelled && !frame.whenRevealedCancelled;
      if (surgeLive && (frame.surgeGained || hasKeyword(ctx.state, frame.instanceId, "surge", ctx.deps))) {
        const next = dealEncounterCardTo(ctx, frame.playerId);
        if (next) {
          emit(ctx, { type: "surgeTriggered", instanceId: frame.instanceId, playerId: frame.playerId });
          frames.push(revealFrame(ctx, frame.playerId, next));
        }
      }
      pushFrames(ctx, frames);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

export function enterPlayOnReveal(ctx: Ctx, id: InstanceId, playerId: PlayerId): void {
  const card = mustCardOf(ctx.state, id);
  let entered = false;
  switch (card.type) {
    case "minion":
      moveCard(ctx, id, { kind: "playArea", playerId });
      updateInstance(ctx, id, (i) => ({ ...i, engagedWith: playerId, controllerId: null }));
      entered = true;
      break;
    case "side_scheme":
      moveCard(ctx, id, { kind: "villainArea" });
      entered = true;
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId: id,
        amount: scale(card.startingThreat, ctx.state.startingPlayerCount),
        sourceInstanceId: null,
      });
      break;
    case "environment":
      moveCard(ctx, id, { kind: "villainArea" });
      entered = true;
      break;
    case "attachment": {
      // Setup-keyword attachments enter play without a reveal frame, so there is
      // no choice point: the first legal host in stable order is used.
      const context: EffectContext = { selfInstanceId: id, controllerId: playerId, event: null, bindings: {}, deps: ctx.deps };
      const [host] = attachmentHostCandidates(ctx.state, card.attachesTo, context);
      if (!host) {
        moveCard(ctx, id, { kind: "encounterDiscard" }, "top");
        break;
      }
      moveCard(ctx, id, { kind: "attachment", hostInstanceId: host });
      entered = true;
      break;
    }
    case "obligation":
      moveCard(ctx, id, { kind: "playArea", playerId });
      entered = true;
      break;
    default:
      break;
  }
  if (entered) enterPlay(ctx, id, playerId);
}

/** Returns false while a target choice is pending. */
function resolveAttachmentTarget(ctx: Ctx, frame: Frame<"reveal">, attachesTo: AttachmentHost): boolean {
  const context: EffectContext = {
    selfInstanceId: frame.instanceId,
    controllerId: frame.playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  const legal = attachmentHostCandidates(ctx.state, attachesTo, context);
  if (legal.length === 0) {
    // RRG "Attach To": a card that cannot legally attach and cannot stay where it was is discarded.
    moveCard(ctx, frame.instanceId, { kind: "encounterDiscard" }, "top");
    return true;
  }
  if (frame.answer) {
    const [picked] = frame.answer;
    const host = picked ? asInstanceId(picked) : legal[0];
    if (!host) return true;
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  if (legal.length === 1) {
    const host = legal[0] as InstanceId;
    moveCard(ctx, frame.instanceId, { kind: "attachment", hostInstanceId: host });
    enterPlay(ctx, frame.instanceId, frame.playerId);
    return true;
  }
  requestChoice(ctx, {
    playerId: frame.playerId,
    prompt: { kind: "chooseAttachmentTarget", instanceId: frame.instanceId },
    options: legal.map((id) => ({
      optionId: id,
      label: mustCardOf(ctx.state, id).name,
      ref: { kind: "card", instanceId: id } as const,
    })),
    minSelections: 1,
    maxSelections: 1,
    frameId: frame.frameId,
  });
  return false;
}
