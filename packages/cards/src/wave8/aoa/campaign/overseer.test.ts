import { AOA_CARDS } from "@mc/content";
import { cannotTakeDamage, cardsInPlay, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { endTurn, firstLegal, inst, instancesOf, P1, stackEncounterDeck } from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import { OVERSEER, OVERSEER_SKIPPED } from "./overseer.js";
import { atTheMission, CAMPAIGN_DEPS, campaignGame } from "./testing.js";

vi.setConfig({ testTimeout: 120_000 });

const CODES = ["45179a", "45180a", "45181a", "45182a", "45183a"];
const AGENT = "45164";
const FILLER = "01188";
const refsOf = (codes: readonly string[]): string[] =>
  AOA_CARDS.filter((c) => codes.includes(c.id as string)).flatMap((c) => abilityRefIds(c));
const SHIELDS = [
  "45179a.mister-sinister-constant",
  "45180a.the-shadow-king-constant",
  "45181a.abyss-constant",
  "45182a.sugar-man-constant",
  "45183a.mikhail-rasputin-constant",
];

describe("Overseer (45179a to 45183a)", () => {
  it("registers the five 'cannot take damage' constants and skips the pairing limit and the four Mission Responses", () => {
    expect(Object.keys(OVERSEER).sort()).toEqual([...SHIELDS].sort());
    expect([...Object.keys(OVERSEER), ...Object.keys(OVERSEER_SKIPPED)].sort()).toEqual(refsOf(CODES).sort());
    expect(refsOf(CODES)).toHaveLength(10);
    for (const [id, reason] of Object.entries(OVERSEER_SKIPPED)) expect(reason, id).toMatch(/task/);
    // The tasks that have landed are no longer named as missing.
    for (const reason of Object.values(OVERSEER_SKIPPED)) expect(reason).not.toMatch(/tasks? 3[123]\b/);
    for (const [id, definition] of Object.entries(OVERSEER)) expect(validateDefinition(definition), id).toEqual([]);
  });

  it("names the mission on every face (the printed lines the scripts stand for)", () => {
    for (const code of CODES) {
      const card = AOA_CARDS.find((c) => c.id === code) as { text: { current: string } };
      expect(card.text.current, code).toContain("another minion is at the mission");
    }
  });

  it("the four Mission Responses are in the data as forced responses (the parser's reading, spec 1.25)", () => {
    const responses = refsOf(CODES).filter((id) => id.endsWith("forced-response"));
    expect(responses.sort()).toEqual([
      "45180a.the-shadow-king-forced-response",
      "45181a.abyss-forced-response",
      "45182a.sugar-man-forced-response",
      "45183a.mikhail-rasputin-forced-response",
    ]);
  });

  const overseerOf = (state: GameState, code: string): InstanceId => instancesOf(state, code)[0]!;

  it.each(CODES)(
    "%s §3.41 test 1: in the mission area at 5 hit points per player, engaged with nobody, and it does not activate in a villain phase",
    (code) => {
      const start = campaignGame({ encounter: [FILLER, FILLER], mission: { mission: "45167a", overseer: code } });
      const overseer = overseerOf(start, code);
      expect(atTheMission(start)).toContain(overseer);
      expect(inst(start, overseer)).toMatchObject({ engagedWith: null, controllerId: null });
      // Alone at the mission it can take damage.
      expect(cannotTakeDamage(start, CAMPAIGN_DEPS, overseer, [null])).toBe(false);
      const run = driveEventsPicking(
        CAMPAIGN_DEPS,
        withForm(stackEncounterDeck(start, FILLER, FILLER), { heroForm: 0 }),
        firstLegal,
        endTurn(P1),
      );
      const acted = run.events.filter(
        (e) => (e.type === "attackResolved" || e.type === "schemeResolved") && e.enemyInstanceId === overseer,
      );
      expect(acted).toHaveLength(0);
      expect(cardsInPlay(run.state)).toContain(overseer);
    },
  );

  it("'Cannot take damage while another minion is at the mission': true once an Agent of Apocalypse is added, false again when it is gone", () => {
    const start = campaignGame({ encounter: [AGENT, FILLER], mission: { mission: "45167a", overseer: "45182a" } });
    const overseer = overseerOf(start, "45182a");
    const run = driveEventsPicking(
      CAMPAIGN_DEPS,
      withForm(stackEncounterDeck(start, FILLER, AGENT), { heroForm: 0 }),
      (state) => {
        const add = state.pendingChoice?.options.find((o) => o.label.startsWith("Add Agent of Apocalypse"));
        return add ? [add.optionId] : firstLegal(state);
      },
      endTurn(P1),
    );
    const agent = instancesOf(run.state, AGENT).find((id) => atTheMission(run.state).includes(id))!;
    expect(agent).toBeDefined();
    expect(cannotTakeDamage(run.state, CAMPAIGN_DEPS, overseer, [null])).toBe(true);
    // The Agent itself is not shielded: the rule is each Overseer's own.
    expect(cannotTakeDamage(run.state, CAMPAIGN_DEPS, agent, [null])).toBe(false);
    const gone: GameState = {
      ...run.state,
      scenarioPlayAreas: {
        ...run.state.scenarioPlayAreas,
        mission: { closed: true, cards: atTheMission(run.state).filter((id) => id !== agent) },
      },
    };
    expect(cannotTakeDamage(gone, CAMPAIGN_DEPS, overseer, [null])).toBe(false);
  });
});
