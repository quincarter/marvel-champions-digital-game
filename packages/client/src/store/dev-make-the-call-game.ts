/**
 * The `?screen=board&fixture=make-the-call` dev jump (`scenes/boot-dev-jump.ts`, issue #419): a real Captain Marvel
 * (Leadership) game against Rhino, played forward on the engine's own commands until Make the Call is in her hand and
 * an ally is in her discard pile, so playing it opens the list of allies it can take. Each turn: if an ally is in hand,
 * spend it to pay for another card, so it lands in the discard pile; then flip to hero form, thwart and end the turn.
 */
import type { GameState, InstanceId } from "@mc/engine";
import { POOL_CARDS, POOL_DEPS } from "../content/pool.js";
import { DevStateHost } from "../engine/dev-state-host.js";
import { appSession, useDevHost } from "../session.js";
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

/** How many core-set aspect allies `many` adds to the discard pile, past the deck's own. */
const EXTRA_ALLIES = 8;
const ASPECTS: readonly string[] = ["aggression", "justice", "leadership", "protection", "basic"];

/**
 * Every ally left in the seat's deck moved to its discard pile, plus a few more core-set aspect allies (state surgery:
 * no card effect does this), so Make the Call lists more allies than a phone's sheet holds and the list pages (#420).
 */
function alliesToDiscard(state: GameState): GameState {
  const [seat, ...rest] = state.players;
  if (!seat) return state;
  const isAlly = (id: InstanceId): boolean => state.cardPool[codeOf(state, id)]?.type === "ally";
  const allies = seat.deck.filter(isAlly);
  const template = allies[0] ?? seat.discard.find(isAlly);
  if (!template) return state;
  const used = new Set(Object.values(state.instances).map((instance) => instance.cardId as string));
  const extra = POOL_CARDS.filter(
    (card) =>
      card.type === "ally" && card.setCode === "core" && ASPECTS.includes((card as { aspect?: string }).aspect ?? ""),
  )
    .filter((card) => !used.has(card.id as string))
    .slice(0, EXTRA_ALLIES);
  const added = extra.map((card, index) => ({
    ...state.instances[template]!,
    instanceId: `make-the-call-extra-${index}` as InstanceId,
    cardId: card.id,
    faceup: true,
  }));
  const instances = Object.fromEntries([
    ...Object.entries(state.instances).map(([id, instance]) => [
      id,
      allies.includes(id as InstanceId) ? { ...instance, faceup: true } : instance,
    ]),
    ...added.map((instance) => [instance.instanceId, instance]),
  ]);
  const cardPool = { ...state.cardPool, ...Object.fromEntries(extra.map((card) => [card.id as string, card])) };
  const moved = {
    ...seat,
    deck: seat.deck.filter((id) => !allies.includes(id)),
    discard: [...added.map((instance) => instance.instanceId), ...allies, ...seat.discard],
  };
  return { ...state, instances, cardPool, players: [moved, ...rest] };
}

/**
 * The jump's game; `tight` (`&tight=1`) then plays one more card from hand at the engine's own smallest payment, so the
 * hand left over cannot pay for every ally and the list dims the ones it cannot. `many` (`&many=1`) then moves every
 * ally left in the deck to the discard pile, for the paged list.
 */
export async function startDevMakeTheCallGame(tight = false, many = false): Promise<InstanceId | null> {
  let store = appSession().store;
  const call = await playToMakeTheCall(store);
  if (call && many) {
    useDevHost(new DevStateHost(alliesToDiscard(store.state.game!), POOL_DEPS));
    store = appSession().store;
    await store.start({
      scenarioId: "rhino",
      difficulty: "standard",
      players: [{ starterDeckId: "core-captain-marvel-leadership" }],
      seed: 5,
    });
  }
  if (!call || !tight) return call;
  const turn = await nextTurn(store);
  const spend = turn?.legal.find(
    (entry) => entry.action.kind === "playCard" && entry.needsPayment && entry.action.instanceId !== call,
  );
  if (spend) await store.dispatch(spend.example);
  await nextTurn(store);
  return call;
}
