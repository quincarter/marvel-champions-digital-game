import { AOA_CARDS, CORE_CARDS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import { createGame, type EngineDeps, type GameState, type InstanceId, type TargetRef } from "@mc/engine";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { firstLegal, settle } from "../../../testing/harness.js";
import { WAVE7_ABILITIES } from "../../../wave7/index.js";
import { AOA_CAMPAIGN_ABILITIES } from "./index.js";
import { MISSION_AREA, MISSION_RULES, missionSetupInstruction } from "./mission-rules.js";

/**
 * Shared staging for the campaign-only sets' tests (docs/phase7-wave8.md section 1.24 to 1.28): Spider-Man (Justice)
 * against Rhino in a standard Core game, the campaign cards added by code to the deck (`requireLegalDecks: false`) and
 * to the encounter deck. Campaign cards are never part of standalone play; this stands in for the campaign's own
 * instructions (the runner puts them where they belong).
 *
 * `mission` stands in for campaign setup's mission and Overseer (MC45 p. 5; docs/phase7-wave8.md §2.12 steps 3 and 4):
 * the two cards start set aside, and one setup instruction, resolved by the first player after scenario setup,
 * creates the mission area, puts the mission into play there with 5[per_hero] threat and puts the Overseer into play
 * there (`missionSetupInstruction`). The Mission Rules card's rules are the game's scenario rules (`MISSION_RULES`).
 * That is how a real campaign game gets its mission area too: the campaign's game builder passes the same two things.
 */
export const POOL: readonly AnyCard[] = [...CORE_CARDS, ...WAVE7_CARDS, ...AOA_CARDS];
export const CAMPAIGN_DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, AOA_CAMPAIGN_ABILITIES) };

const printed = (code: string): TargetRef => ({ kind: "find", query: { printedId: cardId(code) } });

/** The cards in the mission area, in the order they entered it. */
export const atTheMission = (state: GameState): readonly InstanceId[] =>
  state.scenarioPlayAreas?.[MISSION_AREA]?.cards ?? [];

export function campaignGame(opts: {
  readonly deck?: readonly string[];
  readonly encounter?: readonly string[];
  readonly seed?: number;
  /** The mission (an a-face code) and optionally its Overseer, put into the mission area at setup. */
  readonly mission?: { readonly mission: string; readonly overseer?: string };
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
      ...(opts.mission
        ? {
            setAside: [
              ...(config.setAside ?? []),
              cardId(opts.mission.mission),
              ...(opts.mission.overseer ? [cardId(opts.mission.overseer)] : []),
            ],
            scenarioRuleSpecs: [...(config.scenarioRuleSpecs ?? []), ...MISSION_RULES],
            scenarioSetupInstructions: [
              ...(config.scenarioSetupInstructions ?? []),
              missionSetupInstruction(
                printed(opts.mission.mission),
                opts.mission.overseer ? printed(opts.mission.overseer) : undefined,
              ),
            ],
          }
        : {}),
    },
    CAMPAIGN_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", CAMPAIGN_DEPS);
}
