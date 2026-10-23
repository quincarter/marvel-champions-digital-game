/**
 * Issue #365 (reported by @AlecHolland1582): The Red House (`trors` 04139) says "When a character thwarts this side
 * scheme, they may use their ATK instead of their THW", but the board only ever sent the engine's example thwart, so
 * the player was never asked and always thwarted with THW.
 */
import { applyCommand, cardsInPlay, type GameState, type InstanceId, type LegalAction } from "@mc/engine";
import { describe, expect, test } from "vitest";
import { POOL_DEPS } from "../content/pool.js";
import type { SessionConfig } from "../engine/host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { SessionStore } from "../store/session-store.js";
import { thwartStatOptions } from "./thwart-stat-choice.js";

const RED_SKULL: SessionConfig = {
  scenarioId: "red-skull",
  difficulty: "standard",
  players: [{ starterDeckId: "core-spider-man-justice" }],
  seed: 1,
};

async function firstTurn(): Promise<{ game: GameState; thwart: LegalAction }> {
  const store = new SessionStore(new LocalEngineHost());
  await store.start(RED_SKULL);
  const settle = async (): Promise<void> => {
    for (let step = 0; step < 20; step++) {
      const pending = store.state.legal;
      if (!pending || pending.actions.kind !== "choice") break;
      const { choice } = pending.actions;
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
    }
  };
  await settle();
  // Peter Parker flips to Spider-Man first: an alter-ego cannot thwart.
  const flip = store.state.legal?.actions.kind === "turn" ? store.state.legal.actions.legal : [];
  const changeForm = flip.find((entry) => entry.action.kind === "changeForm");
  if (changeForm) await store.dispatch(changeForm.example);
  await settle();
  const legal = store.state.legal?.actions;
  if (legal?.kind !== "turn") throw new Error("expected the hero's turn");
  const thwart = legal.legal.find((entry) => entry.action.kind === "basicThwart");
  if (!thwart) throw new Error("expected a basic thwart");
  return { game: store.state.game!, thwart };
}

const redHouseIn = (game: GameState): InstanceId => {
  const id = cardsInPlay(game).find((instance) => game.instances[instance]?.cardId === "04139");
  if (!id) throw new Error("The Red House is not in play");
  return id;
};

describe("thwartStatOptions (The Red House, issue #365)", () => {
  test("a thwart aimed at The Red House offers THW and ATK, and the ATK command removes ATK's worth of threat", async () => {
    const { game, thwart } = await firstTurn();
    const redHouse = redHouseIn(game);
    expect(thwart.targets).toContain(redHouse);

    const options = thwartStatOptions(game, POOL_DEPS, thwart, redHouse);
    expect(options.map((option) => option.useAtk)).toEqual([false, true]);
    expect(options[0]!.label).toMatch(/^THW \d+$/);
    expect(options[1]!.label).toMatch(/^ATK \d+$/);

    if (thwart.example.type !== "basicThwart") throw new Error("expected a basicThwart example");
    const before = game.instances[redHouse]!.threat;
    const atk = Number(options[1]!.label.replace("ATK ", ""));
    const result = applyCommand(game, { ...thwart.example, schemeInstanceId: redHouse, useAtk: true }, POOL_DEPS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.instances[redHouse]?.threat ?? 0).toBe(Math.max(0, before - atk));
  });

  test("the main scheme gives no choice", async () => {
    const { game, thwart } = await firstTurn();
    expect(thwartStatOptions(game, POOL_DEPS, thwart, game.mainScheme.instanceId)).toEqual([]);
  });
});
