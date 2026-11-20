/**
 * The `?screen=board&fixture=multi-gun` dev jump (`scenes/boot-dev-jump.ts`): Venom and Spider-Man against Rhino,
 * two minions engaged with each, stopped on Multi-Gun's (20008) "Choose a player" question, so the sheet shows each seat's
 * engaged minions with their card hover (issue #911). `dev-multi-gun-game.test.ts` proves it.
 *
 * Played forward through the store with `SessionConfig.stack` and the engine's own example commands, never a state
 * edit. Venom plays Multi-Gun on the first turn and flips to hero form; the villain phase deals each seat a minion;
 * on the third turn Venom uses Multi-Gun and picks its "Choose a player" option.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

const MULTI_GUN = "20008";
const MULTI_GUN_ACTION = "20008.multi-gun-action";

export const MULTI_GUN_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "venom-justice" }, { starterDeckId: "core-spider-man-justice" }],
  seed: 7,
  stack: {
    // Multi-Gun with Strength and Energy to pay for it.
    players: { 0: ids(MULTI_GUN, "20019", "20017") },
    // Each round a boost with no icons per seat, then a minion per seat: round 1 Hydra Mercenary and Sandman, round 2
    // Shocker and another Hydra Mercenary, so each seat has two minions engaged (a stack on its row).
    encounter: ids("01104", "01104", "01101", "01102", "01105", "01105", "01103", "01101"),
  },
};

/** True when the open question is Multi-Gun's choose-a-player, with a minion engaged with every seat. */
export function multiGunReached(game: GameState, prompt: string | undefined): boolean {
  const minions = game.players.map((seat) =>
    seat.playArea.filter((id) => game.cardPool[codeOf(game, id)]?.type === "minion"),
  );
  return prompt === "choosePlayer" && minions.every((list) => list.length > 0);
}

/** Starts the game and plays it forward to Multi-Gun's "Choose a player" question. */
export async function startMultiGunGame(store: SessionStore): Promise<void> {
  await store.start(MULTI_GUN_CONFIG);
  for (let step = 0; step < 60; step++) {
    const turn = await nextTurn(store);
    const game = store.state.game;
    if (!turn || !game) return;
    const venom = game.players[0]!;
    if (store.state.legal?.playerId !== venom.playerId) {
      const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
      if (!end) return;
      await store.dispatch(end.example);
      continue;
    }
    const gun = turn.legal.find(
      (entry) => entry.action.kind === "useAbility" && String(entry.action.abilityId) === MULTI_GUN_ACTION,
    );
    const minionsEverywhere = game.players.every(
      (seat) => seat.playArea.filter((id) => game.cardPool[codeOf(game, id)]?.type === "minion").length >= 2,
    );
    if (gun && minionsEverywhere) {
      await store.dispatch(gun.example);
      const choice = store.state.legal?.actions.kind === "choice" ? store.state.legal.actions.choice : null;
      const option = choice?.options.find((o) => o.label.startsWith("Choose a player"));
      if (option) await store.resolveChoice([option.optionId]);
      return;
    }
    const play = turn.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        entry.example.type === "playCard" &&
        codeOf(game, entry.action.instanceId) === MULTI_GUN,
    );
    if (play && play.action.kind === "playCard") {
      const others = venom.hand.filter((id) => id !== (play.action as { instanceId: string }).instanceId);
      let played = false;
      for (let count = 0; count <= others.length && !played; count++) {
        await store.dispatch({
          ...play.example,
          payment: others.slice(0, count).map((id) => ({ fromHand: id })),
        } as never);
        if (!store.state.error) played = true;
      }
      if (played) continue;
    }
    if (venom.identity.form === "alterEgo") {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    const end = turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) return;
    await store.dispatch(end.example);
  }
}
