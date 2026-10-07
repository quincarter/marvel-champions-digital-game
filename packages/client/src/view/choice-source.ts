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
import type {
  ChoiceList,
  ChoicePrompt,
  EngineDeps,
  GameState,
  InstanceId,
  PendingChoice,
  ResourceRequirement,
  SetupInstructionSource,
  StackFrame,
} from "@mc/engine";
import { activeAbilityRefs } from "@mc/engine";
import { setupCallCopyFor } from "../campaign/story.js";
import { abilityLabelOf } from "./ability-label.js";
import { cardName, numberWord } from "./names.js";

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
      return frame.selfInstanceId
        ? { instanceId: frame.selfInstanceId, abilityId: onlyActiveAbility(state, frame.selfInstanceId) }
        : null;
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
 * The printed setup instruction a pending choice is raised by, when it is one rather than a card: a campaign
 * instruction ("Setup: In player order, each player must search the encounter deck and discard pile for a minion…",
 * MC27 p. 22's reputation node 9) or a scenario's own setup instruction. The engine carries it on every effects frame
 * such an instruction pushes (`StackFrame` "effects" `instruction`), so this is a straight read. Null for a choice a
 * card raises (`choiceSourceOf` names that one) and for a phase-owned choice.
 */
export function choiceInstructionOf(state: GameState, choice: PendingChoice): SetupInstructionSource | null {
  const frame = frameOf(state, choice);
  return frame?.kind === "effects" ? (frame.instruction ?? null) : null;
}

/** The header's name for a setup instruction: which printed setup is asking, not its full text. */
export function instructionHeaderName(instruction: SetupInstructionSource): string {
  const copy = instruction.kind === "campaign" ? setupCallCopyFor(instruction.instructionId) : null;
  if (copy) return copy.name;
  return instruction.kind === "campaign" ? "Campaign setup" : "Scenario setup";
}

/**
 * The question a campaign setup instruction's "choose a player" asks, by instruction id: the engine's `choosePlayer`
 * carries no prompt text, so the sheet would read "Longshot: choose a player" with no hint what the pick does.
 * MojoMania's Longshot reveal (insert p. 13/17): the chosen seat reveals him and he joins that player.
 */
const SETUP_PLAYER_QUESTIONS: Readonly<Record<string, string>> = {
  "mojo.s2.setup.longshot": "Who reveals Longshot? He joins that player.",
  "mojo.s3.setup.longshot": "Who reveals Longshot? He joins that player.",
};

export function setupPlayerQuestionFor(instruction: SetupInstructionSource, prompt: ChoicePrompt): string | null {
  if (instruction.kind !== "campaign" || prompt.kind !== "choosePlayer") return null;
  return SETUP_PLAYER_QUESTIONS[instruction.instructionId] ?? null;
}

/**
 * The overlay title for a `chooseCostCards` prompt (docs/phase7-wave4.md §3.17: Stand Together's "exhaust an
 * [Avenger] character and a [Guardian] character" cost, `InPlayCostMode`), one verb per mode. Falls back to a
 * generic phrase for a mode this module doesn't recognize rather than the sheet's own bare "Choose".
 *
 * `damage` (Thwip Thwip!, `spdr` 31017: "Deal 1 damage to a [Web-Warrior] character you control →") names the
 * amount when the caller has it (`promptTitleOf`, reading it off the ability's own `AbilityCost.damageCards`), and
 * falls back to the bare verb when it doesn't (this function's own unit tests, which pass no amount at all).
 */
export function costCardsPromptTitleOf(mode: string | undefined, damageAmount?: number): string {
  if (mode === "damage") {
    return damageAmount === undefined
      ? "Choose a character to take damage"
      : `Choose a character to take ${damageAmount} damage`;
  }
  const verbs: Record<string, string> = {
    exhaust: "Choose a card to exhaust",
    return: "Choose a card to return to hand",
    discard: "Choose a card to discard",
  };
  return (mode && verbs[mode]) ?? "Choose a card for this cost";
}

/** `StatusName` as `AbilityCost.divide`'s own printed noun: "stun"/"confuse"/"tough" cards. */
const STATUS_NOUN: Record<string, string> = { stunned: "stun", confused: "confuse", tough: "tough" };

/**
 * The overlay title for a `divide` prompt (`EffectSpec divide`, docs/phase7-wave2.md §3.7): "Divide 2 damage among
 * these characters", or, for a status division (Thwip Thwip!, `spdr` 31017: "deal 2 stun cards, divided as you
 * choose, among up to 2 enemies"), "Divide 2 stun cards among up to 2 enemies" — the `maxTargets` cap is worth
 * naming up front, since it is the reason the same 2 cards can't all go on one enemy.
 */
function dividePromptTitleOf(
  what: "damage" | "threat" | string,
  amount: number,
  maxTargets: number | undefined,
): string {
  if (what === "damage" || what === "threat") return `Divide ${amount} ${what}`;
  if (what === "heal") return `Heal ${amount} damage`;
  const noun = STATUS_NOUN[what] ?? what;
  const cards = `${noun} card${amount === 1 ? "" : "s"}`;
  return maxTargets === undefined
    ? `Divide ${amount} ${cards}`
    : `Divide ${amount} ${cards} among up to ${maxTargets} enemies`;
}

/**
 * "Spend 2 resources?", or with a `distinctTypes` rule (docs/phase7-wave6.md §3.69) "Spend 2 different resources?" when
 * every spent resource must differ, else "Spend 3 resources, at least 2 different?". The count is the requirement's
 * total; a requirement of nothing keeps the bare title.
 */
export function spendResourcesTitleOf(requirement: ResourceRequirement, distinctTypes?: number): string {
  const total =
    (requirement.generic ?? 0) +
    (requirement.physical ?? 0) +
    (requirement.mental ?? 0) +
    (requirement.energy ?? 0) +
    (requirement.wild ?? 0);
  if (total <= 0) return "Spend resources?";
  const noun = total === 1 ? "resource" : "resources";
  if (distinctTypes === undefined || distinctTypes <= 1) return `Spend ${total} ${noun}?`;
  if (distinctTypes >= total) return `Spend ${total} different ${noun}?`;
  return `Spend ${total} ${noun}, at least ${distinctTypes} different?`;
}

/** What a `chooseFromList` prompt asks for, by its list (docs/phase7-wave7.md §3.33). */
const CHOICE_LIST_TITLES: Record<ChoiceList, string> = { cardType: "Choose a card type" };

/**
 * The design's overlay titles for every `PendingChoice.prompt` kind (`scenes/choice.ts`'s own overlay header, moved
 * here so it can be unit tested the way every other view model in this file is). `orderCards`/`chooseBottomCards`
 * (`reorderCards`'s three-step split, `packages/engine/src/resolve/effects-frame.ts`) share one kind family across
 * several different piles — give each its own title instead of reusing one pile's for all of them, including the
 * player-deck top/bottom split Global Logistics (`gmw` 16034) reorders, not just the encounter deck's.
 */
export function promptTitleOf(
  prompt: ChoicePrompt,
  deps: EngineDeps,
  counts?: Pick<PendingChoice, "minSelections">,
): string {
  const kind = prompt.kind;
  // RRG 1.8 "End of Player Phase" (p. 17): a player may discard any number, then must discard down to hand size.
  // Title the question by what is owed: "Discard any cards?" when nothing is, "Discard 2 to hand size" when two are.
  if (kind === "discardDownToHandSize" && counts) {
    return counts.minSelections > 0 ? `Discard ${counts.minSelections} to hand size` : "Discard any cards?";
  }
  if (kind === "orderCards") {
    if (prompt.to === "playerDeckTop") return "Put the top of your deck back in order";
    if (prompt.to === "playerDeckBottom") return "Put the bottom of your deck back in order";
    return prompt.to === "encounterDeckBottom" ? "Put the bottom pile back in order" : "Put the top pile back in order";
  }
  if (kind === "chooseCostCards") {
    const amount = prompt.mode === "damage" ? deps.abilities[prompt.abilityId]?.cost?.damageCards?.amount : undefined;
    return costCardsPromptTitleOf(prompt.mode, amount);
  }
  if (kind === "divide") return dividePromptTitleOf(prompt.what, prompt.amount, prompt.maxTargets);
  if (kind === "chooseNumber") {
    return prompt.min === prompt.max
      ? `Choose a number: ${prompt.min}`
      : `Choose a number from ${prompt.min} to ${prompt.max}`;
  }
  if (kind === "spendResources") return spendResourcesTitleOf(prompt.requirement, prompt.distinctTypes);
  if (kind === "chooseFromList") return CHOICE_LIST_TITLES[prompt.list];
  // docs/phase7-wave7.md §3.83: a fact from outside the game, reported by the asked player.
  if (kind === "reportFact") {
    return prompt.fact === "minutesAway" ? "On a break" : "Did you talk this phase?";
  }
  if (kind === "discardRestricted") return `Discard to ${numberWord(prompt.limit)} restricted cards`;
  if (kind === "divideEvenlyRemainder") return "Place the leftover damage";
  const titles: Record<string, string> = {
    declareDefender: "Declare a defender",
    discardDownToHandSize: "Discard to hand size",
    mulligan: "Mulligan",
    chooseMinionToActivate: "Choose a minion to activate",
    orderEnemies: "Order the enemies",
    orderPlayers: "Order the players",
    chooseBottomCards: "Choose which cards go to the bottom",
    orderTriggers: "Order these effects",
    chooseTriggers: "Trigger an ability?",
    chooseTarget: "Choose a target",
    chooseAttachmentTarget: "Choose a host",
    chooseCards: "Choose cards",
    lookAt: "Look at these cards",
    // docs/phase7-wave7.md §3.81: the options are cards outside the game (`ChoiceRef cardDefinition`).
    searchCollection: "Search your collection",
    chooseOption: "Choose one",
    choosePlayer: "Choose a player",
    orderSpecials: "Order the special abilities",
    payForCard: "Pay for this card?",
    payForAbility: "Pay for this ability?",
    spendResources: "Spend resources?",
    discardOverAllyLimit: "Discard to your ally limit",
    discardOverPlayerSideSchemeLimit: "Discard to the player side scheme limit",
    assignIndirectDamage: "Divide this damage",
  };
  return titles[kind] ?? "Choose";
}

/**
 * The choice sheet's header line: "Crimson Bands of Cyttorak — Special:
 * choose a target", "Doctor Strange: choose a target", "Campaign setup:
 * choose cards" for a choice a setup instruction raises
 * (`choiceInstructionOf`), or `genericTitle` unchanged when nothing can be
 * traced back at all — the sheet's own previous, anonymous title, never
 * blanked out.
 *
 * `genericTitle` is `scenes/choice.ts`'s own `promptTitle(choice.prompt.kind)`
 * ("Choose a target", "Pay for this ability?", …): this module adds *who's
 * asking* in front of it rather than re-wording what it already says, so a
 * prompt kind this module doesn't specially recognize still reads sensibly.
 */
export function choiceHeaderText(
  state: GameState,
  choice: PendingChoice,
  deps: EngineDeps,
  genericTitle: string,
): string {
  const source = choiceSourceOf(state, choice);
  const instruction = source ? null : choiceInstructionOf(state, choice);
  let named: string;
  if (source) {
    named = source.abilityId
      ? abilityLabelOf(state, source.instanceId, source.abilityId, deps)
      : cardName(state, source.instanceId);
  } else if (instruction) {
    const question = setupPlayerQuestionFor(instruction, choice.prompt);
    if (question) return question;
    named = instructionHeaderName(instruction);
  } else {
    return genericTitle;
  }
  return `${named}: ${genericTitle.charAt(0).toLowerCase()}${genericTitle.slice(1)}`;
}

/** The card whose art the choice sheet should thumbnail beside the header — `choiceSourceOf`'s own instance, when there is one. */
export function choiceHeaderInstanceId(state: GameState, choice: PendingChoice): InstanceId | null {
  return choiceSourceOf(state, choice)?.instanceId ?? null;
}
