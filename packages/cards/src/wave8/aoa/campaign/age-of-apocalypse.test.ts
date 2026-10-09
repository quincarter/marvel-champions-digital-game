import { AOA_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  cannotTakeDamage,
  cardsInPlay,
  hasKeyword,
  locateCard,
  maxHitPoints,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  stackEncounterDeck,
  type Picker,
} from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { AGE_OF_APOCALYPSE, AGE_OF_APOCALYPSE_SKIPPED } from "./age-of-apocalypse.js";
import { MISSION_AREA } from "./mission-rules.js";
import { atTheMission, CAMPAIGN_DEPS, campaignGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Agent of Apocalypse (45164) and Worldwide Crisis (45165), docs/phase7-wave8.md §3.33 test 3 and §3.41 tests 2 to 5.
 * One player (Spider-Man) against Rhino, with Evacuate Survivors (45167a, 5 threat per player) and Sugar Man (45182a,
 * 5 hit points per player) put into the mission area by the campaign's setup instruction (`campaignGame`'s `mission`).
 * The cards are stacked on the encounter deck (the villain's boost card first, then the card dealt) and revealed by a
 * real `endTurn`.
 */
const AGENT = "45164";
const CRISIS = "45165";
const MISSION = "45167a";
const SUGAR_MAN = "45182a";
/** Core boost card with 1 icon and no boost ability. */
const FILLER = "01188";
/** Advance (Core): the villain schemes. The card a surge deals next, so the surge count is the card's own. */
const AFTER = "01186";
const CODES = [AGENT, CRISIS];
const refs = AOA_CARDS.filter((c) => CODES.includes(c.id as string)).flatMap((c) => abilityRefIds(c));

const types = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Answers a "choose one" by the option whose label matches, and everything else with the first legal answer. */
const choosing =
  (label: RegExp): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const wanted = choice?.options.find((o) => label.test(o.label));
    return wanted ? [wanted.optionId] : firstLegal(state);
  };
const labelsOffered = (events: readonly GameEvent[]): string[] =>
  types(events, "choiceRequested").flatMap((e) => e.choice.options.map((o) => o.label));

/** The boost cards dealt to `enemy` for its first attack (a later card may make it activate again). */
const boostCardsOfFirstAttack = (events: readonly GameEvent[], enemy: InstanceId): number => {
  const resolved = events.findIndex((e) => e.type === "attackResolved" && e.enemyInstanceId === enemy);
  return types(events.slice(0, resolved), "boostCardDealt").filter((e) => e.enemyInstanceId === enemy).length;
};

function table(opts: { mission?: boolean; encounter: readonly string[] }): GameState {
  return campaignGame({
    encounter: [...opts.encounter, FILLER, FILLER, AFTER],
    ...(opts.mission === false ? {} : { mission: { mission: MISSION, overseer: SUGAR_MAN } }),
  });
}
const mission = (state: GameState): InstanceId => instancesOf(state, MISSION)[0]!;
const sugarMan = (state: GameState): InstanceId => instancesOf(state, SUGAR_MAN)[0]!;
/** A villain phase in which Rhino's boost card is `boostCard` and the player is dealt `dealt`. */
const reveal = (state: GameState, boostCard: string, dealt: string, pick: Picker, form: "hero" | "alterEgo") =>
  driveEventsPicking(
    CAMPAIGN_DEPS,
    withForm(stackEncounterDeck(state, boostCard, dealt, AFTER), form === "hero" ? { heroForm: 0 } : "alterEgo"),
    pick,
    endTurn(P1),
  );

describe("Age of Apocalypse (45164, 45165)", () => {
  it("registers all four refs, each a valid definition, and skips none", () => {
    expect(Object.keys(AGE_OF_APOCALYPSE).sort()).toEqual([...refs].sort());
    expect([...refs].sort()).toEqual(["45164.boost", "45164.when-revealed", "45165.boost", "45165.when-revealed"]);
    expect(refs).toHaveLength(4);
    expect(AGE_OF_APOCALYPSE_SKIPPED).toEqual({});
    for (const [id, definition] of Object.entries(AGE_OF_APOCALYPSE)) {
      expect(validateDefinition(definition), id).toEqual([]);
    }
  });

  it("the table: the mission is in the mission area at 5 threat, Sugar Man there at 5 hit points and engaged with nobody", () => {
    const state = table({ encounter: [] });
    expect(state.scenarioPlayAreas?.[MISSION_AREA]?.closed).toBe(true);
    expect(atTheMission(state)).toEqual([mission(state), sugarMan(state)]);
    expect(inst(state, mission(state)).threat).toBe(5);
    expect(maxHitPoints(state, sugarMan(state), CAMPAIGN_DEPS)).toBe(5);
    expect(inst(state, sugarMan(state))).toMatchObject({ engagedWith: null, controllerId: null, damage: 0 });
  });
});

describe("Worldwide Crisis (45165)", () => {
  it("offers its choice (the test that was pinned red until the mission area landed)", () => {
    const run = reveal(table({ encounter: [CRISIS] }), FILLER, CRISIS, firstLegal, "alterEgo");
    expect(labelsOffered(run.events)).toEqual(
      expect.arrayContaining([
        "Place 3 threat on the [MISSION] side scheme",
        "Take 1 damage and this card gains surge",
      ]),
    );
  });

  it("first option: 3 threat on the [MISSION] side scheme (5 to 8), no damage, no surge", () => {
    const start = table({ encounter: [CRISIS] });
    const hero = identityOf(start, P1);
    const run = reveal(start, FILLER, CRISIS, choosing(/^Place 3 threat/), "alterEgo");
    expect(inst(run.state, mission(run.state)).threat).toBe(8);
    expect(inst(run.state, hero).damage).toBe(inst(start, hero).damage);
    expect(types(run.events, "surgeTriggered")).toHaveLength(0);
  });

  it("second option: 1 damage to the player's identity, then one more encounter card for them; the mission keeps its 5", () => {
    const start = table({ encounter: [CRISIS] });
    const hero = identityOf(start, P1);
    const run = reveal(start, FILLER, CRISIS, choosing(/^Take 1 damage/), "alterEgo");
    expect(inst(run.state, hero).damage).toBe(inst(start, hero).damage + 1);
    expect(types(run.events, "surgeTriggered")).toHaveLength(1);
    expect(inst(run.state, mission(run.state)).threat).toBe(5);
  });

  it("with no [MISSION] side scheme in play only the second option is offered", () => {
    const run = reveal(table({ mission: false, encounter: [CRISIS] }), FILLER, CRISIS, firstLegal, "alterEgo");
    const labels = labelsOffered(run.events);
    expect(labels).not.toContain("Place 3 threat on the [MISSION] side scheme");
    expect(types(run.events, "surgeTriggered")).toHaveLength(1);
  });

  it("as a boost card: 1 threat on the [MISSION] side scheme and one more boost card for the activating enemy", () => {
    const start = table({ encounter: [CRISIS] });
    const run = reveal(start, CRISIS, FILLER, firstLegal, "hero");
    expect(inst(run.state, mission(run.state)).threat).toBe(6);
    expect(boostCardsOfFirstAttack(run.events, start.villains[0]!.instanceId)).toBe(2);
  });
});

describe("Agent of Apocalypse (45164)", () => {
  it("§3.41 test 2: added to the mission area: 3 hit points, engaged with nobody, no activation; the Overseer takes no damage while it stands", () => {
    const start = table({ encounter: [AGENT] });
    const run = reveal(start, FILLER, AGENT, choosing(/^Add Agent of Apocalypse/), "hero");
    const agent = instancesOf(run.state, AGENT).find((id) => cardsInPlay(run.state).includes(id))!;
    expect(locateCard(run.state, agent)).toEqual({ kind: "scenarioPlayArea", name: MISSION_AREA });
    expect(atTheMission(run.state)).toEqual([mission(run.state), sugarMan(run.state), agent]);
    expect(inst(run.state, agent)).toMatchObject({ engagedWith: null, controllerId: null });
    expect(maxHitPoints(run.state, agent, CAMPAIGN_DEPS)).toBe(3);
    expect(types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === agent)).toHaveLength(0);
    expect(types(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === agent)).toHaveLength(0);
    // Its guard is printed, and guards nobody from the mission: the player may still attack the villain.
    expect(hasKeyword(run.state, agent, "guard", CAMPAIGN_DEPS)).toBe(true);
    const hero = identityOf(run.state, P1);
    const rhino = run.state.villains[0]!.instanceId;
    const before = inst(run.state, rhino).damage;
    const attacked = driveEventsPicking(
      CAMPAIGN_DEPS,
      patchInstance(run.state, hero, { exhausted: false }),
      firstLegal,
      {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: hero,
        targetInstanceId: rhino,
      },
    );
    expect(inst(attacked.state, rhino).damage).toBeGreaterThan(before);
    // "Cannot take damage while another minion is at the mission": Sugar Man is shielded, the Agent is not.
    expect(cannotTakeDamage(run.state, CAMPAIGN_DEPS, sugarMan(run.state), [null])).toBe(true);
    expect(cannotTakeDamage(run.state, CAMPAIGN_DEPS, agent, [null])).toBe(false);
  });

  it("§3.41 test 3: 'activates against you' in hero form: engaged with the player, attacks for 2", () => {
    const start = table({ encounter: [AGENT] });
    const run = reveal(start, FILLER, AGENT, choosing(/activates against you$/), "hero");
    const agent = instancesOf(run.state, AGENT).find((id) => cardsInPlay(run.state).includes(id))!;
    expect(inst(run.state, agent).engagedWith).toBe(P1);
    expect(types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === agent)).toMatchObject([
      { baseAtk: 2 },
    ]);
    expect(atTheMission(run.state)).not.toContain(agent);
  });

  it("with no [MISSION] side scheme in play only the activation can be chosen", () => {
    const run = reveal(table({ mission: false, encounter: [AGENT] }), FILLER, AGENT, firstLegal, "hero");
    expect(labelsOffered(run.events)).not.toContain("Add Agent of Apocalypse to the mission area");
    const agent = instancesOf(run.state, AGENT).find((id) => cardsInPlay(run.state).includes(id))!;
    expect(inst(run.state, agent).engagedWith).toBe(P1);
    expect(types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === agent)).toHaveLength(1);
  });

  it("as a boost card with no ally at the mission: nothing is damaged, and the activating enemy still gets one more boost card", () => {
    const start = table({ encounter: [AGENT] });
    const run = reveal(start, AGENT, FILLER, firstLegal, "hero");
    expect(boostCardsOfFirstAttack(run.events, start.villains[0]!.instanceId)).toBe(2);
    expect(run.state.encounterDecks[activeEncounterDeckId(run.state)]!.discard).toContain(
      instancesOf(run.state, AGENT)[0],
    );
  });
});
