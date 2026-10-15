/**
 * What the docked villain phase's decision notice says about a held decision: why this player decides (the rule), what
 * is being decided (the prompt's own words, with the asking card named), and what there is to pick from (the engine's
 * own options). Read straight off the `PendingChoice`; nothing here knows a card.
 *
 * Before this the notice said only "As first player, you pick the target" or "Your decision", which never said what
 * the target was for, which of two effects was first, or what the options were.
 */
import type { EngineDeps, GameState, PendingChoice, PlayerId } from "@mc/engine";
import { choiceHeaderText, promptTitleOf } from "./choice-source.js";
import { optionLabelOf } from "./names.js";
import { decisionLabel } from "./villain-walkthrough.js";

/** The most options a notice lists before it says how many more there are. */
const MAX_LISTED = 5;

/** A decision that is plainly "Your decision" / "Ana decides" adds nothing the question line does not say. */
const isBareDecider = (authority: PendingChoice["authority"]): boolean => authority === "player";

/**
 * The notice's body: the rule line (when a rule, not the player's own turn, put the decision here), the question with
 * the card that asks it, and one line per option. Windows (`chooseTriggers`) are answered inline, not here.
 */
export function decisionNoticeOf(
  state: GameState,
  choice: PendingChoice,
  viewer: PlayerId | null,
  deps: EngineDeps,
): string {
  const question = choiceHeaderText(state, choice, deps, promptTitleOf(choice.prompt, deps, choice, state));
  const lines: string[] = [];
  if (!isBareDecider(choice.authority) || choice.prompt.kind === "declareDefender") {
    lines.push(decisionLabel(choice, state, viewer));
  }
  lines.push(question);
  const labels = choice.options.map((option) => optionLabelOf(state, option));
  const listed = labels.slice(0, MAX_LISTED).map((label) => `• ${label}`);
  lines.push(...listed);
  if (labels.length > listed.length) lines.push(`+${labels.length - listed.length} more`);
  return lines.join("\n");
}

/** The prompt kinds that pick one thing, where a lone candidate leaves nothing to pick. */
const SINGLE_PICKS: ReadonlySet<string> = new Set([
  "chooseTarget",
  "chooseAttachmentTarget",
  "chooseMinionToActivate",
  "choosePlayer",
]);

/**
 * The one option id to answer with when the encounter side's pick has only one candidate (the first player "picks" the
 * target when exactly one is eligible), else null. The player never decides anything here, so the phase answers it
 * itself, through the same `resolveChoice` an answered sheet would use; the engine still checks it.
 */
export function soleAnswerOf(choice: PendingChoice): string | null {
  if (choice.authority === "player") return null;
  if (!SINGLE_PICKS.has(choice.prompt.kind)) return null;
  if (choice.options.length !== 1 || choice.minSelections !== 1 || choice.maxSelections !== 1) return null;
  return choice.options[0]!.optionId;
}
