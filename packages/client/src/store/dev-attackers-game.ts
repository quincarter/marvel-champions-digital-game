/**
 * The `?screen=board&fixture=attackers` dev jump (`scenes/boot-dev-jump.ts`): a real solo Rhino game stopped on Captain Marvel's
 * own turn, in hero form, with three ready allies beside her, so "Who attacks?" has four characters to choose among: exactly
 * a page of the pad's direct picks (RT + A / X / Y / B). `dev-attackers-game.test.ts` proves it.
 *
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state
 * edit. Carol Danvers plays the allies the stack feeds her with the resource cards that pay for them,
 * ends the turn, and flips to hero form on the turn the third ally is out.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

/** Maria Hill, Spider-Woman, Hawkeye, Mockingbird: the Captain Marvel starter deck's cheaper allies. */
const ALLIES = new Set(["01067", "01011", "01066", "01083"]);
/** Allies on the table before the game stops. */
export const ATTACKERS = 3;

export const ATTACKERS_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-captain-marvel-leadership" }],
  seed: 7,
  stack: {
    // Maria Hill, Spider-Woman and Hawkeye with the resource cards (Energy, Genius, Strength: two each) that pay for the
    // first two; then Mockingbird and Energy Absorptions for the rest.
    players: {
      0: ids(
        "01067",
        "01088",
        "01011",
        "01089",
        "01090",
        "01066",
        "01083",
        "01014",
        "01014",
        "01012",
        "01013",
        "01012",
      ),
    },
    // Boost cards with no icons (Breakin' & Takin' and Hydra Mercenary reveals follow), so the scheme creeps slowly.
    encounter: ids("01104", "01105", "01104", "01105"),
  },
};

/** The allies in play, ready or not. */
export const alliesInPlay = (game: GameState): readonly string[] =>
  game.players[0]!.playArea.filter((id) => ALLIES.has(codeOf(game, id)));

/** True on Captain Marvel's turn in hero form with every ally ready. */
export function attackersReached(game: GameState): boolean {
  const allies = alliesInPlay(game);
  return (
    game.players[0]!.identity.form === "hero" &&
    allies.length >= ATTACKERS &&
    allies.every((id) => !game.instances[id]?.exhausted)
  );
}

/** Starts the game and plays it forward to Captain Marvel's turn in hero form with `ATTACKERS` ready allies. */
export async function startAttackersGame(store: SessionStore): Promise<void> {
  await store.start(ATTACKERS_CONFIG);
  for (let step = 0; step < 40; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    if (attackersReached(game)) return;
    const me = game.players[0]!;
    let played = false;
    // The cheapest ally first: what the hand can pay for goes down before the turn ends and the hand is trimmed.
    const costOf = (id: string): number => {
      const card = game.cardPool[codeOf(game, id)];
      return card && "cost" in card && typeof card.cost === "number" ? card.cost : 99;
    };
    const byCost = [...turn.legal].sort((a, b) =>
      a.action.kind === "playCard" && b.action.kind === "playCard"
        ? costOf(a.action.instanceId) - costOf(b.action.instanceId)
        : 0,
    );
    for (const entry of byCost) {
      const action = entry.action;
      if (action.kind !== "playCard" || entry.example.type !== "playCard") continue;
      if (!ALLIES.has(codeOf(game, action.instanceId))) continue;
      // Pay with the cards that are not allies, so each ally stays for a table of its own.
      const others = me.hand.filter((id) => id !== action.instanceId && !ALLIES.has(codeOf(game, id)));
      for (let count = 0; count <= others.length && !played; count++) {
        await store.dispatch({ ...entry.example, payment: others.slice(0, count).map((id) => ({ fromHand: id })) });
        if (!store.state.error) played = true;
      }
      if (played) break;
    }
    if (played) continue;
    if (alliesInPlay(game).length >= ATTACKERS && me.identity.form === "alterEgo") {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    // The identity thwarts (an ally would take consequential damage), so Rhino's scheme does not finish before the table is ready.
    const thwart = turn.legal.find(
      (entry) => entry.action.kind === "basicThwart" && entry.action.instanceId === me.identity.instanceId,
    );
    if (thwart) {
      await store.dispatch(thwart.example);
      continue;
    }
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
