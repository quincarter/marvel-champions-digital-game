import { describe, expect, test } from "vitest";
import { activeVillain, cardsInPlay, choiceId, type PendingChoice } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import { startEngagedTargetGame } from "../store/dev-engaged-target-game.js";
import { SessionStore } from "../store/session-store.js";
import { divideSheetOf, shownDivideChoice } from "./divide-sheet.js";
import { playerName } from "./names.js";

const store = new SessionStore(new LocalEngineHost());
await store.start({
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "cap-leadership" }],
  seed: 1,
});
const state = store.state.game!;
const scheme = state.mainScheme.instanceId;
const villain = activeVillain(state).instanceId;
const nameOf = (id: string): string => state.cardPool[state.instances[id]!.cardId]!.name;
const options = [`${scheme}#1`, `${scheme}#2`, `${scheme}#3`, `${villain}#1`, `${villain}#2`].map((optionId) => ({
  optionId,
  label: optionId,
  ref: { kind: "card", instanceId: optionId.slice(0, optionId.lastIndexOf("#")) },
}));
const choice = {
  choiceId: choiceId("c"),
  playerId: "p1",
  prompt: { kind: "divide", what: "threat", amount: 3 },
  minSelections: 3,
  maxSelections: 3,
  options,
  frameId: null,
  ordered: false,
  soleDecider: false,
  authority: "player",
} as unknown as PendingChoice;

describe("divideSheetOf", () => {
  test("labels every tile with its scheme, what it holds and its point number", () => {
    const sheet = divideSheetOf(state, choice, [])!;
    expect(sheet.labels.get(`${scheme}#2`)).toEqual({
      name: nameOf(scheme),
      engaged: null,
      holds: expect.stringContaining("Threat"),
      ordinal: 2,
    });
    expect(sheet.labels.get(`${villain}#1`)?.name).toBe(nameOf(villain));
    expect(sheet.tally).toBe("");
  });

  test("keeps a running tally per scheme", () => {
    expect(divideSheetOf(state, choice, [`${scheme}#1`, `${villain}#1`])!.tally).toBe(
      `${nameOf(scheme)} 1 · ${nameOf(villain)} 1 · 1 to place`,
    );
    expect(divideSheetOf(state, choice, [`${scheme}#1`, `${scheme}#2`, `${villain}#1`])!.tally).toBe(
      `${nameOf(scheme)} 2 · ${nameOf(villain)} 1 · all placed`,
    );
  });

  test("other prompts have no divide sheet", () => {
    expect(
      divideSheetOf(state, { ...choice, prompt: { kind: "chooseTarget", slot: "s", abilityId: null } }, []),
    ).toBeNull();
  });
});

describe("damage divided among minions engaged with different seats (issue #1001)", () => {
  test("each Drone's tile and its tally say who it is engaged with", async () => {
    const two = new SessionStore(new LocalEngineHost());
    await startEngagedTargetGame(two);
    const game = two.state.game!;
    const drones = cardsInPlay(game).filter((id) => game.instances[id]?.facedownAs?.kind === "minion");
    expect(drones).toHaveLength(2);
    const divide = {
      ...choice,
      prompt: { kind: "divide", what: "damage", amount: 2 },
      options: drones.map((id) => ({ optionId: `${id}#1`, label: id, ref: { kind: "card", instanceId: id } })),
    } as unknown as PendingChoice;
    const sheet = divideSheetOf(game, divide, [`${drones[0]}#1`])!;
    const seats = drones.map((id) => `vs ${playerName(game, game.instances[id]!.engagedWith!)}`);
    expect(drones.map((id) => sheet.labels.get(`${id}#1`)?.engaged)).toEqual(seats);
    expect(new Set(seats).size).toBe(2);
    expect(sheet.tally).toContain(`(${seats[0]}) 1`);
  }, 120_000);
});

describe("shownDivideChoice", () => {
  const indirect = (amount: number): PendingChoice =>
    ({ ...choice, prompt: { kind: "assignIndirectDamage", amount, caps: {} }, minSelections: amount }) as PendingChoice;

  test("indirect damage shows no more tiles per card than points to assign", () => {
    // Three tiles for the scheme, two for the villain: two points can fill at most two of a card's tiles.
    expect(shownDivideChoice(indirect(2)).options.map((option) => option.optionId)).toEqual([
      `${scheme}#1`,
      `${scheme}#2`,
      `${villain}#1`,
      `${villain}#2`,
    ]);
    expect(shownDivideChoice(indirect(3)).options).toHaveLength(5);
  });

  test("a divide of threat and any other prompt are left as the engine offered them", () => {
    expect(shownDivideChoice(choice)).toBe(choice);
  });
});
