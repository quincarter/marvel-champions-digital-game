/**
 * The `?screen=board&fixture=jackpot` dev jump (`scenes/boot.ts`, issue #222): a real Domino game against Rhino,
 * paused on Jackpot!'s response after Luck Be a Lady discarded it from the top of her deck, so the response sheet's
 * warning (taking it means Luck Be a Lady won't count its resources) can be seen and shot. Played forward on the
 * engine's own commands from a stacked setup: Luck Be a Lady and five cards in the starting hand, Jackpot! on top.
 */
import { appSession } from "../session.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** Plays a Domino game up to the Jackpot! response window. Shared with the view test that reads the window. */
export async function playToJackpotWindow(store: SessionStore): Promise<void> {
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "domino-justice" }],
    seed: 1,
    stack: { players: { 0: ids("40041", "40052", "40053", "40055", "40047", "40048", "40043") } },
  });
  const flip = (await nextTurn(store))?.legal.find((entry) => entry.action.kind === "changeForm");
  if (!flip) return;
  await store.dispatch(flip.example);
  const turn = await nextTurn(store);
  const game = store.state.game!;
  const luck = turn?.legal.find(
    (entry) => entry.action.kind === "playCard" && codeOf(game, entry.action.instanceId) === "40041",
  );
  if (luck) await store.dispatch(luck.example);
}

export async function startDevJackpotGame(): Promise<void> {
  await playToJackpotWindow(appSession().store);
}
