/**
 * "Which ability?" — an event that prints more than one Action ability, with more than one usable right now.
 *
 * RRG 1.8 "Event" (p. 18): "If an event has more than one triggered ability on it, the player playing it chooses one
 * of those abilities to trigger." The engine lists the usable ones on the `playCard` entry (`LegalAction.abilities`)
 * and refuses a play that names none, so the choice is the player's and is asked before anything is paid. This reads
 * that list and words each ability from the card's own printed text, in the same order the engine judges them (the
 * card's ability references that are Actions, against the card's Action paragraphs). One usable ability plays directly.
 */
import type { AbilityId } from "@mc/content";
import { cardOf, type Command, type EngineDeps, type GameState, type LegalAction } from "@mc/engine";
import { cardTextDisplay } from "./card-text-display.js";

export interface EventAbilityOption {
  readonly abilityId: AbilityId;
  /** A few words: the printed condition ("If you are in Giant hero form"), else the label, else "Option 2". */
  readonly label: string;
  /** The `playCard` command that triggers this ability (payment and targets are the player's, still to come). */
  readonly command: Command;
}

/** True once there is a real choice: the engine offers more than one ability for this play. */
export function needsEventAbilityChoice(entry: LegalAction): boolean {
  return entry.action.kind === "playCard" && (entry.abilities?.length ?? 0) > 1;
}

const ACTION_PARAGRAPH = /^(?:(?:Hero|Alter-Ego) )?Action\b(?:\s*\(([^)]*)\))?\s*:?\s*/i;
const LABEL_WORDS = 6;

/** "If you are in Giant hero form, deal …" to "If you are in Giant hero form": the clause before the first comma. */
function clauseOf(body: string): string {
  const clause = (body.split(/[,.:;]/)[0] ?? "").trim();
  const words = clause.split(/\s+/).filter(Boolean);
  return words.length > LABEL_WORDS ? `${words.slice(0, LABEL_WORDS).join(" ")}…` : clause;
}

/** Each Action paragraph of the card's text, as the words after its "Hero Action (attack):" heading. */
function actionClauses(text: string): readonly { readonly clause: string; readonly tag: string | null }[] {
  return cardTextDisplay(text)
    .split("\n")
    .flatMap((line) => {
      const match = ACTION_PARAGRAPH.exec(line.trim());
      if (!match) return [];
      return [{ clause: clauseOf(line.trim().slice(match[0].length)), tag: match[1]?.trim() ?? null }];
    });
}

/**
 * The abilities to offer for one `playCard` entry, in the engine's order, each with its command; empty when the entry
 * is not a choice (one usable ability, or none, plays directly with the entry's own `example`).
 */
export function eventAbilityOptions(
  state: GameState,
  entry: LegalAction,
  deps: EngineDeps,
): readonly EventAbilityOption[] {
  if (!needsEventAbilityChoice(entry) || entry.action.kind !== "playCard" || entry.example.type !== "playCard") {
    return [];
  }
  const example = entry.example;
  const card = cardOf(state, entry.action.instanceId);
  const printed = card && "abilities" in card ? card.abilities : [];
  const actionIds = printed.filter((ref) => deps.abilities[ref.id]?.trigger.kind === "action");
  const paragraphs = card && "text" in card ? actionClauses(card.text.current) : [];
  const aligned = paragraphs.length === actionIds.length;
  const options = (entry.abilities ?? []).map((abilityId, position): EventAbilityOption => {
    const index = actionIds.findIndex((ref) => ref.id === abilityId);
    const printedLabel = actionIds[index]?.label;
    const paragraph = aligned && index >= 0 ? paragraphs[index] : undefined;
    const label = paragraph?.clause || printedLabel || paragraph?.tag || `Option ${position + 1}`;
    return { abilityId, label, command: { ...example, abilityId } };
  });
  // Two abilities worded alike would be two identical buttons: number them rather than leave them unpickable.
  return options.map((option, i) =>
    options.some((other, j) => j !== i && other.label === option.label)
      ? { ...option, label: `${option.label} (${i + 1})` }
      : option,
  );
}
