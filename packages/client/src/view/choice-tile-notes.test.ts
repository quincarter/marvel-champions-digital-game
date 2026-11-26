import { cardsInPlay, type GameState, type InstanceId, type PendingChoice } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import {
  choiceNoteOf,
  engagedNoteForms,
  optionCounterNotesOf,
  optionEngagedNamesOf,
  tileCounterNote,
} from "./choice-tile-notes.js";
import { playerName } from "./names.js";

const game = {
  instances: {
    a: { instanceId: "a", cardId: "27044", counters: { backup: 3 }, zone: { kind: "playArea", playerId: "p1" } },
    b: { instanceId: "b", cardId: "27044", counters: { backup: 1 }, zone: { kind: "playArea", playerId: "p1" } },
  },
} as unknown as GameState;

const option = (id: string) => ({
  optionId: id,
  label: "Field Agent",
  ref: { kind: "ability", instanceId: id as InstanceId, abilityId: "27044.field-agent-interrupt" },
});

describe("two copies of a Uses card (issue #571)", () => {
  test("a tile fits the short form of the note", () => {
    expect(tileCounterNote("1 backup counter")).toBe("1 backup");
    expect(tileCounterNote("2 backup counters")).toBe("2 backup");
  });

  test("a divided or ordered prompt has no notes", () => {
    const choice = { prompt: { kind: "divide" }, options: [option("a"), option("b")] } as unknown as PendingChoice;
    expect(optionCounterNotesOf(game, choice).size).toBe(0);
  });
});

describe("a card choice's note (#525 item 11)", () => {
  const withPrompt = (prompt: object) => ({ prompt, options: [option("a")] }) as unknown as PendingChoice;

  test("the note a chooseCards prompt carries is shown", () => {
    const note = "A tucked card is out of play: its text stops working, and it is discarded when Spectrum leaves play.";
    expect(choiceNoteOf(withPrompt({ kind: "chooseCards", slot: "tuck", note }))).toBe(note);
  });

  test("no note, an empty note or another prompt kind has no note line", () => {
    expect(choiceNoteOf(withPrompt({ kind: "chooseCards", slot: "tuck" }))).toBeNull();
    expect(choiceNoteOf(withPrompt({ kind: "chooseCards", slot: "tuck", note: "  " }))).toBeNull();
    expect(choiceNoteOf(withPrompt({ kind: "chooseTarget", note: "x" }))).toBeNull();
  });
});

describe("who a minion option is engaged with (issue #1001)", () => {
  /** Ultron's setup deals each seat a facedown Drone: the same card back twice. */
  async function ultronGame(seats: readonly string[]): Promise<GameState> {
    const store = new SessionStore(new LocalEngineHost());
    await store.start({
      scenarioId: "ultron",
      difficulty: "standard",
      players: seats.map((starterDeckId) => ({ starterDeckId })),
      seed: 1,
    });
    for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
      const { choice } = store.state.legal.actions as {
        choice: { options: readonly { optionId: string }[]; minSelections: number };
      };
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((pick) => pick.optionId));
    }
    return store.state.game!;
  }

  const dronesOf = (state: GameState): readonly InstanceId[] =>
    cardsInPlay(state).filter((id) => state.instances[id]?.facedownAs?.kind === "minion");

  const damageChoice = (state: GameState, targets: readonly InstanceId[]): PendingChoice =>
    ({
      playerId: state.players[0]!.playerId,
      prompt: { kind: "chooseTarget" },
      options: [
        { optionId: "villain", label: "Ultron", ref: { kind: "card", instanceId: state.villains[0]!.instanceId } },
        ...targets.map((id, index) => ({
          optionId: `drone${index}`,
          label: "Drone",
          ref: { kind: "card", instanceId: id },
        })),
      ],
    }) as unknown as PendingChoice;

  test("two seats: each Drone says its seat, the villain says nothing", async () => {
    const state = await ultronGame(["core-spider-man-justice", "core-she-hulk-aggression"]);
    const drones = dronesOf(state);
    expect(drones).toHaveLength(2);
    const names = optionEngagedNamesOf(state, damageChoice(state, drones));
    expect(names.has("villain")).toBe(false);
    drones.forEach((id, index) => {
      expect(names.get(`drone${index}`)).toBe(playerName(state, state.instances[id]!.engagedWith!));
    });
    expect(new Set(names.values()).size).toBe(2);
  }, 60_000);

  test("one seat: every minion is engaged with the one hero, so no note", async () => {
    const state = await ultronGame(["core-spider-man-justice"]);
    expect(dronesOf(state).length).toBeGreaterThan(0);
    expect(optionEngagedNamesOf(state, damageChoice(state, dronesOf(state))).size).toBe(0);
  }, 60_000);

  test("worded as the board chip", () => {
    expect(engagedNoteForms("Spider-Man (Peter Parker)")).toEqual([
      "vs Spider-Man (Peter Parker)",
      "vs Spider-Man",
      "vs S.-Man",
    ]);
    expect(engagedNoteForms("Captain Marvel")).toEqual(["vs Captain Marvel", "vs C. Marvel"]);
    expect(engagedNoteForms("Hulk")).toEqual(["vs Hulk"]);
    expect(engagedNoteForms("Spider-Man (Peter Parker) 2")).toEqual([
      "vs Spider-Man (Peter Parker) 2",
      "vs Spider-Man 2",
      "vs S.-M. 2",
    ]);
    expect(engagedNoteForms(undefined)).toEqual([]);
  });

  test("a shorter form two seats would share is never offered (Codex, PR #1014)", () => {
    const names = ["Spider-Man (Peter Parker)", "Spider-Man (Miles Morales)", "Iron Man"];
    expect(engagedNoteForms("Spider-Man (Peter Parker)", names)).toEqual(["vs Spider-Man (Peter Parker)"]);
    expect(engagedNoteForms("Spider-Man (Miles Morales)", names)).toEqual(["vs Spider-Man (Miles Morales)"]);
    expect(engagedNoteForms("Iron Man", names)).toEqual(["vs Iron Man"]);
    // The same seat's name twice (two minions engaged with one hero) is not another seat.
    expect(engagedNoteForms("Spider-Man (Peter Parker)", ["Spider-Man (Peter Parker)", "Iron Man"])).toEqual([
      "vs Spider-Man (Peter Parker)",
      "vs Spider-Man",
      "vs S.-Man",
    ]);
  });
});
