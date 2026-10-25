/**
 * The `?screen=inspect&fixture=work-life` dev jump (`scenes/boot-dev-jump.ts`, issue #412): a real Jessica Jones game
 * in Art Museum Heist against Hammerhead, played forward on the engine's own commands until Work-Life Balance is in
 * her play area, Inspiring Pottery is on her (she is stalwart) and she is back in alter-ego form with no ally, so its
 * Alter-Ego Action has no valid target and Inspect's "Right now" says why. Each turn: change to hero form and take the
 * Pottery while it is not on her, change back to alter-ego once Work-Life Balance has arrived, end the turn.
 */
import type { GameEvent, InstanceId } from "@mc/engine";
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

/**
 * The `?screen=board&fixture=work-life-ally` dev jump: the game above, then an ally played from hand and Work-Life
 * Balance used, so the confuse option is barred while the ally option is taken on its own and the log says why (#412);
 * `answer` false leaves the pick of which ally open.
 * Returns the events of using it, or null when no ally could be played.
 */
export async function playWorkLifeWithAlly(
  store: SessionStore,
  seed = 15,
  answer = true,
): Promise<readonly GameEvent[] | null> {
  const workLife = await playToWorkLifeRefusal(store, seed);
  if (!workLife) return null;
  const game = () => store.state.game!;
  const turn = await nextTurn(store);
  const ally = turn?.legal.find(
    (entry) =>
      entry.action.kind === "playCard" && game().cardPool[codeOf(game(), entry.action.instanceId)]?.type === "ally",
  );
  if (!ally) return null;
  await store.dispatch(ally.example);
  const after = await nextTurn(store);
  const use = after?.legal.find((entry) => entry.action.kind === "useAbility" && entry.action.instanceId === workLife);
  if (!use) return null;
  await store.dispatch(use.example);
  const events: GameEvent[] = [...store.state.lastEvents];
  // The ally the remove option names is a choice of its own: answer it, keeping its events too.
  for (let guard = 0; answer && guard < 10 && store.state.legal?.actions.kind === "choice"; guard++) {
    const choice = store.state.legal.actions.choice;
    await store.resolveChoice(choice.options.slice(0, Math.max(1, choice.minSelections)).map((o) => o.optionId));
    events.push(...store.state.lastEvents);
  }
  return events;
}

export async function startDevWorkLifeAllyGame(): Promise<boolean> {
  // Left on the pick of the ally to remove, so the board opens with the use's own events (its log line) as the last.
  return (await playWorkLifeWithAlly(appSession().store, 15, false)) !== null;
}
