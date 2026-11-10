/**
 * Issue #665: Cable played Psychic Misdirection on Rhino's attack, choosing a Hydra Mercenary, then also defended with
 * Cable at the Declare Defender step, and the Mercenary took 0 (ATK 2 + 1 boost − 6 DEF). The engine was right: a
 * basic defense still takes DEF off the attack's damage in step 4, and Misdirection deals what is left to the chosen
 * enemy (RRG 1.8 "Attack (Enemy Activation)", p. 8; "Defend, Defense", p. 15: a defense-labeled ability is not a
 * basic defense, and the hero "can still be declared the defender ... during the 'Declare Defender' step"). The defend
 * sheet read as if Cable would take the hit, so defending looked like it protected him. This replays the reporter's
 * game to that prompt and checks the sheet says where the damage goes.
 */
import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { applyCommands, defendPreview, type Command, type GameState, type PlayerId } from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { defendChoiceViewOf, redirectNoteOf } from "./defend-choice.js";

const replay = JSON.parse(readFileSync(new URL("./fixtures/issue-665-replay.json", import.meta.url), "utf8")) as {
  readonly config: Parameters<EngineSessionCore["start"]>[0];
  readonly commands: readonly { readonly command: Command }[];
};

const P1 = "p1" as PlayerId;

/** The reporter's game at the Declare Defender prompt, after Psychic Misdirection chose the Hydra Mercenary. */
async function atDefendPrompt(): Promise<GameState> {
  const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
  await core.start(replay.config);
  let state = core.save().initialState;
  for (const { command } of replay.commands.slice(0, -1)) {
    const result = applyCommands(state, [command], POOL_DEPS);
    if (!result.ok) throw new Error(result.error.message);
    state = result.state;
  }
  return state;
}

describe("issue #665: the defend sheet after Psychic Misdirection", () => {
  test("the preview deals the damage to the chosen enemy, with Cable's DEF taken off it when he defends", async () => {
    const state = await atDefendPrompt();
    expect(state.pendingChoice?.prompt.kind).toBe("declareDefender");
    const previews = defendPreview(state, POOL_DEPS)!;
    const decline = previews.find((p) => p.defenderInstanceId === null)!;
    const cable = previews.find((p) => p.defenderInstanceId === "i3")!;
    expect(decline.damagedInstanceId).toBe("i65");
    expect(cable.damagedInstanceId).toBe("i65");
    expect(cable.targetInstanceId).toBe("i3");
    // DEF 6 against ATK 2 and at most a few boost icons: nothing reaches the Mercenary when Cable defends.
    expect(cable.defenseReduction).toBe(6);
    expect(cable.bands.every((band) => band.damageTaken === 0)).toBe(true);
    expect(decline.bands.some((band) => band.damageTaken > 0)).toBe(true);
  });

  test("the sheet names the Mercenary as the one taking the damage, and Cable's health does not move", async () => {
    const state = await atDefendPrompt();
    const view = defendChoiceViewOf(state, state.pendingChoice!, POOL_DEPS, P1, [])!;
    expect(view.summary.forcedNotes).toContain("This attack's damage goes to Hydra Mercenary instead of you.");
    const decline = view.options.find((o) => o.kind === "decline")!;
    const cable = view.options.find((o) => o.kind === "defender")!;
    expect(decline.hpLine).toMatch(/^To Hydra Mercenary: Now \d+ of \d+ HP/);
    expect(cable.consequences[0]).toBe("DEF 6 comes off the damage Hydra Mercenary takes.");
    expect(cable.hpAfterRange?.low).toBe(cable.hpNow?.current);
    expect(decline.hpAfterRange?.low).toBe(decline.hpNow?.current);
  });
});

describe("redirectNoteOf", () => {
  test("says nobody takes the damage once the chosen enemy has left play", () => {
    expect(redirectNoteOf("Hydra Mercenary", "you")).toBe(
      "This attack's damage goes to Hydra Mercenary instead of you.",
    );
    expect(redirectNoteOf("Hydra Mercenary", "you", false)).toBe(
      "This attack's damage was sent to Hydra Mercenary, which has left play: nobody takes it.",
    );
  });
});
