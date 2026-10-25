/**
 * The `?screen=inspect&fixture=work-life` dev jump (`scenes/boot-dev-jump.ts`, issue #412): a real Jessica Jones game
 * in Art Museum Heist against Hammerhead, played forward on the engine's own commands until Work-Life Balance is in
 * her play area, Inspiring Pottery is on her (she is stalwart) and she is back in alter-ego form with no ally, so its
 * Alter-Ego Action has no valid target and Inspect's "Right now" says why. Each turn: change to hero form and take the
 * Pottery while it is not on her, change back to alter-ego once Work-Life Balance has arrived, end the turn.
 */
import type { InstanceId } from "@mc/engine";
import { appSession } from "../session.js";
import { codeOf, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const WORK_LIFE = "61030";
const POTTERY = "60123";

/** Plays the game to the state above; returns Work-Life Balance's instance id, or null when the path did not get there. */
export async function playToWorkLifeRefusal(store: SessionStore, seed = 15): Promise<InstanceId | null> {
  await store.start({
    scenarioId: "art-museum-heist",
    villainSetId: "hammerhead",
    difficulty: "standard",
    players: [{ starterDeckId: "jj-justice" }],
    seed,
  });
  for (let round = 0; round < 8; round++) {
    let turn = await nextTurn(store);
    if (!turn) return null;
    const game = () => store.state.game!;
    const find = (code: string) => Object.values(game().instances).find((i) => i.cardId === code)!;
    const me = () => game().players[0]!;
    const onHer = () => find(POTTERY).attachedTo === me().identity.instanceId;
    const workLifeIn = () => me().playArea.includes(find(WORK_LIFE).instanceId);
    if (onHer() && workLifeIn() && me().identity.form === "alterEgo") return find(WORK_LIFE).instanceId;
    if (!onHer() && me().identity.form === "alterEgo") {
      const flip = turn.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) await store.dispatch(flip.example);
      turn = await nextTurn(store);
    }
    const take = turn?.legal.find(
      (entry) => entry.action.kind === "useAbility" && codeOf(game(), entry.action.instanceId) === POTTERY,
    );
    if (!onHer() && take) {
      await store.dispatch(take.example);
      turn = await nextTurn(store);
    }
    if (workLifeIn() && me().identity.form === "hero") {
      const flip = turn?.legal.find((entry) => entry.action.kind === "changeForm");
      if (flip) {
        await store.dispatch(flip.example);
        continue;
      }
    }
    await store.dispatch({ type: "endTurn", playerId: me().playerId });
  }
  return null;
}

export async function startDevWorkLifeGame(): Promise<InstanceId | null> {
  return playToWorkLifeRefusal(appSession().store);
}
