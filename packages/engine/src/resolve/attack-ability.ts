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
 *
 * **Every "(attack)" ability is an attack** (owner ruling Q48, 2026-10-07; RRG 1.8 "Labeled Ability", p. 26: "When a
 * player resolves an ability labeled '(attack),' that ability is considered to be an attack made by that player's
 * identity"), whether or not it uses the hero's ATK or has an `attack` effect. An "(attack)" ability with no `attack`
 * effect anywhere in it (a *label-only* attack: "Hero Action (attack): Deal 3 damage to an enemy") makes one attack:
 * an `attack` event by that identity (`attack.labeled`) with its "when … attacks" interrupt window, which deals no
 * damage of its own and goes straight to waiting beneath the ability's root frame. Its damage instructions then
 * resolve, and their damage is that attack's, exactly as above. The root frame remembers the attack was made
 * (`labelAttackMade`), so there is one per resolution. An ability whose damage is only to its player's own characters
 * attacks nothing and makes no attack. Covered instructions: `dealDamage` and `divide` of damage; no shipped
 * "(attack)" ability uses another.
 *
 * **When a label-only attack begins.** Official rule, RRG 1.8 "Labeled Ability" (p. 26): "The identity of the player
 * using the labeled ability is considered to be performing the labeled effect when the labeled ability begins
 * resolving (after costs have been paid)." Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 61, rules check
 * A1): the attack, and so its "when … attacks" window, opens as the ability begins resolving, before its first
 * instruction, not at its first damage instruction (`beginLabelAttack`). What follows is this engine's
 * interpretation of how that meets its instruction model, each point with the alternative it was chosen over:
 *
 * - **Target choices that open the ability are made first.** The engine asks an ability's "choose an enemy" as an
 *   instruction. RRG 1.8 "Target" (p. 42): "The phrase 'choose a [game element]' indicates that one or more targets
 *   must be selected in order for an ability to initiate", so a run of `chooseTarget` instructions at the start of
 *   the ability is read as part of initiating it, and the attack begins before the first instruction that is not one.
 *   That keeps "when [a character] attacks [this enemy / a confused enemy]" hearing the enemy the player chose.
 *   (Alternative: before the choice too, when no such interrupt could hear the attack.)
 * - **The attack's target as it begins** (`attack.targetInstanceId`, what its interrupt window reads) is the first
 *   enemy the identity may attack that the ability's first damage instruction able to name one names, read ahead as
 *   the attack begins: the chosen enemy, "the villain", the first of "each enemy". When no instruction can name one
 *   yet (its enemy is chosen after an earlier instruction resolves, or every enemy named is guarded) the attack
 *   begins with no target (`null`): an interrupt that asks nothing of the target hears it, one that names a target
 *   does not, and the event takes the first enemy an instruction attacks as its target then
 *   (`noteAttackedByAbility`). No later window opens for that enemy. (Alternative: a second window as each enemy is
 *   named; not built.)
 * - **Guard is not read as the attack begins**, only for each enemy as it would be attacked (Q49, below). An attack
 *   that begins and whose every enemy turns out to be guarded attacked nobody: it resolves with an empty
 *   `attack.attacked`, nothing retaliates, "after you attack" with no target clause answers it (the identity made an
 *   attack, p. 26) and "after you attack [an enemy]" does not. An ability that names only enemies that cannot be
 *   attacked is still refused before it is played (`target-validity.ts`; RRG 1.8 "Target", p. 43).
 * - **An attack is begun only by an ability that can attack an enemy.** It begins when one of the ability's own
 *   (top-level) damage instructions could name an enemy: its target is not known yet, or it names one now. An
 *   ability whose damage instructions name only its player's own characters makes no attack, as before. One whose
 *   damage instructions all sit inside a branch ("if a [physical] resource was paid, deal 2 damage to an enemy")
 *   makes its attack as the branch reaches the instruction (`openLabelAttack`), so a resolution that never takes
 *   the branch makes none, as before. (Alternative: every "(attack)" ability attacks from its start whatever it
 *   then does, which p. 26 read alone supports; not adopted, to keep those two behaviors.)
 * - **Not done: an ability with an `attack` effect.** P. 26 speaks of every labeled ability, so it covers these too,
 *   but their attack is still made by the `attack` instruction: the event's target, amount and keywords are that
 *   instruction's (one event for each enemy it names, each with its own window), and "when … attacks" interrupts read
 *   them ("when you make a ranged attack", "attacks a confused enemy"). So an instruction written before the `attack`
 *   effect (a discard that sets the damage, a status given first) still resolves before the window. Beginning those
 *   attacks with the ability needs the event split from its damage; reported to the owner, 2026-10-08, not decided.
 *
 * **"That attack deals N additional damage" increases every instance** (owner ruling Q53, 2026-10-08; RRG 1.8 p. 10:
 * "When an attack ability has its damage increased by another ability, each instance of damage in that attack ability
 * that does not use the word 'additional' is increased by the specified amount"; "'For Each'", p. 20: "that modifier
 * is applied to each instance of the 'for each' effect"). `modifyAttack.extraDamage` is a var on the attack's own
 * frame: the attack's own damage adds it (`applyPlayerAttack`), and so does each later damage instruction of the
 * ability against an enemy (`abilityAttackDamage.extra`), for an attack with an `attack` effect and for a label-only
 * attack alike. Two limits:
 *
 * - **Not twice to additional damage.** An instruction the card words as additional damage of an earlier instance
 *   (`dealDamage.additional`) is a modification of that instance, not an instance (RRG 1.8 "Alteration Effect", p. 7;
 *   the Repulsor Blast FAQ), and gets no increase of its own.
 * - **One attack only.** The var belongs to the attack it was given to. In an ability that makes several attacks, an
 *   instruction's damage is the attack's made last before it (`waitingAbilityAttack`), and reads that attack's var:
 *   the other attacks of the ability, and their instances, get nothing (RRG 1.8 p. 10: "An ability that increases the
 *   damage of an attack only increases the damage of one of that ability's attacks").
 *
 * Damage that is not the attack's gets none of it: an instruction marked `fromAttack: false`, damage to the ability's
 * own player, damage to a card that is not an enemy.
 *
 * **Guard restricts attack targeting, checked per enemy as it would be attacked** (owner ruling Q49; RRG 1.8 "Guard",
 * p. 21: "that player cannot use cards they control to attack a villain"; "Attack (Player Ability Type)", p. 10: "Hero
 * and ally attacks can target any enemy, unless a card ability (such as guard) is preventing that enemy from being
 * attacked"). Each damage instruction of the attack attacks the enemies it names, so each is read with `canAttack` as
 * that instruction resolves, not once for the ability:
 *
 * - an instruction that names its enemies ("each other enemy", "the villain") deals an enemy that cannot be attacked
 *   nothing and does not attack it, logged as `attackTargetSkipped`; its other enemies are dealt theirs;
 * - an instruction with a chosen enemy does not offer one that cannot be attacked (`attackTargetAllowed` in
 *   `target-validity.ts`, for a `chooseTarget` slot; a division's candidates), and with none to offer it does nothing;
 * - a guard minion an earlier instruction of the same ability defeated no longer guards: the villain can then be
 *   attacked by the next instruction.
 *
 * Guard is not read for damage that is not an attack on the enemy taking it: an overkill spill, an unlabeled
 * ability's damage, an instruction marked `fromAttack: false`.
 *
 * **Attacked is not damaged** (owner ruling Q50; RRG 1.8 p. 10: "When an attack targets multiple enemies, the attacking
 * character is considered to have attacked each of those enemies"). The frame's `attacked` list holds the enemies an
 * instruction targeted, and nothing else adds to it: an enemy that only took the attack's overkill spill is not
 * attacked, does not retaliate and satisfies no "after you attack …". When the attack finishes, its resolved event
 * carries the list (`attack.attacked`) and its targets are those enemies, so "after you attack a minion" matches a
 * minion only a later instruction named.
 */

import { type Ctx, emit, findFrame, updateFrame } from "../ctx.js";
import type { AbilityDefinition, EngineDeps } from "../abilities.js";
import type { FrameId, InstanceId, PlayerId } from "../ids.js";
import { attackKeywordsOf } from "../keywords.js";
import { canAttack, cardsInPlay, categoriesOf, type EffectContext, resolveRef, selectTargets } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { type Frame, pushEvents } from "./frames.js";
import { guardsIgnored, recordKeywordsIgnored } from "./keyword-ignored.js";
import { abilityRootFrameId } from "./thwart-session.js";

type Attack = Extract<TriggerEvent, { kind: "attack" }>;
type Damage = Extract<TriggerEvent, { kind: "dealDamage" }>;
type Attacked = Extract<TriggerEvent, { kind: "characterAttacked" }>;
type AttackFrame = Frame<"event"> & { readonly event: Attack };

const isAttackLabeled = (deps: EngineDeps, frame: Frame<"effects">): boolean =>
  frame.abilityId !== undefined && deps.abilities[frame.abilityId]?.label?.includes("attack") === true;

/** Whether `value` holds an `attack` effect anywhere inside it (a branch, an option, post-"then" text included). */
function holdsAttackEffect(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(holdsAttackEffect);
  if (value === null || typeof value !== "object") return false;
  const record = value as Readonly<Record<string, unknown>>;
  return record.kind === "attack" || Object.values(record).some(holdsAttackEffect);
}

/** Per definition, since a definition's effects never change: read on every damage instruction of an attack ability. */
const labelOnlyCache = new WeakMap<AbilityDefinition, boolean>();

/**
 * Whether `frame` resolves a label-only attack: an "(attack)" ability with no `attack` effect, whose damage
 * instructions are its attack (owner ruling Q48).
 */
function isLabelOnlyAttack(deps: EngineDeps, frame: Frame<"effects">): boolean {
  const definition = frame.abilityId !== undefined ? deps.abilities[frame.abilityId] : undefined;
  if (!definition?.label?.includes("attack")) return false;
  let labelOnly = labelOnlyCache.get(definition);
  if (labelOnly === undefined) {
    labelOnly = !holdsAttackEffect(definition.effects);
    labelOnlyCache.set(definition, labelOnly);
  }
  return labelOnly;
}

type DamageEffect = Extract<EffectSpec, { kind: "dealDamage" }>;

/**
 * Whether a `dealDamage` instruction of an "(attack)" ability can be its attack's damage: not one the script keeps out
 * of the attack (`fromAttack: false`) or marks as an attack's by other means (`fromAttack: true`), not damage its
 * player takes (`taken`), not damage that names another dealer (`sourceFromEvent`).
 */
export const isAttackInstruction = (effect: DamageEffect): boolean =>
  effect.fromAttack === undefined && !effect.taken && !effect.sourceFromEvent;

/** The attack an "(attack)" ability's damage instructions belong to, as one of them resolves. */
export interface AbilityAttack {
  /** The attacking character: the controller's identity (RRG 1.8 "Labeled Ability", p. 26). */
  readonly attackerId: InstanceId;
  readonly playerId: PlayerId;
  /** The attack's frame, waiting beneath the ability: absent when a label-only attack made none (or it was cancelled). */
  readonly waiting: AttackFrame | undefined;
}

/**
 * The attack the damage instructions of `frame`'s ability are part of: defined while one of its attacks waits for it
 * (Q47), and for a label-only attack throughout (Q48), so that guard is read for an instruction even when no attack
 * could be opened for it. Undefined for an unlabeled ability, and for an "(attack)" ability with an `attack` effect
 * that has made no attack (cancelled, or not reached yet): its damage is then plain damage, as before.
 */
export function abilityAttackOf(
  state: GameState,
  deps: EngineDeps,
  frame: Frame<"effects">,
): AbilityAttack | undefined {
  if (!isAttackLabeled(deps, frame) || frame.controllerId === null) return undefined;
  const playerId = frame.controllerId;
  const identity = state.players.find((player) => player.playerId === playerId)?.identity.instanceId;
  if (identity === undefined) return undefined;
  const waiting = waitingAbilityAttack(state, deps, frame);
  if (!waiting && !isLabelOnlyAttack(deps, frame)) return undefined;
  return { attackerId: waiting?.event.attackerInstanceId ?? identity, playerId, waiting };
}

/**
 * Whether the attack may attack `targetId` right now (owner ruling Q49): always for a card that is not an enemy (the
 * instruction's damage to it is not an attack on it), else `canAttack` (guard, a `cannotAttack` rule).
 */
export const mayAttackWith = (
  state: GameState,
  deps: EngineDeps,
  attack: AbilityAttack,
  targetId: InstanceId,
): boolean => !categoriesOf(state, targetId).includes("enemy") || canAttack(state, attack.attackerId, targetId, deps);

/**
 * The targets of a damage instruction that names its enemies, less the enemies the attack may not attack as it
 * resolves (each logged as `attackTargetSkipped`). For the enemies it does attack past a guard minion the attacker
 * ignores, the guard ignored is recorded on the waiting attack, as its own target's is.
 */
export function skipUnattackable(
  ctx: Ctx,
  attack: AbilityAttack,
  sourceInstanceId: InstanceId | null,
  targets: readonly InstanceId[],
): readonly InstanceId[] {
  return targets.filter((id) => {
    if (mayAttackWith(ctx.state, ctx.deps, attack, id)) {
      if (attack.waiting) {
        recordKeywordsIgnored(
          ctx,
          attack.waiting.frameId,
          guardsIgnored(ctx.state, ctx.deps, attack.attackerId, id, attack.playerId),
        );
      }
      return true;
    }
    emit(ctx, {
      type: "attackTargetSkipped",
      attackerInstanceId: attack.attackerId,
      targetInstanceId: id,
      sourceInstanceId,
    });
    return false;
  });
}

/** The enemies in play a damage instruction of a label-only attack names right now; null for any other instruction. */
function namedByAttackInstruction(
  state: GameState,
  effect: EffectSpec,
  context: EffectContext,
): readonly InstanceId[] | null {
  if (effect.kind === "dealDamage")
    return isAttackInstruction(effect) ? resolveRef(state, effect.target, context) : null;
  if (effect.kind === "divide" && effect.what === "damage") return selectTargets(state, effect.among, context);
  return null;
}

/** Pushes a label-only attack's one `attack` event on top of `frame`, tied to the ability's root frame `rootId`. */
function pushLabelAttack(
  ctx: Ctx,
  frame: Frame<"effects">,
  rootId: FrameId,
  identity: InstanceId,
  playerId: PlayerId,
  target: InstanceId | null,
): void {
  updateFrame(ctx, rootId, (other) => (other.kind === "effects" ? { ...other, labelAttackMade: true } : other));
  const [pushed] = pushEvents(ctx, [
    {
      kind: "attack",
      attackerInstanceId: identity,
      targetInstanceId: target,
      playerId,
      amount: 0,
      basic: false,
      labeled: true,
      sourceInstanceId: frame.selfInstanceId,
      ...(frame.abilityId !== undefined ? { sourceAbilityId: frame.abilityId } : {}),
    },
  ]);
  if (pushed !== undefined) {
    updateFrame(ctx, pushed, (other) => (other.kind === "event" ? { ...other, attackOf: rootId } : other));
  }
}

/**
 * A label-only attack begins (RRG 1.8 "Labeled Ability", p. 26; owner decision, 2026-10-08, row 61): called before
 * each effect of an effects frame resolves. On the root frame of an "(attack)" ability with no `attack` effect that
 * has made no attack yet, at its first instruction that is not an opening target choice, this pushes the ability's
 * one `attack` event (`attack.labeled`) on top of the frame and returns true without advancing it. The attack's
 * interrupt window resolves, it deals nothing, and it waits beneath the frame; the frame then resolves the same
 * instruction. The rules it follows (which instructions count, the target it begins with) are in the file header.
 */
export function beginLabelAttack(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: EffectSpec,
  context: EffectContext,
): boolean {
  // An opening target choice is made before the attack begins, and an instruction being answered has begun.
  if (effect.kind === "chooseTarget" || frame.answer !== null) return false;
  if (frame.controllerId === null || frame.labelAttackMade || !isLabelOnlyAttack(ctx.deps, frame)) return false;
  if (abilityRootFrameId(ctx.state, frame) !== frame.frameId) return false;
  const playerId = frame.controllerId;
  const identity = ctx.state.players.find((player) => player.playerId === playerId)?.identity.instanceId;
  if (identity === undefined) return false;
  const inPlay = cardsInPlay(ctx.state);
  const isEnemy = (id: InstanceId): boolean => inPlay.includes(id) && categoriesOf(ctx.state, id).includes("enemy");
  let attacks = false;
  let target: InstanceId | null = null;
  for (const instruction of frame.effects.slice(frame.cursor)) {
    const named = namedByAttackInstruction(ctx.state, instruction, context);
    if (named === null) continue;
    // Nothing named yet (its target is chosen later) or an enemy named: this instruction can attack.
    if (named.length > 0 && !named.some(isEnemy)) continue;
    attacks = true;
    target = named.find((id) => isEnemy(id) && canAttack(ctx.state, identity, id, ctx.deps)) ?? null;
    if (target !== null) break;
  }
  if (!attacks) return false;
  pushLabelAttack(ctx, frame, frame.frameId, identity, playerId, target);
  return true;
}

/**
 * A label-only attack that did not begin with its ability (`beginLabelAttack`: its damage instructions are all inside
 * a branch) is made as the first of them that names an enemy its player's identity may attack is reached (owner
 * ruling Q48). This pushes the ability's one `attack` event on top of the frame and returns true without advancing
 * it; the frame then resolves the same instruction, whose damage is that attack's.
 */
export function openLabelAttack(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: EffectSpec,
  context: EffectContext,
): boolean {
  if (effect.kind === "dealDamage") {
    if (!isAttackInstruction(effect)) return false;
  } else if (effect.kind !== "divide" || effect.what !== "damage" || frame.answer !== null) return false;
  if (frame.controllerId === null || !isLabelOnlyAttack(ctx.deps, frame)) return false;
  const rootId = abilityRootFrameId(ctx.state, frame);
  const root = findFrame(ctx.state, rootId);
  if (root?.kind !== "effects" || root.labelAttackMade) return false;
  const playerId = frame.controllerId;
  const identity = ctx.state.players.find((player) => player.playerId === playerId)?.identity.instanceId;
  if (identity === undefined) return false;
  const inPlay = cardsInPlay(ctx.state);
  const named =
    effect.kind === "dealDamage"
      ? resolveRef(ctx.state, effect.target, context)
      : selectTargets(ctx.state, effect.among, context);
  const [first] = named.filter(
    (id) =>
      inPlay.includes(id) &&
      categoriesOf(ctx.state, id).includes("enemy") &&
      canAttack(ctx.state, identity, id, ctx.deps),
  );
  // No enemy to attack: damage to the player's own characters only, or every enemy named is guarded.
  if (first === undefined) return false;
  pushLabelAttack(ctx, frame, rootId, identity, playerId, first);
  return true;
}

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
 * order attacked, and its event carries them from here on (`attack.attacked`, owner ruling Q50) for its "resolved"
 * line and its response window. Returns true when it pushed any (the frame then finishes beneath them).
 */
export function pushAttackedByAbility(ctx: Ctx, frame: Frame<"event">): boolean {
  if (!frame.attackWaiting || frame.event.kind !== "attack") return false;
  // A label-only attack whose instructions attacked nothing after all attacked no enemy, its first target included.
  if (frame.attacked === undefined && (!frame.event.labeled || frame.event.attacked !== undefined)) return false;
  const once = (frame.attacked ?? []).filter(
    (event, index, all) => all.findIndex((other) => other.targetInstanceId === event.targetInstanceId) === index,
  );
  const ids = once.map((event) => event.targetInstanceId);
  const { attacked: _named, ...rest } = frame;
  // Always stamped on a label-only attack, which is how a second pass here knows this one was made.
  const asMade = !frame.event.labeled && ids.length === 1 && ids[0] === frame.event.targetInstanceId;
  const event: Attack = asMade ? frame.event : { ...frame.event, attacked: ids };
  const finishing = { ...rest, event };
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.map((other) => (other.frameId === frame.frameId ? finishing : other)),
  };
  if (once.length === 0) return false;
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
 * (spread over the event), the `characterAttacked` the attack owes that enemy, and what is added to the instance
 * (`extra`). Null when `targetId` is not an enemy: damage an attack ability deals to its own identity, or to any
 * friendly character, is not attack damage. Called only for an enemy an instruction targets, which is what makes it
 * attacked (owner ruling Q50).
 */
export function abilityAttackDamage(
  state: GameState,
  deps: EngineDeps,
  attack: AttackFrame,
  targetId: InstanceId,
): { readonly damage: Partial<Damage>; readonly attacked: Attacked; readonly extra: number } | null {
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
    // "This attack deals N additional damage" (`modifyAttack.extraDamage` on the attack's frame) increases each
    // instance of the attack's damage (RRG 1.8 "Attack (Player Ability Type)", p. 10; owner ruling Q53): the attack's
    // own damage (`applyPlayerAttack`) and each later instruction's, through here. The caller leaves it off an
    // instruction that is itself additional damage (`dealDamage.additional`).
    extra: Math.max(0, attack.vars.extraDamage ?? 0),
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

/**
 * Adds the enemies a later instruction attacked to the waiting attack's list. An attack that began before any enemy
 * could be named (`beginLabelAttack`) takes the first of them as its target.
 */
export function noteAttackedByAbility(ctx: Ctx, attackFrameId: FrameId, attacked: readonly Attacked[]): void {
  const [first] = attacked;
  if (first === undefined) return;
  ctx.state = {
    ...ctx.state,
    stack: ctx.state.stack.map((frame) => {
      if (frame.frameId !== attackFrameId || frame.kind !== "event") return frame;
      const event =
        frame.event.kind === "attack" && frame.event.targetInstanceId === null
          ? { ...frame.event, targetInstanceId: first.targetInstanceId }
          : frame.event;
      return { ...frame, event, attacked: [...(frame.attacked ?? []), ...attacked] };
    }),
  };
}
