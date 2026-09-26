/**
 * The main-scheme threat callout in the villain-phase walkthrough (D11, L02):
 * "11 / 12 threat — one more and the scenario is lost." Built entirely on
 * `schemePanel` (`board-model.ts`), which already reads the threshold off the
 * engine's own `mainSchemeValue` — this module only words the two states the
 * canvases actually show, from that panel's own numbers.
 */
import { mainSchemeCompletionLoses, type EngineDeps, type GameState } from "@mc/engine";
import { schemePanel, type SchemePanel } from "./board-model.js";

export interface MainSchemeCallout {
  readonly panel: SchemePanel;
  /** "11 / 12 threat", or "7 threat" for a scheme with no threshold. */
  readonly line: string;
  /** Set only once the threshold is at or one threat away — null otherwise. */
  readonly warning: string | null;
}

export function mainSchemeCalloutOf(state: GameState, deps: EngineDeps): MainSchemeCallout {
  const panel = schemePanel(state, state.mainScheme.instanceId, deps, true);
  const { threat, target } = panel;

  if (target === null) return { panel, line: `${threat} threat`, warning: null };

  const remaining = target - threat;
  // Only a final stage (or one printed "If this stage is completed, the players lose") loses; any other advances.
  const loses = mainSchemeCompletionLoses(state, state.mainScheme.instanceId);
  const warning =
    remaining <= 0
      ? loses
        ? "Threshold reached — the scheme resolves at the end of this phase unless thwarted."
        : "Threshold reached — the main scheme advances to its next stage."
      : remaining === 1
        ? loses
          ? "One more threat and the scenario is lost."
          : "One more threat completes this stage, and the main scheme advances."
        : null;
  return { panel, line: `${threat} / ${target} threat`, warning };
}
