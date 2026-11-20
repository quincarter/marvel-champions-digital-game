/**
 * A board for an either/or additional cost to play with a flip branch (#890 item 11), shaped like Sentinel's Rocket
 * Punch (the `sentinel-tw` community pack): "As an additional cost to play this event, exhaust an Arms (Intact) or
 * destroy it" (flip it to its Destroyed side and take 2 unpreventable damage). Two such Components are in play, so
 * whichever branch is paid, the player has a card to pick. Used by the engine's tests and the client's cost-choice
 * tests (loaded there with `import.meta.glob`, as `dev-shadowland-game.ts` loads its builder).
 */

import type { AbilityCost, EngineDeps } from "../abilities.js";
import type { InstanceId } from "../ids.js";
import type { TargetQuery, TargetRef } from "../spec.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "./abilities.js";
import { stubEvent, stubUpgrade } from "./fixtures.js";
import { giveCard } from "./scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./wave3.js";

const yourIdentity: TargetRef = { kind: "identityOf", player: { kind: "controller" } };
export const ARMS_NAME = "Arms (Intact)";
const ARMS: TargetQuery = { categories: ["upgrade"], name: ARMS_NAME, controller: "you" };

/** "Exhaust Arms (Intact) or destroy it": exhaust one, or flip one and take 2 unpreventable damage. */
export const EXHAUST_OR_DESTROY_ARMS: AbilityCost = {
  either: [
    { exhaustCards: { slot: "arms", query: ARMS, min: 1, max: 1 } },
    { flipCards: { slot: "arms", query: ARMS, min: 1, max: 1 }, damageSelf: 2, damageSelfUnpreventable: true },
  ],
};

const ARMS_CARD = {
  ...stubUpgrade({ id: "arms", cost: 0 }),
  name: ARMS_NAME,
  flipSide: { name: "Arms (Destroyed)", traits: [], keywords: [], text: { printed: "", current: "" }, abilities: [] },
};
const PUNCH_COST = stubAbility("punch.constant", {
  trigger: { kind: "constant", additionalCostToPlay: {} },
  cost: EXHAUST_OR_DESTROY_ARMS,
  effects: [],
});
const PUNCH_ACTION = stubAbility("punch.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "addCounters", target: yourIdentity, counterType: "punched", amount: { kind: "const", value: 1 } }],
});
const PUNCH = stubEvent({ id: "punch", cost: 0, abilities: [PUNCH_COST.ref, PUNCH_ACTION.ref] });

export const EITHER_FLIP_DEPS: EngineDeps = depsOf(PUNCH_COST, PUNCH_ACTION);

/** Player 1 in hero form with two Arms (Intact) in play and the event in hand. */
export function eitherFlipCostGame(): {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly punch: InstanceId;
  readonly arms: readonly InstanceId[];
} {
  const cards = [ARMS_CARD, PUNCH];
  const base = gameAtFirstTurn({
    cards,
    deps: EITHER_FLIP_DEPS,
    deck: [...cards, ...cards, ...cards].map((c) => c.id),
  });
  let state: GameState = {
    ...base,
    players: base.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" } })),
  };
  const arms: InstanceId[] = [];
  for (let i = 0; i < 2; i += 1) {
    const put = playerCardIntoPlay(state, ARMS_CARD.id);
    state = put.state;
    arms.push(put.id);
  }
  const given = giveCard(state, P1, PUNCH.id);
  return { state: given.state, deps: EITHER_FLIP_DEPS, punch: given.id, arms };
}
