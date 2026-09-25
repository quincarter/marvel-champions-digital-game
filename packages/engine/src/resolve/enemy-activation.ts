/** Enemy attack and scheme procedures: boost cards, defenders, damage and threat. */

import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
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
import { drawEncounterCard, exhaustCard } from "../effects.js";
import { type FrameId, type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { attackKeywordsOf } from "../keywords.js";
import { amplifyIconsInPlay, boostIconsFor } from "../modifiers.js";
import {
  cardOf,
  characterProfile,
  discardZoneFor,
  getInstance,
  locateCard,
  mustCardOf,
  mustInstance,
  mustPlayer,
  playerOrder,
  areaOfCard,
  mainSchemeFor,
} from "../query.js";
import {
  attacksDealIndirectDamage,
  mustDefendWithAlly,
  pairedMainSchemeId,
  schemeThreatDestination,
  cannotDefend,
} from "../rules.js";
import { cardsInPlay, controllerOf, DEFENDER_SLOT, isAlly } from "../select.js";
import { currentActivationFrameId, type Vars } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
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

const getsBoostCard = (state: GameState, enemyId: InstanceId): boolean => {
  const card = cardOf(state, enemyId);
  if (!card) return false;
  if (card.type === "villain") return true;
  if (card.type === "minion") return card.keywords.some((k) => k.name === "villainous");
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
}

/** The activation procedure's own boost card: only a villain or a villainous minion is dealt one (p. 11). */
export function giveBoostCard(ctx: Ctx, enemyId: InstanceId): void {
  if (!getsBoostCard(ctx.state, enemyId)) return;
  dealBoostCard(ctx, enemyId);
}

/**
 * RRG 1.8 "Attack (Enemy Activation)" step 3 / "Scheme (Enemy Activation)" step 2, and "Boost" (p. 11): one boost card
 * at a time, in the order dealt. Each is turned faceup; a `boostCardTurnedFaceup` event gives "When/After a boost card
 * is turned faceup" abilities their windows; its "Boost" ability resolves ("when the card is turned face up"), unless
 * cancelled; its icons are added, unless cancelled; then "After applying a boost card to an activation, discard it."
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
  const boost = frame.boost ?? null;
  if (!boost) {
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
    const icons = boostIconsFor(ctx.state, ctx.deps, boostId) + amplifyIconsInPlay(ctx.state);
    emit(ctx, {
      type: "boostCardFlipped",
      enemyInstanceId: frame.enemyInstanceId,
      instanceId: boostId,
      boostIcons: icons,
    });
    setFrame(ctx, {
      ...frame,
      boost: { instanceId: boostId, step: "window", iconsCancelled: false, abilityCancelled: false },
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
  if (boost.step === "window") {
    setFrame(ctx, { ...frame, boost: { ...boost, step: "ability" } });
    if (boost.abilityCancelled) emit(ctx, { type: "boostCancelled", instanceId: boost.instanceId, scope: "ability" });
    else pushFrames(ctx, gameAbilityFrames(ctx, boost.instanceId, ["boost"], null, undefined, playerId));
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
    if (!boost.iconsCancelled && heard(ctx.state, ctx.deps, counting)) {
      pushEvent(ctx, counting);
      return "busy";
    }
  }
  // Amplify is read again at the count, not carried from the flip: "Each amplify icon is equivalent to the following
  // constant ability: 'Each boost card gains [boost]'" (RRG 1.8 p. 7), and a constant applies while its card is in play
  // (the Fearless Determination ruling, Jan 11, 2026 (1): its amplify icon "remains in effect" until it leaves play).
  const counted =
    boostIconsFor(ctx.state, ctx.deps, boost.countFrom ?? boost.instanceId) +
    amplifyIconsInPlay(ctx.state) +
    (boost.countAdjust ?? 0);
  const icons = boost.iconsCancelled ? 0 : Math.max(0, counted);
  // Discarded to its home deck's discard (docs/phase7-wave1.md §4.3, proposed), unless its own Boost ability already
  // moved it ("Put Goblin Thrall into play engaged with you").
  if (locateCard(ctx.state, boost.instanceId)?.kind === "boost")
    moveCard(ctx, boost.instanceId, discardZoneFor(ctx.state, boost.instanceId), "top");
  setFrame(ctx, { ...frame, boost: null });
  return icons;
}

/** An activation's recorded modifications ("gains overkill", "+N ATK", extra boost cards). */
const activationVars = (ctx: Ctx, eventFrameId: FrameId | null): Vars => activationVarsOf(ctx.state, eventFrameId);

/** Records a defender on the attack procedure and its event, and announces the defense. */
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
        ? { ...f, event: { ...f.event, targetInstanceId: defenderId, targetPlayerId: defenderPlayer } }
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
  const basic = cardOf(ctx.state, defenderId)?.type === "hero_identity";
  if (exhaust) exhaustCard(ctx, defenderId);
  const procedure = ctx.state.stack.find((f): f is Frame<"enemyAttack"> => f.kind === "enemyAttack");
  if (procedure) {
    if (procedure.defenderInstanceId === defenderId) setFrame(ctx, { ...procedure, basicDefense: basic });
    else setDefender(ctx, procedure, defenderId, defenderPlayer, basic);
    return;
  }
  const activation = currentActivationFrameId(ctx.state.stack);
  const frame = activation ? ctx.state.stack.find((f) => f.frameId === activation) : undefined;
  if (frame?.kind !== "event" || frame.event.kind !== "enemyAttack") return;
  const already = (frame.slots[DEFENDER_SLOT] ?? [])[0] === defenderId;
  setFrame(ctx, {
    ...frame,
    event: { ...frame.event, targetInstanceId: defenderId, targetPlayerId: defenderPlayer },
    vars: { ...frame.vars, declaredDefense: 1, declaredBasicDefense: basic ? 1 : 0 },
    slots: { ...frame.slots, [DEFENDER_SLOT]: [defenderId] },
  });
  if (!already) {
    announce(ctx, {
      kind: "defended",
      defenderInstanceId: defenderId,
      enemyInstanceId: frame.event.enemyInstanceId,
      playerId: defenderPlayer,
      basic,
    });
  }
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
    const identity = getInstance(state, player.identity.instanceId);
    if (identity && player.identity.form === "hero" && !identity.exhausted) {
      defenders.push(identity.instanceId);
    }
    for (const id of player.playArea) {
      if (!isAlly(state, id)) continue;
      if (!mustInstance(state, id).exhausted) defenders.push(id);
    }
  }
  const attacked = mustPlayer(state, attackedPlayerId);
  const ownFirst = (id: InstanceId): number =>
    id === attacked.identity.instanceId || attacked.playArea.includes(id) ? 0 : 1;
  // "Vision cannot attack or defend." (`RuleSpec cannotDefend`, docs/phase7-wave4.md §3.31).
  return defenders.filter((id) => !cannotDefend(state, deps, id, attackerId)).sort((a, b) => ownFirst(a) - ownFirst(b));
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
 */
function defenderLeftPlay(ctx: Ctx, frame: Frame<"enemyAttack">): Frame<"enemyAttack"> {
  const defender = frame.defenderInstanceId;
  if (defender === null || cardsInPlay(ctx.state).includes(defender)) return frame;
  const identity = mustPlayer(ctx.state, frame.targetPlayerId).identity.instanceId;
  emit(ctx, {
    type: "defenderLeftPlay",
    enemyInstanceId: frame.enemyInstanceId,
    defenderInstanceId: defender,
    targetInstanceId: identity,
  });
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
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "declareDefender" });
      // "That attack does not get a boost card": no boost card at all, additional ones included.
      if (frame.noBoost) return;
      const extra = activationVars(ctx, frame.eventFrameId).extraBoost ?? 0;
      for (let i = 0; i < 1 + extra; i++) giveBoostCard(ctx, frame.enemyInstanceId);
      return;
    }
    case "declareDefender": {
      if (frame.answer) {
        const [picked] = frame.answer;
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
        emit(ctx, {
          type: "defenderDeclared",
          attackInstanceId: frame.enemyInstanceId,
          defenderInstanceId: defenderId,
          playerId: frame.attackedPlayerId,
        });
        exhaustCard(ctx, defenderId);
        setDefender(ctx, { ...frame, answer: null, stage: "flipBoosts" }, defenderId, defenderPlayer, true);
        // "After you use a basic power" (docs/phase7-wave2.md §3.11): defending is the basic defense power.
        const used: TriggerEvent = {
          kind: "basicPowerUsed",
          characterInstanceId: defenderId,
          power: "defense",
          playerId: defenderPlayer,
        };
        if (heard(ctx.state, ctx.deps, used)) announce(ctx, used);
        // "When you use one of your hero's basic powers … DEF" (§17.4), pushed second so it resolves first — before
        // the attack's own damage step reads the defender's DEF (RRG 1.8 "Attack (Enemy Activation)" step 4, p. 9).
        const using: TriggerEvent = {
          kind: "basicPowerUsing",
          characterInstanceId: defenderId,
          power: "defense",
          playerId: defenderPlayer,
        };
        if (heard(ctx.state, ctx.deps, using)) announce(ctx, using);
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
      const all = legalDefenders(ctx.state, frame.attackedPlayerId, ctx.deps, frame.enemyInstanceId);
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
            label: mustCardOf(ctx.state, id).name,
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
      const icons = stepBoostCard(ctx, frame, frame.attackedPlayerId, "attack");
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
      frame = defenderLeftPlay(ctx, frame);
      setFrame(ctx, { ...frame, stage: "done" });
      // RRG 1.8 step 4 (p. 9). The arithmetic and the two rules around it live in `defend-preview.ts`, so the defend
      // prompt's damage ranges and the damage actually dealt can never drift apart.
      const planned = plannedAttackDamage(ctx.state, ctx.deps, frame, {
        boostIcons: frame.boostIcons,
        defenderInstanceId: frame.defenderInstanceId,
        basicDefense: frame.basicDefense,
      });
      if (!planned) return;
      const vars = activationVars(ctx, frame.eventFrameId);
      addFrameSlots(ctx, frame.eventFrameId, { target: [frame.targetInstanceId] });
      emit(ctx, {
        type: "attackResolved",
        enemyInstanceId: frame.enemyInstanceId,
        targetInstanceId: frame.targetInstanceId,
        baseAtk: planned.baseAtk,
        boostIcons: frame.boostIcons,
        defenseReduction: planned.defenseReduction,
        damageDealt: planned.damage,
      });
      // "The attack gains piercing/ranged" (Crossfire's boost, Crossfire's Rifle): a `modifyAttack` grant made during
      // this activation, folded in with the enemy's own keywords once and stamped on the events below.
      const keywords = attackKeywordsOf(ctx.state, ctx.deps, { attackerInstanceId: frame.enemyInstanceId, vars });
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
      pushEvents(ctx, [
        {
          kind: "dealDamage",
          targetInstanceId: frame.targetInstanceId,
          amount: planned.damage,
          sourceInstanceId: frame.enemyInstanceId,
          fromAttack: true,
          parentFrameId: frame.eventFrameId,
          overkill: (vars.overkill ?? 0) > 0,
          ...(keywords.includes("piercing") ? { piercing: true } : {}),
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
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "flipBoosts" });
      if (frame.noBoost) return;
      const extra = activationVars(ctx, frame.eventFrameId).extraBoost ?? 0;
      for (let i = 0; i < 1 + extra; i++) giveBoostCard(ctx, frame.enemyInstanceId);
      return;
    }
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
      // With separate game areas, "the main scheme" is the enemy's own area's (docs/phase7-wave2.md §3.1).
      const schemeInstanceId =
        schemeThreatDestination(ctx.state, ctx.deps, frame.enemyInstanceId) ??
        pairedMainSchemeId(ctx.state, ctx.deps, frame.enemyInstanceId) ??
        mainSchemeFor(ctx.state, areaOfCard(ctx.state, frame.enemyInstanceId))?.instanceId ??
        ctx.state.mainScheme.instanceId;
      const threatBonus = vars.threatBonus ?? 0;
      const amount = Math.max(0, sch + frame.boostIcons + threatBonus);
      // The mirror of `attackResolved`: every term of the total separately, so nothing downstream has to re-derive it.
      emit(ctx, {
        type: "schemeResolved",
        enemyInstanceId: frame.enemyInstanceId,
        schemeInstanceId,
        baseSch: sch,
        boostIcons: frame.boostIcons,
        threatBonus,
        threatPlaced: amount,
      });
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId,
        amount,
        sourceInstanceId: frame.enemyInstanceId,
        parentFrameId: frame.eventFrameId,
      });
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}
