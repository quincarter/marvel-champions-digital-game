/**
 * The `?screen=board&fixture=sense` dev jump (`scenes/boot-dev-jump.ts`): Daredevil (Justice, with his Sense deck) and
 * Echo at the first player turn, to see a named side deck beside the play area and the Team-Up blurb in the Other
 * Heroes panel, and a sideways player side scheme (De-escalation) in the hand. A fixture for screenshots only.
 */
import { appSession } from "../session.js";
import { ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export async function startDevSenseGame(): Promise<void> {
  await appSession().store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "fne-daredevil-justice" }, { starterDeckId: "fne-echo-protection" }],
    seed: 3,
    // De-escalation (60024, a player side scheme: a sideways card) dealt into Daredevil's opening hand.
    stack: { players: { 0: ids("60024") } },
  });
}

/**
 * The `?screen=board&fixture=sense-hero` dev jump: Daredevil alone against Rhino, flipped to his hero face on the first
 * turn, so Superhuman Senses is legal and the Sense deck's top card offers "Play it" (`view/inspect-model.ts`
 * `deckTopPlaysOf`). Played forward on the engine's own commands (`nextTurn`), never a state edit.
 */
export async function startDevSenseHeroGame(store: SessionStore = appSession().store): Promise<void> {
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "fne-daredevil-justice" }],
    seed: 3,
  });
  const turn = await nextTurn(store);
  if (store.state.game?.players[0]?.identity.form === "hero") return;
  const flip = turn?.legal.find((entry) => entry.action.kind === "changeForm");
  if (flip) await store.dispatch(flip.example);
  await nextTurn(store);
}
