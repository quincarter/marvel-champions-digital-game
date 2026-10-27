/**
 * What an optional interrupt or response window is about, in plain words.
 *
 * A `chooseTriggers` sheet used to open as "JENNIFER WALTERS - I OBJECT!: TRIGGER AN ABILITY?" with a card and two
 * buttons: nothing said that Defense Network was placing threat, or why a scheme was being revealed during setup.
 * This reads the prompt's own `TriggerEvent`, the stack and the step, so the sheet can say what is about to happen
 * (an interrupt) or what just happened (a response), why now, and what saying yes does. Every word is the event's
 * fields, a card's name, or the ability's own printed text; nothing is invented.
 */

import {
  cardOf,
  getPlayer,
  type ChoiceOption,
  type ChoicePrompt,
  type EngineDeps,
  type FrameId,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
  type TriggerEvent,
} from "@mc/engine";
import { abilityFirst, sourceCardPanelFor } from "./choice-source-panel.js";
import { heroFaceNameAt } from "./hero-names.js";
import { triggerLabel } from "./inspect-model.js";
import { cardName, faceUpName, playerName } from "./names.js";
import { triggerEventWords } from "./trigger-event-words.js";

export interface TriggerWindowContext {
  /** "Defense Network is about to get 1 threat" / "Hydra Mercenary was revealed". */
  readonly headline: string;
  /** Where the game is when the event isn't obviously from play; null when there is nothing to add. */
  readonly whyNow: string | null;
  /** What saying yes does, one line per offered ability. */
  readonly effects: readonly string[];
  /** What saying yes costs that the card text does not say; null when there is nothing to warn about. */
  readonly warning: string | null;
  /** What declining here means when the window will offer these again ("Not now"); null for a plain decline. */
  readonly later: string | null;
}

const count = (n: number, word: string): string => `${n} ${word}`;

/** "you" for the viewer's own identity card, else the card's name. */
function characterName(state: GameState, id: InstanceId, viewer: PlayerId): { name: string; you: boolean } {
  const me = getPlayer(state, viewer);
  if (me && me.identity.instanceId === id) return { name: "you", you: true };
  return { name: cardName(state, id), you: false };
}

function playerRef(state: GameState, id: PlayerId, viewer: PlayerId): string {
  return id === viewer ? "you" : playerName(state, id);
}

/** The headline for one event. An interrupt reads "is about to", a response the past tense. */
export function triggerHeadlineOf(
  state: GameState,
  event: TriggerEvent,
  timing: "interrupt" | "response",
  viewer: PlayerId,
): string {
  const before = timing === "interrupt";
  switch (event.kind) {
    case "placeThreat": {
      const scheme = cardName(state, event.schemeInstanceId);
      return before
        ? `${scheme} is about to get ${count(event.amount, "threat")}`
        : `${scheme} got ${count(event.amount, "threat")}`;
    }
    case "removeThreat": {
      const scheme = cardName(state, event.schemeInstanceId);
      return before
        ? `${scheme} is about to lose ${count(event.amount, "threat")}`
        : `${scheme} lost ${count(event.amount, "threat")}`;
    }
    case "dealDamage": {
      const target = characterName(state, event.targetInstanceId, viewer);
      const amount = before ? event.amount : (event.taken ?? event.amount);
      if (before) return `${target.you ? "You are" : `${target.name} is`} about to take ${count(amount, "damage")}`;
      return `${target.you ? "You" : target.name} took ${count(amount, "damage")}`;
    }
    case "enemyAttack": {
      const enemy = cardName(state, event.enemyInstanceId);
      const against = playerRef(state, event.attackedPlayerId, viewer);
      return before ? `${enemy} is about to attack ${against}` : `${enemy} attacked ${against}`;
    }
    case "enemyScheme": {
      const enemy = cardName(state, event.enemyInstanceId);
      return before ? `${enemy} is about to scheme` : `${enemy} schemed`;
    }
    case "cardRevealed":
      return before
        ? `${cardName(state, event.instanceId)} is about to be revealed`
        : `${cardName(state, event.instanceId)} was revealed`;
    case "encounterCardRevealing":
      return `${cardName(state, event.instanceId)} is about to be revealed`;
    // Still facedown while this window is open, so the card is not named.
    case "encounterCardBeingRevealed":
      return "A facedown encounter card is about to be revealed";
    case "cardEntersPlay":
      return before
        ? `${cardName(state, event.instanceId)} is about to enter play`
        : `${cardName(state, event.instanceId)} entered play`;
    case "characterDefeated": {
      const who = characterName(state, event.instanceId, viewer);
      const name = who.you ? "You" : who.name;
      return before
        ? `${name} ${who.you ? "are" : "is"} about to be defeated`
        : `${name} ${who.you ? "were" : "was"} defeated`;
    }
    case "cardPlayed":
      return `${cardName(state, event.instanceId)} was played`;
    case "cardBeingPlayed":
      return `${cardName(state, event.instanceId)} is about to be played`;
    case "attack": {
      const attacker = cardName(state, event.attackerInstanceId);
      return before ? `${attacker} is about to attack` : `${attacker} attacked`;
    }
    case "cardDiscardedFromDeck": {
      const card = cardName(state, event.instanceId);
      const deck =
        event.playerId === null
          ? "the encounter deck"
          : event.playerId === viewer
            ? "your deck"
            : `${playerName(state, event.playerId)}'s deck`;
      const by = event.sourceInstanceId === null ? "" : ` by ${cardName(state, event.sourceInstanceId)}`;
      return `${card} was discarded from the top of ${deck}${by}`;
    }
    case "boostCardTurnedFaceup": {
      // One window per boost card: the card and its icons tell two windows of the same attack apart (issue #253).
      const boost = cardName(state, event.boostInstanceId);
      const icons = count(event.boostIcons, event.boostIcons === 1 ? "boost icon" : "boost icons");
      return before
        ? `${boost} is being turned up as a boost card (${icons})`
        : `${boost} was turned up as a boost card (${icons})`;
    }
    // Still facedown while this window is open, so the card is not named (Defiance, issue #348).
    case "boostCardTurningFaceup":
      return before ? "A facedown boost card is about to be turned up" : "A boost card was turned up";
    case "thwart": {
      const thwarter = cardName(state, event.thwarterInstanceId);
      return before ? `${thwarter} is about to thwart` : `${thwarter} thwarted`;
    }
    case "formChanging":
    case "formChanged": {
      const who = playerRef(state, event.playerId, viewer);
      const Who = who === "you" ? "You" : who;
      const face = formChangeTarget(state, event);
      if (before) return `${Who} ${who === "you" ? "are" : "is"} about to change to ${face}`;
      return `${Who} changed to ${face}`;
    }
    default: {
      const words = triggerEventWords(event.kind);
      return before ? `About to happen: ${words}` : `Just happened: ${words}`;
    }
  }
}

/** What a form change changes to: the named hero face of an identity with several, an additional form's name. */
function formChangeTarget(
  state: GameState,
  event: Extract<TriggerEvent, { kind: "formChanging" | "formChanged" }>,
): string {
  if (event.kind === "formChanged" && event.change === "additional") return event.formName ?? "another form";
  if (event.to === "alterEgo") return "alter-ego form";
  const seat = getPlayer(state, event.playerId);
  const identity = seat ? cardOf(state, seat.identity.instanceId) : undefined;
  if (identity?.type !== "hero_identity" || (identity.additionalHeroForms ?? []).length === 0) return "hero form";
  const index = event.kind === "formChanging" ? event.heroFormIndex : (event.toHeroForm ?? 0);
  return heroFaceNameAt(identity, index) ?? "hero form";
}

/** The card whose reveal is running, innermost first: its When Revealed (or setup reveal) is what is resolving. */
function revealingCard(state: GameState): InstanceId | null {
  for (let i = state.stack.length - 1; i >= 0; i--) {
    const frame = state.stack[i]!;
    // A reveal still at step 1 (its facedown "would reveal" window, `encounterCardBeingRevealed`) is not resolving yet.
    if (frame.kind === "reveal" && frame.stage === "faceup") continue;
    if (frame.kind === "reveal" && !frame.whenRevealedCancelled && !frame.effectsCancelled) return frame.instanceId;
  }
  return null;
}

const DOING: Partial<Record<TriggerEvent["kind"], string>> = {
  placeThreat: "places threat",
  removeThreat: "removes threat",
  dealDamage: "deals damage",
  enemyAttack: "makes an attack",
  enemyScheme: "schemes",
  cardEntersPlay: "puts a card into play",
};

const VILLAIN_STEP_WORDS: Readonly<Record<string, string>> = {
  placeThreat: "the main scheme gets its threat",
  enemyActivations: "enemies are activating",
};

/** Where the game is, when the event is not plain play. */
export function triggerWhyNowOf(state: GameState, event: TriggerEvent): string | null {
  const settingUp = state.step.phase === "setup";
  const revealed = revealingCard(state);
  if (revealed) {
    const doing = DOING[event.kind];
    const tail = doing ? `, and its When Revealed ${doing}` : ", and its When Revealed is resolving";
    const what = `${cardName(state, revealed)} was revealed${settingUp ? " as a setup card" : ""}${tail}`;
    return settingUp ? `Setting up: ${what}` : what;
  }
  if (settingUp) return "Setting up the table";
  if (state.step.phase === "villain") {
    const words = VILLAIN_STEP_WORDS[state.step.kind];
    return words ? `Villain phase: ${words}` : "Villain phase";
  }
  return null;
}

/**
 * "Use I Object! to prevent 1 of that threat (once per round)" from the ability's own printed paragraph: the quoted
 * name, the trigger keyword and the "When ... ," condition come off the front. A paragraph that does not take that
 * shape is shown whole after the name rather than guessed at.
 */
export function effectLineOf(name: string, paragraph: string): string {
  let text = paragraph.trim();
  // The ability's own name, quoted ("I Object!") or plain (Spider-Sense), before its trigger keyword.
  const named = text.match(
    /^["\u201c]?([^"\u201d\u2014\u2013]{1,40}?)["\u201d]?\s*[-\u2013\u2014]\s*(?=(?:Hero |Alter-Ego )?(?:Forced )?(?:Interrupt|Response)\b)/i,
  );
  let shown = name;
  if (named) {
    shown = named[1]!.trim();
    text = text.slice(named[0].length);
  }
  text = text.replace(/^(?:Hero |Alter-Ego )?(?:Forced )?(?:Interrupt|Response)\s*:\s*/i, "");
  const rest = text.replace(/^(?:When|After|If)\b[^,]*,\s*/i, "");
  const tidy = (s: string): string =>
    s
      .replace(/\.\s*\(Limit ([^)]*?)\.?\)\s*$/i, " ($1)")
      .replace(/\.$/, "")
      .trim();
  if (rest !== text && /^[a-z]/.test(rest)) return `Use ${shown} to ${tidy(rest)}`;
  return `Use ${shown}: ${tidy(text)}`;
}

/**
 * A response that takes a card away after a mission attempt discarded it from a deck (Digging Deep to hand): the card
 * no longer counts for the attempt (ruling April 30, 2026 - Ruling 4, answer 1), which the card text does not say. Any
 * other deck discard keeps counting a card taken away (Jackpot! shuffled back still counts for Luck Be a Lady;
 * docs/phase7-wave7.md §4.1 Q32 = A), so nothing is said there. The attempt's set is marked `takenAwayNotCounted`.
 */
export function deckDiscardWarningOf(state: GameState, event: TriggerEvent): string | null {
  if (event.kind !== "cardDiscardedFromDeck" || event.at !== "discard") return null;
  const source = event.sourceInstanceId;
  if (source === null || source === event.instanceId) return null;
  const dropped = (state.deckDiscardWindows ?? []).some((window) =>
    window.discards.some((d) => d.instanceId === event.instanceId && d.boundOn?.takenAwayNotCounted === true),
  );
  if (!dropped) return null;
  return `Heads up: if ${cardName(state, event.instanceId)} leaves the discard pile, it won't count for ${cardName(state, source)}. Decline to keep it counted.`;
}

/** The parts of a choice the window headline reads. */
export interface TriggerChoiceLike {
  readonly prompt: ChoicePrompt;
  readonly options: readonly ChoiceOption[];
  readonly frameId?: FrameId | null | undefined;
}

/**
 * The triggering conditions a `chooseTriggers` choice's options answer, each once, in the order they happened. A
 * sentence's held responses open one window for all of the sentence's conditions (RRG 1.8 "Triggering Condition",
 * p. 45; `resolve/sentence-hold.ts`), and the prompt's own `event` is only the last of them: a form change's Response
 * offered after Gamma Blast's attack answers the form change, not the attack. The window's frame says which condition
 * each offered ability answers (`TriggerCandidate.sharedEvent`); without the frame (a beat read back after the window
 * closed), the prompt's event stands.
 */
export function answeredEventsOf(state: GameState, choice: TriggerChoiceLike): readonly TriggerEvent[] {
  const { prompt } = choice;
  if (prompt.kind !== "chooseTriggers") return [];
  const frame = state.stack.find((f) => f.frameId === choice.frameId);
  if (!frame || frame.kind !== "window" || !frame.alsoEvents?.length) return [prompt.event];
  // `alsoEvents` resolved before `event`, in order.
  const answered = new Set<number>();
  const last = frame.alsoEvents.length;
  for (const option of choice.options) {
    const { ref } = option;
    if (ref.kind !== "ability") continue;
    for (const candidate of frame.pending) {
      if (candidate.instanceId !== ref.instanceId || candidate.abilityId !== ref.abilityId) continue;
      answered.add(candidate.sharedEvent ? candidate.sharedEvent.index : last);
    }
  }
  if (answered.size === 0) return [prompt.event];
  return [...answered].sort((a, b) => a - b).map((index) => frame.alsoEvents![index] ?? frame.event);
}

/**
 * The headline for a `chooseTriggers` choice: the condition its options answer, or each of them in turn when they
 * answer several ("You changed to Hulk form, then you attacked Rhino").
 */
export function triggerChoiceHeadlineOf(
  state: GameState,
  choice: TriggerChoiceLike,
  timing: "interrupt" | "response",
  viewer: PlayerId,
): string {
  const lines = answeredEventsOf(state, choice).map((event) => triggerHeadlineOf(state, event, timing, viewer));
  const distinct = lines.filter((line, index) => lines.indexOf(line) === index);
  return distinct
    .map((line, index) =>
      index === 0 ? line : line.replace(/^(You|Just happened|About to happen)\b/, (lead) => lead.toLowerCase()),
    )
    .join(", then ");
}

/**
 * True while a sentence's combined response window offers its early round (`Frame<"window">.earlyOptional`): optional
 * responses to the conditions no forced response answers, ahead of the forced ones (RRG 1.8 p. 5, p. 20, p. 45). One
 * declined there is offered again once the forced responses have resolved, so declining is "Not now", not "Decline".
 */
export function offeredAgainLater(state: GameState, choice: TriggerChoiceLike): boolean {
  if (choice.prompt.kind !== "chooseTriggers") return false;
  const frame = state.stack.find((f) => f.frameId === choice.frameId);
  return frame?.kind === "window" && frame.earlyOptional === "offering";
}

/** The decline button's label for a choice: "Not now" for the early round of a combined window, else "Decline". */
export function declineLabelOf(state: GameState | null, choice: TriggerChoiceLike): string {
  return state && offeredAgainLater(state, choice) ? "Not now" : "Decline";
}

/**
 * The context for a `chooseTriggers` prompt, or null for any other prompt. `effects` has one line per distinct
 * offered ability.
 */
export function triggerWindowContextOf(
  state: GameState,
  choice: PendingChoice,
  viewer: PlayerId,
  deps: EngineDeps,
): TriggerWindowContext | null {
  const { prompt } = choice;
  if (prompt.kind !== "chooseTriggers") return null;
  const effects: string[] = [];
  for (const option of choice.options) {
    const { ref } = option;
    if (ref.kind !== "ability") continue;
    const panel = sourceCardPanelFor(state, ref.instanceId, viewer, deps, null, ref.abilityId);
    const trigger = deps.abilities[ref.abilityId]?.trigger;
    const ordered = abilityFirst(panel.rulesText, trigger ? triggerLabel(trigger) : "");
    const line = effectLineOf(faceUpName(state, ref.instanceId), ordered.split(/\n+/)[0] ?? ordered);
    if (!effects.includes(line)) effects.push(line);
  }
  const answered = answeredEventsOf(state, choice);
  return {
    headline: triggerChoiceHeadlineOf(state, choice, prompt.timing, viewer),
    whyNow: triggerWhyNowOf(state, answered[0] ?? prompt.event),
    effects,
    warning:
      prompt.timing === "response"
        ? (answered.map((event) => deckDiscardWarningOf(state, event)).find((line) => line !== null) ?? null)
        : null,
    later: offeredAgainLater(state, choice)
      ? "Not now: you'll be offered these again after the forced responses resolve. Pick one now to use it first."
      : null,
  };
}
