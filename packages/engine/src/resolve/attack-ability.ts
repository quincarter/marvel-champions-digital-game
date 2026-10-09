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
 *   `attackAwaitsAbility`. While it waits it is not "this attack" (`currentActivationFrameId`): the ability's other
 *   instructions name the activation around it, if any. It is again once it starts to finish (below).
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
 * "(attack)" ability's attack that was never made (no frame waits, so its later damage is plain damage).
 * An ability with several `attack` effects still makes one `attack` event each; each waits and finishes in order.
 * When each begins is below ("An ability with an `attack` effect begins its attack the same way").
 *
 * **A cancelled attack deals no damage** (owner decision, 2026-10-08, docs/phase7-wave8.md §4.1 row 65, rules check
 * A6: "cancelling a damage-only attack cancels its damage too"). No official text names the case. What the decision
 * rests on, RRG 1.8 "Cancel" (p. 11): "Cancel abilities interrupt the initiation of effects and prevent them from
 * resolving" and "Cancel effects are considered a subtype of replacement effect, with the canceled effect being
 * replaced with no effect. Abilities dependent on the canceled effect cannot trigger as the canceled effect is not
 * considered to have occurred"; "Attack (Player Ability Type)" (p. 10): "An ability labeled as an attack is considered
 * a single attack, even if that attack deals multiple instances of damage", so the instances of damage are the attack
 * that was cancelled. When an `attack` event of an "(attack)" ability by its controller's identity is cancelled (an
 * interrupt's `cancelTriggeringEvent` in its "when … attacks" window), the ability's root frame is marked
 * (`attackCancelled`, `cancelAbilityAttack`) and from then on:
 *
 * - **its damage instructions deal enemies nothing**: a `dealDamage` that would be the attack's
 *   (`isAttackInstruction`) and a division of damage skip every enemy, each logged as `attackTargetSkipped` with
 *   `reason: "attackCancelled"`, and a chosen-enemy instruction is offered no enemy. No enemy is attacked, nothing
 *   retaliates, and nothing answers "after … attacks" (the event's `cancelled` line, no response window);
 * - **its remaining `attack` effects are cancelled too** (the ability is one attack, p. 10): one not yet reached makes
 *   no event, and one whose event is already on the stack (the next enemy of "each enemy") is cancelled before its
 *   interrupt window;
 * - **post-"then" text does not resolve** when the text before it held a cancelled instruction (`preThenUnresolved`,
 *   cause `attackCancelled`; RRG 1.8 "'Then'", p. 44).
 *
 * Interpretations beyond that text, each with its alternative:
 *
 * - **The ability's other instructions still resolve**: a status given, a card drawn, damage its player takes, damage
 *   to a card that is not an enemy, an instruction the script keeps out of the attack (`fromAttack: false`). The
 *   attack was cancelled, not the ability, and this is what a cancelled "(thwart)" already does (`thwart-session.ts`:
 *   every instance of threat removal goes, the rest of the ability resolves). An instruction that reads the cancelled
 *   damage ("if that enemy was defeated", "for each damage dealt") finds nothing. (Alternative: the whole ability is
 *   cancelled except its costs, which is what RRG 1.8 "Labeled Ability", p. 26, says of a labeled ability cancelled
 *   by a status card: "the entire ability (except for its costs) is canceled". That sentence is about status cards
 *   only, so it was not extended here; reported to the owner.)
 * - **Damage already dealt stays dealt.** A label-only attack's window opens before its first instruction, so nothing
 *   precedes the cancel. In an ability with several `attack` effects an earlier one may have resolved: its damage
 *   stands, the enemies it attacked were attacked (they retaliate, and "after … attacks" answers that event when the
 *   ability finishes), and only what comes after the cancel is stopped. P. 11 prevents effects "from initiating"; it
 *   undoes nothing. (Alternative: the earlier attack's "after" abilities are silenced too; not built.)
 * - **A stunned identity is not this case**: its whole ability is cancelled by the status card first (p. 26,
 *   `labelCancels`), as before.
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
 *   attack, p. 26) and "after you attack [an enemy]" does not. An ability whose attack names only enemies that cannot
 *   be attacked is refused before it is played, whatever else it does (`attackNamesNoAttackableEnemy` in
 *   `target-validity.ts`; RRG 1.8 "Target", p. 43: "A target that cannot be attacked is not a valid target for an
 *   attack-labeled ability"; owner decision, 2026-10-08, row 64). So this case is left to an ability whose enemies
 *   are not known as it is initiated (a branch, "each minion" with none in play) or become guarded as it resolves.
 * - **An attack is begun only by an ability that can attack an enemy.** It begins when one of the ability's damage
 *   instructions on the path it is about to resolve could name an enemy: its target is not known yet, or it names
 *   one now. An ability whose damage instructions name only its player's own characters makes no attack, as before.
 *   One whose damage instructions sit inside a branch not decided as it begins ("place a counter here; if there is a
 *   counter here, deal 2 damage to an enemy"), or reached with nothing resolving before them, makes its attack as the
 *   branch reaches the instruction (`openLabelAttack`), so a resolution that never takes the branch makes none, as
 *   before. What "decided as it begins" reads is stated with row 73 below (`attackAhead`), and since row 73 a damage
 *   instruction in a branch already decided, after another instruction, begins the attack with the ability.
 *   (Alternative: every "(attack)" ability attacks from its start whatever it then does, which p. 26 read alone
 *   supports; not adopted, to keep those two behaviors.)
 *
 * **An ability with an `attack` effect begins its attack the same way** (owner decision, 2026-10-08,
 * docs/phase7-wave8.md §4.1 row 73, rules check A1, second half: "Fix all affected older cards so the attack begins
 * when the ATK attack actually starts resolving. Keep attack timing consistent."). Official rule: the same sentence of
 * p. 26, which speaks of every labeled ability. When another instruction resolves before the ability's `attack`
 * instruction (a discard that sets the damage, a status given first, an enemy that attacks first), the attack begins
 * before that instruction, with its "when … attacks" window, and its damage is dealt when the `attack` instruction is
 * reached. The attack's beginning is split from its damage:
 *
 * - **It begins** (`beginLabelAttack`) as an `attack` event marked `begun`, by the identity, with amount 0. Its
 *   interrupt window resolves and it waits beneath the ability's root frame (`attackBegun`), exactly as a label-only
 *   attack does. A cancel in that window is the cancelled attack of row 65 (above): the instructions before the
 *   `attack` instruction still resolve, the `attack` instruction makes no attack.
 * - **The `attack` instruction takes it over** (`resumeBegunAttack`): the ability's first `attack` instruction by
 *   that identity gives the waiting event its target, amount, overkill and keywords and puts the same frame back on
 *   top of the stack at its damage step. No second event, no second window. What the window put on the frame is still
 *   there when the damage is computed: `modifyAttack`'s additional damage, ATK bonus and keywords, and effects
 *   lasting "for this attack". The attack then waits for the rest of its ability as before (Q47).
 * - **Damage instructions written before it are the attack's too** ("Deal 1 damage to each minion. Deal 8 damage to
 *   an enemy": one attack, RRG 1.8 p. 10), since the attack is waiting when they resolve: attack damage by the
 *   identity, each enemy named attacked, guard read for each, the attack's increase added to each instance (Q53).
 *   Before row 73 they were plain damage, dealt before the attack existed.
 *
 * Interpretations (not official text), each with its alternative:
 *
 * - **What is read ahead as the ability begins** (`attackAhead`). The engine follows the ability's instructions in
 *   order from its first one that is not an opening target choice, as far as their outcome is already decided: an
 *   `if` by its condition as it stands now ("if you paid for this card using a [physical] resource"), post-"then"
 *   text as resolving, a choice among options only when every option offered leads to an attack ("discard up to 4
 *   cards → deal …"). The attack begins with the ability when that path reaches an instruction that makes an attack
 *   (an `attack` instruction by the identity, or a damage instruction able to name an enemy) and something resolves
 *   before it. A branch not taken makes no attack, as before. An attack reached only through something not decided
 *   yet (a branch whose condition does not hold yet, a loop, one option of several) begins as its instruction is
 *   reached, as before. An attack whose own instruction is the first to resolve begins there, which is the same
 *   moment. (Alternatives: every "(attack)" ability attacks from its start whatever it then does, which p. 26 read
 *   alone supports, declined with row 61 to keep "a branch not taken makes no attack"; or never read into a branch,
 *   which leaves "Stun an enemy. If you paid with [physical], deal 3 damage to that enemy" beginning its attack after
 *   the stun.) The same reading now applies to a label-only attack: one whose damage sits in a branch already decided
 *   as the ability begins, after another instruction, begins with the ability instead of at that damage instruction.
 * - **What its window hears.** The target is read as for a label-only attack: the first enemy the identity may
 *   attack that an instruction of the attack names, taken in order (a damage instruction before the `attack`
 *   instruction first), or none (`null`) when it is chosen later. The keywords and overkill are the `attack`
 *   instruction's ("when you make a ranged attack" hears a ranged one). The amount is not known and reads 0.
 *   (Alternative: the amount as it would be if nothing more resolved first; not built, since a discard or a boost
 *   icon count would make it a guess.)
 * - **An `attack` instruction that names several enemies** ("each enemy") makes one event per enemy, as it always
 *   has. The begun attack is the first of them (the enemy its window heard, if that instruction still names it); the
 *   others are made as the instruction is reached, each with its own window. (Alternative: the other enemies' events
 *   skip their window and copy the first's modifiers; not built. No shipped ability with an instruction before such
 *   an `attack` exists.)
 * - **An ability that makes several separate attacks** (two `attack` instructions) still makes one attack per
 *   instruction. The first begins as the ability begins (through `beginLabelAttack` when something precedes it,
 *   otherwise at its own instruction, the same moment); each later one begins as its instruction is reached, with
 *   its own window. P. 26 has the identity attacking from the ability's start, which the first attack satisfies; p. 10
 *   ("An ability that increases the damage of an attack only increases the damage of one of that ability's attacks")
 *   has each attack hear "when you attack" on its own, and an attack that had begun before the one in front of it
 *   finished would have its window before that attack's damage and defeats. (Alternative: every attack of the
 *   ability begins at the start, in order; not built.)
 * - **A stun received while the ability resolves does not stop an attack that has begun.** RRG 1.8 "Stun, Stunned"
 *   (p. 41): "When this character would attack, remove each stunned status card from it instead" and "If a stunned
 *   identity or ally attempts to attack or use an attack ability, discard the stunned card instead." The attempt was
 *   made as the ability began, with no stunned card (a stunned identity's whole ability is cancelled then, p. 26,
 *   `labelCancels`), so the `attack` instruction that takes a begun attack over does not read the status again and
 *   the stunned card stays for the next attack. An attack that begins at its own instruction reads it there, as
 *   before. (Alternative: the instruction discards the stunned card and deals nothing, which is what happened before
 *   row 73 when "that enemy attacks you" stunned the hero before "deal 5 damage to that enemy".)
 * - **An attack that began and whose instruction is never reached, or names no enemy it may attack by then**, is the
 *   label-only case above: it attacked the enemies its other damage instructions named, or nobody.
 *
 * **A target changed in the attack's window** (`EffectSpec retargetAttack` with `attack: "player"`: "when you attack an
 * enemy, change the target of this attack to a friendly character"; docs/phase7-wave7.md §3.66). Official text: RRG
 * 1.8 "Attack (Player Ability Type)" (p. 10), "resolving that ability is considered to attack the specified target",
 * and the card that changes the target. The invariant: once an attack event exists, its target as its window left it
 * is where that attack's damage goes, whichever instruction deals it. An `attack` instruction that makes its own
 * event has always done this (the event's apply step reads the event's target). For an attack whose damage is dealt
 * by instructions that resolve after its window (a label-only attack, a begun attack) the frame remembers the move
 * (`attackRetarget`: `from` the enemy the window heard, `to` the character it was moved onto), and what follows is
 * this engine's interpretation of the card, chosen to match the plain path:
 *
 * - **The attack on `from` is the attack on `to`.** Each instance of the attack's damage that an instruction aims at
 *   `from` is dealt to `to` instead, as attack damage by the identity with the attack's keywords and its increase
 *   (Q53), and `to` is the character attacked: it retaliates, `from` does not, and "after you attack [an enemy]" does
 *   not answer for it. Guard is read for `from` as the instruction resolves, as before: an instruction that may not
 *   attack `from` deals nothing, so nothing is moved. (Alternative: only the first instance moves; not built, since
 *   the card changes "the target of this attack", and the ability is one attack, p. 10.)
 * - **The `attack` instruction of a begun attack** takes the begun event over as its attack on `from` and deals its
 *   damage to `to` (`begunAttackTarget`). If it no longer names `from`, it takes it over as its attack on the first
 *   enemy it names, as it does with no retarget, and that enemy is dealt the damage: the move was off `from`.
 * - **Several enemies** ("each enemy"): only the attack on `from` moves, which is what a plain `attack` instruction
 *   does (one event per enemy, each retargeted on its own). The other enemies are attacked and damaged as written.
 *   Unlike the plain path they have no window of their own in which to be moved (file header above: "No later window
 *   opens for that enemy").
 * - **An attack that began with no target** (`null`: its enemy is chosen later) has no target to move, so the
 *   retarget does nothing and logs nothing (`retargetAttack` requires a target), and the attack resolves as written.
 * - **`to` has left play** by the time an instruction would deal it damage: that instance is not dealt
 *   (`attackTargetSkipped` naming `to`), and `from` is not dealt it either.
 * - **Not built: a division of damage** (`divide`, `effects-frame.ts`). Its shares are assigned by the player after
 *   the window, among the enemies only, so a share given to `from` still goes to `from`. No shipped card pairs the
 *   two; reported to the owner.
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
import {
  canAttack,
  cardsInPlay,
  categoriesOf,
  type EffectContext,
  evaluate,
  resolveRef,
  selectTargets,
} from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { ReportTarget } from "../stack.js";
import type { GameState } from "../state.js";
import type { TriggerEvent } from "../trigger-events.js";
import { type Frame, pushEvents } from "./frames.js";
import { guardsIgnored, recordKeywordsIgnored } from "./keyword-ignored.js";
import { markPreThenUnresolved } from "./then.js";
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
  /** An attack of this ability was cancelled: its instructions deal enemies no more damage (row 65, file header). */
  readonly cancelled: boolean;
  /** The effects frame whose instruction is resolving (a branch's own frame), marked when its damage is cancelled. */
  readonly frameId: FrameId;
}

/** Whether an attack of the "(attack)" ability `frame` belongs to was cancelled (`cancelAbilityAttack`). */
function abilityAttackCancelled(state: GameState, frame: Frame<"effects">): boolean {
  const root = findFrame(state, abilityRootFrameId(state, frame));
  return root?.kind === "effects" && root.attackCancelled === true;
}

/**
 * An `attack` event was cancelled: when it is an "(attack)" ability's attack by its controller's identity (`attackOf`),
 * the ability's root frame remembers it, so the rest of that attack does not resolve (owner decision, 2026-10-08, row
 * 65; file header).
 */
export function cancelAbilityAttack(ctx: Ctx, frame: Frame<"event">): void {
  if (frame.event.kind !== "attack" || frame.attackOf === undefined) return;
  updateFrame(ctx, frame.attackOf, (root) => (root.kind === "effects" ? { ...root, attackCancelled: true } : root));
}

/** Whether this attack event's ability has had an attack cancelled, so this one is cancelled with it. */
export function cancelledWithAbilityAttack(state: GameState, frame: Frame<"event">): boolean {
  if (frame.event.kind !== "attack" || frame.attackOf === undefined || frame.attackWaiting) return false;
  const root = findFrame(state, frame.attackOf);
  return root?.kind === "effects" && root.attackCancelled === true;
}

/**
 * Logs the enemies an instruction of a cancelled attack would have attacked (`attackTargetSkipped`, reason
 * `attackCancelled`) and marks the instruction's frame as not fully resolved, for a later "then".
 */
export function skipForCancelledAttack(
  ctx: Ctx,
  attack: Pick<AbilityAttack, "attackerId" | "frameId">,
  sourceInstanceId: InstanceId | null,
  enemies: readonly InstanceId[],
): void {
  for (const id of enemies) {
    emit(ctx, {
      type: "attackTargetSkipped",
      attackerInstanceId: attack.attackerId,
      targetInstanceId: id,
      sourceInstanceId,
      reason: "attackCancelled",
    });
  }
  if (enemies.length > 0) markPreThenUnresolved(ctx, attack.frameId, "attackCancelled");
}

/** The root frame of `frame`'s "(attack)" ability when an attack of it was cancelled, for an `attack` effect to read. */
export const attackEffectCancelled = (state: GameState, deps: EngineDeps, frame: Frame<"effects">): boolean =>
  isAttackLabeled(deps, frame) && abilityAttackCancelled(state, frame);

/**
 * The attack the damage instructions of `frame`'s ability are part of: defined while one of its attacks waits for it
 * (Q47), and for a label-only attack throughout (Q48), so that guard is read for an instruction even when no attack
 * could be opened for it, and once an attack of the ability was cancelled (`cancelled`). Undefined for an unlabeled
 * ability, and for an "(attack)" ability with an `attack` effect that has made no attack (not reached yet): its damage
 * is then plain damage, as before.
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
  const cancelled = abilityAttackCancelled(state, frame);
  if (!waiting && !cancelled && !isLabelOnlyAttack(deps, frame)) return undefined;
  return {
    attackerId: waiting?.event.attackerInstanceId ?? identity,
    playerId,
    waiting,
    cancelled,
    frameId: frame.frameId,
  };
}

/**
 * Whether the attack may attack `targetId` right now (owner ruling Q49): always for a card that is not an enemy (the
 * instruction's damage to it is not an attack on it), else `canAttack` (guard, a `cannotAttack` rule). No enemy once
 * the attack was cancelled (row 65).
 */
/**
 * Where the waiting attack's damage aimed at `targetId` goes when its window moved it off that enemy (`attackRetarget`,
 * file header "A target changed in the attack's window"): the character it was moved onto. Undefined otherwise.
 */
export const movedAttackTarget = (attack: AttackFrame | undefined, targetId: InstanceId): InstanceId | undefined => {
  const moved = attack?.attackRetarget;
  return moved !== undefined && moved.from === targetId && moved.to !== targetId ? moved.to : undefined;
};

interface DamageAim {
  readonly named: InstanceId;
  readonly dealtTo: InstanceId;
  readonly moved: boolean;
}

/**
 * The characters a damage instruction of the waiting attack deals its damage to: each target the instruction names,
 * with the enemy the attack was moved off replaced by the character it was moved onto (`dealtTo`; `named` is still the
 * card the instruction names, which its per-target amount is read for). A character moved onto that has left play is
 * dealt nothing, logged as `attackTargetSkipped`.
 */
export function withMovedAttackTarget(
  ctx: Ctx,
  attack: AttackFrame | undefined,
  sourceInstanceId: InstanceId | null,
  targets: readonly InstanceId[],
): readonly DamageAim[] {
  const inPlay = attack?.attackRetarget ? cardsInPlay(ctx.state) : [];
  return targets.flatMap((named): DamageAim[] => {
    const to = movedAttackTarget(attack, named);
    if (to === undefined) return [{ named, dealtTo: named, moved: false }];
    if (inPlay.includes(to)) return [{ named, dealtTo: to, moved: true }];
    emit(ctx, {
      type: "attackTargetSkipped",
      attackerInstanceId: attack!.event.attackerInstanceId,
      targetInstanceId: to,
      sourceInstanceId,
    });
    return [];
  });
}

export const mayAttackWith = (
  state: GameState,
  deps: EngineDeps,
  attack: AbilityAttack,
  targetId: InstanceId,
): boolean =>
  !categoriesOf(state, targetId).includes("enemy") ||
  (!attack.cancelled && canAttack(state, attack.attackerId, targetId, deps));

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
  if (attack.cancelled) {
    // The attack was cancelled: its damage to enemies is not dealt (row 65); anything else it names is dealt its own.
    const isEnemy = (id: InstanceId): boolean => categoriesOf(ctx.state, id).includes("enemy");
    skipForCancelledAttack(ctx, attack, sourceInstanceId, targets.filter(isEnemy));
    return targets.filter((id) => !isEnemy(id));
  }
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

type AttackKeywords = NonNullable<Attack["keywords"]>;

/** An instruction that makes or continues an "(attack)" ability's attack, as read ahead while the ability begins. */
interface AttackMaker {
  /** The cards it names right now: empty when its target is not chosen yet. */
  readonly named: readonly InstanceId[];
  /** An `attack` instruction by the identity (it takes the begun attack over); otherwise a damage instruction. */
  readonly attackEffect: boolean;
  readonly overkill: boolean;
  readonly keywords: AttackKeywords;
}

/** What `attackAhead` has read so far along the path the ability will resolve. */
interface AttackAhead {
  /** In resolution order: damage instructions, ending with the first `attack` instruction if the path reaches one. */
  makers: AttackMaker[];
  /** An instruction that is neither a target choice nor a branch resolves before the next one read. */
  preceded: boolean;
  /** `preceded` as the first maker was reached. */
  firstPreceded: boolean;
  /** Nothing further is read: an `attack` instruction was reached, or a choice not yet made. */
  done: boolean;
}

/**
 * Reads ahead along the instructions an "(attack)" ability is about to resolve, as far as their outcome is decided
 * now, for the instructions that make its attack (file header, "What is read ahead as the ability begins"; an
 * interpretation of RRG 1.8 "Labeled Ability", p. 26). Nothing is resolved: conditions and targets are only read.
 */
function attackAhead(
  state: GameState,
  effects: readonly EffectSpec[],
  context: EffectContext,
  identity: InstanceId,
  ahead: AttackAhead,
): void {
  const inPlay = cardsInPlay(state);
  const isEnemy = (id: InstanceId): boolean => inPlay.includes(id) && categoriesOf(state, id).includes("enemy");
  const found = (maker: AttackMaker): void => {
    if (ahead.makers.length === 0) ahead.firstPreceded = ahead.preceded;
    ahead.makers.push(maker);
  };
  for (const instruction of effects) {
    if (ahead.done) return;
    switch (instruction.kind) {
      // Choosing a target is not an instruction that resolves before the attack (RRG 1.8 "Target", p. 42).
      case "chooseTarget":
        break;
      case "attack": {
        const by = instruction.attacker ? resolveRef(state, instruction.attacker, context)[0] : identity;
        if (by !== identity) {
          // Another character's attack (an ally's) is not the ability's own.
          ahead.preceded = true;
          break;
        }
        found({
          named: resolveRef(state, instruction.target, context),
          attackEffect: true,
          overkill: instruction.overkill === true,
          keywords: instruction.keywords ?? [],
        });
        // A later `attack` instruction is another attack, which begins as it is reached.
        ahead.done = true;
        break;
      }
      case "if": {
        const taken = evaluate(state, instruction.condition, context);
        attackAhead(state, taken ? instruction.then : (instruction.otherwise ?? []), context, identity, ahead);
        break;
      }
      // Post-"then" text resolves unless the text before it fails to (RRG 1.8 "'Then'", p. 44), which is not known yet.
      case "then":
        attackAhead(state, instruction.effects, context, identity, ahead);
        break;
      case "chooseOne": {
        // Not chosen yet: the attack is certain only when every option that would be offered makes one.
        const options = instruction.options
          .filter((option) => option.condition === undefined || evaluate(state, option.condition, context))
          .map((option) => {
            const within: AttackAhead = { makers: [], preceded: ahead.preceded, firstPreceded: false, done: false };
            attackAhead(state, option.effects, context, identity, within);
            return within;
          });
        const firsts = options.flatMap((option) => option.makers.slice(0, 1));
        const [first] = firsts;
        if ((instruction.count ?? 1) !== 1 || first === undefined || firsts.length < options.length) {
          ahead.preceded = true;
          break;
        }
        // What the options agree on: the same enemy named, the keywords each of them gives the attack.
        const sameNamed = firsts.every(
          (maker) => maker.named.length === first.named.length && maker.named.every((id, at) => id === first.named[at]),
        );
        if (ahead.makers.length === 0) ahead.preceded = options.some((option) => option.firstPreceded);
        found({
          named: sameNamed ? first.named : [],
          attackEffect: firsts.every((maker) => maker.attackEffect),
          overkill: firsts.every((maker) => maker.overkill),
          keywords: first.keywords.filter((keyword) => firsts.every((maker) => maker.keywords.includes(keyword))),
        });
        ahead.done = true;
        break;
      }
      default: {
        const named = namedByAttackInstruction(state, instruction, context);
        // A damage instruction that names nothing yet (its target is chosen later) or names an enemy can attack; one
        // that names only its player's own characters cannot. Anything else resolves before the attack's damage.
        if (named !== null && (named.length === 0 || named.some(isEnemy))) {
          found({ named, attackEffect: false, overkill: false, keywords: [] });
        }
        ahead.preceded = true;
      }
    }
  }
}

/**
 * Pushes the `attack` event an "(attack)" ability begins with on top of `frame`, tied to the ability's root frame
 * `rootId`: a label-only attack's one event (`labeled`), or, with `begun`, the event an ability's `attack` instruction
 * will take over (`attack.begun`, `attackBegun` on its frame).
 */
function pushLabelAttack(
  ctx: Ctx,
  frame: Frame<"effects">,
  rootId: FrameId,
  identity: InstanceId,
  playerId: PlayerId,
  target: InstanceId | null,
  begun?: Pick<AttackMaker, "overkill" | "keywords">,
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
      ...(begun
        ? {
            begun: true as const,
            overkill: begun.overkill,
            ...(begun.keywords.length > 0 ? { keywords: begun.keywords } : {}),
          }
        : { labeled: true as const }),
      sourceInstanceId: frame.selfInstanceId,
      ...(frame.abilityId !== undefined ? { sourceAbilityId: frame.abilityId } : {}),
    },
  ]);
  if (pushed !== undefined) {
    updateFrame(ctx, pushed, (other) =>
      other.kind === "event" ? { ...other, attackOf: rootId, ...(begun ? { attackBegun: true as const } : {}) } : other,
    );
  }
}

/**
 * An "(attack)" ability's attack begins as the ability begins resolving (official rule: RRG 1.8 "Labeled Ability",
 * p. 26; owner decisions, 2026-10-08, rows 61 and 73): called before each effect of an effects frame resolves. On the
 * root frame of an "(attack)" ability that has begun no attack this way yet, at its first instruction that is not an
 * opening target choice, this pushes an `attack` event on top of the frame and returns true without advancing it. The
 * attack's interrupt window resolves, it deals nothing, and it waits beneath the frame; the frame then resolves the
 * same instruction.
 *
 * - An ability with no `attack` effect: its one attack (`attack.labeled`), whose damage is the ability's damage
 *   instructions'.
 * - An ability with an `attack` effect that another instruction resolves before: that attack, begun early
 *   (`attack.begun`), which the `attack` instruction takes over when it is reached (`resumeBegunAttack`). When the
 *   `attack` instruction is itself the first to resolve nothing is pushed here: the instruction makes its event now.
 *
 * The rules it follows (what is read ahead, the target it begins with) are interpretations, stated in the file header.
 */
export function beginLabelAttack(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: EffectSpec,
  context: EffectContext,
): boolean {
  // An opening target choice is made before the attack begins, and an instruction being answered has begun.
  if (effect.kind === "chooseTarget" || frame.answer !== null) return false;
  if (frame.controllerId === null || frame.labelAttackMade || !isAttackLabeled(ctx.deps, frame)) return false;
  if (abilityRootFrameId(ctx.state, frame) !== frame.frameId) return false;
  const labelOnly = isLabelOnlyAttack(ctx.deps, frame);
  // An ability with an `attack` effect begins an attack here only as it begins resolving: each attack it makes after
  // that begins at its own instruction (file header, "An ability that makes several separate attacks").
  if (!labelOnly && !frame.effects.slice(0, frame.cursor).every((earlier) => earlier.kind === "chooseTarget"))
    return false;
  const playerId = frame.controllerId;
  const identity = ctx.state.players.find((player) => player.playerId === playerId)?.identity.instanceId;
  if (identity === undefined) return false;
  const ahead: AttackAhead = { makers: [], preceded: false, firstPreceded: false, done: false };
  attackAhead(ctx.state, frame.effects.slice(frame.cursor), context, identity, ahead);
  const [first] = ahead.makers;
  if (first === undefined) return false;
  if (!ahead.firstPreceded) {
    // Nothing resolves before the attack's own instruction. An `attack` instruction makes its event now, as it always
    // has; a damage instruction reached through a branch makes the attack as it is reached (`openLabelAttack`).
    if (first.attackEffect || namedByAttackInstruction(ctx.state, effect, context) === null) return false;
  }
  const inPlay = cardsInPlay(ctx.state);
  const mayAttack = (id: InstanceId): boolean =>
    inPlay.includes(id) &&
    categoriesOf(ctx.state, id).includes("enemy") &&
    canAttack(ctx.state, identity, id, ctx.deps);
  // The first enemy the identity may attack that an instruction of the attack names, in order.
  const target = ahead.makers.flatMap((maker) => maker.named.filter(mayAttack))[0] ?? null;
  const instruction = ahead.makers.find((maker) => maker.attackEffect);
  pushLabelAttack(
    ctx,
    frame,
    frame.frameId,
    identity,
    playerId,
    target,
    labelOnly ? undefined : { overkill: instruction?.overkill === true, keywords: instruction?.keywords ?? [] },
  );
  return true;
}

/** The attack `rootId`'s ability began early that no `attack` instruction has taken over yet (`attackBegun`). */
function begunAttackWaiting(state: GameState, rootId: FrameId, attackerId: InstanceId): AttackFrame | undefined {
  return state.stack.find(
    (other): other is AttackFrame =>
      other.kind === "event" &&
      other.event.kind === "attack" &&
      other.attackOf === rootId &&
      other.attackWaiting === true &&
      other.attackBegun === true &&
      other.event.attackerInstanceId === attackerId,
  );
}

/**
 * Whether the "(attack)" ability `rootId` belongs to began an attack by `attackerId` as it began resolving that is
 * still waiting for its `attack` instruction. That instruction does not read the attacker's stunned status again: the
 * attempt to attack was made as the ability began (RRG 1.8 "Stun, Stunned", p. 41; an interpretation, file header).
 */
export const hasBegunAttack = (state: GameState, rootId: FrameId | undefined, attackerId: InstanceId): boolean =>
  rootId !== undefined && begunAttackWaiting(state, rootId, attackerId) !== undefined;

/**
 * What the attack `rootId`'s ability began with becomes when an `attack` instruction that names `targets` reaches it.
 * `instead`: the enemy of the instruction whose attack it is (no second event is made for that enemy), the enemy its
 * window heard if the instruction still names it, else the first. `target`: the character its damage goes to, which is
 * that enemy, unless the window moved the attack off it (`attackRetarget`), then the character it was moved onto: the
 * event's target as its window left it is kept (file header, "A target changed in the attack's window"). Undefined
 * when no attack is waiting to be taken over or the instruction names no enemy (the attack then stays as it began).
 */
export function begunAttackTarget(
  state: GameState,
  rootId: FrameId,
  attackerId: InstanceId,
  targets: readonly InstanceId[],
): { readonly instead: InstanceId; readonly target: InstanceId } | undefined {
  const waiting = begunAttackWaiting(state, rootId, attackerId);
  if (waiting === undefined) return undefined;
  // The enemy the window heard: the one the attack was made against, before any move.
  const heard = waiting.attackRetarget?.from ?? waiting.event.targetInstanceId;
  const instead = heard !== null && targets.includes(heard) ? heard : targets[0];
  if (instead === undefined) return undefined;
  return { instead, target: movedAttackTarget(waiting, instead) ?? instead };
}

/**
 * An `attack` instruction takes over the attack its ability began as it began resolving (row 73): the waiting event is
 * given the instruction's attack on `target` (`begunAttackTarget`), its amount, overkill and keywords, and its frame
 * goes back on top of the stack at its damage step. Its interrupt window is not opened again, and everything that
 * window put on the frame stays (`modifyAttack`'s vars, what "for this attack" effects are timed to, a changed target).
 *
 * The frame never leaves the stack, so the move is logged as one `attackResumed` carrying what the instruction gave
 * the attack, not as a `framePushed`: the log reads `framePushed` (the attack begins), `attackAwaitsAbility` with
 * `begun`, `attackResumed`, then `attackAwaitsAbility` again once its damage is dealt, and one `framePopped`.
 */
export function resumeBegunAttack(
  ctx: Ctx,
  rootId: FrameId,
  attackerId: InstanceId,
  target: InstanceId,
  made: { readonly amount: number; readonly overkill: boolean; readonly keywords: AttackKeywords },
  reportTo: ReportTarget | null,
): void {
  const waiting = begunAttackWaiting(ctx.state, rootId, attackerId);
  if (waiting === undefined) return;
  const { attackWaiting: _waiting, attackBegun: _begun, ...frame } = waiting;
  const { keywords: _keywords, ...event } = waiting.event;
  const resumed: Frame<"event"> = {
    ...frame,
    stage: "apply",
    reportTo,
    event: {
      ...event,
      targetInstanceId: target,
      amount: made.amount,
      overkill: made.overkill,
      ...(made.keywords.length > 0 ? { keywords: made.keywords } : {}),
    },
  };
  ctx.state = {
    ...ctx.state,
    stack: [resumed, ...ctx.state.stack.filter((other) => other.frameId !== waiting.frameId)],
  };
  emit(ctx, {
    type: "attackResumed",
    attackFrameId: waiting.frameId,
    abilityFrameId: rootId,
    attackerInstanceId: attackerId,
    targetInstanceId: target,
    amount: made.amount,
    overkill: made.overkill,
    keywords: made.keywords,
  });
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
    // Begun with its ability and not taken over yet: it has dealt nothing and waits for its `attack` instruction.
    ...(frame.attackBegun ? { begun: true as const } : {}),
  });
}

/**
 * The waiting attack is on top again (its ability has finished): every enemy it attacked is named, once each, in the
 * order attacked, and its event carries them from here on (`attack.attacked`, owner ruling Q50) for its "resolved"
 * line and its response window. Returns true when it pushed any (the frame then finishes beneath them).
 *
 * The attack stops waiting here (`attackWaiting` is cleared, which is also how a second pass knows this one was
 * made): from its first retaliate event to its last "at the end of this attack" effect it is the attack in progress
 * again (`currentActivationFrameId`), so an ability that answers one of them and names "this attack" (`atEndOfAttack`,
 * `until: "endOfAttack"`, `modifyBasicPower`) names it, as it would a basic attack at the same point. The caller
 * resolves on from the frame as it is on the stack after this.
 */
export function pushAttackedByAbility(ctx: Ctx, frame: Frame<"event">): boolean {
  if (!frame.attackWaiting || frame.event.kind !== "attack") return false;
  // An attack no instruction of its own made: a label-only attack, or one begun with its ability that no `attack`
  // instruction took over (`attackBegun`). It attacked the enemies the ability's damage instructions named.
  const labelMade = frame.event.labeled === true || frame.attackBegun === true;
  const once = (frame.attacked ?? []).filter(
    (event, index, all) => all.findIndex((other) => other.targetInstanceId === event.targetInstanceId) === index,
  );
  const ids = once.map((event) => event.targetInstanceId);
  const { attacked: _named, attackWaiting: _waited, ...rest } = frame;
  // An attack of its own instruction that named nobody (its target gone, no ATK) is left as it was made. One no
  // instruction made is always stamped: with nothing attacked, it attacked no enemy, the target it began with included.
  const asMade = !labelMade && (ids.length === 0 || (ids.length === 1 && ids[0] === frame.event.targetInstanceId));
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
 * attacked (owner ruling Q50). `moved`: `targetId` is the character the attack's window moved it onto, in place of the
 * enemy the instruction names (`withMovedAttackTarget`); it is attacked and dealt attack damage whatever it is.
 */
export function abilityAttackDamage(
  state: GameState,
  deps: EngineDeps,
  attack: AttackFrame,
  targetId: InstanceId,
  moved = false,
): { readonly damage: Partial<Damage>; readonly attacked: Attacked; readonly extra: number } | null {
  if (!moved && !categoriesOf(state, targetId).includes("enemy")) return null;
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
