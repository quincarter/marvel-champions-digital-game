/**
 * "As an additional cost to attack [an enemy], you must discard 1 card from your hand." (`RuleSpec
 * additionalAttackCost`, docs/phase7-wave10-hero-packs.md H3.16): a cost a rule adds to every attack a player makes
 * against a matching enemy. Whether it can be paid, when it is charged, and how it is paid.
 *
 * RRG 1.8 "Cost" (p. 14): "Some card abilities may reference an 'additional cost.' A player must pay all additional
 * costs simultaneously with the cost that is being added to … if they cannot pay for all of the costs at once, then
 * they do not pay any of the costs and the effect associated with the costs does not occur." "Attack (Player Ability
 * Type)" (p. 10): "Hero and ally attacks can target any enemy, unless a card ability … is preventing that enemy from
 * being attacked", and "If a triggered ability is labeled as an attack … resolving that ability is considered to
 * attack the specified target." "Labeled Ability" (p. 26): the attack is made by the player's identity.
 *
 * - **Who pays.** The controller of the attacking character: the player whose hero or ally makes a basic attack, and
 *   the player resolving an "(attack)" ability, whose identity attacks (p. 26). An attack no player makes (one enemy
 *   attacking another) owes nothing.
 * - **An enemy the attacker's controller cannot pay for cannot be attacked** (`attackCostBars`, read by `canAttack`),
 *   as the owner ruled for the additional cost to thwart a scheme (docs/phase7-wave5.md §4.1 Q18): it is no legal
 *   target of a basic attack, is not offered to an "(attack)" ability's choice, and is skipped by an instruction that
 *   names it with others ("each enemy"), exactly as a villain behind a guard minion is. So the character does not
 *   exhaust and no card is spent on an attack that could not be paid for.
 * - **When it is paid: as the attack is made against that enemy, before anything of the attack resolves**
 *   (`chargeAttackCosts`, looked at before every frame the stack runs). A basic attack and an `attack` effect are an
 *   `attack` event: the cost is paid before that event's "when … attacks" window. An "(attack)" ability's damage or
 *   defeat instruction names its enemies as it resolves: the cost is paid before that damage or defeat. The engine asks
 *   an ability's "choose an enemy" as it resolves, after the card's own costs, so "simultaneously" (p. 14) is read as
 *   "with nothing in between": the hand that pays is the hand left once the card's own costs are paid, which is the
 *   hand a simultaneous payment would have had to find both costs in. See the report with HT13 for the alternative.
 * - **Once per attack per enemy.** An "(attack)" ability is one attack however many instances of damage it deals
 *   (p. 10), so an enemy two of its instructions name is paid for once (`attackCostsCharged` on the attack's event
 *   frames, shared by the events of one ability). A second attack pays again.
 * - **Mandatory once the enemy is attacked.** The text is "you must": a player who can pay and attacks the enemy pays.
 *   With a choice of enemy the player declines by choosing another; an instruction that names the enemy among others
 *   attacks it whenever it can be paid for.
 * - **A stunned character's basic attack still pays** (`pushAttackCosts` from the command): RRG 1.8 "Stun, Stunned"
 *   (p. 41), "Costs associated with the attack attempt, including exhausting the character, must still be paid", as
 *   the owner ruled for a confused thwart (wave 5 §4.1 Q40). A stunned identity's "(attack)" ability is cancelled as
 *   it is triggered, before it names an enemy, and pays nothing.
 * - **Not charged:** damage that is not an attack on the enemy (an unlabeled ability's damage, an overkill spill,
 *   retaliate, an instruction marked `fromAttack: false`), and an enemy an attack was moved onto in its own window
 *   (`retargetAttack`): the player did not choose to attack it.
 *
 * What the cost may be: any `AbilityCost` that `planCost` checks and `payCost` pays at once without resources: a
 * discard from hand above all. `@mc/cards`' validator refuses the rest.
 */

import type { EngineDeps } from "./abilities.js";
import { handDiscardCandidates, isPriceFault, payCost, planCost } from "./actions.js";
import { type Ctx, emit, requestChoice, setFrame } from "./ctx.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { getInstance } from "./query.js";
import { type Frame, pushEffects } from "./resolve/frames.js";
import { requirementTotal } from "./resources.js";
import { additionalAttackCostsFor, type AttackCostOwed } from "./rules.js";
import { activeRules, cardsInPlay, controllerOf } from "./select.js";
import type { EffectSpec } from "./spec.js";
import type { StackFrame } from "./stack.js";
import type { GameState } from "./state.js";
import { displayNameOf } from "./visibility.js";

type AttackFrame = Frame<"event"> & { readonly event: { readonly kind: "attack" } };

const isAttackFrame = (frame: StackFrame): frame is AttackFrame =>
  frame.kind === "event" && frame.event.kind === "attack";

/** Whether any additional attack cost is in force at all (the cheap guard for every reader below). */
const anyAttackCost = (state: GameState, deps: EngineDeps): boolean =>
  activeRules(state, deps, "additionalAttackCost").length > 0;

/**
 * The additional costs `attackerId`'s controller owes to attack `targetId` now, one per rule that names it; none for
 * an attacker no player controls.
 */
export function attackCostsOwed(
  state: GameState,
  deps: EngineDeps,
  attackerId: InstanceId,
  targetId: InstanceId,
): readonly AttackCostOwed[] {
  const payer = controllerOf(state, attackerId);
  if (payer === null) return [];
  return additionalAttackCostsFor(state, deps, targetId, payer);
}

/** The hand cards a cost's "discard N cards from your hand" part would take by default, leaving out `taken`. */
function defaultDiscards(
  state: GameState,
  deps: EngineDeps,
  owed: AttackCostOwed,
  playerId: PlayerId,
  taken: ReadonlySet<InstanceId>,
): readonly InstanceId[] {
  const part = owed.cost.discardFromHand;
  if (!part) return [];
  return handDiscardCandidates(state, deps, owed.sourceInstanceId, playerId, owed.cost)
    .filter((id) => !taken.has(id))
    .slice(0, part.min);
}

/**
 * Whether `playerId` could pay all of `owed` at once, now, with none of the cards in `spending` (cards the attack's
 * own costs take from the hand): each cost is planned by `planCost`, the planner every cost is paid through, with the
 * discards the costs before it would take set aside (RRG 1.8 "Cost", p. 13: one card cannot pay two costs).
 */
function payable(
  state: GameState,
  deps: EngineDeps,
  playerId: PlayerId,
  owed: readonly AttackCostOwed[],
  spending: ReadonlySet<InstanceId>,
): boolean {
  const taken = new Set(spending);
  for (const each of owed) {
    const picks = defaultDiscards(state, deps, each, playerId, taken);
    const plan = planCost(
      state,
      deps,
      each.sourceInstanceId,
      playerId,
      each.cost,
      each.cost.discardFromHand ? { discard: picks } : {},
      taken,
    );
    if (isPriceFault(plan) || requirementTotal(plan.requirement) > 0) return false;
    for (const id of picks) taken.add(id);
  }
  return true;
}

/**
 * Whether the additional costs to attack every one of `targetIds` with `attackerId` could be paid together now, by
 * the attacker's controller, without the hand cards in `spending`. True when nothing is owed.
 */
export function attackCostsPayable(
  state: GameState,
  deps: EngineDeps,
  attackerId: InstanceId,
  targetIds: readonly InstanceId[],
  spending: ReadonlySet<InstanceId> = new Set(),
): boolean {
  if (!anyAttackCost(state, deps)) return true;
  const playerId = controllerOf(state, attackerId);
  if (playerId === null) return true;
  const owed = [...new Set(targetIds)].flatMap((targetId) => attackCostsOwed(state, deps, attackerId, targetId));
  return owed.length === 0 || payable(state, deps, playerId, owed, spending);
}

/** The attack frames that are one attack with `frame`: itself, and the other events of the same "(attack)" ability. */
const sameAttack = (state: GameState, frame: AttackFrame): readonly AttackFrame[] =>
  state.stack.filter(
    (other): other is AttackFrame =>
      isAttackFrame(other) &&
      (other.frameId === frame.frameId || (frame.attackOf !== undefined && other.attackOf === frame.attackOf)),
  );

/** Whether an attack by `attackerId` now on the stack has already been charged for `targetId`. */
const alreadyCharged = (state: GameState, attackerId: InstanceId, targetId: InstanceId): boolean =>
  state.stack.some(
    (frame) =>
      isAttackFrame(frame) &&
      frame.event.attackerInstanceId === attackerId &&
      frame.attackCostsCharged?.includes(targetId) === true,
  );

/**
 * Whether an additional attack cost keeps `attackerId` from attacking `targetId` right now: a cost is owed that its
 * controller cannot pay, and no attack by that character under way has already been charged for the enemy (an
 * "(attack)" ability's later instruction naming an enemy its first one paid for). Read by `canAttack`.
 */
export function attackCostBars(
  state: GameState,
  deps: EngineDeps,
  attackerId: InstanceId,
  targetId: InstanceId,
): boolean {
  if (!anyAttackCost(state, deps)) return false;
  if (attackCostsPayable(state, deps, attackerId, [targetId])) return false;
  return !alreadyCharged(state, attackerId, targetId);
}

/** The step that pays one additional attack cost (`EffectSpec payAttackCost`), as its own frame for `playerId`. */
function pushPayment(
  ctx: Ctx,
  playerId: PlayerId,
  attackerId: InstanceId,
  targetId: InstanceId,
  owed: AttackCostOwed,
): void {
  const step: EffectSpec = {
    kind: "payAttackCost",
    attackerInstanceId: attackerId,
    targetInstanceId: targetId,
    cost: owed.cost,
  };
  pushEffects(ctx, { effects: [step], selfInstanceId: owed.sourceInstanceId, controllerId: playerId });
}

/**
 * Pushes the payment of every additional cost to attack `targetIds` with `attackerId`, on top of the stack, so each
 * is paid before whatever was about to resolve (the first target's first). For an attack attempt that makes no
 * `attack` event: a stunned character's basic attack. Returns whether anything was pushed.
 */
export function pushAttackCosts(ctx: Ctx, attackerId: InstanceId, targetIds: readonly InstanceId[]): boolean {
  if (!anyAttackCost(ctx.state, ctx.deps)) return false;
  const playerId = controllerOf(ctx.state, attackerId);
  if (playerId === null) return false;
  const due = [...new Set(targetIds)].flatMap((targetId) =>
    attackCostsOwed(ctx.state, ctx.deps, attackerId, targetId).map((owed) => ({ targetId, owed })),
  );
  for (const { targetId, owed } of [...due].reverse()) pushPayment(ctx, playerId, attackerId, targetId, owed);
  return due.length > 0;
}

/**
 * The enemies this attack is being made against that it has not been charged for (file header, "When it is paid"):
 *
 * - **its own target**, as the event comes to the top of the stack for the first time (before its "when … attacks"
 *   window), or as an attack begun with its ability is taken over by the `attack` instruction that names its enemy
 *   (`resumeBegunAttack`). Not the target a label-only or begun attack was read ahead to: its instructions name the
 *   enemies it attacks.
 * - **each enemy an instruction of its ability attacked** (`attacked`).
 *
 * Never the character the attack was moved onto in its window (`attackRetarget`).
 */
function uncharged(state: GameState, frame: AttackFrame, top: boolean): readonly InstanceId[] {
  if (frame.cancelled) return [];
  const event = frame.event;
  const made = event.labeled !== true && frame.attackBegun !== true;
  const arriving = frame.stage === "interrupts" || (frame.stage === "apply" && event.begun === true);
  const own = top && made && arriving && event.targetInstanceId !== null ? [event.targetInstanceId] : [];
  const named = (frame.attacked ?? []).map((attacked) => attacked.targetInstanceId);
  const charged = new Set(sameAttack(state, frame).flatMap((other) => other.attackCostsCharged ?? []));
  const inPlay = cardsInPlay(state);
  return [...new Set([...own, ...named])].filter(
    (id) => !charged.has(id) && id !== frame.attackRetarget?.to && inPlay.includes(id),
  );
}

/**
 * Looked at before each frame the stack runs: every player attack on the stack that is being made against an enemy
 * it has not been charged for is charged now (`uncharged`), the payment pushed on top so it is made first. The enemy
 * is marked on the attack's frame whether or not a cost is owed, so it is looked at once. Returns whether a payment
 * was pushed (the caller then runs the stack again).
 */
export function chargeAttackCosts(ctx: Ctx): boolean {
  if (!ctx.state.stack.some(isAttackFrame) || !anyAttackCost(ctx.state, ctx.deps)) return false;
  const due: { readonly attackerId: InstanceId; readonly targetId: InstanceId }[] = [];
  ctx.state.stack.forEach((frame, index) => {
    if (!isAttackFrame(frame)) return;
    // Read from the live stack: an earlier frame of the same attack may just have been marked.
    const live = ctx.state.stack.find((other) => other.frameId === frame.frameId);
    if (!live || !isAttackFrame(live)) return;
    const targets = uncharged(ctx.state, live, index === 0);
    if (targets.length === 0) return;
    setFrame(ctx, { ...live, attackCostsCharged: [...(live.attackCostsCharged ?? []), ...targets] });
    for (const targetId of targets) due.push({ attackerId: live.event.attackerInstanceId, targetId });
  });
  let pushed = false;
  for (const { attackerId, targetId } of [...due].reverse()) {
    pushed = pushAttackCosts(ctx, attackerId, [targetId]) || pushed;
  }
  return pushed;
}

/**
 * The `payAttackCost` step: the cost is planned and paid by the frame's player, with the rule's card as its source.
 * A "discard N cards from your hand" part with more candidates than it takes asks which (a `chooseTarget` choice on
 * slot `discard`, as an effect's discard asks); a forced pick pays itself. Logged `additionalAttackCostPaid`.
 *
 * `canAttack` let the attack name this enemy only while the cost could be paid, so a cost that cannot be paid here
 * means the hand changed in between (two costly enemies named by one instruction and a hand that pays for one). The
 * attack is not undone: logged `additionalAttackCostNotPaid` with the reason, for the replay to show.
 */
export function executePayAttackCost(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "payAttackCost" }>,
): void {
  const playerId = frame.controllerId;
  const sourceId = frame.selfInstanceId;
  const { attackerInstanceId, targetInstanceId, cost } = effect;
  const done = (): void => setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  if (playerId === null || sourceId === null) return done();
  const log = { playerId, attackerInstanceId, targetInstanceId, sourceInstanceId: sourceId };
  const notPaid = (reason: string): void => {
    done();
    emit(ctx, { type: "additionalAttackCostNotPaid", ...log, reason });
  };
  const part = cost.discardFromHand;
  let choices: { discard?: readonly InstanceId[] } = {};
  if (part) {
    const candidates = handDiscardCandidates(ctx.state, ctx.deps, sourceId, playerId, cost);
    if (candidates.length < part.min) return notPaid("not enough cards in hand to discard");
    const forced = candidates.length === part.min;
    if (!forced && frame.answer === null) {
      requestChoice(ctx, {
        playerId,
        prompt: { kind: "chooseTarget", slot: "discard", abilityId: null },
        options: candidates.map((id) => ({
          optionId: id,
          label: displayNameOf(ctx.state, id),
          ref: { kind: "card", instanceId: id } as const,
        })),
        minSelections: part.min,
        maxSelections: Math.min(candidates.length, part.max ?? candidates.length),
        frameId: frame.frameId,
      });
      return;
    }
    choices = { discard: forced ? candidates : candidates.filter((id) => frame.answer?.includes(id)) };
  }
  const plan = planCost(ctx.state, ctx.deps, sourceId, playerId, cost, choices, new Set());
  if (isPriceFault(plan)) return notPaid(plan.message);
  if (requirementTotal(plan.requirement) > 0) return notPaid("an additional attack cost has no resource part");
  done();
  payCost(ctx, sourceId, playerId, cost, plan);
  emit(ctx, { type: "additionalAttackCostPaid", ...log });
}

/** The card whose rule asks an additional cost to attack `targetId` that `attackerId`'s controller cannot pay. */
export function unpayableAttackCostSource(
  state: GameState,
  deps: EngineDeps,
  attackerId: InstanceId,
  targetId: InstanceId,
): InstanceId | null {
  if (!attackCostBars(state, deps, attackerId, targetId)) return null;
  const [first] = attackCostsOwed(state, deps, attackerId, targetId);
  return first && getInstance(state, first.sourceInstanceId) ? first.sourceInstanceId : null;
}
