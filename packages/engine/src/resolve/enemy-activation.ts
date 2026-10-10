/** Enemy attack and scheme procedures: boost cards, defenders, damage and threat. */

import { displayNameOf } from "../visibility.js";
import { type AbilityDefinition, DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import {
  announceResourcesSpent,
  isPriceFault,
  joinSpent,
  NOTHING_SPENT,
  paymentOptions,
  paymentsFromOptionIds,
  payPayment,
  priceOf,
  type SpentPayment,
} from "../actions.js";
import {
  type Ctx,
  emit,
  moveCard,
  popFrame,
  pushFrames,
  requestChoice,
  setFrame,
  updateFrame,
  updateInstance,
} from "../ctx.js";
import { activationVarsOf, plannedAttackDamage } from "../defend-preview.js";
import { currentEnemyAttackFrame, defenseBarFor } from "../defense-claim.js";
import { drawEncounterCard, exhaustCard } from "../effects.js";
import { type FrameId, type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { attackKeywordsOf, hasKeyword } from "../keywords.js";
import { amplifyIconsInPlay, boostIconsFor } from "../modifiers.js";
import {
  cardOf,
  characterProfile,
  discardZoneFor,
  getInstance,
  locateCard,
  mustInstance,
  mustPlayer,
  playerOrder,
  areaOfCard,
  mainSchemeFor,
} from "../query.js";
import { canPaySpend } from "../payable.js";
import { satisfies } from "../resources.js";
import {
  additionalPowerCostFor,
  attacksDealIndirectDamage,
  attacksDividedEvenly,
  boostIgnored,
  mustDefendWithAlly,
  schemeActivationDestination,
  cannotDefend,
  defendsWithoutExhausting,
} from "../rules.js";
import { cardsInPlay, controllerOf, DEFENDER_SLOT, evaluate, isAlly } from "../select.js";
import { currentActivationFrameId, type Vars } from "../stack.js";
import type { BoostGiven, GameState, ZoneId } from "../state.js";
import { type SchemeThreatDivert, TOTAL_ATK_RESULT, type TriggerEvent } from "../trigger-events.js";
import {
  addFrameSlots,
  addFrameVars,
  announce,
  base,
  type Frame,
  gameAbilityFrames,
  pushEffects,
  pushEvent,
  pushEvents,
} from "./frames.js";
import { heard } from "./triggers.js";

/**
 * RRG 1.8 "Villainous" (p. 47): a minion with the keyword is given a boost card when it activates. The keyword is read
 * the way the rest of the engine reads keywords (`hasKeyword`): a gained Villainous counts, since a card "functions as
 * if it possesses the gained characteristic" (RRG 1.8 "Gains", p. 21; Solus, `spiderham` 30037), and a printed one on a
 * blanked text box does not (RRG 1.8 "Blank", p. 10).
 */
const getsBoostCard = (state: GameState, deps: EngineDeps, enemyId: InstanceId): boolean => {
  const card = cardOf(state, enemyId);
  if (!card) return false;
  if (card.type === "villain") return true;
  if (card.type === "minion") return hasKeyword(state, enemyId, "villainous", deps);
  return false;
};

/**
 * Whether an initiated activation by an enemy whose ATK (attack) or SCH (scheme) is printed "—" does nothing.
 *
 * The engine's reading of docs/phase7-wave1.md §4.4, kept in this one function so it is easy to change. RRG 1.8
 * "Dash (Value)" (p. 15): the character "cannot exhaust to use that power", and a referenced dash "is treated as an
 * unmodifiable 0". Nothing says whether such an enemy still attacks for 0 plus boost icons. Core's decision for "—"
 * minions was to skip the activation, and that is kept: the activation is initiated (so "would attack … instead"
 * replacements such as Norman Osborn's can fire in its interrupt window) and, if nothing replaced it, it is skipped
 * when it applies, before any boost card is dealt. An attack already in progress when the villain flips to a dashed
 * face is not affected: it carries on for 0 plus boost icons (FAQ "Green Goblin (#1B)", p. 59).
 */
export const dashedStatSkipsActivation = (
  state: GameState,
  deps: EngineDeps,
  enemyId: InstanceId,
  activation: "attack" | "scheme",
): boolean =>
  characterProfile(state, enemyId, deps)?.missing.includes(activation === "attack" ? "atk" : "sch") ?? false;

/**
 * Puts one facedown boost card from the active encounter deck on `enemyId`, whoever it is.
 *
 * `outsideActivation` marks a card ability's doing ("give the villain 1 facedown boost card", Hired Gun/Intimidation,
 * `gob` pack) rather than the activation procedure's. RRG 1.8 "Boost, Boost Icon" (p. 11): "If an enemy is dealt a
 * boost card outside of its own activation, that boost card remains facedown on that enemy until that enemy
 * activates", and "If that enemy is a villain or a minion with the villainous keyword, it still gets dealt another
 * boost card at the start of its activation as normal" — so nothing else is needed: the card simply waits in
 * `boostCards`, ahead of the automatic one, and `stepBoostCard` flips them in the order dealt.
 *
 * A card ability naming an enemy is the authority on who gets one (RRG 1.8 "The Golden Rules", p. 4), so this is
 * deliberately *not* gated on `getsBoostCard`, which is about the automatic boost card only.
 */
export function dealBoostCard(ctx: Ctx, enemyId: InstanceId, outsideActivation = false): void {
  const id = drawEncounterCard(ctx);
  if (!id) return;
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
  moveCard(ctx, id, { kind: "boost", hostInstanceId: enemyId });
  emit(ctx, {
    type: "boostCardDealt",
    enemyInstanceId: enemyId,
    instanceId: id,
    ...(outsideActivation ? { outsideActivation: true } : {}),
  });
  recordBoostGiven(ctx, enemyId, id);
}

const LISTENS_FOR_BOOST_GIVEN = new WeakMap<EngineDeps, boolean>();

/**
 * Whether any ability in the registry triggers on `boostCardGiven` (docs/phase7-wave9.md §3.44); cached per registry.
 * A boost card is given in every villain phase, so nothing is recorded or announced, and the give-boost step is taken
 * in one go as it always was, for a registry with no such ability: its games keep their state and their log.
 */
export function listensForBoostGiven(deps: EngineDeps): boolean {
  const cached = LISTENS_FOR_BOOST_GIVEN.get(deps);
  if (cached !== undefined) return cached;
  const listens = Object.values(deps.abilities).some((definition) => {
    const trigger = definition.trigger;
    if (!("on" in trigger) || !trigger.on) return false;
    const kinds = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    return kinds.includes("boostCardGiven");
  });
  LISTENS_FOR_BOOST_GIVEN.set(deps, listens);
  return listens;
}

/**
 * The one place a facedown boost card given to a card is recorded for its `boostCardGiven` announcement
 * (docs/phase7-wave9.md §3.44; `GameState.pendingBoostGiven`, announced between frames by `announceBoostCardsGiven`).
 * Called by both ways a boost card is given, `dealBoostCard` (the activation's own cards and a card ability's, off the
 * deck) and `dealChosenBoostCard` (a named card). The activation read is the innermost one of `enemyId` in progress:
 * the procedure giving its own card, or the one a card ability gives a card during; a card given to an enemy that is
 * not activating has none. Nothing is recorded in a game with no ability that hears one.
 */
function recordBoostGiven(ctx: Ctx, enemyId: InstanceId, boostId: InstanceId): void {
  if (!listensForBoostGiven(ctx.deps)) return;
  const procedure = ctx.state.stack.find(
    (f): f is Frame<"enemyAttack"> | Frame<"enemyScheme"> =>
      (f.kind === "enemyAttack" || f.kind === "enemyScheme") && f.enemyInstanceId === enemyId && f.stage !== "done",
  );
  const given: BoostGiven = {
    enemyInstanceId: enemyId,
    boostInstanceId: boostId,
    activation: procedure ? (procedure.kind === "enemyAttack" ? "attack" : "scheme") : null,
    playerId: procedure ? (procedure.kind === "enemyAttack" ? procedure.attackedPlayerId : procedure.playerId) : null,
  };
  ctx.state = { ...ctx.state, pendingBoostGiven: [...(ctx.state.pendingBoostGiven ?? []), given] };
}

/**
 * Announces each facedown boost card given since the last look (`TriggerEvent boostCardGiven`, recorded by
 * `recordBoostGiven`; docs/phase7-wave9.md §3.44), when an ability hears it, and empties the list. Each card is an
 * occurrence of its own, so each has its own response window, the first given resolving first: a response to one may
 * be used again for the next ("each … ability can only be triggered once per occurrence of its triggering
 * condition", RRG 1.8 "Triggering Condition", p. 45). A card that is no longer a facedown boost card on that enemy by
 * now is not announced. The flow looks here between frames. Returns true when it pushed a frame.
 */
export function announceBoostCardsGiven(ctx: Ctx): boolean {
  const pending = ctx.state.pendingBoostGiven;
  if (!pending || pending.length === 0) return false;
  const { pendingBoostGiven: _, ...rest } = ctx.state;
  ctx.state = rest;
  const events = pending
    .filter((given) => {
      const holder = getInstance(ctx.state, given.enemyInstanceId);
      return (
        holder?.boostCards.includes(given.boostInstanceId) && !getInstance(ctx.state, given.boostInstanceId)?.faceup
      );
    })
    .map((given): TriggerEvent => ({ kind: "boostCardGiven", ...given }))
    .filter((event) => heard(ctx.state, ctx.deps, event));
  if (events.length === 0) return false;
  pushEvents(ctx, events);
  return true;
}

/**
 * The give-boost step of an activation (RRG 1.8 "Attack (Enemy Activation)" step 1, p. 8; "Scheme (Enemy Activation)"
 * step 1): the activation's own boost card and each additional one (`extraBoost`). Returns true once the step is over
 * and the procedure moves to `next`.
 *
 * In a game where an ability hears a boost card being given (`listensForBoostGiven`, docs/phase7-wave9.md §3.44) the
 * cards are given one at a time, the frame staying on this step (`boostsGiven`) while each one's response window
 * resolves, so a card a response put on top of the deck is the next one given. In every other game they are given in
 * one go, as before those events existed.
 */
function giveBoostStep(
  ctx: Ctx,
  frame: Frame<"enemyAttack"> | Frame<"enemyScheme">,
  next: "declareDefender" | "flipBoosts",
  activation: "attack" | "scheme",
): void {
  const { boostsGiven: given = 0, ...rest } = frame;
  const advance = () => setFrame(ctx, { ...rest, stage: next } as typeof frame);
  // "That attack does not get a boost card": no boost card at all, additional ones included.
  if (frame.noBoost || boostWithheld(ctx, frame, activation)) return advance();
  const total = 1 + (activationVars(ctx, frame.eventFrameId).extraBoost ?? 0);
  if (!listensForBoostGiven(ctx.deps)) {
    advance();
    for (let i = 0; i < total; i++) giveBoostCard(ctx, frame.enemyInstanceId);
    return;
  }
  if (given >= total) return advance();
  setFrame(ctx, { ...frame, boostsGiven: given + 1 });
  giveBoostCard(ctx, frame.enemyInstanceId);
}

/**
 * Out-of-play zones a chosen card can be given from as a boost card (`giveBoostCard.card`, docs/phase7-wave6.md §3.16).
 * Not the removed-from-game area (ruling December 17, 2025 (4): such a card "cannot be returned to the game by any
 * means"), the victory display, a card tucked under another, nor one mid-resolution. A card mid-reveal is in none of
 * these zones and is allowed on its own terms (`beingRevealed`).
 */
export const BOOST_SOURCE_ZONES: ReadonlySet<ZoneId["kind"]> = new Set<ZoneId["kind"]>([
  "hand",
  "deck",
  "discard",
  "setAside",
  "encounterDeck",
  "encounterDiscard",
  "encounterSetAside",
  "separateDeck",
  "separateDiscard",
  "scenarioDeck",
  "scenarioDiscard",
  "scenarioArea",
]);

/**
 * Whether `id` is a card whose reveal is in progress and that is still in front of the player it was dealt to (zone
 * `dealtEncounter`; RRG 1.8 "Reveal", p. 37): the one card outside `BOOST_SOURCE_ZONES` that `giveBoostCard.card` may
 * give, for "When Revealed: … Give this card to that villain as a facedown boost card" (docs/phase7-wave8.md §3.79).
 * A card being resolved for any other reason (a played event, an obligation) is not.
 */
export function beingRevealed(state: GameState, id: InstanceId): boolean {
  if (locateCard(state, id)?.kind !== "dealtEncounter") return false;
  return state.stack.some((frame) => frame.kind === "reveal" && frame.instanceId === id);
}

/**
 * "Take the topmost [Magnetic] card in the encounter discard pile and give it to Magneto as a facedown boost card"
 * (Master of Magnetism 32151; docs/phase7-wave6.md §3.16): `cardId` itself, not the encounter deck's top, goes
 * facedown onto `holderId` as a boost card dealt outside its activation (RRG 1.8 "Boost, Boost Icon", p. 11). From
 * there it is any other waiting boost card: flipped in the enemy's next activation, then discarded to its own discard
 * pile (`discardZoneFor`). The caller checks the card is out of play.
 */
export function dealChosenBoostCard(ctx: Ctx, holderId: InstanceId, cardId: InstanceId): void {
  updateInstance(ctx, cardId, (i) => ({ ...i, faceup: false }));
  moveCard(ctx, cardId, { kind: "boost", hostInstanceId: holderId });
  emit(ctx, { type: "boostCardDealt", enemyInstanceId: holderId, instanceId: cardId, outsideActivation: true });
  recordBoostGiven(ctx, holderId, cardId);
}

/** The activation procedure's own boost card: only a villain or a villainous minion is dealt one (p. 11). */
export function giveBoostCard(ctx: Ctx, enemyId: InstanceId): void {
  if (!getsBoostCard(ctx.state, ctx.deps, enemyId)) return;
  dealBoostCard(ctx, enemyId);
}

/**
 * RRG 1.8 "Attack (Enemy Activation)" step 3 / "Scheme (Enemy Activation)" step 2, and "Boost" (p. 11): one boost card
 * at a time, in the order dealt. Each is turned faceup; a `boostCardTurnedFaceup` event gives "When/After a boost card
 * is turned faceup" abilities their windows; its "Boost" ability resolves ("when the card is turned face up"), unless
 * cancelled; its icons are added, unless cancelled; then "After applying a boost card to an activation, discard it."
 *
 * Under an `ignoreBoost` rule (docs/phase7-wave7.md §3.67; RRG 1.8 "Ignore", p. 23) the card goes through the same
 * steps, turned faceup and discarded, but its icons count 0 and its "Boost" ability is not resolved. Neither is
 * canceled. The rule is read at the flip and again at each later step, so one that begins while the card is faceup
 * covers what is left of it.
 *
 * Called repeatedly while the procedure sits on `flipBoosts`. Returns `"busy"` while a card is resolving, the icons to
 * add once one finishes, or `null` when none is left.
 */
function stepBoostCard(
  ctx: Ctx,
  frame: Frame<"enemyAttack"> | Frame<"enemyScheme">,
  playerId: PlayerId,
  activation: "attack" | "scheme",
): number | null | "busy" {
  const turned = frame.boost ?? null;
  if (!turned) {
    // The first boost card still *facedown*, not simply the first one dealt. A boost card stays in `boostCards`,
    // faceup, until its own ability and icon count are done — and a Boost ability can start a whole activation of
    // its own ("That villain schemes.", The Wrecking Crew's I've Been Waiting For This!). When that nested activation
    // is by the same enemy, its flip step used to find the outer activation's faceup card first and turn it "up"
    // again, ability and all, which nested another scheme, which flipped it again — until `runFlow`'s step cap
    // rejected the whole command (2026-09-21: a two-hero Breakout froze mid villain phase in 10 of 60 seeds).
    const boostId = mustInstance(ctx.state, frame.enemyInstanceId).boostCards.find(
      (id) => !mustInstance(ctx.state, id).faceup,
    );
    if (!boostId) return null;
    updateInstance(ctx, boostId, (i) => ({ ...i, faceup: true }));
    // "When a boost card is turned faceup during an enemy activation, add one additional boost icon to that card for
    // each amplify icon in play" (RRG 1.8 "Amplify Icon", p. 7; docs/phase7-wave3.md §3.6).
    // An ignored card has no boost icon to count, printed or gained (an amplify icon's "Each boost card gains
    // [boost]" gives it a boost icon like any other), so the windows that follow see 0.
    const ignored = boostIgnored(ctx.state, ctx.deps, frame.enemyInstanceId, frame.eventFrameId);
    const icons = ignored
      ? 0
      : boostIconsFor(ctx.state, ctx.deps, boostId, playerId) +
        amplifyIconsInPlay(ctx.state, ctx.deps) +
        boostIconsEachOf(ctx, frame);
    emit(ctx, {
      type: "boostCardFlipped",
      enemyInstanceId: frame.enemyInstanceId,
      instanceId: boostId,
      boostIcons: icons,
    });
    if (ignored) emit(ctx, { type: "boostIgnored", enemyInstanceId: frame.enemyInstanceId, instanceId: boostId });
    setFrame(ctx, {
      ...frame,
      boost: {
        instanceId: boostId,
        step: "window",
        iconsCancelled: false,
        abilityCancelled: false,
        ...(ignored ? { ignored: true as const } : {}),
      },
    });
    pushEvent(ctx, {
      kind: "boostCardTurnedFaceup",
      enemyInstanceId: frame.enemyInstanceId,
      boostInstanceId: boostId,
      activation,
      boostIcons: icons,
      playerId,
    });
    return "busy";
  }
  let boost = turned;
  if (
    !boost.ignored &&
    boost.step !== "resolved" &&
    boostIgnored(ctx.state, ctx.deps, frame.enemyInstanceId, frame.eventFrameId)
  ) {
    boost = { ...boost, ignored: true };
    emit(ctx, { type: "boostIgnored", enemyInstanceId: frame.enemyInstanceId, instanceId: boost.instanceId });
  }
  if (boost.step === "resolved") {
    // After the `boostCardResolved` responses (docs/phase7-wave5.md §3.5): discarded unless one moved it.
    if (locateCard(ctx.state, boost.instanceId)?.kind === "boost")
      moveCard(ctx, boost.instanceId, discardZoneFor(ctx.state, boost.instanceId), "top");
    setFrame(ctx, { ...frame, boost: null });
    return boost.icons ?? 0;
  }
  if (boost.step === "window") {
    setFrame(ctx, { ...frame, boost: { ...boost, step: "ability" } });
    if (boost.abilityCancelled) emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "ability" });
    else if (!boost.ignored)
      pushFrames(ctx, gameAbilityFrames(ctx, boost.instanceId, ["boost"], null, undefined, playerId));
    return "busy";
  }
  if (boost.step === "ability") {
    // The icons are about to be counted: a window only when something could react (docs/phase7-wave2.md §3.6).
    setFrame(ctx, { ...frame, boost: { ...boost, step: "count" } });
    const counting: TriggerEvent = {
      kind: "boostIconsCounting",
      enemyInstanceId: frame.enemyInstanceId,
      cardInstanceId: boost.instanceId,
      playerId,
    };
    if (!boost.iconsCancelled && !boost.ignored && heard(ctx.state, ctx.deps, counting)) {
      pushEvent(ctx, counting);
      return "busy";
    }
  }
  // Amplify is read again at the count, not carried from the flip: "Each amplify icon is equivalent to the following
  // constant ability: 'Each boost card gains [boost]'" (RRG 1.8 p. 7), and a constant applies while its card is in play
  // (the Fearless Determination ruling, Jan 11, 2026 (1): its amplify icon "remains in effect" until it leaves play).
  const counted =
    boostIconsFor(ctx.state, ctx.deps, boost.countFrom ?? boost.instanceId, playerId) +
    amplifyIconsInPlay(ctx.state, ctx.deps) +
    boostIconsEachOf(ctx, frame) +
    (boost.countAdjust ?? 0);
  const icons = boost.iconsCancelled || boost.ignored ? 0 : Math.max(0, counted);
  // "After you resolve a boost card during Mysterio's activation, place that card in your discard pile" (§3.5 of wave
  // 5): a response window between the count and the discard, only when an ability listens.
  const resolved: TriggerEvent = {
    kind: "boostCardResolved",
    enemyInstanceId: frame.enemyInstanceId,
    boostInstanceId: boost.instanceId,
    playerId,
  };
  if (locateCard(ctx.state, boost.instanceId)?.kind === "boost" && heard(ctx.state, ctx.deps, resolved)) {
    setFrame(ctx, { ...frame, boost: { ...boost, step: "resolved", icons } });
    pushEvent(ctx, resolved);
    return "busy";
  }
  // Discarded to its home deck's discard (docs/phase7-wave1.md §4.3, proposed), unless its own Boost ability already
  // moved it ("Put Goblin Thrall into play engaged with you").
  if (locateCard(ctx.state, boost.instanceId)?.kind === "boost")
    moveCard(ctx, boost.instanceId, discardZoneFor(ctx.state, boost.instanceId), "top");
  setFrame(ctx, { ...frame, boost: null });
  return icons;
}

/**
 * "Each boost card turned faceup during that activation gets +N boost icons" (`enemyAttack`/`enemyScheme`/`modifyAttack`
 * `boostIconsEach`, docs/phase7-wave5.md §4.1 Q66): read off this activation's own event frame, so it covers exactly
 * the boost cards this activation turns faceup (RRG 1.8 "Boost, Boost Icon", p. 11) and ends with it.
 */
const boostIconsEachOf = (ctx: Ctx, frame: Frame<"enemyAttack"> | Frame<"enemyScheme">): number =>
  activationVarsOf(ctx.state, frame.eventFrameId).boostIconsEach ?? 0;

/** An activation's recorded modifications ("gains overkill", "+N ATK", extra boost cards). */
const activationVars = (ctx: Ctx, eventFrameId: FrameId | null): Vars => activationVarsOf(ctx.state, eventFrameId);

/** A named slot on the activation's own event frame (`modifyAttack`'s `threatRemover`, `damageTo`). */
const activationSlot = (ctx: Ctx, eventFrameId: FrameId | null, name: string): readonly InstanceId[] => {
  const frame = eventFrameId ? ctx.state.stack.find((f) => f.frameId === eventFrameId) : undefined;
  return frame?.kind === "event" ? (frame.slots[name] ?? []) : [];
};

/**
 * "Do not give X a boost card for this activation" (`modifyAttack.noBoost`, docs/phase7-wave6.md §3.15), set by an
 * interrupt to the activation in progress: its `giveBoost` step deals nothing, the automatic card and every
 * `extraBoost` alike. Logged as `boostWithheld` so the log (and the villain-phase audit) can tell a withheld boost
 * card from a missing one. Cards already on the enemy from outside the activation still flip (RRG 1.8 "Boost", p. 11).
 */
function boostWithheld(
  ctx: Ctx,
  frame: Frame<"enemyAttack"> | Frame<"enemyScheme">,
  activation: "attack" | "scheme",
): boolean {
  if ((activationVars(ctx, frame.eventFrameId).noBoost ?? 0) <= 0) return false;
  emit(ctx, { type: "boostWithheld", enemyInstanceId: frame.enemyInstanceId, activation });
  return true;
}

/**
 * `modifyAttack.removesThreatFrom` as the attack's damage step reads it: the scheme the attack removes threat from
 * instead of dealing damage, whose removal it is and, for a "(thwart)" ability, the thwarting identity. A main scheme
 * stage replaced since the interrupt (a boost ability's threat completed it) hands the removal to the main scheme now
 * in the attacker's area: the card says "the main scheme", which is whichever stage is in play as the threat comes off.
 * Any other scheme that left play keeps its record, and the removal finds nothing to remove.
 */
function threatInsteadOfDamage(
  ctx: Ctx,
  frame: Frame<"enemyAttack">,
): {
  readonly schemeInstanceId: InstanceId;
  readonly removerInstanceId: InstanceId | null;
  readonly thwarterInstanceId: InstanceId | null;
} | null {
  const [recorded] = activationSlot(ctx, frame.eventFrameId, "removesThreatFrom");
  if (!recorded) return null;
  const replacedStage =
    cardOf(ctx.state, recorded)?.type === "main_scheme" && !cardsInPlay(ctx.state).includes(recorded);
  const current = replacedStage
    ? (mainSchemeFor(ctx.state, areaOfCard(ctx.state, frame.enemyInstanceId))?.instanceId ??
      ctx.state.mainScheme.instanceId)
    : recorded;
  return {
    schemeInstanceId: current,
    removerInstanceId: activationSlot(ctx, frame.eventFrameId, "threatInsteadRemover")[0] ?? null,
    thwarterInstanceId: activationSlot(ctx, frame.eventFrameId, "threatInsteadThwarter")[0] ?? null,
  };
}

/**
 * Records a defender on the attack procedure and its event, and announces the defense.
 *
 * An attack declined at step 2 is recorded as undefended, which is what a boost card turned up in step 3 reads. A
 * "(defense)" ability used after that still makes the hero the defender (RRG 1.8 "Defend, Defense", p. 15), so the
 * record is withdrawn here: an "undefended attack" reader after this point sees a defended attack. `basic` alone
 * decides whether DEF is subtracted; a labeled defense passes false and never undoes the declined step into one.
 */
export function setDefender(
  ctx: Ctx,
  frame: Frame<"enemyAttack">,
  defenderId: InstanceId,
  defenderPlayer: PlayerId,
  basic: boolean,
): void {
  setFrame(ctx, {
    ...frame,
    defenderInstanceId: defenderId,
    targetInstanceId: defenderId,
    targetPlayerId: defenderPlayer,
    basicDefense: basic,
  });
  if (frame.eventFrameId) {
    updateFrame(ctx, frame.eventFrameId, (f) =>
      f.kind === "event" && f.event.kind === "enemyAttack"
        ? {
            ...f,
            event: { ...f.event, targetInstanceId: defenderId, targetPlayerId: defenderPlayer },
            ...((f.vars.undefended ?? 0) > 0 ? { vars: { ...f.vars, undefended: 0 } } : {}),
          }
        : f,
    );
    addFrameSlots(ctx, frame.eventFrameId, { [DEFENDER_SLOT]: [defenderId] });
  }
  announce(ctx, {
    kind: "defended",
    defenderInstanceId: defenderId,
    enemyInstanceId: frame.enemyInstanceId,
    playerId: defenderPlayer,
    basic,
  });
}

/**
 * A character is making a basic defense: declared at the Declare Defender step, or declared the defender by a card
 * ability (`declareDefenderByEffect`; docs/phase7-wave8.md §4.1 Q55, RRG 1.8 "Defend, Defense", p. 15: "When a card
 * ability says to 'declare [a hero] the defender' of an attack, that hero is considered to be making a basic
 * defense"). Each caller announces it once per defense. Resolving a "(defense)"-labeled ability is not one (p. 16:
 * "Resolving a defense-labeled ability is not a basic defense"), so the label alone never reaches here.
 */
function announceBasicDefense(ctx: Ctx, defenderId: InstanceId, defenderPlayer: PlayerId): void {
  // "After you use a basic power" (docs/phase7-wave2.md §3.11): defending is the basic defense power.
  const used: TriggerEvent = {
    kind: "basicPowerUsed",
    characterInstanceId: defenderId,
    power: "defense",
    stat: "def",
    playerId: defenderPlayer,
  };
  if (heard(ctx.state, ctx.deps, used)) announce(ctx, used);
  // "When you use one of your hero's basic powers … DEF" (§17.4), pushed second so it resolves first — before
  // the attack's own damage step reads the defender's DEF (RRG 1.8 "Attack (Enemy Activation)" step 4, p. 9).
  const using: TriggerEvent = {
    kind: "basicPowerUsing",
    characterInstanceId: defenderId,
    power: "defense",
    stat: "def",
    playerId: defenderPlayer,
  };
  if (heard(ctx.state, ctx.deps, using)) announce(ctx, using);
}

/**
 * Records that `playerId` resolved a "(defense)"-labeled ability during the enemy attack in progress, if they are the
 * first to: the record other players' defense abilities are barred by (`defenseBarFor`). Nothing outside an attack.
 */
export function recordDefenseLabel(ctx: Ctx, playerId: PlayerId): void {
  const attack = currentEnemyAttackFrame(ctx.state);
  if (!attack || attack.defenseLabeledBy !== undefined) return;
  setFrame(ctx, { ...attack, defenseLabeledBy: playerId });
}

/** RRG "Defend, Defense": a (defense) ability makes the identity the defender if the current attack has none. */
export function declareLabeledDefense(ctx: Ctx, playerId: PlayerId): void {
  const identity = mustPlayer(ctx.state, playerId).identity.instanceId;
  const attack = ctx.state.stack.find((f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack");
  // A character that cannot defend is not made the defender by a "(defense)" ability either (§3.31 of wave 4).
  const attackerOf = attack?.enemyInstanceId ?? null;
  if (cannotDefend(ctx.state, ctx.deps, identity, attackerOf)) return;
  if (attack) {
    if (attack.defenderInstanceId === null) setDefender(ctx, attack, identity, playerId, false);
    return;
  }
  // Interrupting the attack itself ("When the villain attacks you"): the procedure
  // hasn't started, so record the defender on the attack event.
  const activation = currentActivationFrameId(ctx.state.stack);
  const frame = activation ? ctx.state.stack.find((f) => f.frameId === activation) : undefined;
  if (frame?.kind !== "event" || frame.event.kind !== "enemyAttack" || (frame.vars.labeledDefense ?? 0) > 0) return;
  // "…if there is not already a defender" (p. 14): one an effect declared while the attack was being initiated, this
  // hero included, stays the defender, and the label announces no second defense.
  if ((frame.slots[DEFENDER_SLOT] ?? []).length > 0) return;
  const enemyInstanceId = frame.event.enemyInstanceId;
  setFrame(ctx, {
    ...frame,
    event: { ...frame.event, targetInstanceId: identity, targetPlayerId: playerId },
    vars: { ...frame.vars, labeledDefense: 1 },
    slots: { ...frame.slots, [DEFENDER_SLOT]: [identity] },
  });
  announce(ctx, { kind: "defended", defenderInstanceId: identity, enemyInstanceId, playerId, basic: false });
}

/** The activation slot naming the hero whose "(defense)" ability declared another character the defender. */
const LABELED_DEFENSE_HERO_SLOT = "labeledDefenseHero";

/** Whether a "(defense)" ability's own effects declare the defender, so its label does not declare the hero up front. */
export const declaresDefender = (definition: AbilityDefinition): boolean =>
  definition.effects.some((effect) => effect.kind === "declareDefender");

/**
 * `EffectSpec declareDefender` from a "(defense)"-labeled ability (`labeledFor`: the player whose ability it is). RRG 1.8
 * FAQ "Mutant Protectors (#17)" (p. 63): "that player becomes the target of the enemy attack and the X-Men ally put
 * into play becomes the defender", so the ally alone is announced as defending, and "If the defending ally leaves play
 * before damage is dealt for the attack, the player's hero becomes the defender" (`defenderLeftPlay` reads the slot
 * recorded here). When the effect names the hero itself (Shieldmaiden), or finds no character to declare, the label
 * makes the hero the defender as it would have when the ability was initiated.
 */
export function declareDefenderByLabeledEffect(
  ctx: Ctx,
  defenderId: InstanceId | null,
  exhaust: boolean,
  labeledFor: PlayerId | null,
): void {
  const hero = labeledFor ? mustPlayer(ctx.state, labeledFor).identity.instanceId : null;
  if (labeledFor && (defenderId === null || defenderId === hero)) declareLabeledDefense(ctx, labeledFor);
  if (defenderId === null) return;
  declareDefenderByEffect(ctx, defenderId, exhaust);
  if (hero === null || defenderId === hero) return;
  const attack = ctx.state.stack.find((f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack");
  addFrameSlots(ctx, attack?.eventFrameId ?? currentActivationFrameId(ctx.state.stack), {
    [LABELED_DEFENSE_HERO_SLOT]: [hero],
  });
}

/**
 * "Declare Valkyrie the defender without exhausting her" (Shieldmaiden, 25011) / "declare him the defender without
 * exhausting him" (Colossus, Bamf!) / "Exhaust it and declare it the defender" (Mutant Protectors): `EffectSpec
 * declareDefender` (docs/phase7-wave4.md §3.22). RRG 1.8 "Defend, Defense" (p. 15): "When a card ability says to
 * 'declare [a hero] the defender' of an attack, that hero is considered to be making a basic defense" (so the hero's DEF
 * reduces the damage), "When a card ability says to 'declare [an ally] the defender' of an attack, that ally becomes
 * the defender", and a defense-labeled ability's hero "can still be declared the defender … by another card ability".
 *
 * Works on the innermost enemy attack: its procedure once it runs, or its event while the attack is being initiated
 * ("When the enemy … attacks"), where `pushEnemyAttackFrame` picks the declaration up. Re-declaring the character that
 * already defends (a "(defense)" ability's hero) only makes the defense basic; it is not a second defense.
 */
export function declareDefenderByEffect(ctx: Ctx, defenderId: InstanceId, exhaust: boolean): void {
  const defenderPlayer = controllerOf(ctx.state, defenderId);
  if (!defenderPlayer) return;
  // "While a player is defending, other players cannot defend against that same attack" (p. 14): no character of
  // another player's is declared, and it is not exhausted for a declaration that does not happen.
  if (defenseBarFor(ctx.state, defenderPlayer) !== null) return;
  const basic = cardOf(ctx.state, defenderId)?.type === "hero_identity";
  if (exhaust) exhaustCard(ctx, defenderId);
  const procedure = ctx.state.stack.find((f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack");
  // The log's `defenderDeclared`, as the Declare Defender step logs its own (RRG 1.8 "Defend, Defense", p. 15: an
  // ability's declaration makes the character the defender just as the step's does), marked `byEffect`.
  const logDeclared = (enemyInstanceId: InstanceId): void =>
    emit(ctx, {
      type: "defenderDeclared",
      attackInstanceId: enemyInstanceId,
      defenderInstanceId: defenderId,
      playerId: defenderPlayer,
      byEffect: true,
    });
  if (procedure) {
    // The character already making this basic defense (declared at the step, or by an earlier ability) is not making
    // a second one.
    const alreadyBasic = procedure.defenderInstanceId === defenderId && procedure.basicDefense;
    if (procedure.defenderInstanceId === defenderId) setFrame(ctx, { ...procedure, basicDefense: basic });
    else {
      logDeclared(procedure.enemyInstanceId);
      setDefender(ctx, procedure, defenderId, defenderPlayer, basic);
    }
    if (!alreadyBasic && (basic || procedure.defenderInstanceId !== defenderId)) {
      announceBasicDefense(ctx, defenderId, defenderPlayer);
    }
    return;
  }
  const activation = currentActivationFrameId(ctx.state.stack);
  const frame = activation ? ctx.state.stack.find((f) => f.frameId === activation) : undefined;
  if (frame?.kind !== "event" || frame.event.kind !== "enemyAttack") return;
  const already = (frame.slots[DEFENDER_SLOT] ?? [])[0] === defenderId;
  const alreadyBasic = already && (frame.vars.declaredBasicDefense ?? 0) > 0;
  setFrame(ctx, {
    ...frame,
    event: { ...frame.event, targetInstanceId: defenderId, targetPlayerId: defenderPlayer },
    vars: { ...frame.vars, declaredDefense: 1, declaredBasicDefense: basic ? 1 : 0 },
    slots: { ...frame.slots, [DEFENDER_SLOT]: [defenderId] },
  });
  if (!already) {
    logDeclared(frame.event.enemyInstanceId);
    announce(ctx, {
      kind: "defended",
      defenderInstanceId: defenderId,
      enemyInstanceId: frame.event.enemyInstanceId,
      playerId: defenderPlayer,
      basic,
    });
  }
  if (!alreadyBasic && (basic || !already)) announceBasicDefense(ctx, defenderId, defenderPlayer);
}

export function pushEnemyAttackFrame(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "enemyAttack" }>,
  eventFrameId: FrameId,
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyAttack",
      enemyInstanceId: event.enemyInstanceId,
      attackedPlayerId: event.attackedPlayerId,
      targetPlayerId: event.targetPlayerId,
      targetInstanceId: event.targetInstanceId,
      // A "(defense)" ability used while the attack was initiated already made the identity the defender; a
      // `declareDefender` effect named a defender (a hero's being a basic defense, §3.22).
      defenderInstanceId:
        (activationVars(ctx, eventFrameId).labeledDefense ?? 0) > 0 ||
        (activationVars(ctx, eventFrameId).declaredDefense ?? 0) > 0
          ? event.targetInstanceId
          : null,
      basicDefense: (activationVars(ctx, eventFrameId).declaredBasicDefense ?? 0) > 0,
      boostIcons: 0,
      stage: "giveBoost",
      eventFrameId,
      ...(event.noBoost ? { noBoost: true } : {}),
    },
  ]);
}

/**
 * RRG "Defend": any player may defend with a character they control, and if a
 * player other than the attacked player defends, that player becomes the new
 * target. The attacked player is the one who decides (co-op table convention;
 * the engine gives the decision to a single seat so it stays deterministic).
 */
export function legalDefenders(
  state: GameState,
  attackedPlayerId: PlayerId,
  deps: EngineDeps = DEFAULT_DEPS,
  attackerId: InstanceId | null = null,
): readonly InstanceId[] {
  const defenders: InstanceId[] = [];
  for (const player of playerOrder(state)) {
    // Ready, or under a rule that has it defend without exhausting (`RuleSpec defendsWithoutExhausting`,
    // docs/phase7-wave9.md §3.47; RRG 1.8 "Defend, Defense", p. 15: such an ability "can be used on an exhausted hero").
    const canDeclare = (id: InstanceId, exhausted: boolean): boolean =>
      !exhausted || defendsWithoutExhausting(state, deps, id);
    const identity = getInstance(state, player.identity.instanceId);
    if (identity && player.identity.form === "hero" && canDeclare(identity.instanceId, identity.exhausted)) {
      defenders.push(identity.instanceId);
    }
    for (const id of player.playArea) {
      if (!isAlly(state, id)) continue;
      if (canDeclare(id, mustInstance(state, id).exhausted)) defenders.push(id);
    }
  }
  const attacked = mustPlayer(state, attackedPlayerId);
  const ownFirst = (id: InstanceId): number =>
    id === attacked.identity.instanceId || attacked.playArea.includes(id) ? 0 : 1;
  // "Vision cannot attack or defend." (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31).
  return defenders.filter((id) => !cannotDefend(state, deps, id, attackerId)).sort((a, b) => ownFirst(a) - ownFirst(b));
}

/**
 * `legalDefenders` less the characters of a player the attack in progress is closed to (`defenseBarFor`): once a player
 * has resolved a "(defense)"-labeled ability for it, no other player defends it. The Declare Defender step offers these.
 */
export const declarableDefenders = (
  state: GameState,
  attackedPlayerId: PlayerId,
  deps: EngineDeps = DEFAULT_DEPS,
  attackerId: InstanceId | null = null,
): readonly InstanceId[] =>
  legalDefenders(state, attackedPlayerId, deps, attackerId).filter(
    (id) => defenseBarFor(state, controllerOf(state, id)) === null && defenseCostPayable(state, deps, id),
  );

/**
 * Whether the additional cost to defend with this character (`RuleSpec additionalPowerCost`, docs/phase7-wave9.md
 * §3.31) can be paid by its controller right now; true when there is none. A character whose controller cannot pay is
 * not offered at the Declare Defender step: the cost is paid with the exhaust or the defense is not made (RRG 1.8
 * "Cost", p. 13).
 */
export function defenseCostPayable(state: GameState, deps: EngineDeps, defenderId: InstanceId): boolean {
  const ruled = additionalPowerCostFor(state, deps, defenderId, "defend");
  if (!ruled) return true;
  const payer = controllerOf(state, defenderId);
  return payer !== null && canPaySpend(state, deps, payer, ruled.resources);
}

/**
 * The Declare Defender step's question for a declared defender whose defense has an additional cost
 * (`Frame<"enemyAttack">.defenderCostFor`): its controller is asked for the payment, and the answer is judged here.
 * Returns true once the cost is paid (the caller then declares the defender, and announces `spent` last); false when
 * the step has been handed back (a prompt is open, or the cost went unpaid and the step asks again without the
 * character).
 */
function settleDefenseCost(
  ctx: Ctx,
  frame: Frame<"enemyAttack">,
  defenderId: InstanceId,
  spentOut: SpentPayment[],
): boolean {
  const payer = controllerOf(ctx.state, defenderId);
  const ruled = additionalPowerCostFor(ctx.state, ctx.deps, defenderId, "defend");
  // The rule ended, or the character left play, while the question stood: nothing is owed.
  if (!ruled || payer === null) return true;
  const notPaid = (): false => {
    emit(ctx, {
      type: "additionalPowerCostNotPaid",
      playerId: payer,
      characterInstanceId: defenderId,
      power: "defend",
    });
    const { defenderCostFor: _asked, ...rest } = frame;
    setFrame(ctx, {
      ...rest,
      answer: null,
      defendersNotPaidFor: [...(frame.defendersNotPaidFor ?? []), defenderId],
    });
    return false;
  };
  if (frame.answer === null) {
    const options = paymentOptions(ctx, payer, null);
    if (options.length === 0) return notPaid();
    requestChoice(ctx, {
      playerId: payer,
      prompt: { kind: "spendResources", requirement: ruled.resources },
      options,
      minSelections: 0,
      maxSelections: options.length,
      frameId: frame.frameId,
    });
    return false;
  }
  const payment = paymentsFromOptionIds(frame.answer);
  const pool = priceOf(ctx, payer, payment, null, null);
  if (isPriceFault(pool) || !satisfies(pool, ruled.resources)) return notPaid();
  spentOut.push(payPayment(ctx, payer, payment));
  emit(ctx, {
    type: "additionalPowerCostPaid",
    playerId: payer,
    characterInstanceId: defenderId,
    power: "defend",
    sourceInstanceIds: ruled.sourceInstanceIds,
  });
  return true;
}

/** RRG 1.8 "Activation" (p. 6): an enemy that left play mid-activation ends it; nothing further resolves. */
function endedByLeavingPlay(
  ctx: Ctx,
  frame: Frame<"enemyAttack"> | Frame<"enemyScheme">,
  activation: "attack" | "scheme",
): boolean {
  if (frame.stage === "done" || cardsInPlay(ctx.state).includes(frame.enemyInstanceId)) return false;
  emit(ctx, { type: "activationSkipped", enemyInstanceId: frame.enemyInstanceId, activation, reason: "leftPlay" });
  setFrame(ctx, { ...frame, stage: "done", boost: null });
  return true;
}

/**
 * RRG 1.8 "Attack (Enemy Activation)" step 5 (p. 9): "If the defending ally leaves play prior to damage from the
 * attack being dealt, the attack is considered to have no character defending and the identity of that ally's
 * controller becomes the target of the attack." "Defend, Defense" (p. 16): "if a defending ally is defeated before
 * damage from the attack is dealt (such as through a 'Boost' ability), the attack is considered undefended."
 *
 * The defender's player is already the target player (`setDefender`), so the new target is that player's identity.
 * The `defender` slot on the event keeps its record of the defense, since the character did defend (p. 16: abilities
 * that trigger after a character defends still resolve); `defendingCharacter` filters it out as no longer in play.
 *
 * The exception is an ally a "(defense)" ability declared (`declareDefenderByLabeledEffect`). RRG 1.8 FAQ "Mutant
 * Protectors (#17)" (p. 63): "If the defending ally leaves play before damage is dealt for the attack, the player's
 * hero becomes the defender and can trigger 'after you defend' responses after the attack resolves. (This is not a
 * basic defense, and the villain's attack is not reduced by the hero's DEF.)" The hero's defense is announced, and the
 * damage step waits for it: the result is null until that announcement has resolved.
 */
function defenderLeftPlay(ctx: Ctx, frame: Frame<"enemyAttack">): Frame<"enemyAttack"> | null {
  const defender = frame.defenderInstanceId;
  if (defender === null || cardsInPlay(ctx.state).includes(defender)) return frame;
  const target = mustPlayer(ctx.state, frame.targetPlayerId);
  const identity = target.identity.instanceId;
  const [labeledHero] = activationSlot(ctx, frame.eventFrameId, LABELED_DEFENSE_HERO_SLOT);
  const heroDefends =
    labeledHero === identity &&
    target.identity.form === "hero" &&
    !cannotDefend(ctx.state, ctx.deps, identity, frame.enemyInstanceId);
  emit(ctx, {
    type: "defenderLeftPlay",
    enemyInstanceId: frame.enemyInstanceId,
    defenderInstanceId: defender,
    targetInstanceId: identity,
    ...(heroDefends ? { heroDefends: true as const } : {}),
  });
  if (heroDefends) {
    setDefender(ctx, frame, identity, frame.targetPlayerId, false);
    return null;
  }
  const next: Frame<"enemyAttack"> = {
    ...frame,
    defenderInstanceId: null,
    basicDefense: false,
    targetInstanceId: identity,
  };
  setFrame(ctx, next);
  if (frame.eventFrameId) {
    updateFrame(ctx, frame.eventFrameId, (f) =>
      f.kind === "event" && f.event.kind === "enemyAttack"
        ? { ...f, event: { ...f.event, targetInstanceId: identity } }
        : f,
    );
    addFrameVars(ctx, frame.eventFrameId, { undefended: 1 });
  }
  return next;
}

export function executeEnemyAttackFrame(ctx: Ctx, frame: Frame<"enemyAttack">): void {
  if (endedByLeavingPlay(ctx, frame, "attack")) return;
  switch (frame.stage) {
    case "giveBoost":
      return giveBoostStep(ctx, frame, "declareDefender", "attack");
    case "declareDefender": {
      // A declared defender whose defense has an additional cost (`RuleSpec additionalPowerCost`,
      // docs/phase7-wave9.md §3.31): the cost is settled first, and the declaration below is made only once it is paid,
      // so the resources and the exhaust are paid together or not at all (RRG 1.8 "Cost", p. 13).
      const costFor = frame.defenderCostFor;
      const spent: SpentPayment[] = [];
      if (costFor !== undefined && !settleDefenseCost(ctx, frame, costFor, spent)) return;
      if (costFor !== undefined || frame.answer) {
        const [picked] = costFor !== undefined ? [costFor] : (frame.answer ?? []);
        if (!picked || picked === "decline") {
          emit(ctx, {
            type: "defenseDeclined",
            attackInstanceId: frame.enemyInstanceId,
            playerId: frame.attackedPlayerId,
          });
          setFrame(ctx, { ...frame, answer: null, stage: "flipBoosts" });
          if (frame.defenderInstanceId === null) addFrameVars(ctx, frame.eventFrameId, { undefended: 1 });
          return;
        }
        const defenderId = asInstanceId(picked);
        const defenderPlayer = controllerOf(ctx.state, defenderId) ?? frame.targetPlayerId;
        if (costFor === undefined && additionalPowerCostFor(ctx.state, ctx.deps, defenderId, "defend")) {
          emit(ctx, {
            type: "additionalPowerCostAsked",
            playerId: defenderPlayer,
            characterInstanceId: defenderId,
            power: "defend",
          });
          setFrame(ctx, { ...frame, answer: null, defenderCostFor: defenderId });
          return;
        }
        // "[It] does not exhaust to defend" (`RuleSpec defendsWithoutExhausting`, docs/phase7-wave9.md §3.47): read
        // as it is declared, so a rule that ended earlier in the phase no longer spares it.
        const withoutExhausting = defendsWithoutExhausting(ctx.state, ctx.deps, defenderId);
        emit(ctx, {
          type: "defenderDeclared",
          attackInstanceId: frame.enemyInstanceId,
          defenderInstanceId: defenderId,
          playerId: frame.attackedPlayerId,
          ...(withoutExhausting ? { withoutExhausting: true as const } : {}),
        });
        if (!withoutExhausting) exhaustCard(ctx, defenderId);
        const { defenderCostFor: _asked, defendersNotPaidFor: _notPaid, ...declaring } = frame;
        const next = { ...declaring, answer: null, stage: "flipBoosts" } as const;
        // The hero a "(defense)" ability already made the defender: the basic defense subtracts DEF, and it is the
        // same defense of this attack, announced when the ability made the hero the defender, not a second one
        // (owner ruling 2026-10-06; `declareDefenderByEffect` reads an effect's declaration the same way).
        if (frame.defenderInstanceId === defenderId) setFrame(ctx, { ...next, basicDefense: true });
        else setDefender(ctx, next, defenderId, defenderPlayer, true);
        announceBasicDefense(ctx, defenderId, defenderPlayer);
        // What the additional cost spent is announced on top, so "after you spend this card" resolves first, as a
        // basic power's is (`withSpentAnnounced`, `actions.ts`).
        if (spent.length > 0) {
          announceResourcesSpent(ctx, defenderPlayer, spent.reduce(joinSpent, NOTHING_SPENT), defenderId, "ability");
        }
        return;
      }
      // A defender an effect declared (`declareDefender`, §3.22): an ally, or a hero already making a basic defense,
      // leaves nothing to declare.
      if (
        frame.defenderInstanceId !== null &&
        (frame.basicDefense || cardOf(ctx.state, frame.defenderInstanceId)?.type !== "hero_identity")
      ) {
        setFrame(ctx, { ...frame, stage: "flipBoosts" });
        return;
      }
      // RRG "Defend, Defense": with a "(defense)" defender already set, only that
      // hero may still make a basic defense; nobody else can defend this attack.
      const existing = frame.defenderInstanceId;
      // Less a character whose controller was asked for its additional cost during this step and did not pay it.
      const all = declarableDefenders(ctx.state, frame.attackedPlayerId, ctx.deps, frame.enemyInstanceId).filter(
        (id) => !frame.defendersNotPaidFor?.includes(id),
      );
      // "Must defend with an ally they control, if able" (Melter): only the engaged player's ready allies, no declining.
      const forcedAllies = mustDefendWithAlly(ctx.state, ctx.deps, frame.enemyInstanceId)
        ? all.filter((id) => isAlly(ctx.state, id) && controllerOf(ctx.state, id) === frame.attackedPlayerId)
        : [];
      const defenders = existing ? all.filter((id) => id === existing) : forcedAllies.length > 0 ? forcedAllies : all;
      if (defenders.length === 0) {
        setFrame(ctx, { ...frame, stage: "flipBoosts" });
        if (existing === null) addFrameVars(ctx, frame.eventFrameId, { undefended: 1 });
        return;
      }
      requestChoice(ctx, {
        playerId: frame.attackedPlayerId,
        prompt: {
          kind: "declareDefender",
          attack: {
            enemyInstanceId: frame.enemyInstanceId,
            targetPlayerId: frame.targetPlayerId,
            targetCharacterInstanceId: frame.targetInstanceId,
          },
        },
        options: [
          ...(forcedAllies.length > 0 && !existing
            ? []
            : [{ optionId: "decline", label: "No defense", ref: { kind: "none" } } as const]),
          ...defenders.map((id) => ({
            optionId: id,
            label: displayNameOf(ctx.state, id),
            ref: { kind: "card", instanceId: id } as const,
          })),
        ],
        minSelections: 1,
        maxSelections: 1,
        frameId: frame.frameId,
      });
      return;
    }
    case "flipBoosts": {
      // RRG "Attack (Enemy Activation)" step 3: one boost card at a time, in the order dealt.
      // A boost card's "you" is the defending player (RRG 1.8 "Defend, Defense", p. 16: "Any constant or boost abilities
      // that refer to 'you' refer to the defending player"; owner ruling 2026-10-09, docs/phase7-wave8.md §4.1 row
      // 93). Step 2 declares the defender before step 3 turns the cards up (p. 9), so that is the attack's target
      // player, read afresh for each card: the attacked player until another player's character defends, and still
      // the attacked player when nobody does.
      const icons = stepBoostCard(ctx, frame, frame.targetPlayerId, "attack");
      if (icons === "busy") return;
      if (icons === null) {
        setFrame(ctx, { ...frame, stage: "dealDamage" });
        return;
      }
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "enemyAttack" ? { ...f, boostIcons: f.boostIcons + icons } : f,
      );
      return;
    }
    case "dealDamage": {
      const current = defenderLeftPlay(ctx, frame);
      // The hero took over a labeled defense: its `defended` announcement resolves first, then this step runs again.
      if (current === null) return;
      frame = current;
      setFrame(ctx, { ...frame, stage: "done" });
      // RRG 1.8 step 4 (p. 9). The arithmetic and the two rules around it live in `defend-preview.ts`, so the defend
      // prompt's damage ranges and the damage actually dealt can never drift apart.
      const planned = plannedAttackDamage(ctx.state, ctx.deps, frame, {
        boostIcons: frame.boostIcons,
        defenderInstanceId: frame.defenderInstanceId,
        basicDefense: frame.basicDefense,
      });
      if (!planned) return;
      // "His total ATK for that attack" (docs/phase7-wave8.md §3.81): the enemy's ATK as this attack reads it, "+N ATK
      // for this attack" and the boost icons counted included, before any defense (RRG 1.8 "Attack (Enemy Activation)"
      // step 4, p. 9). The attack event's result `totalAtk`; `damage` is what the attack then dealt.
      addFrameVars(ctx, frame.eventFrameId, { [TOTAL_ATK_RESULT]: planned.baseAtk + frame.boostIcons });
      const vars = activationVars(ctx, frame.eventFrameId);
      addFrameSlots(ctx, frame.eventFrameId, { target: [frame.targetInstanceId] });
      // "Damage from that attack is dealt to the chosen enemy instead of you" (`modifyAttack.damageTo`, Psychic
      // Misdirection; docs/phase7-wave6.md §3.36), recorded by an interrupt to this attack.
      const [damageTo] = activationSlot(ctx, frame.eventFrameId, "damageTo");
      // "That attack removes threat from the main scheme instead of dealing damage" (`modifyAttack.removesThreatFrom`,
      // Determined Defense), recorded by an interrupt to this attack or to a defense against it.
      const threatInstead = threatInsteadOfDamage(ctx, frame);
      if (threatInstead) {
        const { schemeInstanceId, removerInstanceId, thwarterInstanceId } = threatInstead;
        emit(ctx, {
          type: "attackResolved",
          enemyInstanceId: frame.enemyInstanceId,
          targetInstanceId: frame.targetInstanceId,
          baseAtk: planned.baseAtk,
          boostIcons: frame.boostIcons,
          defenseReduction: planned.defenseReduction,
          damageDealt: 0,
          removesThreatFrom: schemeInstanceId,
          threatInstead: planned.damage,
        });
        const thwartingPlayer = thwarterInstanceId ? controllerOf(ctx.state, thwarterInstanceId) : null;
        // No damage is dealt, in whatever form step 5 would have dealt it (to the target, redirected, indirect or
        // divided), so no tough card is used, piercing discards none (RRG 1.8 "Piercing", p. 32) and nothing is excess.
        // The attacked character is still attacked, so it is announced as before (retaliate, "after … attacks you").
        // The removal resolves first, where the damage would have: a "(thwart)" ability's as a thwart by its identity
        // (crisis, patrol and `cannotThwart` are read as it removes), else as the card's own removal (crisis only).
        pushEvents(ctx, [
          thwarterInstanceId && thwartingPlayer
            ? {
                kind: "thwart",
                thwarterInstanceId,
                schemeInstanceId,
                playerId: thwartingPlayer,
                amount: planned.damage,
                basic: false,
                sourceInstanceId: removerInstanceId,
              }
            : {
                kind: "removeThreat",
                schemeInstanceId,
                amount: planned.damage,
                sourceInstanceId: removerInstanceId,
                playerId: removerInstanceId ? controllerOf(ctx.state, removerInstanceId) : null,
                parentFrameId: frame.eventFrameId,
              },
          {
            kind: "characterAttacked",
            attackerInstanceId: frame.enemyInstanceId,
            targetInstanceId: frame.targetInstanceId,
            playerId: frame.attackedPlayerId,
            ...(attackKeywordsOf(ctx.state, ctx.deps, { attackerInstanceId: frame.enemyInstanceId, vars }).includes(
              "ranged",
            )
              ? { ranged: true }
              : {}),
          },
        ]);
        return;
      }
      emit(ctx, {
        type: "attackResolved",
        enemyInstanceId: frame.enemyInstanceId,
        targetInstanceId: frame.targetInstanceId,
        baseAtk: planned.baseAtk,
        boostIcons: frame.boostIcons,
        defenseReduction: planned.defenseReduction,
        damageDealt: planned.damage,
        ...(damageTo ? { damageTo } : {}),
      });
      // "The attack gains piercing/ranged" (Crossfire's boost, Crossfire's Rifle): a `modifyAttack` grant made during
      // this activation, folded in with the enemy's own keywords once and stamped on the events below.
      const keywords = attackKeywordsOf(ctx.state, ctx.deps, { attackerInstanceId: frame.enemyInstanceId, vars });
      // The redirected damage replaces step 5 whatever form it would have taken (indirect, divided). Per §4.1 Q18 it is
      // attack damage from the attacker, so a tough status card on the enemy absorbs it, but that enemy is not
      // attacked (`notAttacked`: no piercing, overkill or prevent budget; no `characterAttacked` for it, so no
      // retaliate). The attacked character is still attacked, so it is announced as before, and takes nothing. If
      // the chosen enemy has left play by now the damage is replaced all the same and dealt to nobody.
      if (damageTo) {
        pushEvents(ctx, [
          {
            kind: "dealDamage",
            targetInstanceId: damageTo,
            amount: planned.damage,
            sourceInstanceId: frame.enemyInstanceId,
            fromAttack: true,
            parentFrameId: frame.eventFrameId,
            notAttacked: true,
          },
          {
            kind: "characterAttacked",
            attackerInstanceId: frame.enemyInstanceId,
            targetInstanceId: frame.targetInstanceId,
            playerId: frame.attackedPlayerId,
            ...(keywords.includes("ranged") ? { ranged: true } : {}),
          },
        ]);
        return;
      }
      // "Starshark's attacks deal indirect damage" (RRG 1.8 "Indirect Damage", p. 24; docs/phase7-wave3.md §3.16): step
      // four deals the attack's damage as indirect damage to the player it targets, who assigns it; only the defender
      // (or the identity) is attacked, so `characterAttacked` still names it and resolves after the damage.
      if (attacksDealIndirectDamage(ctx.state, ctx.deps, frame.enemyInstanceId)) {
        pushEvents(ctx, [
          {
            kind: "characterAttacked",
            attackerInstanceId: frame.enemyInstanceId,
            targetInstanceId: frame.targetInstanceId,
            playerId: frame.attackedPlayerId,
            ...(keywords.includes("ranged") ? { ranged: true } : {}),
          },
        ]);
        pushEffects(ctx, {
          effects: [
            {
              kind: "dealIndirectDamage",
              to: { kind: "id", playerId: frame.targetPlayerId },
              amount: { kind: "const", value: planned.damage },
              fromAttack: true,
            },
          ],
          selfInstanceId: frame.enemyInstanceId,
          controllerId: null,
          eventFrameId: frame.eventFrameId,
        });
        return;
      }
      // "Divide damage from [this enemy]'s attack among each character the attacked player controls as evenly as
      // possible" (`attacksDividedEvenly`, Bombshell `spdr` 31031) replaces step 5: step 4's damage, already reduced by
      // a hero defender's DEF, is split among the target player's identity and allies — who, after another player's
      // defense, is the defending player (RRG 1.8 "Attack (Enemy Activation)", p. 8: "that player becomes the new
      // target"). The card names nobody to place the leftover points, so the first player does (RRG 1.8 "First
      // Player", p. 19: a choice an encounter card requires "but does not specify which player should act").
      if (attacksDividedEvenly(ctx.state, ctx.deps, frame.enemyInstanceId)) {
        pushEvents(ctx, [
          {
            kind: "characterAttacked",
            attackerInstanceId: frame.enemyInstanceId,
            targetInstanceId: frame.targetInstanceId,
            playerId: frame.attackedPlayerId,
            ...(keywords.includes("ranged") ? { ranged: true } : {}),
          },
        ]);
        pushEffects(ctx, {
          effects: [
            {
              kind: "divideDamageEvenly",
              to: { kind: "id", playerId: frame.targetPlayerId },
              amount: { kind: "const", value: planned.damage },
              chooser: { kind: "firstPlayer" },
              fromAttack: true,
              ...(keywords.includes("piercing") ? { piercingFor: frame.targetInstanceId } : {}),
            },
          ],
          selfInstanceId: frame.enemyInstanceId,
          controllerId: null,
          eventFrameId: frame.eventFrameId,
        });
        return;
      }
      pushEvents(ctx, [
        {
          kind: "dealDamage",
          targetInstanceId: frame.targetInstanceId,
          amount: planned.damage,
          sourceInstanceId: frame.enemyInstanceId,
          fromAttack: true,
          parentFrameId: frame.eventFrameId,
          // Every source of the keyword, a constant "each enemy attack gains overkill" rule included.
          overkill: keywords.includes("overkill"),
          ...(keywords.includes("piercing") ? { piercing: true } : {}),
          ...(keywords.includes("ranged") ? { ranged: true as const } : {}),
        },
        {
          kind: "characterAttacked",
          attackerInstanceId: frame.enemyInstanceId,
          targetInstanceId: frame.targetInstanceId,
          playerId: frame.attackedPlayerId,
          ...(keywords.includes("ranged") ? { ranged: true } : {}),
        },
      ]);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

export function pushEnemySchemeFrame(
  ctx: Ctx,
  event: Extract<TriggerEvent, { kind: "enemyScheme" }>,
  eventFrameId: FrameId,
): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyScheme",
      enemyInstanceId: event.enemyInstanceId,
      playerId: event.playerId,
      boostIcons: 0,
      stage: "giveBoost",
      eventFrameId,
      ...(event.noBoost ? { noBoost: true } : {}),
    },
  ]);
}

export function executeEnemySchemeFrame(ctx: Ctx, frame: Frame<"enemyScheme">): void {
  if (endedByLeavingPlay(ctx, frame, "scheme")) return;
  switch (frame.stage) {
    case "giveBoost":
      return giveBoostStep(ctx, frame, "flipBoosts", "scheme");
    case "flipBoosts": {
      const icons = stepBoostCard(ctx, frame, frame.playerId, "scheme");
      if (icons === "busy") return;
      if (icons === null) {
        setFrame(ctx, { ...frame, stage: "placeThreat" });
        return;
      }
      updateFrame(ctx, frame.frameId, (f) =>
        f.kind === "enemyScheme" ? { ...f, boostIcons: f.boostIcons + icons } : f,
      );
      return;
    }
    case "placeThreat": {
      setFrame(ctx, { ...frame, stage: "done" });
      const profile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!profile) return;
      const vars = activationVars(ctx, frame.eventFrameId);
      // "Schemes with +X SCH" (`enemyScheme.schBonus`) raises the enemy's SCH, so a dashed SCH stays "an unmodifiable
      // 0" (RRG 1.8 "Dash (Value)", p. 15); `threatBonus` ("reduce the amount of threat placed … by 1") changes the
      // threat itself and applies either way. The two are deliberately separate keys.
      const sch = profile.sch + (profile.missing.includes("sch") ? 0 : (vars.schBonus ?? 0));
      // RRG 1.8 "Scheme (Enemy Activation)" step 3 places it on the main scheme unless a constant ability redirects it.
      const schemeInstanceId = schemeActivationDestination(ctx.state, ctx.deps, frame.enemyInstanceId);
      const threatBonus = vars.threatBonus ?? 0;
      const amount = Math.max(0, sch + frame.boostIcons + threatBonus);
      // "This activation removes threat instead of placing it" (`modifyAttack.removesThreat`, Psychic Manipulation;
      // docs/phase7-wave6.md §3.35): the same total comes off the scheme it would have gone on. The removal is the
      // player card's (§4.1 Q17), so `threatRemovalBlocked` reads a crisis icon against it and, if one is in play,
      // nothing is removed; the placing is replaced either way.
      const removes = (vars.removesThreat ?? 0) > 0;
      const divert = removes ? null : schemeDivertOf(ctx, frame.eventFrameId, schemeInstanceId);
      const diverted = divert ? Math.min(divert.amount, amount) : 0;
      // The mirror of `attackResolved`: every term of the total separately, so nothing downstream has to re-derive it.
      emit(ctx, {
        type: "schemeResolved",
        enemyInstanceId: frame.enemyInstanceId,
        schemeInstanceId,
        baseSch: sch,
        boostIcons: frame.boostIcons,
        threatBonus,
        threatPlaced: removes ? 0 : amount - diverted,
        ...(removes ? { removesThreat: true as const } : {}),
        ...(divert && diverted > 0 ? { diverted: { toInstanceId: divert.toInstanceId, amount: diverted } } : {}),
      });
      if (removes) {
        const removerInstanceId = activationSlot(ctx, frame.eventFrameId, "threatRemover")[0] ?? null;
        // A "(thwart)" ability made the replacement (RRG 1.8 "Labeled Ability", p. 26): the removal is a thwart by
        // that player's identity, so patrol and `cannotThwart` are read as well as a crisis icon, and "after you
        // thwart" answers it. The placing is replaced whether or not the thwart removes anything.
        const [thwarterInstanceId] = activationSlot(ctx, frame.eventFrameId, "threatThwarter");
        const thwartingPlayer = thwarterInstanceId ? controllerOf(ctx.state, thwarterInstanceId) : null;
        if (thwarterInstanceId && thwartingPlayer) {
          pushEvent(ctx, {
            kind: "thwart",
            thwarterInstanceId,
            schemeInstanceId,
            playerId: thwartingPlayer,
            amount,
            basic: false,
            sourceInstanceId: removerInstanceId,
          });
          return;
        }
        pushEvent(ctx, {
          kind: "removeThreat",
          schemeInstanceId,
          amount,
          sourceInstanceId: removerInstanceId,
          parentFrameId: frame.eventFrameId,
        });
        return;
      }
      const onScheme: TriggerEvent = {
        kind: "placeThreat",
        schemeInstanceId,
        amount: amount - diverted,
        sourceInstanceId: frame.enemyInstanceId,
        parentFrameId: frame.eventFrameId,
      };
      if (!divert || diverted <= 0) {
        pushEvent(ctx, onScheme);
        return;
      }
      // The diverted part first, then the rest on the main scheme: both are this activation's placement by the enemy
      // and both report to it, so its `threatPlaced` is the whole and `threatDiverted` the part that left the scheme.
      addFrameVars(ctx, frame.eventFrameId, { threatDiverted: diverted });
      pushEvents(ctx, [
        {
          kind: "placeThreat",
          schemeInstanceId: divert.toInstanceId,
          amount: diverted,
          sourceInstanceId: frame.enemyInstanceId,
          parentFrameId: frame.eventFrameId,
        },
        onScheme,
      ]);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

/**
 * `EffectSpec enemyScheme.divert` as this activation's place-threat step reads it (docs/phase7-wave9.md §3.9), or null
 * when nothing is diverted: the threat is not going on a main scheme (a `schemeThreatDestination` rule sends it to
 * another scheme), the card left play or is that main scheme, or its condition does not hold now.
 */
function schemeDivertOf(ctx: Ctx, eventFrameId: FrameId | null, destination: InstanceId): SchemeThreatDivert | null {
  const frame = eventFrameId ? ctx.state.stack.find((f) => f.frameId === eventFrameId) : undefined;
  const event = frame?.kind === "event" && frame.event.kind === "enemyScheme" ? frame.event : null;
  const divert = event?.divert;
  if (!event || !divert) return null;
  if (cardOf(ctx.state, destination)?.type !== "main_scheme") return null;
  if (divert.toInstanceId === destination || !cardsInPlay(ctx.state).includes(divert.toInstanceId)) return null;
  const holds =
    divert.if === undefined ||
    evaluate(ctx.state, divert.if, {
      selfInstanceId: divert.selfInstanceId,
      controllerId: divert.controllerId,
      event,
      bindings: divert.bindings,
      vars: divert.vars,
      deps: ctx.deps,
    });
  return holds ? divert : null;
}
