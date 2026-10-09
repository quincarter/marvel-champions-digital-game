import { AOA_CARDS, CORE_CARDS, WAVE7_CARDS, cardId, type AnyCard } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  pairOptionId,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
  type TargetRef,
} from "@mc/engine";
import { coreScenario } from "../../../core/setup.js";
import { mergeRegistries } from "../../../dsl/index.js";
import { firstLegal, instancesOf, playerOf, settle, type Picker } from "../../../testing/harness.js";
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

export const MISSION_TEAM = "45171a";
const printed = (code: string): TargetRef => ({ kind: "find", query: { printedId: cardId(code) } });

/** The cards in the mission area, in the order they entered it. */
export const atTheMission = (state: GameState): readonly InstanceId[] =>
  state.scenarioPlayAreas?.[MISSION_AREA]?.cards ?? [];

export function campaignGame(opts: {
  readonly deck?: readonly string[];
  readonly encounter?: readonly string[];
  readonly seed?: number;
  /**
   * The mission (an a-face code) and optionally its Overseer, put into the mission area at setup; `team` also puts
   * Mission Team (45171a) into play under the first player's control.
   */
  readonly mission?: { readonly mission: string; readonly overseer?: string; readonly team?: boolean };
  /** Seats (default 1): Spider-Man, then Captain Marvel, then She-Hulk, each with its Core starter deck. */
  readonly players?: 1 | 2 | 3;
  /** More set-aside cards, by code (the campaign's own: Desperate Measures, the campaign allies, the Sea Wall). */
  readonly setAside?: readonly string[];
}): GameState {
  const config = coreScenario("rhino", {
    players: [
      { starterDeckId: "core-spider-man-justice" },
      { starterDeckId: "core-captain-marvel-leadership" },
      { starterDeckId: "core-she-hulk-aggression" },
    ].slice(0, opts.players ?? 1),
    seed: opts.seed ?? 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: POOL,
  });
  const players = config.players.map((p) => ({ ...p, deck: [...p.deck, ...(opts.deck ?? []).map((c) => cardId(c))] }));
  const setAside = [...(config.setAside ?? []), ...(opts.setAside ?? []).map((c) => cardId(c))];
  const created = createGame(
    {
      ...config,
      players,
      requireLegalDecks: false,
      encounterDeck: [...config.encounterDeck, ...(opts.encounter ?? []).map((c) => cardId(c))],
      ...(setAside.length > 0 ? { setAside } : {}),
      ...(opts.mission
        ? {
            setAside: [
              ...setAside,
              cardId(opts.mission.mission),
              ...(opts.mission.overseer ? [cardId(opts.mission.overseer)] : []),
              ...(opts.mission.team ? [cardId(MISSION_TEAM)] : []),
            ],
            scenarioRuleSpecs: [...(config.scenarioRuleSpecs ?? []), ...MISSION_RULES],
            scenarioSetupInstructions: [
              ...(config.scenarioSetupInstructions ?? []),
              missionSetupInstruction(
                printed(opts.mission.mission),
                opts.mission.overseer ? printed(opts.mission.overseer) : undefined,
                opts.mission.team ? printed(MISSION_TEAM) : undefined,
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

/**
 * Test surgery: these cards of `player` (in hand, deck or discard pile) are at the mission, faceup, under nobody's
 * control, as if each had been played there. Marrow's "Play only if you have the [X-FORCE] or [X-MEN] trait" keeps
 * Spider-Man from playing her, and the tests here are about what happens at the mission, not about the play.
 */
export function atMission(
  state: GameState,
  player: PlayerId,
  ...codes: readonly string[]
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, player);
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const wanted = (id: InstanceId) => state.instances[id]?.cardId === cardId(code) && !ids.includes(id);
    const id = owner.hand.find(wanted) ?? owner.deck.find(wanted) ?? owner.discard.find(wanted);
    if (!id) throw new Error(`${player} has no ${code}`);
    ids.push(id);
  }
  const strip = (zone: readonly InstanceId[]) => zone.filter((id) => !ids.includes(id));
  const area = state.scenarioPlayAreas?.[MISSION_AREA];
  if (!area) throw new Error("no mission area");
  const instances = { ...state.instances };
  for (const id of ids) instances[id] = { ...instances[id]!, controllerId: null, faceup: true };
  return {
    ids,
    state: {
      ...state,
      instances,
      players: state.players.map((p) =>
        p.playerId === player ? { ...p, hand: strip(p.hand), deck: strip(p.deck), discard: strip(p.discard) } : p,
      ),
      scenarioPlayAreas: { ...state.scenarioPlayAreas, [MISSION_AREA]: { ...area, cards: [...area.cards, ...ids] } },
    },
  };
}

/** Test surgery: an encounter card from the encounter deck is at the mission, as Agent of Apocalypse's first option puts it. */
export function encounterCardAtMission(
  state: GameState,
  code: string,
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((candidate) => state.instances[candidate]?.cardId === cardId(code));
  const area = state.scenarioPlayAreas?.[MISSION_AREA];
  if (!id || !area) throw new Error(`no ${code} in the encounter deck, or no mission area`);
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: { ...state.instances[id]!, faceup: true, engagedWith: null } },
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      scenarioPlayAreas: { ...state.scenarioPlayAreas, [MISSION_AREA]: { ...area, cards: [...area.cards, id] } },
    },
  };
}

/** The one card of this code in the game (the mission, its Overseer, Mission Team). */
export const theCard = (state: GameState, code: string): InstanceId => {
  const [id] = instancesOf(state, code);
  if (!id) throw new Error(`no ${code}`);
  return id;
};

export const MISSION_TEAM_ACTION = "45171a.mission-team-action";
/** Mission Team's two options, as `chooseOption` numbers them. */
export const DISCOUNT = "0";
export const ATTEMPT = "1";

/**
 * A picker for a mission attempt: chooses the attempt, assigns the cards as `pairs` says (a function of the cards the
 * prompt offers, in discard order, to [card, ally] pairs), deals the pool to the first enemy offered in the largest
 * amount each time, and otherwise answers like `fallback`.
 */
export function attempting(
  pairs: (cards: readonly InstanceId[]) => readonly (readonly [InstanceId, InstanceId])[],
  fallback: Picker = firstLegal,
): Picker {
  return (state) => {
    const choice = state.pendingChoice;
    if (!choice) return [];
    if (choice.prompt.kind === "chooseOption" && choice.options.some((o) => o.label === "Make a mission attempt"))
      return [ATTEMPT];
    if (choice.prompt.kind === "pairCards")
      return pairs(choice.prompt.cards).map(([card, ally]) => pairOptionId(card, ally));
    if (choice.prompt.kind === "chooseNumber") return [String(choice.prompt.max)];
    return fallback(state);
  };
}
