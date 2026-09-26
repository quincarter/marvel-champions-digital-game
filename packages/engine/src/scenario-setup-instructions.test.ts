/**
 * `GameSetupConfig.scenarioSetupInstructions`: setup text a scenario's rulebook prints rather than a card, which the
 * scenario builder includes when the players chose it. The first user is MC21 p. 11's "Modular Difficulty" for Tower
 * Defense ("they may place damage on Avengers Tower during setup"; docs/phase7-wave4.md §4 Q4), so the fixture
 * mirrors it: a main scheme whose 1A Setup puts a set-aside environment into play, and an instruction that places
 * damage on that environment. The engine names neither.
 *
 * What is pinned: the instructions resolve after RRG 1.8 Appendix II step 12's Setup and When Revealed abilities
 * (so the card they touch is already in play) and before step 14's draw, in a standalone game and in a campaign game,
 * and a game without any is exactly the game it was.
 */
import { describe, expect, it } from "vitest";
import { cardId, flat, type CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { GameEvent } from "./events.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import type { GameState, GameStep, ScenarioSetupInstruction } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { syntheticCampaignInput } from "./testing/campaign.js";
import { runCommands } from "./testing/drive.js";
import { stubEnvironment, stubMainScheme } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, VILLAIN, seatIdentities } from "./testing/scenario.js";

const TOWER = stubEnvironment({ id: "syn-tower", name: "Syn Tower" });

/** 1A Setup: "Put the Syn Tower into play" — the way Tower Defense's Avengers Tower reaches play during step 12. */
const PUT_TOWER_INTO_PLAY = stubAbility("syn-scheme.setup", {
  trigger: { kind: "setup" },
  effects: [
    { kind: "selectCards", slot: "tower", cards: { kind: "encounterSetAside", filter: { name: TOWER.name } } },
    { kind: "putIntoPlay", card: { kind: "slot", slot: "tower" }, controller: { kind: "firstPlayer" } },
  ],
});
const SCHEME = stubMainScheme({
  id: "syn-scheme",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(99),
      acceleration: flat(0),
      aSideAbilities: [PUT_TOWER_INTO_PLAY.ref],
    },
  ],
});
const deps: EngineDeps = depsOf(PUT_TOWER_INTO_PLAY);

/** "Place 2[per_hero] damage on the Syn Tower." */
const PLACE_DAMAGE: ScenarioSetupInstruction = {
  id: "syn.setup-damage",
  text: "Place 2[per_hero] damage on the Syn Tower.",
  citation: "test",
  effects: [
    {
      kind: "placeDamage",
      target: { kind: "each", query: { categories: ["environment"], name: TOWER.name } },
      amount: { kind: "perPlayer", base: 0, perPlayer: 2 },
    },
  ],
};

function play(
  instructions: readonly ScenarioSetupInstruction[] | undefined,
  campaign = false,
): { readonly state: GameState; readonly events: readonly GameEvent[] } {
  const identities = seatIdentities(HERO, 2);
  const config: GameSetupConfig = {
    seed: 7,
    cards: [...DEFAULT_CARDS, SCHEME, TOWER, ...identities],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: SCHEME.id,
    encounterDeck: [],
    setAside: [TOWER.id],
    players: identities.map((identity) => ({ identityCardId: identity.id, deck: DEFAULT_DECK })),
    ...(instructions ? { scenarioSetupInstructions: instructions } : {}),
    ...(campaign
      ? {
          campaign: syntheticCampaignInput({
            seats: identities.map((identity, index) => ({
              seatNumber: index + 1,
              identityCardId: identity.id,
              deck: [] as CardId[],
              aspects: [],
              grantedCardIds: [],
            })),
          }),
        }
      : {}),
  };
  const created = createGame(config, deps);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const driven = runCommands(created.state, deps);
  return { state: driven.state, events: [...created.events, ...driven.events] };
}

const towerDamage = (state: GameState): number => {
  const id = Object.keys(state.instances).find((key) => state.instances[key]?.cardId === cardId(TOWER.id));
  return id === undefined ? -1 : (state.instances[id]?.damage ?? -1);
};

const describeStep = (step: GameStep): string => (step.kind === "campaignWindow" ? step.window : step.kind);
const stepsOf = (events: readonly GameEvent[]): readonly string[] =>
  events.flatMap((event) => (event.type === "stepChanged" ? [describeStep(event.to)] : []));

describe("scenario setup instructions (GameSetupConfig.scenarioSetupInstructions)", () => {
  it("resolve after step 12 has put the card into play, and before the draw", () => {
    const { state, events } = play([PLACE_DAMAGE]);
    expect(towerDamage(state)).toBe(4); // 2 per player, 2 players
    const towerId = Object.keys(state.instances).find((key) => state.instances[key]?.cardId === cardId(TOWER.id));
    const entered = events.findIndex((event) => event.type === "cardMoved" && event.instanceId === towerId);
    const resolved = events.findIndex((event) => event.type === "scenarioSetupInstructionResolved");
    const placed = events.findIndex((event) => event.type === "damagePlaced");
    const drawn = events.findIndex((event) => event.type === "cardDrawn");
    expect(entered).toBeGreaterThanOrEqual(0);
    expect(entered).toBeLessThan(resolved);
    expect(resolved).toBeLessThan(placed);
    if (drawn >= 0) expect(placed).toBeLessThan(drawn);
    expect(stepsOf(events).slice(0, 2)).toEqual(["scenarioSetupInstructions", "drawStartingHands"]);
    expect(events.find((event) => event.type === "scenarioSetupInstructionResolved")).toEqual({
      type: "scenarioSetupInstructionResolved",
      instructionId: PLACE_DAMAGE.id,
      text: PLACE_DAMAGE.text,
      citation: PLACE_DAMAGE.citation,
    });
  });

  it("are plain data carried into the state, so a save replays them", () => {
    const { state } = play([PLACE_DAMAGE]);
    expect(state.scenarioRules.setupInstructions).toEqual([PLACE_DAMAGE]);
    expect(JSON.parse(JSON.stringify(state.scenarioRules))).toEqual(state.scenarioRules);
  });

  it("leave a game without any exactly as it was: no field, no step, no event, no damage", () => {
    for (const none of [undefined, []]) {
      const { state, events } = play(none);
      expect(towerDamage(state)).toBe(0);
      expect("setupInstructions" in state.scenarioRules).toBe(false);
      expect(stepsOf(events)).not.toContain("scenarioSetupInstructions");
      expect(events.some((event) => event.type === "scenarioSetupInstructionResolved")).toBe(false);
    }
  });

  it("resolve in a campaign game too, between step 12 and the campaign's after-setup windows", () => {
    const { state, events } = play([PLACE_DAMAGE], true);
    expect(towerDamage(state)).toBe(4);
    const steps = stepsOf(events);
    expect(steps.slice(0, 3)).toEqual(["scenarioSetup", "scenarioSetupInstructions", "afterScenarioSetup"]);
  });
});
