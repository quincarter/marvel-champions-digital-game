/** Revealing encounter cards and placing them (attachment hosts included). */

import type { AttachmentHost } from "@mc/content";
import { type Ctx, emit, moveCard, popFrame, pushFrames, requestChoice, setFrame, updateInstance } from "../ctx.js";
import { dealEncounterCardTo } from "../effects.js";
import { type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { hasKeyword, keywordTotal } from "../keywords.js";
import {
  activeVillain,
  cardOf,
  characterProfile,
  currentName,
  discardZoneFor,
  getInstance,
  getPlayer,
  mustCardOf,
  mustInstance,
  printedProfile,
  remainingHitPoints,
  startingThreatOf,
  undefeatedVillains,
} from "../query.js";
import { cardsInPlay, controllerOf, type EffectContext, selectTargets, traitsOf } from "../select.js";
import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import type { TargetQuery } from "../spec.js";
import type { StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { whenRevealedRepeats } from "../rules.js";
import { encounterTargetSelector } from "../villain/authority.js";
import { engagedEvent } from "./apply-effect.js";
import { enterPlay, quickstrikeAttack } from "./enter-play.js";
import { heard } from "./triggers.js";
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
  scheme: { categories: ["scheme"] },
  hero: { categories: ["hero"] },
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  anyCharacter: { categories: ["character"] },
};

type QualifiedHost = Extract<AttachmentHost, { kind: "qualified" }>;
type SuperlativeHost = Extract<AttachmentHost, { kind: "superlative" }>;

/** The pool a `qualified` or `superlative` host ranks among; `friendlyCharacter` is narrowed by `isFriendly`. */
const POOL_QUERIES: Record<QualifiedHost["category"] | SuperlativeHost["among"], TargetQuery> = {
  ally: { categories: ["ally"] },
  minion: { categories: ["minion"] },
  enemy: { categories: ["enemy"] },
  villain: { categories: ["villain"] },
  character: { categories: ["character"] },
  friendlyCharacter: { categories: ["character"] },
  sideScheme: { categories: ["sideScheme"] },
};

/** RRG 1.8 "Friendly" (p. 21): "cards the players control". */
const isFriendly = (state: GameState, id: InstanceId): boolean => controllerOf(state, id) !== null;

const printedHpOf = (state: GameState, id: InstanceId): number => printedProfile(state, id)?.maxHp ?? 0;

/** What a `superlative` host ranks by (RRG 1.8 "Printed", p. 35, for the printed values). */
function hostMeasure(state: GameState, id: InstanceId, measure: SuperlativeHost["measure"], deps: EngineDeps): number {
  switch (measure) {
    case "printedHp":
      return printedHpOf(state, id);
    case "remainingHp":
      return remainingHitPoints(state, id, deps) ?? 0;
    case "printedAtk":
      return printedProfile(state, id)?.atk ?? 0;
    case "atk":
      return characterProfile(state, id, deps)?.atk ?? 0;
    case "sch":
      return characterProfile(state, id, deps)?.sch ?? 0;
  }
}

/** "an X-MEN ally", "a non-ELITE minion", "without another Goblin Glider attached" (`HostQualifiers`). */
function passesQualifiers(state: GameState, id: InstanceId, host: QualifiedHost | SuperlativeHost, deps: EngineDeps): boolean {
  if (host.trait && !traitsOf(state, id, deps).includes(host.trait)) return false;
  if (host.withoutTrait && traitsOf(state, id, deps).includes(host.withoutTrait)) return false;
  const barred = host.withoutAttachmentNamed;
  if (barred !== undefined && mustInstance(state, id).attachments.some((a) => currentName(state, a) === barred)) return false;
  return true;
}

/**
 * Every legal host for an attachment right now, in stable order (docs/phase7-wave1.md §1.6, §3.14).
 *
 * RRG 1.8 "Attach To" (p. 8): "The 'attach to' phrase is checked for legality when the card would be attached", so
 * this is evaluated at that moment and never cached. An empty result means the card cannot attach and is discarded
 * by the caller — with no replacement card revealed (FAQ "Counterspell (#30)", p. 60: "Because it is unable to meet
 * its condition, simply discard it. (Do not reveal a new encounter card in its place.)").
 *
 * Several candidates are a choice for the first player on an encounter card (RRG 1.8 "First Player", p. 19); the
 * superlative kinds return every tied card for that reason.
 */
export function attachmentHostCandidates(
  state: GameState,
  host: AttachmentHost,
  context: EffectContext,
): readonly InstanceId[] {
  const deps = context.deps ?? DEFAULT_DEPS;
  switch (host.kind) {
    case "villain": {
      // "Attach to the villain": the active villain (The Wrecking Crew insert, "The Active Villain").
      const active = activeVillain(state);
      return active.defeated ? [] : [active.instanceId];
    }
    case "namedVillain":
      // "Attach to Wrecker": by the title showing, so a flipped villain is found under its current face's name.
      return undefeatedVillains(state)
        .filter((villain) => currentName(state, villain.instanceId) === host.name)
        .map((villain) => villain.instanceId);
    case "mainScheme":
      return [state.mainScheme.instanceId];
    case "villainSideScheme": {
      // "Attach to the active villain's side scheme" (Held Hostage), or a named villain's.
      const of = host.of;
      const villains =
        of === "activeVillain"
          ? undefeatedVillains(state).filter((villain) => villain.instanceId === state.activeVillainId)
          : undefeatedVillains(state).filter((villain) => currentName(state, villain.instanceId) === of.villainName);
      const inPlay = cardsInPlay(state);
      return villains.flatMap((villain) =>
        villain.signatureSideSchemeId && inPlay.includes(villain.signatureSideSchemeId) ? [villain.signatureSideSchemeId] : [],
      );
    }
    case "yourIdentity": {
      // RRG 1.8 "You, Your": on an encounter card, the player resolving it. An identity not in the named form is no
      // legal host, so the card is discarded (FAQ "Counterspell (#30)", p. 60).
      const playerId = context.controllerId;
      const player = playerId ? getPlayer(state, playerId) : undefined;
      if (!player || player.eliminated) return [];
      if (host.form !== undefined && player.identity.form !== host.form) return [];
      return [player.identity.instanceId];
    }
    case "friendlyCharacter":
      return selectTargets(state, { categories: ["character"] }, context).filter((id) => isFriendly(state, id));
    case "namedCard":
      return selectTargets(state, { name: host.name }, context);
    case "qualified": {
      const pool = selectTargets(state, POOL_QUERIES[host.category], context).filter(
        (id) => host.category !== "friendlyCharacter" || isFriendly(state, id),
      );
      return pool.filter((id) => passesQualifiers(state, id, host, deps));
    }
    case "minionWithHighestPrintedHp": {
      const minions = selectTargets(state, { categories: ["minion"] }, context).filter(
        (id) =>
          host.withoutAttachmentNamed === undefined ||
          !mustInstance(state, id).attachments.some((a) => currentName(state, a) === host.withoutAttachmentNamed),
      );
      const highest = Math.max(...minions.map((id) => printedHpOf(state, id)));
      return minions.filter((id) => printedHpOf(state, id) === highest);
    }
    case "superlative": {
      // "The enemy with the highest printed hit points and without another Goblin Glider attached."
      const pool = selectTargets(state, POOL_QUERIES[host.among], context)
        .filter((id) => host.among !== "friendlyCharacter" || isFriendly(state, id))
        .filter((id) => passesQualifiers(state, id, host, deps));
      if (pool.length === 0) return [];
      const values = pool.map((id) => hostMeasure(state, id, host.measure, deps));
      const best = host.order === "highest" ? Math.max(...values) : Math.min(...values);
      return pool.filter((_, index) => values[index] === best);
    }
    case "ifAble": {
      // "Attach to Yellowjacket, if able. If you cannot, attach to the villain." (docs/phase7-wave2.md §1.7). The
      // fallback is only considered when the preferred host has no legal candidate at this moment (RRG 1.8 "Attach
      // To", p. 8).
      const preferred = attachmentHostCandidates(state, host.preferred, context);
      return preferred.length > 0 ? preferred : attachmentHostCandidates(state, host.otherwise, context);
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
        if (getInstance(ctx.state, frame.instanceId)) moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
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
      // "Resolve each 'When Revealed' ability that you reveal 1 additional time" (Media Coverage).
      const times = 1 + whenRevealedRepeats(ctx.state, ctx.deps, frame.playerId);
      for (let i = 0; i < times; i++) {
        frames.push(...gameAbilityFrames(ctx, frame.instanceId, ["whenRevealed"], revealed, undefined, frame.playerId));
      }
      pushFrames(ctx, frames);
      return;
    }
    case "finish": {
      setFrame(ctx, { ...frame, stage: "done" });
      if (card.type === "treachery" && getInstance(ctx.state, frame.instanceId)) {
        // Its home deck's discard (docs/phase7-wave1.md §4.3, proposed; see `discardZoneFor`).
        moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
      }
      // RRG "Reveal": responses to any step wait until every step has completed.
      const events: TriggerEvent[] = [
        { kind: "cardRevealed", instanceId: frame.instanceId, playerId: frame.playerId },
      ];
      // RRG "Quickstrike": resolves after this minion's "When Revealed" abilities.
      const quickstrike = frame.effectsCancelled ? null : quickstrikeAttack(ctx.state, frame.instanceId);
      if (quickstrike) events.push(quickstrike);
      // A revealed minion engaged its player; announced after its keywords (ruling, Jan 17, 2026 (3) answer 2).
      if (!frame.effectsCancelled && card.type === "minion") events.push(...engagedEvent(ctx, frame.instanceId));
      const frames: StackFrame[] = events.map((event) => eventFrame(ctx, event));
      // RRG "Surge": the original card is fully resolved first, then the same
      // player reveals one more — so the extra reveal is queued last.
      const surgeLive = !frame.effectsCancelled && !frame.whenRevealedCancelled;
      if (surgeLive && (frame.surgeGained || hasKeyword(ctx.state, frame.instanceId, "surge", ctx.deps))) {
        const surge: TriggerEvent = { kind: "surgeResolving", instanceId: frame.instanceId, playerId: frame.playerId };
        if (heard(ctx.state, ctx.deps, surge)) {
          // "When the surge keyword … would be resolved" (Espionage): its windows first, then `resolveSurge`.
          frames.push(eventFrame(ctx, surge));
        } else {
          const next = dealEncounterCardTo(ctx, frame.playerId);
          if (next) {
            emit(ctx, { type: "surgeTriggered", instanceId: frame.instanceId, playerId: frame.playerId });
            frames.push(revealFrame(ctx, frame.playerId, next));
          }
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

/** RRG 1.8 "Surge" (p. 42): the player resolving the card deals themself another encounter card, then reveals it. */
export function resolveSurge(ctx: Ctx, instanceId: InstanceId, playerId: PlayerId): void {
  const next = dealEncounterCardTo(ctx, playerId);
  if (!next) return;
  emit(ctx, { type: "surgeTriggered", instanceId, playerId });
  pushFrames(ctx, [revealFrame(ctx, playerId, next)]);
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
        amount: startingThreatOf(ctx.state, id, ctx.deps),
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
        moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
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
    moveCard(ctx, frame.instanceId, discardZoneFor(ctx.state, frame.instanceId), "top");
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
  // RRG "First Player": an encounter card with several eligible targets — the
  // first player selects (not the revealing player).
  requestChoice(ctx, {
    playerId: encounterTargetSelector(ctx.state),
    authority: "firstPlayerTargets",
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
