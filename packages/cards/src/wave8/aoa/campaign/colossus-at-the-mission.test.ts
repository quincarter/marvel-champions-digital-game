import {
  legalActions,
  playDestinationOfOption,
  playToAreaOption,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { mergeRegistries } from "../../../dsl/index.js";
import { endTurn, firstLegal, moveToHand, P1, playerOf } from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { MAGIK_SUPPORT_UPGRADES_ALLIES } from "../magik/support-upgrades-allies.js";
import { MISSION_AREA } from "./mission-rules.js";
import { atTheMission, CAMPAIGN_DEPS, campaignGame } from "./testing.js";

vi.setConfig({ testTimeout: 60_000 });

/**
 * Colossus (45031) with a mission in play. MC45 p. 5: "While a [MISSION] side scheme is in play, when a player plays
 * an ally, they must choose: either play that ally into their game area per the normal rules of the game, or play it
 * into the mission area." Owner decision, 2026-10-08 (docs/phase7-wave8.md §4.1 row 60): an effect that says "play an
 * ally" offers that choice. Owner answer Q32 (same table): "Colossus 45031's Interrupt plays him and makes him the
 * defender, which the mission area cannot satisfy: that play goes to the player's own area only. Ordinary ally plays
 * keep the mission choice." So his interrupt asks nothing about the place (`playFromHand.ownAreaOnly`), and playing
 * him from hand on the player's turn still lists the mission.
 *
 * Staging: the campaign harness (Spider-Man against Rhino, Evacuate Survivors in the mission area), Colossus added to
 * the deck by code. The engine's own tests of the choice are `play-destination-effect.test.ts`.
 */
const COLOSSUS = "45031";
const COLOSSUS_INTERRUPT = "45031.colossus-interrupt";
const DEPS: EngineDeps = { abilities: mergeRegistries(CAMPAIGN_DEPS.abilities, MAGIK_SUPPORT_UPGRADES_ALLIES) };

function inHand(): { readonly state: GameState; readonly colossus: InstanceId } {
  const game = withForm(campaignGame({ deck: [COLOSSUS], mission: { mission: "45167a" } }), { heroForm: 0 });
  const { state, ids } = moveToHand(game, P1, COLOSSUS);
  return { state, colossus: ids[0]! };
}
const placeQuestions = (events: readonly GameEvent[]) =>
  events.filter(
    (e) =>
      e.type === "choiceRequested" && e.choice.options.some((o) => playDestinationOfOption(o.optionId) !== undefined),
  );

/** Ends the turn and takes Colossus's interrupt when it is offered, paying with three cards. */
function villainPhase(deps: EngineDeps, place: (s: GameState) => readonly string[] = firstLegal) {
  const { state, colossus } = inHand();
  let taken = 0;
  const run = driveEventsPicking(
    deps,
    state,
    (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers") {
        const own = choice.options.find((o) => o.optionId.endsWith(COLOSSUS_INTERRUPT));
        if (own) {
          taken++;
          return [own.optionId];
        }
      }
      if (choice.prompt.kind === "spendResources") return choice.options.slice(0, 3).map((o) => o.optionId);
      if (choice.options.some((o) => playDestinationOfOption(o.optionId) !== undefined)) return place(s);
      return firstLegal(s);
    },
    endTurn(P1),
  );
  return { ...run, colossus, taken };
}

describe("Colossus 45031 while a mission is in play (owner answer Q32 beside row 60)", () => {
  it("his interrupt plays him to the player's own area with no question of place, and he defends", () => {
    const run = villainPhase(DEPS);
    expect(run.taken).toBeGreaterThanOrEqual(1);
    expect(run.events.some((e) => e.type === "cardPlayed" && e.instanceId === run.colossus)).toBe(true);
    expect(placeQuestions(run.events)).toEqual([]);
    expect(playerOf(run.state, P1).playArea).toContain(run.colossus);
    expect(atTheMission(run.state)).not.toContain(run.colossus);
    expect(
      run.events.filter((e) => e.type === "defenderDeclared" && e.defenderInstanceId === run.colossus),
    ).toHaveLength(1);
  });

  it("played from hand on his player's turn he keeps the choice: the mission is listed as a destination", () => {
    const { state, colossus } = inHand();
    const actions = legalActions(state, P1, DEPS);
    if (actions.kind !== "turn") throw new Error("not the player's turn");
    const play = actions.legal.find(({ action }) => action.kind === "playCard" && action.instanceId === colossus);
    expect(play?.destinations).toEqual([MISSION_AREA]);
  });

  it("what the answer changes: the same interrupt without its mark asks, and at the mission he cannot be declared", () => {
    // The script as row 60 alone would have it, built here only to show the difference Q32 makes.
    const marked = MAGIK_SUPPORT_UPGRADES_ALLIES[COLOSSUS_INTERRUPT]!;
    const unmarked = {
      ...marked,
      effects: marked.effects.map((effect) => {
        if (effect.kind !== "playFromHand") return effect;
        const { ownAreaOnly: _mark, ...rest } = effect;
        return rest;
      }),
    };
    const deps: EngineDeps = { abilities: { ...DEPS.abilities, [COLOSSUS_INTERRUPT]: unmarked } };
    const run = villainPhase(deps, () => [playToAreaOption(MISSION_AREA)]);
    expect(placeQuestions(run.events).length).toBeGreaterThanOrEqual(1);
    expect(atTheMission(run.state)).toContain(run.colossus);
    expect(run.events.filter((e) => e.type === "defenderDeclared" && e.defenderInstanceId === run.colossus)).toEqual(
      [],
    );
  });
});
