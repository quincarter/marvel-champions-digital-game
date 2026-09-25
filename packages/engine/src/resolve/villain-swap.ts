/**
 * Replacing the villain in play with a set-aside villain of the same title (docs/phase7-wave4.md §3.7): Loki's swap
 * (RRG 1.8 "'Swap'", p. 42) and "When Loki is defeated, advance to a random set-aside Loki villain" (All Hail King Loki
 * 1B, `mts` 21165b; MC21 p. 24). Both keep the villain the same instance — its attachments, tucked cards, status cards
 * and counters simply stay on it — and give it the other card; the card it had moves to the set-aside card's place.
 */

import type { CardId } from "@mc/content";
import { type Ctx, emit, moveCard, pushFrames, updateInstance } from "../ctx.js";
import { giveStatus } from "../effects.js";
import type { InstanceId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import { cardOf, characterProfile, currentName, mustCard, mustInstance, mustVillain } from "../query.js";
import { nextInt } from "../rng.js";
import type { StackFrame } from "../stack.js";
import type { TriggerEvent } from "../trigger-events.js";
import { eventFrame, gameAbilityFrames } from "./frames.js";
import { heard } from "./triggers.js";

/** The set-aside villain cards whose title is `title`, in set-aside order. */
function setAsideVillainsTitled(ctx: Ctx, title: string | undefined): readonly InstanceId[] {
  if (title === undefined) return [];
  return ctx.state.encounterSetAside.filter((id) => {
    const card = cardOf(ctx.state, id);
    return card?.type === "villain" && card.name === title;
  });
}

/** One of them at random, from the game's seeded RNG; null with none. */
function randomSetAsideVillain(ctx: Ctx, villainId: InstanceId): InstanceId | null {
  const candidates = setAsideVillainsTitled(ctx, currentName(ctx.state, villainId));
  if (candidates.length === 0) return null;
  const [pick, rng] = nextInt(ctx.state.rng, candidates.length);
  ctx.state = { ...ctx.state, rng };
  return candidates[pick] ?? null;
}

/**
 * The villain instance takes the set-aside card's identity and the set-aside instance takes the villain's old card.
 * The new card starts on its starting side, at the same stage position where it has one.
 */
function exchangeCards(ctx: Ctx, villainId: InstanceId, setAsideId: InstanceId): { from: CardId; to: CardId } {
  const villain = mustVillain(ctx.state, villainId);
  const from = villain.cardId;
  const to = mustInstance(ctx.state, setAsideId).cardId;
  const card = mustCard(ctx.state, to);
  if (card.type !== "villain") return { from, to: from };
  const side = card.startingSide ?? card.sides[0].side;
  const stages = card.sides.find((s) => s.side === side)?.stages ?? card.sides[0].stages;
  const stageIndex = Math.min(villain.stageIndex, stages.length - 1);
  ctx.state = {
    ...ctx.state,
    villains: ctx.state.villains.map((v) =>
      v.instanceId === villainId
        ? {
            ...v,
            cardId: to,
            side,
            stageIndex,
            lastStageIndex: Math.max(stageIndex, Math.min(v.lastStageIndex, stages.length - 1)),
          }
        : v,
    ),
  };
  updateInstance(ctx, villainId, (i) => ({ ...i, cardId: to }));
  updateInstance(ctx, setAsideId, (i) => ({ ...i, cardId: from }));
  return { from, to };
}

/**
 * `EffectSpec swapVillain`: RRG 1.8 "'Swap'" (p. 42), two cards sharing a title — "neither card is considered to enter or
 * leave play", everything on the in-play card is transferred, and "that dial remains at the same value". The swapped-out
 * card is set aside (MC21 p. 24). Returns false when there was nothing to swap with.
 */
export function swapVillain(ctx: Ctx, villainId: InstanceId): boolean {
  const setAsideId = randomSetAsideVillain(ctx, villainId);
  if (setAsideId === null) return false;
  const before = characterProfile(ctx.state, villainId, ctx.deps);
  const remaining = before ? before.maxHp - mustInstance(ctx.state, villainId).damage : 0;
  const { from, to } = exchangeCards(ctx, villainId, setAsideId);
  const after = characterProfile(ctx.state, villainId, ctx.deps);
  // The dial shows remaining hit points; keeping its value keeps the villain's remaining hit points.
  if (before && after && Number.isFinite(after.maxHp))
    updateInstance(ctx, villainId, (i) => ({ ...i, damage: Math.max(0, after.maxHp - remaining) }));
  emit(ctx, { type: "villainReplaced", instanceId: villainId, fromCardId: from, toCardId: to, reason: "swap" });
  const swapped = { kind: "villainSwapped" as const, villainInstanceId: villainId, fromCardId: from, toCardId: to };
  if (heard(ctx.state, ctx.deps, swapped)) pushFrames(ctx, [eventFrame(ctx, swapped)]);
  return true;
}

/**
 * `EffectSpec advanceToSetAsideVillain`: the defeated card leaves play (the victory display with Victory X, else removed
 * from the game) and a random set-aside villain of the same title takes over as the same villain, dial reset to its
 * printed hit points. Returns the frames to push (its When Revealed), or null when none was set aside.
 */
export function advanceToSetAsideVillain(
  ctx: Ctx,
  villainId: InstanceId,
  /** The defeat this advance interrupts, handed to the defeated card's own When Defeated abilities. */
  defeat: TriggerEvent | null = null,
): readonly StackFrame[] | null {
  const setAsideId = randomSetAsideVillain(ctx, villainId);
  if (setAsideId === null) return null;
  const victory = hasKeyword(ctx.state, villainId, "victory", ctx.deps);
  // The defeated card's own "When Defeated" (Loki's "discard … until a side scheme is discarded; reveal it"): RRG 1.8
  // "When Defeated Abilities" (p. 48) is a forced interrupt to the same defeat this advance interrupts, and every
  // When Defeated on the card resolves. The advance replaces the defeat's usual course (the dial resets, so the
  // defeat sweep never reaches `defeatVillainStage`), so its abilities are read here, from the card being defeated,
  // before the exchange, and resolve after the advance (docs/phase7-wave4.md §3.48, §4 Q21).
  const whenDefeated = gameAbilityFrames(ctx, villainId, ["whenDefeated"], defeat, undefined, ctx.state.firstPlayerId);
  const { from, to } = exchangeCards(ctx, villainId, setAsideId);
  // RRG 1.8 "Villain Defeat" (p. 47): "Excess damage … does not carry over", the new card's dial is its own.
  updateInstance(ctx, villainId, (i) => ({ ...i, damage: 0 }));
  moveCard(ctx, setAsideId, victory ? { kind: "victoryDisplay" } : { kind: "removedFromGame" });
  emit(ctx, { type: "villainReplaced", instanceId: villainId, fromCardId: from, toCardId: to, reason: "advance" });
  if (hasKeyword(ctx.state, villainId, "toughness", ctx.deps)) giveStatus(ctx, villainId, "tough");
  // The When Defeated frames name the defeated card's instance, now the one in the victory display (`exchangeCards`).
  const defeatedCardFrames = whenDefeated.map((f) => (f.kind === "ability" ? { ...f, instanceId: setAsideId } : f));
  return [
    ...defeatedCardFrames,
    ...gameAbilityFrames(ctx, villainId, ["whenRevealed"], null, undefined, ctx.state.firstPlayerId),
  ];
}
