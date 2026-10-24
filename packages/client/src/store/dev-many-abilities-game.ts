/**
 * The `?screen=board&fixture=abilities` dev jump (`scenes/boot-dev-jump.ts`): a real one-seat Rhino game stopped on
 * Captain Marvel's own turn with five or more usable Action abilities on cards in play, so the pad's RT layer has a
 * second page (A / X / Y / B take four, LB / RB turn the page). `dev-many-abilities-game.test.ts` proves it.
 *
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state
 * edit. Each turn plays one of the wanted supports / allies paid for with the other cards in hand, then ends the turn.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** Alpha Flight Station, Helicarrier, Avengers Mansion, Vision: each carries an Action the player can use. */
const WANTED = new Set(["01015", "01092", "01091", "01068"]);
/** Usable abilities needed before the game stops (the RT layer shows four a page). */
export const MANY_ABILITIES = 5;

export const MANY_ABILITIES_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-captain-marvel-leadership" }],
  seed: 7,
  stack: {
    players: {
      0: ids(
        // Turn 1: Alpha Flight Station and Helicarrier, paid for with the four fillers.
        "01015",
        "01092",
        "01012",
        "01012",
        "01012",
        "01013",
        // Turn 2: Avengers Mansion and an Energy Channel.
        "01091",
        "01018",
        "01013",
        "01013",
        "01014",
        "01014",
        // Turn 3: Vision, if five are not usable yet.
        "01068",
        "01017",
        "01017",
        "01083",
        "01084",
        "01085",
      ),
    },
    // Boost cards with no icons (Breakin' & Takin' and Hydra Mercenary reveals follow), so the scheme creeps slowly.
    encounter: ids("01104", "01105", "01104", "01105"),
  },
};

/** How many usable abilities the engine lists for the active player right now. */
export const usableAbilityCount = (store: SessionStore): number => {
  const actions = store.state.legal?.actions;
  return actions?.kind === "turn" ? actions.legal.filter((entry) => entry.action.kind === "useAbility").length : 0;
};

/** The wanted cards in play (the stop condition and the test read the same thing). */
export const wantedInPlay = (game: GameState): number =>
  game.players[0]!.playArea.filter((id) => WANTED.has(codeOf(game, id))).length;

/** Starts the game and plays it forward to Captain Marvel's turn with at least `MANY_ABILITIES` abilities usable. */
export async function startManyAbilitiesGame(store: SessionStore): Promise<void> {
  await store.start(MANY_ABILITIES_CONFIG);
  for (let step = 0; step < 60; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    if (usableAbilityCount(store) >= MANY_ABILITIES) return;
    const me = game.players[0]!;
    let played = false;
    for (const entry of turn.legal) {
      const action = entry.action;
      if (action.kind !== "playCard" || entry.example.type !== "playCard") continue;
      if (!WANTED.has(codeOf(game, action.instanceId))) continue;
      // Pay with cards that are not wanted permanents first.
      const others = me.hand
        .filter((id) => id !== action.instanceId)
        .sort((a, b) => Number(WANTED.has(codeOf(game, a))) - Number(WANTED.has(codeOf(game, b))));
      for (let count = 0; count <= others.length && !played; count++) {
        await store.dispatch({ ...entry.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
        if (!store.state.error) played = true;
      }
      if (played) break;
    }
    if (played) continue;
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
