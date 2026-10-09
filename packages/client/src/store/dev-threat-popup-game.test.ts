import { cardsInPlay } from "@mc/engine";
import { expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import {
  BREAKIN_AND_TAKIN,
  CROWD_CONTROL,
  DAREDEVIL,
  HYDRA_BOMBER,
  SURVEILLANCE_TEAM,
  startEnemyPopupGame,
  startThreatPopupGame,
} from "./dev-threat-popup-game.js";
import { codeOf } from "./dev-game-steps.js";
import { SessionStore } from "./session-store.js";

test("the threat popup dev game stops with Surveillance Team out and two side schemes holding different threat", async () => {
  const store = new SessionStore(new LocalEngineHost());
  await startThreatPopupGame(store);
  expect(store.state.error).toBeNull();
  const game = store.state.game!;
  const threat = (code: string): number | null => {
    const id = cardsInPlay(game).find((i) => codeOf(game, i) === code);
    return id ? game.instances[id]!.threat : null;
  };
  expect(cardsInPlay(game).some((id) => codeOf(game, id) === SURVEILLANCE_TEAM)).toBe(true);
  expect(threat(CROWD_CONTROL)).toBe(1);
  expect(threat(BREAKIN_AND_TAKIN)).toBeGreaterThan(1);
}, 60_000);

test("the enemy popup dev game stops with Daredevil ready and a Hydra Bomber beside Rhino", async () => {
  const store = new SessionStore(new LocalEngineHost());
  await startEnemyPopupGame(store);
  expect(store.state.error).toBeNull();
  const game = store.state.game!;
  const inPlay = cardsInPlay(game).map((id) => codeOf(game, id));
  expect(inPlay).toContain(DAREDEVIL);
  expect(inPlay).toContain(HYDRA_BOMBER);
}, 60_000);
