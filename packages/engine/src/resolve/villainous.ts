/**
 * RRG 1.8 "Villainous" (p. 47) on a character that is not an enemy: an ally or a hero (MC60 p. 26 FAQ, Black Cat 60169:
 * "Does Black Cat retain the villainous keyword while she is an ally? Yes. The rules for villainous have been revised to
 * function for allies (and heroes) who have it"; docs/phase7-wave11-scenarios.md §S3.7).
 *
 * "When a character with the villainous keyword uses a basic power, give it a facedown boost card from the top of the
 * encounter deck. When resolving that basic power, turn the boost card faceup, resolve any boost ability on that card,
 * and apply its boost icons to the character's stats for this use. Discard the boost card after it is resolved."
 *
 * The give is the keyword's forced interrupt to the power's `basicPowerUsing` event (`VILLAINOUS_ABILITY`,
 * `keyword-abilities.ts`), ordered among the other forced interrupts like any. The rest is two `characterBoost` frames
 * (`stack.ts`): the use's record beneath the use's own frame, and a `resolve` frame above it, which runs once the
 * `basicPowerUsing` window is over, as the power resolves. For each boost card this use gave (one held from before
 * stays facedown, RRG 1.8 "Boost, Boost Icon", p. 11):
 *
 * 1. it is turned faceup (`characterBoostCardFlipped`) and a `boostCardTurnedFaceup` event opens its interrupt window,
 *    as an enemy's boost card does (RRG 1.8 "Attack (Enemy Activation)" step 3a, p. 8; "Boost", p. 11). "A boost card"
 *    with no qualifier hears it (the Golden Rules, p. 4: the card's text says what it is); one naming the villain or an
 *    enemy does not, since the holder, the event's source, is the character;
 * 2. its printed and gained Boost abilities resolve with the character's controller as "you" (an ability naming "the
 *    villain" still means the villain, p. 47), unless cancelled; then the event's responses;
 * 3. its icons, unless cancelled, are counted (its own `adjustBoostCount` / `replaceBoostCount` included) and added to
 *    the stat powering this use until the use ends. Amplify adds nothing (RRG 1.8 "Amplify Icon", p. 7: "during an
 *    enemy activation"; §S4.0).
 *
 * The card stays faceup on the character until the use has resolved; the record then discards it (RRG 1.8 p. 47,
 * "Discard the boost card after it is resolved"; MC60 p. 3, "after the basic power resolves"). A character that leaves
 * play first takes its boost cards with it to their discard piles (`effects.ts`).
 */

import type { EngineDeps } from "../abilities.js";
import {
  type Ctx,
  emit,
  findFrame,
  moveCard,
  popFrame,
  pushFrames,
  setFrame,
  updateFrame,
  updateInstance,
} from "../ctx.js";
import { addLastingEffect } from "../effects.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { hasKeyword } from "../keywords.js";
import { boostIconsFor } from "../modifiers.js";
import { discardZoneFor, getInstance, locateCard } from "../query.js";
import { cardsInPlay, categoriesOf, gainedBoostAbilities } from "../select.js";
import type { BasicPowerName, StatName } from "../spec.js";
import { basicPowerUseFrameId, describeFrame, type StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { base, eventFrame, type Frame, gameAbilityFrames } from "./frames.js";

/** A character in play that is not an enemy and has villainous, printed or gained, read as every keyword is. */
export const villainousFriendlyCharacter = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  cardsInPlay(state).includes(id) &&
  !categoriesOf(state, id).includes("enemy") &&
  hasKeyword(state, id, "villainous", deps);

const facedownBoosts = (state: GameState, id: InstanceId): readonly InstanceId[] =>
  (getInstance(state, id)?.boostCards ?? []).filter((card) => getInstance(state, card)?.faceup === false);

/** Puts `frames` directly beneath the frame `below` on the stack. */
function insertBeneath(ctx: Ctx, below: FrameId, frames: readonly StackFrame[]): void {
  const stack = ctx.state.stack;
  const at = stack.findIndex((f) => f.frameId === below) + 1;
  if (at === 0) return;
  ctx.state = { ...ctx.state, stack: [...stack.slice(0, at), ...frames, ...stack.slice(at)] };
  for (const frame of frames)
    emit(ctx, { type: "framePushed", frameId: frame.frameId, frame: frame.kind, description: describeFrame(frame) });
}

/**
 * Records a basic power `characterId` is using, when it is a villainous ally or hero: the `use` record beneath the
 * use's frame, and, except for a basic defense, the `resolve` frame on top. Called by the power's announcer just before
 * it pushes the power's `basicPowerUsing` event, so the `resolve` frame sits beneath that event and above the use.
 *
 * A basic defense's card is turned faceup after the enemy's own boost cards (`startDefenderBoost`). Engine reading
 * (authority step 5): no card yet makes a hero villainous; the card is turned up after the enemy's boost cards (RRG 1.8
 * p. 9 step 3) because DEF applies at step 4 and p. 47 separates "uses" from "when resolving". Revisit if such a card
 * appears.
 */
export function pushCharacterBoost(
  ctx: Ctx,
  characterId: InstanceId,
  power: BasicPowerName,
  stat: StatName,
  playerId: PlayerId,
): void {
  if (!villainousFriendlyCharacter(ctx.state, ctx.deps, characterId)) return;
  // An ally's defense gets no boost card (`VILLAINOUS_ABILITY`'s pattern: RRG 1.8 pp. 10, 15), so nothing to resolve.
  if (power === "defense" && !categoriesOf(ctx.state, characterId).includes("hero")) return;
  // A divided basic power (Wasp's, one `attack` / `thwart` event per share) is read as its top share's frame: the icons
  // apply to that share and the use ends with it, the limit "+N to that power for this use" (`modifyBasicPower`)
  // already has. No villainous character divides a basic power yet.
  const useFrameId = basicPowerUseFrameId(ctx.state.stack, power, characterId);
  if (useFrameId === null) return;
  const record: Frame<"characterBoost"> = {
    ...base(ctx),
    kind: "characterBoost",
    stage: "use",
    characterInstanceId: characterId,
    playerId,
    power,
    stat,
    useFrameId,
    heldBefore: facedownBoosts(ctx.state, characterId),
    turned: [],
    bonuses: [],
    ...(power === "defense" ? {} : { started: true as const }),
  };
  insertBeneath(ctx, useFrameId, [record]);
  if (power !== "defense") pushFrames(ctx, [resolveFrameFor(ctx, record)]);
}

const resolveFrameFor = (ctx: Ctx, record: Frame<"characterBoost">): Frame<"characterBoost"> => ({
  ...record,
  ...base(ctx),
  stage: "resolve",
  heldBefore: [],
  turned: [],
  bonuses: [],
  recordFrameId: record.frameId,
  boost: null,
});

/**
 * RRG 1.8 "Attack (Enemy Activation)" (p. 9): a villainous hero's basic defense resolves its boost card once the enemy's
 * boost cards are done (step 3), before the damage step reads DEF (step 4). Called by the attack procedure when its
 * flip step finds no enemy boost card left; true when it pushed a `resolve` frame, the procedure then waiting on it.
 * The engine reading is `pushCharacterBoost`'s.
 */
export function startDefenderBoost(ctx: Ctx, attackEventFrameId: FrameId | null): boolean {
  if (attackEventFrameId === null) return false;
  const record = ctx.state.stack.find(
    (f): f is Frame<"characterBoost"> =>
      f.kind === "characterBoost" &&
      f.stage === "use" &&
      f.power === "defense" &&
      f.useFrameId === attackEventFrameId &&
      f.started !== true,
  );
  if (!record) return false;
  setFrame(ctx, { ...record, started: true });
  pushFrames(ctx, [resolveFrameFor(ctx, record)]);
  return true;
}

/**
 * A substitution of the stat powering a use ("use its ATK instead of its DEF", `setBasicPowerStat`): the icons already
 * applied move to the new stat, and any still to come go there (RRG 1.8 p. 47, "apply its boost icons to the
 * character's stats for this use"; docs/phase7-wave8.md §4.1 Q54).
 */
export function retargetCharacterBoost(
  ctx: Ctx,
  characterId: InstanceId | null,
  power: BasicPowerName,
  stat: StatName,
): void {
  const record = ctx.state.stack.find(
    (f): f is Frame<"characterBoost"> =>
      f.kind === "characterBoost" &&
      f.stage === "use" &&
      f.power === power &&
      (characterId === null || f.characterInstanceId === characterId),
  );
  if (!record || record.stat === stat) return;
  setFrame(ctx, { ...record, stat });
  if (record.bonuses.length === 0) return;
  ctx.state = {
    ...ctx.state,
    lastingEffects: ctx.state.lastingEffects.map((effect) =>
      record.bonuses.includes(effect.id) && effect.kind === "statModifier" ? { ...effect, stat } : effect,
    ),
  };
}

export function executeCharacterBoostFrame(ctx: Ctx, frame: Frame<"characterBoost">): void {
  if (frame.stage === "use") return finishUse(ctx, frame);
  const record = frame.recordFrameId !== undefined ? findFrame(ctx.state, frame.recordFrameId) : undefined;
  const character = frame.characterInstanceId;
  if (record?.kind !== "characterBoost" || !cardsInPlay(ctx.state).includes(character)) return popFrame(ctx);
  const boost = frame.boost ?? null;
  const activation = record.power === "attack" || record.power === "defense" ? "attack" : null;
  const turnedEvent = (boostId: InstanceId, boostIcons: number): TriggerEvent => ({
    kind: "boostCardTurnedFaceup",
    enemyInstanceId: character,
    boostInstanceId: boostId,
    activation,
    boostIcons,
    playerId: frame.playerId,
  });

  if (!boost) {
    // A use cancelled in its interrupt window is not resolved, so nothing is turned up or resolved for it (RRG 1.8
    // p. 47, "When resolving that basic power"); the record still discards the card it was given.
    const use = findFrame(ctx.state, record.useFrameId);
    if (!use || (use.kind === "event" && use.cancelled)) return popFrame(ctx);
    const boostId = facedownBoosts(ctx.state, character).find(
      (id) => !record.heldBefore.includes(id) && !record.turned.includes(id),
    );
    if (!boostId) return popFrame(ctx);
    updateInstance(ctx, boostId, (i) => ({ ...i, faceup: true }));
    updateFrame(ctx, record.frameId, (f) =>
      f.kind === "characterBoost" ? { ...f, turned: [...f.turned, boostId] } : f,
    );
    const icons = boostIconsFor(ctx.state, ctx.deps, boostId, frame.playerId);
    emit(ctx, {
      type: "characterBoostCardFlipped",
      characterInstanceId: character,
      instanceId: boostId,
      power: record.power,
      stat: record.stat,
      boostIcons: icons,
    });
    // The interrupts to the card being turned faceup, then its Boost ability, then the responses (RRG 1.8 p. 5), as
    // `stepBoostCard` resolves an enemy's.
    const turned = eventFrame(ctx, turnedEvent(boostId, icons));
    setFrame(ctx, {
      ...frame,
      boost: {
        instanceId: boostId,
        step: "window",
        iconsCancelled: false,
        abilityCancelled: false,
        turnedIcons: icons,
        turnedFrameId: turned.frameId,
      },
    });
    pushFrames(ctx, [turned.kind === "event" ? { ...turned, responsesLater: true } : turned]);
    return;
  }
  if (boost.step === "window") {
    const { turnedFrameId: _interruptsDone, ...rest } = boost;
    setFrame(ctx, { ...frame, boost: { ...rest, step: "ability" } });
    if (boost.abilityCancelled) {
      emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "ability" });
      return;
    }
    // A card a "discard it instead" moved away resolves nothing more.
    if (locateCard(ctx.state, boost.instanceId)?.kind !== "boost") return;
    const gained = gainedBoostAbilities(ctx.state, ctx.deps, boost.instanceId).map((g) => ({ id: g.abilityId }));
    pushFrames(ctx, [
      ...gameAbilityFrames(ctx, boost.instanceId, ["boost"], null, undefined, frame.playerId),
      ...(gained.length > 0 ? gameAbilityFrames(ctx, boost.instanceId, ["boost"], null, gained, frame.playerId) : []),
    ]);
    return;
  }
  if (boost.step === "ability") {
    setFrame(ctx, { ...frame, boost: { ...boost, step: "responses" } });
    if (!boost.turnedCancelled) {
      const responses = eventFrame(
        ctx,
        turnedEvent(boost.instanceId, boost.iconsCancelled ? 0 : (boost.turnedIcons ?? 0)),
      );
      pushFrames(ctx, [responses.kind === "event" ? { ...responses, stage: "responses" } : responses]);
      return;
    }
  }
  // The count: no window opens for it (no character's boost card is an enemy activation's to count).
  const icons = boost.iconsCancelled
    ? 0
    : Math.max(
        0,
        boostIconsFor(ctx.state, ctx.deps, boost.countFrom ?? boost.instanceId, frame.playerId) +
          (boost.countAdjust ?? 0),
      );
  setFrame(ctx, { ...frame, boost: null });
  if (icons <= 0 || locateCard(ctx.state, boost.instanceId)?.kind !== "boost") return;
  if (!ctx.state.stack.some((f) => f.frameId === record.useFrameId)) return;
  const bonus = addLastingEffect(
    ctx,
    {
      kind: "statModifier",
      stat: record.stat,
      amount: { kind: "const", value: icons },
      targets: [character],
      affects: null,
      scope: { selfInstanceId: character, controllerId: frame.playerId, vars: {}, bindings: {} },
    },
    { kind: "endOfEvent", frameId: record.useFrameId },
  );
  updateFrame(ctx, record.frameId, (f) =>
    f.kind === "characterBoost" ? { ...f, bonuses: [...f.bonuses, bonus.id] } : f,
  );
}

/**
 * The use has resolved: each boost card it gave the character is discarded, turned up or not (one the use never
 * reached, its attack ended first, is not left on the character for a later use). A card held from before stays.
 */
function finishUse(ctx: Ctx, record: Frame<"characterBoost">): void {
  popFrame(ctx);
  const holder = getInstance(ctx.state, record.characterInstanceId);
  for (const id of [...(holder?.boostCards ?? [])]) {
    if (record.heldBefore.includes(id)) continue;
    const zone = locateCard(ctx.state, id);
    if (zone?.kind !== "boost" || zone.hostInstanceId !== record.characterInstanceId) continue;
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
  }
}
