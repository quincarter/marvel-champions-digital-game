/**
 * Names the *source* of a pending choice — the card, and where it can be
 * pinned down exactly, the ability — for the choice sheet's header.
 *
 * Reported bug: every `chooseTarget` prompt titled itself "Choose a target"
 * with no hint of which card was asking. After paying for Doctor Strange's
 * Spell Mastery, a bare sheet appeared with no mention of Crimson Bands of
 * Cyttorak; the same for a basic attack/thwart's own target choice. The
 * engine sends `ChoicePrompt`'s `chooseTarget.abilityId` as `null` for every
 * effect-driven target choice (`packages/engine/src/resolve/effects-frame.ts`),
 * so the fix has to come from somewhere else the prompt already points to:
 * `PendingChoice.frameId`, which names a frame on `GameState.stack`
 * (`packages/engine/src/stack.ts`).
 *
 * Built without an engine change (a concurrent session owns `packages/engine`
 * right now) — every field this module reads already exists:
 *  - `payForCard`/`payForAbility` name their own `instanceId`/`abilityId`
 *    directly on the prompt. Full fidelity, always.
 *  - `declareDefender` names the attacking enemy on `prompt.attack`.
 *  - a `window` frame (`chooseTriggers`/`orderTriggers`, or a card paying its
 *    own cost inside a timing window) names its candidate's instance and
 *    ability directly (`StackFrame` "window", `paying`/`pending`/`queue`).
 *  - an `effects` frame (`chooseTarget`, `chooseCards`, `choosePlayer`,
 *    `chooseOption`, a `chooseAttachmentTarget` raised mid-ability) names
 *    `selfInstanceId` — the card whose ability's effects are running — but
 *    *not* which of that card's abilities it is. See "KNOWN GAP" below.
 *  - `enemyAttack`/`enemyScheme`/`reveal`/`playCard` frames name the
 *    activating/revealed/played card directly (`playCard` also names
 *    `triggeredAbilityId` when the play was itself the answer to a window).
 *
 * KNOWN GAP, for `game-rules-architect`/`ability-scripting-engineer`: a
 * `chooseTarget`/`chooseCards`/`choosePlayer` prompt raised from inside a
 * card with *more than one* currently active ability can only be traced back
 * to the card, never the specific ability, because the "effects" `StackFrame`
 * (`packages/engine/src/stack.ts`) carries `selfInstanceId` but no
 * `AbilityId` — `resolve/ability.ts`'s `executeAbilityFrame` pops the
 * `"ability"` frame (which does carry `abilityId`) *before* pushing the
 * effects frame that runs its effects, and `resolve/frames.ts`'s
 * `pushEffects` has no field to carry it through even if it wanted to. This
 * is the actual reason every `chooseTarget` call site hardcodes
 * `abilityId: null` (`resolve/effects-frame.ts`, `resolve/defeat.ts`) even
 * though `ChoicePrompt`'s `chooseTarget` variant already reserves the field.
 * A card with exactly one live ability isn't ambiguous (there is nothing
 * else it could be), so this module still names the ability in that — the
 * overwhelmingly common — case; only a card with two or more live abilities
 * degrades to the card name alone. The precise, minimal engine fix: add
 * `abilityId: AbilityId | null` to the `"effects"` `StackFrame`, set from
 * `Frame<"ability">.abilityId` in `executeAbilityFrame` just before it pops
 * that frame, threaded through `pushEffects`'s spec; then have
 * `requestTargetChoice` and `resolve/effects-frame.ts`'s other two
 * `chooseTarget` call sites read it off the frame instead of `null`.
 */

import type { AbilityId } from "@mc/content";
import type { EngineDeps, GameState, InstanceId, PendingChoice, StackFrame } from "@mc/engine";
import { activeAbilityRefs } from "@mc/engine";
import { abilityLabelOf } from "./ability-label.js";
import { cardName } from "./names.js";

/** The card (and, when unambiguous, the ability) a pending choice traces back to. */
export interface ChoiceSource {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId | null;
}

/**
 * The card with exactly one currently active ability — the one case an
 * ability-less `effects`/`enemyAttack`/… frame can still name an ability by
 * deduction rather than a guess (see this module's own "KNOWN GAP").
 */
function onlyActiveAbility(state: GameState, instanceId: InstanceId): AbilityId | null {
  const refs = activeAbilityRefs(state, instanceId);
  return refs.length === 1 ? refs[0]!.id : null;
}

/** `choice`'s own frame on `state.stack`, or null when it names none (a phase-owned choice, e.g. a mulligan) or the frame has already resolved. */
function frameOf(state: GameState, choice: PendingChoice): StackFrame | null {
  if (choice.frameId === null) return null;
  return state.stack.find((frame) => frame.frameId === choice.frameId) ?? null;
}

/**
 * The card (and ability, where it can be pinned down) a pending choice is
 * actually about. Null when nothing in `PendingChoice`/`state.stack` names
 * one — a phase-owned choice (mulligan, discard to hand size), or a
 * multi-member `damageGroup` frame with no single source.
 */
export function choiceSourceOf(state: GameState, choice: PendingChoice): ChoiceSource | null {
  const prompt = choice.prompt;
  // Full fidelity, straight off the prompt — no stack lookup needed.
  if (prompt.kind === "payForCard" || prompt.kind === "payForAbility") {
    return { instanceId: prompt.instanceId, abilityId: prompt.abilityId };
  }
  if (prompt.kind === "declareDefender") {
    return { instanceId: prompt.attack.enemyInstanceId, abilityId: null };
  }

  const frame = frameOf(state, choice);
  if (!frame) return null;
  switch (frame.kind) {
    case "ability":
      return { instanceId: frame.instanceId, abilityId: frame.abilityId };
    case "effects":
      return frame.selfInstanceId ? { instanceId: frame.selfInstanceId, abilityId: onlyActiveAbility(state, frame.selfInstanceId) } : null;
    case "window": {
      const candidate = frame.paying ?? frame.pending[0] ?? frame.queue[0];
      return candidate ? { instanceId: candidate.instanceId, abilityId: candidate.abilityId } : null;
    }
    case "enemyAttack":
      return { instanceId: frame.enemyInstanceId, abilityId: null };
    case "enemyScheme":
      return { instanceId: frame.enemyInstanceId, abilityId: null };
    case "reveal":
      return { instanceId: frame.instanceId, abilityId: null };
    case "playCard":
      return { instanceId: frame.instanceId, abilityId: frame.triggeredAbilityId };
    case "event":
    case "damageGroup":
      // No single source card: an event frame's own "who did this" is a player action or an activation this
      // module already covers separately (`enemyAttack`/`enemyScheme`), and a damage group splits several members'
      // damage at once.
      return null;
  }
}

/**
 * The choice sheet's header line: "Crimson Bands of Cyttorak — Special:
 * choose a target", "Doctor Strange: choose a target", or `genericTitle`
 * unchanged when nothing can be traced back to a card at all — the sheet's
 * own previous, anonymous title, never blanked out.
 *
 * `genericTitle` is `scenes/choice.ts`'s own `promptTitle(choice.prompt.kind)`
 * ("Choose a target", "Pay for this ability?", …): this module adds *who's
 * asking* in front of it rather than re-wording what it already says, so a
 * prompt kind this module doesn't specially recognize still reads sensibly.
 */
export function choiceHeaderText(state: GameState, choice: PendingChoice, deps: EngineDeps, genericTitle: string): string {
  const source = choiceSourceOf(state, choice);
  if (!source) return genericTitle;
  const named = source.abilityId ? abilityLabelOf(state, source.instanceId, source.abilityId, deps) : cardName(state, source.instanceId);
  return `${named}: ${genericTitle.charAt(0).toLowerCase()}${genericTitle.slice(1)}`;
}

/** The card whose art the choice sheet should thumbnail beside the header — `choiceSourceOf`'s own instance, when there is one. */
export function choiceHeaderInstanceId(state: GameState, choice: PendingChoice): InstanceId | null {
  return choiceSourceOf(state, choice)?.instanceId ?? null;
}
