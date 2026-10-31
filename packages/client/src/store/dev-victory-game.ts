/**
 * The `?screen=board&fixture=victory` dev jump (`scenes/boot-dev-jump.ts`): a real X-23 game played to her Specialized
 * Training (43021, a basic player side scheme) defeated, so the victory display's pile is on the table. The opening
 * hand comes from `SessionConfig.stack`, as the X-23 lesson's does, and every step is an engine command, so it replays
 * byte for byte like any saved game. `dev-victory-game.test.ts` proves it reaches the state it claims.
 */
import type { InstanceId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import { codeOf, ids, nextTurn } from "./dev-game-steps.js";
import type { SessionStore } from "./session-store.js";

export const VICTORY_DEV_CARD = "43021";

const CLAW_MASTERY = "43005";
const ANIMAL_INSTINCT = "43004";
const ENERGY = "43022";
const GENIUS = "43023";
const STRENGTH = "43024";

export const VICTORY_DEV_CONFIG: SessionConfig = {
  scenarioId: "rhino",
  difficulty: "standard",
  modularSetIds: ["bomb_scare"],
  players: [{ starterDeckId: "x-23-aggression" }],
  seed: 4204,
  stack: { players: { 0: ids(VICTORY_DEV_CARD, CLAW_MASTERY, ANIMAL_INSTINCT, ENERGY, GENIUS, STRENGTH) } },
};

export async function startVictoryDevGame(store: SessionStore): Promise<void> {
  await store.start(VICTORY_DEV_CONFIG);
  await nextTurn(store);
  const { playerId, identity } = store.state.game!.players[0]!;
  await store.dispatch({ type: "changeForm", playerId });
  const inHand = (code: string): InstanceId =>
    store.state.game!.players[0]!.hand.find((id) => codeOf(store.state.game!, id) === code)!;
  const play = async (code: string, payer: string): Promise<void> => {
    await store.dispatch({
      type: "playCard",
      playerId,
      cardInstanceId: inHand(code),
      payment: [{ fromHand: inHand(payer) }],
      attachToInstanceId: null,
    });
    await nextTurn(store);
  };
  await play(VICTORY_DEV_CARD, GENIUS);
  await play(CLAW_MASTERY, ENERGY);
  const training = Object.values(store.state.game!.instances).find((i) => (i.cardId as string) === VICTORY_DEV_CARD)!;
  await store.dispatch({
    type: "basicThwart",
    playerId,
    thwarterInstanceId: identity.instanceId,
    schemeInstanceId: training.instanceId,
  });
  // Animal Instinct's interrupt is offered before the thwart resolves; the Specialist off the defeat takes the minimum.
  const offer = store.state.legal?.actions;
  if (offer?.kind === "choice") {
    await store.resolveChoice(
      offer.choice.options.filter((o) => o.optionId.includes(`${ANIMAL_INSTINCT}.`)).map((o) => o.optionId),
    );
  }
  await nextTurn(store);
}
