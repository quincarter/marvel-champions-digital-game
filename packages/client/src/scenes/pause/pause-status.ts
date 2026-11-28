import { playableScenarioOffer } from "@mc/cards";
import { gameEncounterSets, gameScenarios } from "../../content/game-deps.js";
import { t } from "../../i18n/translate.js";
import { adjustedSuffixOf, blindSheetNamesOf, pauseStatusOf, seedSuffixOf } from "../../view/pause-model.js";
import { appSession } from "../../session.js";
import type { SessionState } from "../../store/session-store.js";

type Game = NonNullable<SessionState["game"]>;
type Perspective = NonNullable<SessionState["perspectiveId"]>;

/**
 * A Civil War game played blind (docs/phase7-wave10-client.md 2.6): the stage pair and the modular sets as they stand,
 * hidden pieces worded and counted; a built or rolled game (not blind) lists its stages and sets. Empty for every
 * other game, and for a leader as printed.
 */
export function blindSheetOf(
  game: Game,
  perspectiveId: Perspective,
  config: SessionState["config"],
): readonly string[] {
  if (!config) return [];
  let offer = null;
  try {
    offer = playableScenarioOffer(config.scenarioId);
  } catch {
    offer = null;
  }
  const setNames = new Map(gameEncounterSets().map((set) => [set.id as string, set.name]));
  const status = pauseStatusOf(
    game,
    perspectiveId,
    config,
    gameScenarios(),
    blindSheetNamesOf(offer, setNames),
    appSession().store.state.adjusted,
  );
  return status.blindSheet ?? status.buildSheet ?? [];
}

/** The phone header's full line: scenario · difficulty · round · phase · seat (and the seed, and the adjusted note). */
export function statusLineOf(game: Game, perspectiveId: Perspective, config: SessionState["config"]): string {
  const s = pauseStatusOf(game, perspectiveId, config, gameScenarios(), undefined, appSession().store.state.adjusted);
  return `${s.scenarioName} · ${s.difficultyLabel} · ${t("pause.round", { round: s.round })} · ${s.phaseLabel} · ${s.seatLabel}${seedSuffixOf(s)}${adjustedSuffixOf(s)}`;
}

/**
 * D13's own shorter read ("Round 3 · player phase · your turn"): the wide menu is a narrow column, so it drops the
 * scenario and difficulty the board's own chrome underneath still shows.
 */
export function wideStatusLineOf(game: Game, perspectiveId: Perspective, config: SessionState["config"]): string {
  const s = pauseStatusOf(game, perspectiveId, config, gameScenarios(), undefined, appSession().store.state.adjusted);
  // The seed before the seat: the seat name is the part that gives way when the column is too narrow for both.
  return `${t("pause.round", { round: s.round })} · ${s.phaseLabel.toLowerCase()}${seedSuffixOf(s)} · ${s.seatLabel}`;
}
