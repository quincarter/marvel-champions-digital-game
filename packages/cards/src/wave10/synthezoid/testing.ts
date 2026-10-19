import { WAVE10_ENCOUNTER_SETS } from "@mc/content";
import { createGame, type GameState } from "@mc/engine";
import { sideMainSchemeCard } from "../../main-scheme-stages.js";
import { playableScenarioOffer } from "../../playable/scenario-options.js";
import { firstLegal, settle } from "../../testing/harness.js";
import { WAVE10_CARDS } from "../cards.js";
import { wave10ScenarioRecord } from "../setup.js";
import { WAVE10_DEPS, civilWarConfig } from "../testing.js";

/**
 * A Civil War leader's game, past setup, whose main scheme deck is `picks` (the B faces of one stage 1 and one stage 2,
 * Synthezoid Smackdown's included) on the card with every set ungated (`WAVE10_ENCOUNTER_SETS`). Synthezoid Smackdown
 * stays gated in the playable lists until all its sets are scripted, so `wave10Scenario` would refuse its stages; this
 * builds the config it will build once the gate is lifted, the way `main-scheme-stage-pool.test.ts` does.
 */
export function ungatedStageGame(
  scenarioId: string,
  picks: readonly [string, string],
  opts: { readonly twoPlayers?: boolean; readonly seed?: number; readonly starterDeckId?: string } = {},
): GameState {
  const recommended = playableScenarioOffer(scenarioId).mainSchemeStages!.recommended;
  const config = civilWarConfig(scenarioId, { ...opts, mainSchemeStageIds: recommended });
  const card = sideMainSchemeCard(wave10ScenarioRecord(scenarioId), WAVE10_CARDS, WAVE10_ENCOUNTER_SETS);
  const indexOf = (id: string): number => {
    const index = card.stages.findIndex((stage) => (stage.printedCardId as string | undefined) === id);
    if (index < 0) throw new Error(`no stage ${id}`);
    return index;
  };
  const created = createGame(
    {
      ...config,
      cards: config.cards.map((c) => (c.id === card.id ? card : c)),
      mainSchemeStageIndexes: picks.map(indexOf),
    },
    WAVE10_DEPS,
  );
  if (!created.ok) throw new Error(`${created.error.code}: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
}
