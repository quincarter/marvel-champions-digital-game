import { describe, expect, test } from "vitest";
import { cardsInPlay } from "@mc/engine";
import { LocalEngineHost } from "../engine/local-host.js";
import {
  PEACEKEEPERS_CARD,
  STRENGTH_IN_NUMBERS_CARD,
  TEAM_STRIKE_CARD,
  startPeacekeepersDevGame,
  startStrengthInNumbersDevGame,
  startTeamStrikeDevGame,
} from "./dev-in-play-cost-games.js";
import { SessionStore } from "./session-store.js";

/** One hero in hero form, two ready allies in play, the card in hand. */
async function check(start: (store: SessionStore) => Promise<void>, held: string, allyCodes: readonly string[]) {
  const store = new SessionStore(new LocalEngineHost());
  await start(store);
  const game = store.state.game!;
  const me = game.players[0]!;
  expect(me.identity.form).toBe("hero");
  expect(me.hand.some((id) => (game.instances[id]?.cardId as string) === held)).toBe(true);
  const allies = cardsInPlay(game).filter((id) => allyCodes.includes(game.instances[id]!.cardId as string));
  expect(allies).toHaveLength(2);
  expect(allies.every((id) => !game.instances[id]!.exhausted)).toBe(true);
}

describe("the in-play cost dev games", () => {
  test("Phoenix: Cyclops and Marvel Girl ready in play, Mutant Peacekeepers in hand", () =>
    check(startPeacekeepersDevGame, PEACEKEEPERS_CARD, ["34003", "34015"]));

  test("Captain America: Squirrel Girl and Wonder Man ready in play, Strength in Numbers in hand", () =>
    check(startStrengthInNumbersDevGame, STRENGTH_IN_NUMBERS_CARD, ["03013", "03014"]));

  test("Wolverine: Jubilee and Sunfire ready in play, Team Strike in hand", () =>
    check(startTeamStrikeDevGame, TEAM_STRIKE_CARD, ["35003", "35014"]));
});
