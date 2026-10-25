/**
 * The `?screen=board&fixture=make-the-call` dev jump (`scenes/boot-dev-jump.ts`, issue #419): a real Captain Marvel
 * (Leadership) game against Rhino, played forward on the engine's own commands until Make the Call is in her hand and
 * an ally is in her discard pile, so playing it opens the list of allies it can take. Each turn: if an ally is in hand,
 * spend it to pay for another card, so it lands in the discard pile; then flip to hero form, thwart and end the turn.
 */
import type { InstanceId } from "@mc/engine";
import { appSession } from "../session.js";
import { codeOf, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const MAKE_THE_CALL = "01071";

/** Plays the game to the state above; returns Make the Call's instance id, or null when the path did not get there. */
export async function playToMakeTheCall(store: SessionStore, seed = 5): Promise<InstanceId | null> {
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-captain-marvel-leadership" }],
    seed,
  });
  for (let round = 0; round < 12; round++) {
    const turn = await nextTurn(store);
    if (!turn) return null;
    const game = () => store.state.game!;
    const me = () => game().players[0]!;
    const isAlly = (id: InstanceId) => game().cardPool[codeOf(game(), id)]?.type === "ally";
    const call = turn.legal.find(
      (entry) =>
        entry.action.kind === "playCard" &&
        codeOf(game(), entry.action.instanceId) === MAKE_THE_CALL &&
        entry.targets.length > 0,
    );
    if (call?.action.kind === "playCard") return call.action.instanceId;
    const ally = me().hand.find(isAlly);
    const play = ally
      ? turn.legal.find(
          (entry) =>
            entry.action.kind === "playCard" &&
            entry.needsPayment &&
            entry.action.instanceId !== ally &&
            codeOf(game(), entry.action.instanceId) !== MAKE_THE_CALL,
        )
      : undefined;
    if (ally && play?.action.kind === "playCard" && play.example.type === "playCard") {
      const playing = play.action.instanceId;
      const others = me().hand.filter((id) => id !== playing && id !== ally && codeOf(game(), id) !== MAKE_THE_CALL);
      for (let count = 0; count <= others.length; count++) {
        const payment = [ally, ...others.slice(0, count)].map((id) => ({ fromHand: id }));
        if (await store.dispatch({ ...play.example, payment })) break;
      }
      await nextTurn(store);
    }
    // Keep the main scheme from completing: in hero form, Captain Marvel thwarts.
    let next = await nextTurn(store);
    if (me().identity.form === "alterEgo") {
      const flip = next?.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
      next = await nextTurn(store);
    }
    const thwart = next?.legal.find((entry) => entry.action.kind === "basicThwart");
    if (thwart) {
      await store.dispatch(thwart.example);
      await nextTurn(store);
    }
    await store.dispatch({ type: "endTurn", playerId: me().playerId });
  }
  return null;
}

export async function startDevMakeTheCallGame(): Promise<InstanceId | null> {
  return playToMakeTheCall(appSession().store);
}
