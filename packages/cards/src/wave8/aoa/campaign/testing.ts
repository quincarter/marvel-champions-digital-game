import { AOA_CARDS, CORE_CARDS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import { createGame, type EngineDeps, type GameState } from "@mc/engine";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { firstLegal, settle } from "../../../testing/harness.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { AOA_CAMPAIGN_ABILITIES } from "./index.js";

/**
 * Shared staging for the campaign-only sets' tests (docs/phase7-wave8.md section 1.24 to 1.28): Spider-Man (Justice)
 * against Rhino in a standard Core game, the campaign cards added by code to the deck (`requireLegalDecks: false`) and
 * to the encounter deck. Campaign cards are never part of standalone play; this stands in for the campaign's own
 * instructions (the runner puts them where they belong).
 */
export const POOL: readonly AnyCard[] = [...CORE_CARDS, ...WAVE7_CARDS, ...AOA_CARDS];
export const CAMPAIGN_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, AOA_CAMPAIGN_ABILITIES) };

export function campaignGame(opts: {
  readonly deck?: readonly string[];
  readonly encounter?: readonly string[];
  readonly seed?: number;
}): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = config.players.map((p) => ({ ...p, deck: [...p.deck, ...(opts.deck ?? []).map((c) => cardId(c))] }));
  const created = createGame(
    {
      ...config,
      players,
      requireLegalDecks: false,
      encounterDeck: [...config.encounterDeck, ...(opts.encounter ?? []).map((c) => cardId(c))],
    },
    CAMPAIGN_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", CAMPAIGN_DEPS);
}
