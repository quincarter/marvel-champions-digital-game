/**
 * The `?screen=defend-allies` dev jump (`scenes/boot-dev-jump.ts`, issue #298): a real solo Rhino game stopped on a
 * `declareDefender` choice with War Machine and Mockingbird both ready to defend and at least one of them already
 * hurt, so the defend picker has to say how much health each ally has left before the attack. Played forward through
 * the store with `SessionConfig.stack` and the engine's own example commands, never a state edit.
 *
 * Iron Man plays both allies and flips to hero form on his first turn, so Rhino attacks; an ally defends the first
 * attack and lives through it, and the next attack is where the jump stops.
 */
import type { GameState } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { LocalEngineHost } from "../engine/local-host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import { SessionStore } from "./session-store.js";

const WAR_MACHINE = "01030";
const MOCKINGBIRD = "01083";
const ALLIES = new Set([WAR_MACHINE, MOCKINGBIRD]);

export const DEFEND_ALLIES_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  players: [{ starterDeckId: "core-iron-man-aggression" }],
  seed: 1,
  stack: { players: { 0: ids(WAR_MACHINE, MOCKINGBIRD, "01088", "01089", "01090", "01054", "01054") } },
};

/** The two allies in play, ready, and at least one of them damaged, on an open `declareDefender`. */
export function defendAlliesReached(game: GameState): boolean {
  if (game.pendingChoice?.prompt.kind !== "declareDefender") return false;
  const allies = game.players[0]!.playArea.filter((id) => ALLIES.has(codeOf(game, id)));
  return (
    allies.length === 2 &&
    allies.every((id) => !game.instances[id]?.exhausted) &&
    allies.some((id) => (game.instances[id]?.damage ?? 0) > 0)
  );
}

/** Plays a game forward to the second Rhino attack with a hurt ally on the table. */
export async function playDefendAlliesGame(store: SessionStore): Promise<void> {
  await store.start(DEFEND_ALLIES_CONFIG);
  for (let step = 0; step < 80; step++) {
    const game = store.state.game;
    const actions = store.state.legal?.actions;
    if (!game || game.outcome || !actions) return;
    if (defendAlliesReached(game)) return;
    if (actions.kind === "choice") {
      const { choice } = actions;
      // The first attack: the ally with the most health left takes it (and lives), the other stays ready.
      if (game.pendingChoice?.prompt.kind === "declareDefender") {
        const pick = choice.options.find((option) => /War Machine/.test(option.label)) ?? choice.options[0];
        await store.resolveChoice(pick ? [pick.optionId] : []);
        continue;
      }
      await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
      continue;
    }
    const turn = await nextTurn(store);
    if (!turn) return;
    const me = game.players[0]!;
    const ally = turn.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        entry.example.type === "playCard" &&
        ALLIES.has(codeOf(game, entry.action.instanceId)),
    );
    if (ally && ally.action.kind === "playCard" && ally.example.type === "playCard") {
      const payWith = me.hand.filter((id) => !ALLIES.has(codeOf(game, id)));
      let played = false;
      for (let count = 0; count <= payWith.length && !played; count++) {
        await store.dispatch({ ...ally.example, payment: payWith.slice(0, count).map((id) => ({ fromHand: id })) });
        if (!store.state.error) played = true;
      }
      if (played) continue;
    }
    const flip =
      me.identity.form === "alterEgo" ? turn.legal.find((entry) => entry.action.kind === "changeForm") : null;
    const next = flip ?? turn.legal.find((entry) => entry.action.kind === "endTurn");
    if (!next) return;
    await store.dispatch(next.example);
  }
}

/**
 * Starts the game on `store` and replays every command but the last; the returned function sends that one. The board
 * only collects the villain phase's beats while it is mounted, so the dev jump sends the last command once it is up
 * (as `?screen=villain-decision` does) and the attack opens in the docked defend panel.
 */
export async function startDefendAlliesGame(store: SessionStore): Promise<() => Promise<void>> {
  const plan = new SessionStore(new LocalEngineHost());
  await playDefendAlliesGame(plan);
  const commands = plan.state.commandTrail.map((entry) => entry.command);
  const last = commands.pop();
  await store.start(DEFEND_ALLIES_CONFIG);
  for (const command of commands) await store.dispatch(command);
  return async () => {
    if (last) await store.dispatch(last);
  };
}
