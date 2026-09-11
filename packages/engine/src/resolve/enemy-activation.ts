/** Enemy attack and scheme procedures: boost cards, defenders, damage and threat. */

import type { AnyCard } from "@mc/content";
import { type Ctx, emit, moveCard, popFrame, pushFrames, requestChoice, setFrame, updateFrame, updateInstance } from "../ctx.js";
import { drawEncounterCard, exhaustCard } from "../effects.js";
import { type FrameId, type InstanceId, instanceId as asInstanceId, type PlayerId } from "../ids.js";
import { cardOf, characterProfile, getInstance, mustCardOf, mustInstance, mustPlayer, playerOrder } from "../query.js";
import { mustDefendWithAlly } from "../rules.js";
import { controllerOf } from "../select.js";
import type { Vars } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { addFrameSlots, addFrameVars, announce, base, type Frame, gameAbilityFrames, pushEvent, pushEvents } from "./frames.js";

const getsBoostCard = (state: GameState, enemyId: InstanceId): boolean => {
  const card = cardOf(state, enemyId);
  if (!card) return false;
  if (card.type === "villain") return true;
  if (card.type === "minion") return card.keywords.some((k) => k.name === "villainous");
  return false;
};

const boostIconsOf = (card: AnyCard): number => ("boostIcons" in card ? card.boostIcons : 0);

export function giveBoostCard(ctx: Ctx, enemyId: InstanceId): void {
  if (!getsBoostCard(ctx.state, enemyId)) return;
  const id = drawEncounterCard(ctx);
  if (!id) return;
  updateInstance(ctx, id, (i) => ({ ...i, faceup: false }));
  moveCard(ctx, id, { kind: "boost", hostInstanceId: enemyId });
  emit(ctx, { type: "boostCardDealt", enemyInstanceId: enemyId, instanceId: id });
}

/**
 * RRG "Boost": each boost card is flipped, its "Boost" ability resolves, and its
 * icons raise the enemy's ATK/SCH. The abilities go on the stack, so they resolve
 * before the activation's damage/threat step rather than interleaved per card.
 */
function flipNextBoostCard(ctx: Ctx, enemyId: InstanceId, playerId: PlayerId): number | null {
  const [boostId] = mustInstance(ctx.state, enemyId).boostCards;
  if (!boostId) return null;
  updateInstance(ctx, boostId, (i) => ({ ...i, faceup: true }));
  const card = mustCardOf(ctx.state, boostId);
  const value = boostIconsOf(card);
  emit(ctx, { type: "boostCardFlipped", enemyInstanceId: enemyId, instanceId: boostId, boostIcons: value });
  const frames = gameAbilityFrames(ctx, boostId, ["boost"], null, undefined, playerId);
  moveCard(ctx, boostId, { kind: "encounterDiscard" }, "top");
  pushFrames(ctx, frames);
  return value;
}

/** An activation's recorded modifications ("gains overkill", "+N ATK", extra boost cards). */
const activationVars = (ctx: Ctx, eventFrameId: FrameId | null): Vars => {
  const frame = eventFrameId ? ctx.state.stack.find((f) => f.frameId === eventFrameId) : undefined;
  return frame?.kind === "event" ? frame.vars : {};
};

/** Records a defender on the attack procedure and its event, and announces the defense. */
export function setDefender(ctx: Ctx, frame: Frame<"enemyAttack">, defenderId: InstanceId, defenderPlayer: PlayerId, basic: boolean): void {
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
  }
  announce(ctx, { kind: "defended", defenderInstanceId: defenderId, enemyInstanceId: frame.enemyInstanceId, playerId: defenderPlayer, basic });
}

export function pushEnemyAttackFrame(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyAttack" }>, eventFrameId: FrameId): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyAttack",
      enemyInstanceId: event.enemyInstanceId,
      attackedPlayerId: event.attackedPlayerId,
      targetPlayerId: event.targetPlayerId,
      targetInstanceId: event.targetInstanceId,
      // A "(defense)" ability used while the attack was initiated already made the identity the defender.
      defenderInstanceId: (activationVars(ctx, eventFrameId).labeledDefense ?? 0) > 0 ? event.targetInstanceId : null,
      basicDefense: false,
      boostIcons: 0,
      stage: "giveBoost",
      eventFrameId,
    },
  ]);
}

/**
 * RRG "Defend": any player may defend with a character they control, and if a
 * player other than the attacked player defends, that player becomes the new
 * target. The attacked player is the one who decides (co-op table convention;
 * the engine gives the decision to a single seat so it stays deterministic).
 */
export function legalDefenders(state: GameState, attackedPlayerId: PlayerId): readonly InstanceId[] {
  const defenders: InstanceId[] = [];
  for (const player of playerOrder(state)) {
    const identity = getInstance(state, player.identity.instanceId);
    if (identity && player.identity.form === "hero" && !identity.exhausted) {
      defenders.push(identity.instanceId);
    }
    for (const id of player.playArea) {
      if (cardOf(state, id)?.type !== "ally") continue;
      if (!mustInstance(state, id).exhausted) defenders.push(id);
    }
  }
  const attacked = mustPlayer(state, attackedPlayerId);
  const ownFirst = (id: InstanceId): number =>
    id === attacked.identity.instanceId || attacked.playArea.includes(id) ? 0 : 1;
  return [...defenders].sort((a, b) => ownFirst(a) - ownFirst(b));
}

export function executeEnemyAttackFrame(ctx: Ctx, frame: Frame<"enemyAttack">): void {
  switch (frame.stage) {
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "declareDefender" });
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
        return;
      }
      // RRG "Defend, Defense": with a "(defense)" defender already set, only that
      // hero may still make a basic defense; nobody else can defend this attack.
      const existing = frame.defenderInstanceId;
      const all = legalDefenders(ctx.state, frame.attackedPlayerId);
      // "Must defend with an ally they control, if able" (Melter): only the engaged player's ready allies, no declining.
      const forcedAllies = mustDefendWithAlly(ctx.state, ctx.deps, frame.enemyInstanceId)
        ? all.filter((id) => cardOf(ctx.state, id)?.type === "ally" && controllerOf(ctx.state, id) === frame.attackedPlayerId)
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
          ...(forcedAllies.length > 0 && !existing ? [] : [{ optionId: "decline", label: "No defense", ref: { kind: "none" } } as const]),
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
      const icons = flipNextBoostCard(ctx, frame.enemyInstanceId, frame.attackedPlayerId);
      if (icons === null) {
        setFrame(ctx, { ...frame, stage: "dealDamage" });
        return;
      }
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "enemyAttack" ? { ...f, boostIcons: f.boostIcons + icons } : f));
      return;
    }
    case "dealDamage": {
      setFrame(ctx, { ...frame, stage: "done" });
      const enemyProfile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!enemyProfile) return;
      const vars = activationVars(ctx, frame.eventFrameId);
      const defenderProfile = frame.defenderInstanceId
        ? characterProfile(ctx.state, frame.defenderInstanceId, ctx.deps)
        : undefined;
      // Only a basic defense by a hero reduces damage by DEF (RRG "Defend, Defense").
      const reduction = frame.basicDefense && defenderProfile?.kind === "identity" ? defenderProfile.def : 0;
      const atk = enemyProfile.atk + (vars.atkBonus ?? 0);
      addFrameSlots(ctx, frame.eventFrameId, { target: [frame.targetInstanceId] });
      const damage = Math.max(0, atk + frame.boostIcons - reduction);
      emit(ctx, {
        type: "attackResolved",
        enemyInstanceId: frame.enemyInstanceId,
        targetInstanceId: frame.targetInstanceId,
        baseAtk: atk,
        boostIcons: frame.boostIcons,
        defenseReduction: reduction,
        damageDealt: damage,
      });
      pushEvents(ctx, [
        {
          kind: "dealDamage",
          targetInstanceId: frame.targetInstanceId,
          amount: damage,
          sourceInstanceId: frame.enemyInstanceId,
          fromAttack: true,
          parentFrameId: frame.eventFrameId,
          overkill: (vars.overkill ?? 0) > 0,
        },
        {
          kind: "characterAttacked",
          attackerInstanceId: frame.enemyInstanceId,
          targetInstanceId: frame.targetInstanceId,
          playerId: frame.attackedPlayerId,
        },
      ]);
      return;
    }
    case "done":
      popFrame(ctx);
      return;
  }
}

export function pushEnemySchemeFrame(ctx: Ctx, event: Extract<TriggerEvent, { kind: "enemyScheme" }>, eventFrameId: FrameId): void {
  pushFrames(ctx, [
    {
      ...base(ctx),
      kind: "enemyScheme",
      enemyInstanceId: event.enemyInstanceId,
      playerId: event.playerId,
      boostIcons: 0,
      stage: "giveBoost",
      eventFrameId,
    },
  ]);
}

export function executeEnemySchemeFrame(ctx: Ctx, frame: Frame<"enemyScheme">): void {
  switch (frame.stage) {
    case "giveBoost": {
      setFrame(ctx, { ...frame, stage: "flipBoosts" });
      const extra = activationVars(ctx, frame.eventFrameId).extraBoost ?? 0;
      for (let i = 0; i < 1 + extra; i++) giveBoostCard(ctx, frame.enemyInstanceId);
      return;
    }
    case "flipBoosts": {
      const icons = flipNextBoostCard(ctx, frame.enemyInstanceId, frame.playerId);
      if (icons === null) {
        setFrame(ctx, { ...frame, stage: "placeThreat" });
        return;
      }
      updateFrame(ctx, frame.frameId, (f) => (f.kind === "enemyScheme" ? { ...f, boostIcons: f.boostIcons + icons } : f));
      return;
    }
    case "placeThreat": {
      setFrame(ctx, { ...frame, stage: "done" });
      const profile = characterProfile(ctx.state, frame.enemyInstanceId, ctx.deps);
      if (!profile) return;
      pushEvent(ctx, {
        kind: "placeThreat",
        schemeInstanceId: ctx.state.mainScheme.instanceId,
        amount: Math.max(0, profile.sch + frame.boostIcons + (activationVars(ctx, frame.eventFrameId).threatBonus ?? 0)),
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
