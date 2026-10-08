import { AOA_CARDS } from "@mc/content";
import { activeEncounterDeckId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { driveEvents } from "../../../testing/staging.js";
import { endTurn, instancesOf, P1, stackEncounterDeck } from "../../../testing/harness.js";
import { AGE_OF_APOCALYPSE, AGE_OF_APOCALYPSE_SKIPPED } from "./age-of-apocalypse.js";
import { CAMPAIGN_DEPS, campaignGame } from "./testing.js";

const CODES = ["45164", "45165"];
const FILLER = "01186";
const refs = AOA_CARDS.filter((c) => CODES.includes(c.id as string)).flatMap((c) => abilityRefIds(c));

/** Worldwide Crisis dealt to the player in the villain phase, behind a filler that absorbs the villain's boost draw. */
function revealWorldwideCrisis() {
  const game = campaignGame({ encounter: ["45165", FILLER] });
  const staged = stackEncounterDeck(game, FILLER, "45165");
  return driveEvents(CAMPAIGN_DEPS, staged, endTurn(P1));
}

describe("Age of Apocalypse (45164, 45165): every ref waits on the mission area", () => {
  it("registers nothing: all four refs are skipped, each with a reason naming its queue task", () => {
    expect(Object.keys(AGE_OF_APOCALYPSE)).toEqual([]);
    expect(Object.keys(AGE_OF_APOCALYPSE_SKIPPED).sort()).toEqual([...refs].sort());
    expect(refs).toHaveLength(4);
    for (const [id, reason] of Object.entries(AGE_OF_APOCALYPSE_SKIPPED)) expect(reason, id).toMatch(/task/);
  });

  it("today (companion): a revealed Worldwide Crisis is inert, so it offers no choice after it is revealed", () => {
    const { state, events } = revealWorldwideCrisis();
    const revealed = events.findIndex((e) => e.type === "encounterCardRevealed");
    expect(revealed).toBeGreaterThan(-1);
    expect(events.slice(revealed).some((e) => e.type === "choiceRequested")).toBe(false);
    expect(state.encounterDecks[activeEncounterDeckId(state)]!.discard).toContain(instancesOf(state, "45165")[0]);
  });

  it.fails("task 31/32: a revealed Worldwide Crisis offers the choice (3 threat on the mission, or damage and surge)", () => {
    const { events } = revealWorldwideCrisis();
    const revealed = events.findIndex((e) => e.type === "encounterCardRevealed");
    expect(events.slice(revealed).some((e) => e.type === "choiceRequested")).toBe(true);
  });
});
