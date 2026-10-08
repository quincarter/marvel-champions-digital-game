/**
 * One "(attack)" ability is one attack. RRG 1.8 "Attack (Player Ability Type)" (p. 10): "If a triggered ability is
 * labeled as an attack … resolving that ability is considered to attack the specified target", "An ability labeled as
 * an attack is considered a single attack, even if that attack deals multiple instances of damage", "When an attack
 * targets multiple enemies, the attacking character is considered to have attacked each of those enemies" and "Each
 * attacked enemy with the retaliate X keyword that is still in play after the attack resolves deals its retaliate
 * damage to the attacking character". Owner ruling, 2026-10-07 (docs/phase7-wave8.md §4.1 Q47, following FFG's ruling
 * on the Cyclops ally, Q46): damage an "(attack)" ability deals to enemies while it resolves is damage from that
 * attack, even when separate instructions deal it or it goes to different enemies.
 *
 * An `attack` effect of an "(attack)" ability made by its controller's identity is still its own `attack` event frame,
 * with its "when … attacks" interrupt window and its damage. What changes is when it finishes:
 *
 * - **It waits for its ability.** Once its own damage has resolved, the frame reports its results to the instruction
 *   that made it (`<bind>.defeated`, `<bind>.excessDealt`, read by the ability's next instructions as before) and
 *   moves beneath the root effects frame of the ability (`attackOf`, `attackWaiting`), logged as
 *   `attackAwaitsAbility`.
 * - **Damage the ability then deals to an enemy is that attack's** (`abilityAttackDamage`): a `dealDamage` instruction
 *   of the same ability, to a card that is an enemy, is dealt by the attacker with the ability's card as `via`,
 *   `fromAttack`, and reported to the waiting frame (the attack's `damage`, `damaged`, `defeated` and `excessDealt`
 *   totals). So a rule on damage "from each attack" reads each instance ("increase the amount of damage that enemy
 *   takes from each attack by 1": every instance against that enemy), "prevent all damage from that attack" reaches
 *   every instance, and the attack's keywords (its attacker's or granted to it, `attackKeywordsOf`) are that damage's
 *   as they are the first instance's. Damage to anything else is not the attack's: the attacking identity ("take 1
 *   damage for each boost icon discarded this way"), an ally. Neither is damage another card deals meanwhile (a
 *   response to one of the instances), nor damage an instruction marked `fromAttack: false` deals.
 * - **Each such enemy is attacked, once.** The frame keeps one `characterAttacked` per enemy (`attacked`): its own
 *   target, then each enemy a later instruction dealt damage to.
 * - **The attack finishes after the ability's last effect**, when the root frame has left the stack and the waiting
 *   frame is on top again: `characterAttacked` for each enemy attacked (retaliate, from each one still in play, once
 *   however many instances it was dealt; RRG 1.8 p. 10 step 7), then the attack's own response window ("after …
 *   attacks [and defeats]", reading every instance's results), then its "at the end of this attack" effects, and
 *   effects lasting "for this attack" end.
 *
 * Unchanged: a basic attack, an attack by another character (an ally's), an attack an unlabeled ability makes, and an
 * "(attack)" ability's attack that was cancelled or never made (no frame waits, so its later damage is plain damage).
 * An ability with several `attack` effects still makes one `attack` event each; each waits and finishes in order.
 */

import { type Ctx, emit, findFrame } from "../ctx.js";
import type { EngineDeps } from "../abilities.js";
import type { FrameId, InstanceId } from "../ids.js";
import { attackKeywordsOf } from "../keywords.js";
import { categoriesOf } from "../select.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { type Frame, pushEvents } from "./frames.js";
import { abilityRootFrameId } from "./thwart-session.js";

type Attack = Extract<TriggerEvent, { kind: "attack" }>;
type Damage = Extract<TriggerEvent, { kind: "dealDamage" }>;
type Attacked = Extract<TriggerEvent, { kind: "characterAttacked" }>;
type AttackFrame = Frame<"event"> & { readonly event: Attack };

const isAttackLabeled = (deps: EngineDeps, frame: Frame<"effects">): boolean =>
  frame.abilityId !== undefined && deps.abilities[frame.abilityId]?.label?.includes("attack") === true;

/**
 * The root frame an `attack` effect's event belongs to (`attackOf`): set when `frame` resolves an "(attack)"-labeled
 * ability and `attackerId` is its controller's identity (RRG 1.8 "Labeled Ability", p. 26: the labeled action is the
 * identity's). Undefined for every other attack.
 */
export function abilityAttackRoot(
  state: GameState,
  deps: EngineDeps,
  frame: Frame<"effects">,
  attackerId: InstanceId,
): FrameId | undefined {
  if (!isAttackLabeled(deps, frame) || frame.controllerId === null) return undefined;
  const identity = state.players.find((player) => player.playerId === frame.controllerId)?.identity.instanceId;
  return identity === attackerId ? abilityRootFrameId(state, frame) : undefined;
}

/** Whether this attack's ability is still resolving, so the attack waits for it rather than finishing now. */
export function attackAwaitsAbility(state: GameState, frame: Frame<"event">): frame is AttackFrame {
  if (frame.event.kind !== "attack" || frame.attackOf === undefined || frame.attackWaiting) return false;
  return findFrame(state, frame.attackOf)?.kind === "effects";
}

/**
 * Moves the attack frame (on top of the stack) beneath its ability's root frame, and beneath any attack of the same
 * ability already waiting there, so they finish in the order they were made.
 */
export function waitBeneathAbility(ctx: Ctx, frame: AttackFrame): void {
  const root = frame.attackOf!;
  const rest = ctx.state.stack.filter((other) => other.frameId !== frame.frameId);
  let at = rest.findIndex((other) => other.frameId === root) + 1;
  while (at < rest.length) {
    const below = rest[at];
    if (below?.kind !== "event" || below.attackOf !== root || !below.attackWaiting) break;
    at++;
  }
  const waiting: Frame<"event"> = { ...frame, attackWaiting: true, reportTo: null };
  ctx.state = { ...ctx.state, stack: [...rest.slice(0, at), waiting, ...rest.slice(at)] };
  emit(ctx, {
    type: "attackAwaitsAbility",
    attackFrameId: frame.frameId,
    abilityFrameId: root,
    attackerInstanceId: frame.event.attackerInstanceId,
  });
}

/**
 * The waiting attack is on top again (its ability has finished): every enemy it attacked is named, once each, in the
 * order attacked. Returns true when it pushed any (the frame then finishes beneath them).
 */
export function pushAttackedByAbility(ctx: Ctx, frame: Frame<"event">): boolean {
  if (!frame.attackWaiting || !frame.attacked || frame.attacked.length === 0) return false;
  const once = frame.attacked.filter(
    (event, index, all) => all.findIndex((other) => other.targetInstanceId === event.targetInstanceId) === index,
  );
  const { attacked: _named, ...finishing } = frame;
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.map((other) => (other.frameId === frame.frameId ? finishing : other)),
  };
  pushEvents(ctx, once);
  return true;
}

/** The attack of `frame`'s "(attack)" ability that is waiting for it: the one made last, when there are several. */
export function waitingAbilityAttack(
  state: GameState,
  deps: EngineDeps,
  frame: Frame<"effects">,
): AttackFrame | undefined {
  if (!isAttackLabeled(deps, frame)) return undefined;
  const root = abilityRootFrameId(state, frame);
  const waiting = state.stack.filter(
    (other): other is AttackFrame =>
      other.kind === "event" &&
      other.event.kind === "attack" &&
      other.attackOf === root &&
      other.attackWaiting === true,
  );
  return waiting[waiting.length - 1];
}

/**
 * What makes a `dealDamage` event of the waiting attack's ability that attack's damage to the enemy `targetId`
 * (spread over the event), and the `characterAttacked` the attack owes that enemy. Null when `targetId` is not an
 * enemy: damage an attack ability deals to its own identity, or to any friendly character, is not attack damage.
 */
export function abilityAttackDamage(
  state: GameState,
  deps: EngineDeps,
  attack: AttackFrame,
  targetId: InstanceId,
): { readonly damage: Partial<Damage>; readonly attacked: Attacked } | null {
  if (!categoriesOf(state, targetId).includes("enemy")) return null;
  const event = attack.event;
  const keywords = attackKeywordsOf(state, deps, {
    attackerInstanceId: event.attackerInstanceId,
    viaInstanceId: event.sourceInstanceId ?? null,
    basic: false,
    ...(event.keywords ? { keywords: event.keywords } : {}),
    vars: attack.vars,
  });
  return {
    damage: {
      sourceInstanceId: event.attackerInstanceId,
      fromAttack: true,
      parentFrameId: attack.frameId,
      viaInstanceId: event.sourceInstanceId ?? null,
      ...(event.overkill === true || keywords.includes("overkill") ? { overkill: true } : {}),
      ...(keywords.includes("piercing") ? { piercing: true } : {}),
      ...(keywords.includes("ranged") ? { ranged: true as const } : {}),
    },
    attacked: {
      kind: "characterAttacked",
      attackerInstanceId: event.attackerInstanceId,
      targetInstanceId: targetId,
      playerId: event.playerId,
      ...(keywords.includes("ranged") ? { ranged: true } : {}),
    },
  };
}

/** Adds the enemies a later instruction attacked to the waiting attack's list. */
export function noteAttackedByAbility(ctx: Ctx, attackFrameId: FrameId, attacked: readonly Attacked[]): void {
  if (attacked.length === 0) return;
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.map((frame) =>
      frame.frameId === attackFrameId && frame.kind === "event"
        ? { ...frame, attacked: [...(frame.attacked ?? []), ...attacked] }
        : frame,
    ),
  };
}
