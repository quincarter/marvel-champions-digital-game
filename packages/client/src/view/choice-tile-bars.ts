/**
 * The bars on the "choose a target" sheet's tiles: a scheme's threat meter and a character's hit point plate, the
 * same two the board draws, so a player picking between two schemes sees how much each holds before choosing.
 *
 * Every number is the engine's. A bar's level is the board panel's own (`schemePanel`, `characterPanel`); the
 * striped "would be reduced" segment is read off the engine's `preview()` of answering with the current picks
 * (`OutcomePreview.counters`, before and after), so the client restates no rule. A preview is shown only when the
 * engine ran the whole answer to its end (`stop.kind === "complete"`): an amount still to be chosen, a response
 * window or hidden information means the number is not known yet, and the bar is plain rather than guessed.
 */

import {
  cardOf,
  preview,
  type ChoiceRef,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PendingChoice,
} from "@mc/engine";
import { characterPanel, schemePanel } from "./board-model.js";

/** The prompts whose tiles are the cards an effect would hit; every other card sheet keeps its plain tiles. */
const BAR_PROMPTS: ReadonlySet<string> = new Set(["chooseTarget", "chooseBasicPowerTarget"]);

export interface TileBar {
  readonly kind: "threat" | "hp";
  /** Threat on the scheme, or hit points left. */
  readonly current: number;
  /** The meter's full width: a side scheme's starting threat or the main scheme's target; a character's maximum hit points. */
  readonly max: number | null;
  /** The main scheme's target threat (drawn "n / target"); null for a side scheme and a character. */
  readonly target: number | null;
  /** A dashed target ("—"): no threshold. */
  readonly targetDashed: boolean;
  /** What the bar reads once the effect has resolved, when the engine knows; null draws the plain bar. */
  readonly after: number | null;
}

const refInstanceId = (ref: ChoiceRef): InstanceId | null =>
  ref.kind === "card" || ref.kind === "ability" ? ref.instanceId : null;

/** The bar for one card at rest, or null for a card with neither threat nor hit points to show. */
function barOf(state: GameState, id: InstanceId, deps: EngineDeps): TileBar | null {
  const type = cardOf(state, id)?.type;
  if (type === "main_scheme" || type === "side_scheme") {
    const panel = schemePanel(state, id, deps, type === "main_scheme");
    return {
      kind: "threat",
      current: panel.threat,
      max: panel.meterMax,
      target: panel.target,
      targetDashed: panel.targetDashed === true,
      after: null,
    };
  }
  if (!state.instances[id]) return null;
  const hp = characterPanel(state, id, deps).hp;
  return hp ? { kind: "hp", current: hp.current, max: hp.max, target: null, targetDashed: false, after: null } : null;
}

/**
 * The bar for each card option of a pending choice, by option id. `selected` is the sheet's current picks: with at
 * least one pick, the engine previews answering with exactly those, and each picked tile whose card the answer
 * lowers carries `after`.
 */
export function choiceTileBarsOf(
  state: GameState,
  choice: PendingChoice,
  selected: readonly string[],
  deps: EngineDeps,
): ReadonlyMap<string, TileBar> {
  const bars = new Map<string, TileBar>();
  if (!BAR_PROMPTS.has(choice.prompt.kind)) return bars;
  for (const option of choice.options) {
    const id = refInstanceId(option.ref);
    const bar = id ? barOf(state, id, deps) : null;
    if (bar) bars.set(option.optionId, bar);
  }
  if (bars.size === 0 || selected.length === 0 || choice.prompt.kind !== "chooseTarget") return bars;

  const result = preview(
    state,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: selected },
    deps,
  );
  if (result.stop.kind !== "complete") return bars;
  for (const optionId of selected) {
    const bar = bars.get(optionId);
    const option = choice.options.find((entry) => entry.optionId === optionId);
    const id = option ? refInstanceId(option.ref) : null;
    const counter = id ? result.counters.find((entry) => entry.instanceId === id) : undefined;
    if (!bar || !counter) continue;
    // A card the answer takes out of play (a scheme thwarted to 0, an enemy defeated) is an emptied bar.
    const after =
      bar.kind === "threat"
        ? counter.after.inPlay
          ? (counter.after.threat ?? 0)
          : 0
        : counter.after.inPlay
          ? (counter.after.remainingHitPoints ?? 0)
          : 0;
    if (after < bar.current) bars.set(optionId, { ...bar, after });
  }
  return bars;
}
