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
 * `keyword-abilities.ts`), ordered among the other forced interrupts like any. For a basic attack, thwart or recovery
 * that event waits for its power's own "would" interrupts (`deferUsingAfterWould`), so a "would" cancel gives no card
 * (RRG 1.8 "'Would'", p. 48). The rest is two `characterBoost` frames (`stack.ts`): the use's record beneath the use's
 * own frame, and a `resolve` frame pushed above that frame once its own interrupt window has closed, as the power
 * resolves (`startCharacterBoost`).
 *
 * Held boost cards. A card given to the character ahead of time for its basic powers ("Give her 1 facedown boost
 * card", Acrobatic Prowess 63006; `EffectSpec giveBoostCard.forBasicPower`, `CardInstance.heldForBasicPowers`) waits
 * facedown on it and resolves on its next basic power, the same way, before the card that use gives: "if Elektra has a
 * boost card while in Alter-Ego form and makes a basic recovery, she resolves that boost card for that activation"
 * (ruling September 10, 2026 - Ruling 3 (A)). So a character holding one has its use recorded even without the
 * keyword (Elektra Natchios has none), and the cards belong to the identity, not a face: a form change keeps them. A
 * boost card an enemy's text placed on the character ("place 1 facedown boost card on your identity", Venom) is not
 * one: "the boost cards that Venom places on an identity are distinct from the boost cards Elektra is given via cards
 * in her kit; Elektra cannot use boost cards placed on her by Venom" (the same ruling, (C)). It stays facedown
 * (`heldBefore`; RRG 1.8 "Boost, Boost Icon", p. 11).
 *
 * For each boost card the use resolves, held ones first, then the use's own, in the order given:
 *
 * 1. it is turned faceup (`characterBoostCardFlipped`) and a `boostCardTurnedFaceup` event opens its interrupt window,
 *    as an enemy's boost card does (RRG 1.8 "Attack (Enemy Activation)" step 3a, p. 8; "Boost", p. 11). "A boost card"
 *    with no qualifier hears it (the Golden Rules, p. 4: the card's text says what it is); one naming the villain or an
 *    enemy does not, since the holder, the event's source, is the character;
 * 2. its printed and gained Boost abilities resolve with the character's controller as "you" (an ability naming "the
 *    villain" still means the villain, p. 47), unless cancelled; then the event's responses;
 * 3. its icons, unless cancelled, are counted (its own `adjustBoostCount` / `replaceBoostCount` included) and added to
 *    the stat powering this use until the use ends, one more for each amplify icon in play (`characterAmplify`).
 *
 * The card stays faceup on the character until the use has resolved; the record then discards it (RRG 1.8 p. 47,
 * "Discard the boost card after it is resolved"; MC60 p. 3, "after the basic power resolves"), unless its Boost ability
 * sent it elsewhere: shuffled into another deck, or given back facedown for a later use ("Otherwise, give this card to
 * Elektra as a facedown boost card", the Ninja cards 63002–63004), where it stays; its icons still count for this use
 * (ruling January 11, 2024 #134; owner decision 4, docs/phase7-elektra-iron-fist.md §5). A card this use never reached
 * stays facedown and held for a later use (owner decision 5, the same section; `finishUse`). A character that leaves
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
import { amplifyIconsInPlay, boostIconsFor } from "../modifiers.js";
import { discardZoneFor, getInstance, locateCard } from "../query.js";
import { cardsInPlay, categoriesOf, gainedBoostAbilities } from "../select.js";
import type { BasicPowerName, StatName } from "../spec.js";
import { basicPowerUseFrameId, defendsWithBasicPower, describeFrame, type StackFrame } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { base, eventFrame, type Frame, gameAbilityFrames, pushEvent } from "./frames.js";

/** A character in play that is not an enemy and has villainous, printed or gained, read as every keyword is. */
export const villainousFriendlyCharacter = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  cardsInPlay(state).includes(id) &&
  !categoriesOf(state, id).includes("enemy") &&
  hasKeyword(state, id, "villainous", deps);

/**
 * The amplify icons a character's boost card gains as it resolves during a basic power: one per amplify icon in play.
 *
 * Conflict between sources, settled by the owner on 2026-11-14 (docs/phase7-wave11-scenarios.md §S4.0, "Amplify"):
 * RRG 1.8 "Amplify Icon" (p. 7) adds the icon only "when a boost card is turned faceup during an enemy activation",
 * which would leave a villainous hero's or ally's card without it. The Fear No Evil rulebook's updated text (MC60 p. 4,
 * "Amplify Icon (Updated)") reads "When a character resolves a boost card while using a basic power, add one additional
 * boost icon to that card for each amplify icon in play". The owner follows the newer product text over RRG 1.8 p. 7
 * for every character, not as an Elektra exception: a villainous hero's basic attack, thwart and defense (Elektra
 * 63001a), a basic recovery by an identity that has villainous, and a villainous ally's basic attack and thwart (Black
 * Cat 60169 / 63016; an ally's defense is no basic power, so it gets no card). A character given its card by
 * `registerCharacterBoost` (the custom Carnage card's Klyntar Bond) gains it too: MC60 says "a character". An enemy
 * activation's boost cards keep theirs (`enemy-activation.ts`). Read live, at the flip and again at the count, as an
 * enemy's card is (the Fearless Determination ruling, January 11, 2026 (1)).
 *
 * A held boost card (`CardInstance.heldForBasicPowers`) gains it as well, on any basic power of its holder, recovery
 * included: it is resolved while that character uses the power (ruling September 10, 2026 - Ruling 3 (A)).
 */
const characterAmplify = (ctx: Ctx): number => amplifyIconsInPlay(ctx.state, ctx.deps);

const facedownBoosts = (state: GameState, id: InstanceId): readonly InstanceId[] =>
  (getInstance(state, id)?.boostCards ?? []).filter((card) => getInstance(state, card)?.faceup === false);

/**
 * The facedown boost cards `id` holds for its basic powers, in the order given (`CardInstance.heldForBasicPowers`):
 * what its next basic power resolves besides any card that use gives. For a view, their count is what shows on the
 * character; the cards themselves are facedown encounter cards.
 */
export const heldBoostCardsOf = (state: GameState, id: InstanceId): readonly InstanceId[] =>
  facedownBoosts(state, id).filter((card) => getInstance(state, card)?.heldForBasicPowers === true);

/**
 * Whether `id`'s basic powers resolve boost cards: a character in play that is not an enemy, with villainous or holding
 * a boost card for its basic powers (ruling September 10, 2026 - Ruling 3 (A)).
 */
export const resolvesBoostCards = (state: GameState, deps: EngineDeps, id: InstanceId): boolean =>
  villainousFriendlyCharacter(state, deps, id) ||
  (cardsInPlay(state).includes(id) &&
    !categoriesOf(state, id).includes("enemy") &&
    heldBoostCardsOf(state, id).length > 0);

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
 * Holds a basic attack's, thwart's or recovery's `basicPowerUsing` announcement on the power's own event frame
 * (`Frame<"event">.usingAfterWould`) until that event's "would" interrupts have resolved. Villainous = Forced Interrupt:
 * when this character uses a basic power (RRG 1.8 "Villainous", p. 47), the same triggering condition as Stick 60029
 * and Moondragon 63038, so it initiates before them ("Forced", p. 20); "would" interrupts to the attack or thwart go
 * first, and a "would" cancel gives no card ("'Would'", p. 48). False when there is no such frame still to open its
 * window (a basic defense, a use already under way): the caller pushes the announcement at once.
 *
 * A divided basic attack or thwart (Wasp's; one `attack` / `thwart` event per share) holds it on its use frame, the
 * top share's (`basicPowerUseFrameId`), as the use record reads it: it is announced once, in that share's window, and a
 * "would" cancel of that share alone leaves the whole power unannounced though the other shares go on. No villainous
 * character divides a basic power yet; revisit if one does.
 */
export function deferUsingAfterWould(ctx: Ctx, using: Extract<TriggerEvent, { kind: "basicPowerUsing" }>): boolean {
  if (using.power === "defense") return false;
  const useFrameId = basicPowerUseFrameId(ctx.state.stack, using.power, using.characterInstanceId);
  const frame = useFrameId === null ? undefined : findFrame(ctx.state, useFrameId);
  if (frame?.kind !== "event" || frame.stage !== "interrupts" || frame.usingAfterWould) return false;
  const event = frame.event;
  const ofThisUse =
    (using.power === "attack" &&
      event.kind === "attack" &&
      event.basic === true &&
      event.attackerInstanceId === using.characterInstanceId) ||
    (using.power === "thwart" &&
      event.kind === "thwart" &&
      event.basic === true &&
      event.thwarterInstanceId === using.characterInstanceId) ||
    (using.power === "recover" &&
      event.kind === "basicRecovery" &&
      event.characterInstanceId === using.characterInstanceId);
  if (!ofThisUse) return false;
  setFrame(ctx, { ...frame, usingAfterWould: using });
  return true;
}

/**
 * Pushes the `basicPowerUsing` announcement the event frame `eventFrameId` holds (`deferUsingAfterWould`), clearing it:
 * called as that event's interrupt window passes its "would" tier, or at its apply step when it opened none. True when
 * it pushed one, the caller then waiting for it to resolve.
 */
export function pushUsingAfterWould(ctx: Ctx, eventFrameId: FrameId): boolean {
  const frame = findFrame(ctx.state, eventFrameId);
  if (frame?.kind !== "event" || !frame.usingAfterWould) return false;
  const { usingAfterWould: using, ...rest } = frame;
  setFrame(ctx, rest as Frame<"event">);
  pushEvent(ctx, using);
  return true;
}

/**
 * Records a basic power `characterId` is using, when it is a villainous ally or hero or one holding boost cards for its
 * basic powers: the `use` record beneath the use's frame. Called by the power's announcer just before it pushes the
 * power's `basicPowerUsing` event. Its cards are turned faceup later, as the power resolves (`startCharacterBoost`).
 *
 * A basic defense's cards are turned faceup in the attack's step 3, with the enemy's: "she will turn that boost card
 * faceup during the same step that the villain's boost cards are turned faceup" (ruling September 10, 2026 - Ruling 3
 * (B)), all of one character's before the other's, the defending player choosing which (October 12, 2026 - Ruling 1:
 * "you can choose to resolve either character's boost cards first … Ensure that all boost cards are resolved before
 * moving on to step 4"). The attack procedure asks (`defenderBoostOrder`, `enemy-activation.ts`) and starts them
 * (`startDefenderBoost`).
 */
export function pushCharacterBoost(
  ctx: Ctx,
  characterId: InstanceId,
  power: BasicPowerName,
  stat: StatName,
  playerId: PlayerId,
): void {
  if (!resolvesBoostCards(ctx.state, ctx.deps, characterId)) return;
  const record = characterBoostRecord(ctx, characterId, power, stat, playerId);
  if (!record) return;
  insertBeneath(ctx, record.useFrameId, [record]);
}

/**
 * The `use` record for a basic power `characterId` is using, or null when the use gets no boost card or is not on the
 * stack. An ally's defense gets none (`VILLAINOUS_ABILITY`'s pattern: RRG 1.8 pp. 10, 15: it is no use of a basic
 * power). A divided basic power (Wasp's, one `attack` / `thwart` event per share) is read as its top share's frame: the
 * icons apply to that share and the use ends with it, the limit "+N to that power for this use" (`modifyBasicPower`)
 * already has. No villainous character divides a basic power yet.
 */
function characterBoostRecord(
  ctx: Ctx,
  characterId: InstanceId,
  power: BasicPowerName,
  stat: StatName,
  playerId: PlayerId,
): Frame<"characterBoost"> | null {
  if (power === "defense" && !defendsWithBasicPower(ctx.state, characterId)) return null;
  const useFrameId = basicPowerUseFrameId(ctx.state.stack, power, characterId);
  if (useFrameId === null) return null;
  return {
    ...base(ctx),
    kind: "characterBoost",
    stage: "use",
    characterInstanceId: characterId,
    playerId,
    power,
    stat,
    useFrameId,
    // Only cards it cannot use (an enemy's text placed them); its held ones resolve (ruling September 10, 2026 - Ruling
    // 3 (A), (C)).
    heldBefore: facedownBoosts(ctx.state, characterId).filter(
      (id) => getInstance(ctx.state, id)?.heldForBasicPowers !== true,
    ),
    turned: [],
    bonuses: [],
  };
}

/**
 * "When Carnage uses a basic power, you may give him a boost card" (Klyntar Bond, a custom-content card; the pack's
 * text is the authority, docs/custom-content-packs.md §6, and its author expects the card to resolve as villainous's
 * does): from an interrupt to the power's `basicPowerUsing` event, makes this use resolve a boost card the way the
 * villainous keyword's does (RRG 1.8 "Villainous", p. 47; MC60 p. 26 FAQ), for a character that need not have the
 * keyword. Registers the `use` record `pushCharacterBoost` would have pushed as the power was announced, beneath the
 * use's frame; its cards are turned faceup as the power resolves (`startCharacterBoost`, `startDefenderBoost`). A use
 * that already has a record (a villainous character) keeps it: it turns up every card the use was given, this one too.
 * The caller then gives the card (`giveBoostCard`, held for the use). False when the use gets no boost card (an ally's
 * defense, a use no longer on the stack): nothing is registered and nothing should be given.
 */
export function registerCharacterBoost(ctx: Ctx, event: Extract<TriggerEvent, { kind: "basicPowerUsing" }>): boolean {
  const { characterInstanceId: characterId, power, stat, playerId } = event;
  if (!cardsInPlay(ctx.state).includes(characterId)) return false;
  const record = characterBoostRecord(ctx, characterId, power, stat, playerId);
  if (!record) return false;
  const existing = ctx.state.stack.some(
    (f) =>
      f.kind === "characterBoost" &&
      f.stage === "use" &&
      f.useFrameId === record.useFrameId &&
      f.characterInstanceId === characterId,
  );
  if (existing) return true;
  insertBeneath(ctx, record.useFrameId, [record]);
  return true;
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

/** The `use` record of the basic defense of the attack `attackEventFrameId`, while its cards are not yet started. */
export function pendingDefenderBoost(
  state: GameState,
  attackEventFrameId: FrameId | null,
): Frame<"characterBoost"> | null {
  if (attackEventFrameId === null) return null;
  return (
    state.stack.find(
      (f): f is Frame<"characterBoost"> =>
        f.kind === "characterBoost" &&
        f.stage === "use" &&
        f.power === "defense" &&
        f.useFrameId === attackEventFrameId &&
        f.started !== true,
    ) ?? null
  );
}

/**
 * The facedown boost cards a `use` record's character will resolve for that use: those held for its basic powers (its
 * kit's and the one this use's villainous keyword gave, both marked `heldForBasicPowers` as they are given) that it has
 * not turned up yet. A card an enemy's text placed on it is never one, whenever it arrived (ruling September 10, 2026 -
 * Ruling 3 (C)).
 */
export function boostCardsToResolve(state: GameState, record: Frame<"characterBoost">): readonly InstanceId[] {
  return heldBoostCardsOf(state, record.characterInstanceId).filter(
    (id) => !record.heldBefore.includes(id) && !record.turned.includes(id),
  );
}

/**
 * Called by the event frame `useFrameId` (an attack, a thwart, a basic recovery) as it resolves, after its interrupt
 * window and only when it was not cancelled: turns up the boost cards of the basic power it is, if any (a basic
 * defense's are turned up in the enemy attack's step 3 instead, `startDefenderBoost`). True when it pushed the
 * `resolve` frame, the event then waiting on it.
 *
 * Boost cards flip as the basic power resolves (RRG 1.8 "Villainous" p.47), after all interrupts to it: "would"
 * interrupts first ("Would" p.48), then the Villainous forced interrupt, then non-forced interrupts ("Forced" p.20,
 * "Interrupt" p.25). So a cancel in the power's own interrupt window ("when she attacks") leaves every card facedown and
 * held for her next basic power (owner decision 5, docs/phase7-elektra-iron-fist.md §5; `finishUse`).
 */
export function startCharacterBoost(ctx: Ctx, useFrameId: FrameId): boolean {
  const record = ctx.state.stack.find(
    (f): f is Frame<"characterBoost"> =>
      f.kind === "characterBoost" &&
      f.stage === "use" &&
      f.power !== "defense" &&
      f.useFrameId === useFrameId &&
      f.started !== true,
  );
  if (!record) return false;
  setFrame(ctx, { ...record, started: true });
  pushFrames(ctx, [resolveFrameFor(ctx, record)]);
  return true;
}

/**
 * RRG 1.8 "Attack (Enemy Activation)" (p. 9): a defending hero's own boost cards resolve in step 3, before the damage
 * step reads DEF (step 4), all of them before or after all of the enemy's (rulings September 10, 2026 - Ruling 3 (B);
 * October 12, 2026 - Ruling 1). Called by the attack procedure when the defending player chose them first, or when its
 * flip step finds no enemy boost card left; true when it pushed a `resolve` frame, the procedure then waiting on it.
 */
export function startDefenderBoost(ctx: Ctx, attackEventFrameId: FrameId | null): boolean {
  const record = pendingDefenderBoost(ctx.state, attackEventFrameId);
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
    // p. 47, "When resolving that basic power"); its cards, the one it was given included, stay facedown and held for
    // the character's next basic power (owner decision 5, docs/phase7-elektra-iron-fist.md §5; `finishUse`).
    const use = findFrame(ctx.state, record.useFrameId);
    if (!use || (use.kind === "event" && use.cancelled)) return popFrame(ctx);
    const [boostId] = boostCardsToResolve(ctx.state, record);
    if (!boostId) return popFrame(ctx);
    updateInstance(ctx, boostId, (i) => ({ ...i, faceup: true }));
    updateFrame(ctx, record.frameId, (f) =>
      f.kind === "characterBoost" ? { ...f, turned: [...f.turned, boostId] } : f,
    );
    const icons = boostIconsFor(ctx.state, ctx.deps, boostId, frame.playerId) + characterAmplify(ctx);
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
  // The count: no window opens for it (no character's boost card is an enemy activation's to count). A cancel of the
  // card's icons does not reach those its "Boost" ability gave it (ruling May 10, 2024 #173), as in `enemy-activation.ts`.
  const counted =
    boostIconsFor(ctx.state, ctx.deps, boost.countFrom ?? boost.instanceId, frame.playerId) +
    characterAmplify(ctx) +
    (boost.countAdjust ?? 0);
  const icons = Math.max(0, (boost.iconsCancelled ? 0 : counted) + (boost.boostAbilityAdjust ?? 0));
  setFrame(ctx, { ...frame, boost: null });
  // Its icons count for this use wherever its own Boost ability moved it: shuffled into another deck (the Ninja cards)
  // or attached ("the boost icon(s) on Homo Superior still increases the enemy's ATK", ruling January 11, 2024 #134;
  // RRG 1.8 "Villainous", p. 47, "apply its boost icons to the character's stats for this use"). One given back
  // facedown for a later use counts too, and again when it is turned faceup on that later use: owner decision 4
  // (docs/phase7-elektra-iron-fist.md §5), on ruling January 11, 2024 #134.
  if (icons <= 0) return;
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
 * The use has resolved: each boost card it turned up is discarded. Every card still facedown stays as it is. One held
 * for the character's basic powers stays held for its next one: a card this use never reached (the power was cancelled
 * or its attack ended first), the card this use's villainous keyword gave included, or one a Boost ability gave back to
 * it ("Otherwise, give this card to Elektra as a facedown boost card"). Owner decision 5 (docs/phase7-elektra-iron-
 * fist.md §5, provisional; RRG 1.8 "Boost, Boost Icon", p. 11; ruling September 10, 2026 - Ruling 3 (A)), for every
 * character that resolves boost cards, not only Elektra. A card it cannot use (an enemy's text placed it, before the
 * use or during it, "Elektra cannot use boost cards placed on her by Venom", the same ruling, (C)) is not marked: the
 * held mark comes only with the give (`giveBoostCard.forBasicPower`, and the villainous keyword's own give), never from
 * the use ending.
 */
function finishUse(ctx: Ctx, record: Frame<"characterBoost">): void {
  popFrame(ctx);
  const holder = getInstance(ctx.state, record.characterInstanceId);
  for (const id of [...(holder?.boostCards ?? [])]) {
    if (record.heldBefore.includes(id)) continue;
    const card = getInstance(ctx.state, id);
    if (card && !card.faceup) continue;
    const zone = locateCard(ctx.state, id);
    if (zone?.kind !== "boost" || zone.hostInstanceId !== record.characterInstanceId) continue;
    moveCard(ctx, id, discardZoneFor(ctx.state, id), "top");
  }
}
