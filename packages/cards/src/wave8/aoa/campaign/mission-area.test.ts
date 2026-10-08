import {
  activeAbilityRefs,
  cardsInPlay,
  characterProfile,
  controllerOf,
  legalActions,
  locateCard,
  sessionApply,
  startSession,
  type Command,
  type EngineDeps,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { endTurn, firstLegal, inst, instancesOf, moveToHand, P1, playerOf } from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { AOA_ASPECT_BASIC } from "../aspect-basic.js";
import { MAGIK_SUPPORT_UPGRADES_ALLIES } from "../magik/support-upgrades-allies.js";
import { MISSION_AREA, MISSION_RULES } from "./mission-rules.js";
import { atTheMission, CAMPAIGN_DEPS, campaignGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The mission area with the box's own player cards (docs/phase7-wave8.md §3.34, §3.55 test 4, §3.56 and §4.1 Q32):
 * Spider-Man against Rhino with Evacuate Survivors (45167a) and Sugar Man (45182a) in the mission area and the
 * Mission Rules card's rules in force (`MISSION_RULES`, `campaignGame`'s `mission`). The allies are added to his deck
 * by code, and Colossus's Interrupt comes from his own module's registry.
 */
const X23 = "45012";
const MARROW = "45021";
const COLOSSUS = "45031";
const GOLDBALLS = "45041";
const COLOSSUS_REF = "45031.colossus-interrupt";
const DEPS: EngineDeps = {
  abilities: { ...CAMPAIGN_DEPS.abilities, ...AOA_ASPECT_BASIC, ...MAGIK_SUPPORT_UPGRADES_ALLIES },
};
const INTO = { scenarioPlayArea: MISSION_AREA } as const;

function table(...codes: readonly string[]): { state: GameState; ids: readonly InstanceId[] } {
  const game = campaignGame({ deck: codes, mission: { mission: "45167a", overseer: "45182a" } });
  return moveToHand(game, P1, ...codes);
}
/** The legal play of `id` as `legalActions` lists it, with the areas it may also go to. */
function playOf(state: GameState, id: InstanceId) {
  const listed = legalActions(state, P1, DEPS);
  if (listed.kind !== "turn") throw new Error(listed.kind);
  const entry = listed.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id);
  const refusal = listed.illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id);
  return { entry, refusal };
}
const toMission = (command: Command): Command => (command.type === "playCard" ? { ...command, into: INTO } : command);
const run = (state: GameState, command: Command) => driveEventsPicking(DEPS, state, firstLegal, command);

describe("the mission area with real allies (§3.34)", () => {
  it("the Mission Rules card's rules are the scenario's: a destination rule, a blank and the defeat shield", () => {
    expect(MISSION_RULES.map((rule) => rule.kind)).toEqual([
      "playDestination",
      "blankTextBox",
      "notDefeatedWithoutThreat",
    ]);
  });

  it("test 1: X-23 (cost 3) may be played to her player's area or to the mission; at the mission she is in play, paid for in full and under nobody's control", () => {
    const { state, ids } = table(X23);
    const x23 = ids[0]!;
    const { entry } = playOf(state, x23);
    expect(entry?.destinations).toEqual([MISSION_AREA]);
    const played = run(state, toMission(entry!.example));
    expect(locateCard(played.state, x23)).toEqual({ kind: "scenarioPlayArea", name: MISSION_AREA });
    expect(atTheMission(played.state)).toContain(x23);
    expect(controllerOf(played.state, x23)).toBeNull();
    expect(inst(played.state, x23).ownerId).toBe(P1);
    // Paid for in full: three resources.
    expect(played.events.find((e) => e.type === "cardPlayed" && e.instanceId === x23)).toMatchObject({
      resourcesPaid: 3,
    });
    // Printed THW 1, ATK 3 and 3 hit points stay: they are not text box.
    expect(characterProfile(played.state, x23, DEPS)).toMatchObject({ thw: 1, atk: 3, maxHp: 3 });
    // The same card to the player's own area is the ordinary play.
    const own = run(state, entry!.example);
    expect(playerOf(own.state, P1).playArea).toContain(x23);
    expect(controllerOf(own.state, x23)).toBe(P1);
  });

  it("test 2: Marrow's 'Play only if you have the [X-FORCE] or [X-MEN] trait' is checked before the destination matters: Spider-Man cannot play her to either", () => {
    const { state, ids } = table(MARROW);
    const marrow = ids[0]!;
    const { entry, refusal } = playOf(state, marrow);
    expect(entry).toBeUndefined();
    expect(refusal).toBeDefined();
    const example: Command = {
      type: "playCard",
      playerId: P1,
      cardInstanceId: marrow,
      payment: playerOf(state, P1)
        .hand.filter((id) => id !== marrow)
        .slice(0, 2)
        .map((fromHand) => ({ fromHand })),
      attachToInstanceId: null,
    };
    const own = sessionApply(startSession(state), example, DEPS);
    const there = sessionApply(startSession(state), toMission(example), DEPS);
    expect(own.ok).toBe(false);
    expect(there.ok).toBe(false);
    if (!own.ok && !there.ok) expect(there.error.code).toBe(own.error.code);
  });

  it("§3.55 test 4: Goldballs at the mission has no Interrupt (his text box is blank) and keeps his ATK 1", () => {
    const { state, ids } = table(GOLDBALLS);
    const goldballs = ids[0]!;
    // In hand his text is his own.
    expect(AOA_ASPECT_BASIC["45041.goldballs-interrupt"]).toBeDefined();
    const played = run(state, toMission(playOf(state, goldballs).entry!.example));
    expect(atTheMission(played.state)).toContain(goldballs);
    expect(activeAbilityRefs(played.state, goldballs, DEPS)).toEqual([]);
    expect(characterProfile(played.state, goldballs, DEPS)?.atk).toBe(1);
  });

  it("§3.34 test 5: Colossus (toughness) played to the mission gets no tough status card; in his player's area he gets one", () => {
    const { state, ids } = table(COLOSSUS);
    const colossus = ids[0]!;
    const example = playOf(state, colossus).entry!.example;
    expect(inst(run(state, toMission(example)).state, colossus).statuses.tough).toBe(0);
    expect(inst(run(state, example).state, colossus).statuses.tough).toBe(1);
  });

  it("Q32 = A: Colossus's Interrupt plays him into an attack, so that play goes to his player's own area with the mission in play, and he defends", () => {
    const { state, ids } = table(COLOSSUS);
    const colossus = ids[0]!;
    const offered: string[] = [];
    const attacked = driveEventsPicking(
      DEPS,
      withForm(state, { heroForm: 0 }),
      (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind === "chooseTriggers") {
          const own = choice.options.find((o) => o.optionId.endsWith(COLOSSUS_REF));
          if (own) {
            offered.push(own.optionId);
            return [own.optionId];
          }
        }
        if (choice.prompt.kind === "spendResources") return choice.options.slice(0, 3).map((o) => o.optionId);
        return firstLegal(s);
      },
      endTurn(P1),
    );
    expect(offered.length).toBeGreaterThanOrEqual(1);
    expect(playerOf(attacked.state, P1).playArea).toContain(colossus);
    expect(atTheMission(attacked.state)).not.toContain(colossus);
    expect(controllerOf(attacked.state, colossus)).toBe(P1);
    // No destination was asked for: the only choices were the trigger, the payment and the game's own.
    const asked = attacked.events.flatMap((e) => (e.type === "choiceRequested" ? [e.choice.prompt.kind] : []));
    expect(asked).not.toContain("chooseDestination");
    expect(cardsInPlay(attacked.state)).toContain(instancesOf(attacked.state, "45182a")[0]);
  });
});
