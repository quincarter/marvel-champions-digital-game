/**
 * Rescue Captives (173B): "Response: After you defeat a Sentinel minion, spend 1 resource of any type -> ... (Any
 * player may trigger this ability.)" "You" is the triggering player's identity, or an event or upgrade of theirs, not
 * an ally they control (RRG 1.8 "You, Your", p. 49; issue #817). The card is the encounter's, so `extensionOf:
 * controller` must read the acting player: the identity case is offered to P1 and to P2, an ally's defeat to neither.
 */
import { cardsInPlay, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  endTurn,
  firstLegal,
  identityOf,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
} from "../../testing/harness.js";
import { WAVE6_DEPS } from "../index.js";
import { campaignGame } from "./campaign-cards-testing.js";

const RESPONSE = "32173b.rescue-captives-response";
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const settled = (state: GameState, until?: (s: GameState) => boolean) => settle(state, firstLegal, until, WAVE6_DEPS);
const offered = (s: GameState): boolean =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" &&
  s.pendingChoice.options.some((o) => o.optionId.endsWith(RESPONSE));

/** Rescue Captives flipped, `player` in hero form, and a Sentinel minion engaged with P1 about to die. */
function stage(player: PlayerId): { state: GameState; sentinel: InstanceId } {
  const start = campaignGame(2);
  const scheme = instancesOf(start, "32173a").find((id) => cardsInPlay(start).includes(id))!;
  const turn = player === P1 ? start : settled(run(start, endTurn(P1)));
  const hero = settled(run(turn, toHero(player)));
  const flipped = settled(
    run(patchInstance(hero, scheme, { threat: 1 }), {
      type: "basicThwart",
      playerId: player,
      thwarterInstanceId: identityOf(hero, player),
      schemeInstanceId: scheme,
    }),
  );
  const sentinel = cardsInPlay(flipped).find(
    (id) =>
      flipped.instances[id]!.engagedWith === P1 && flipped.cardPool[flipped.instances[id]!.cardId]?.type === "minion",
  )!;
  const ready = patchInstance(flipped, identityOf(flipped, player), { exhausted: false });
  return { state: patchInstance(ready, sentinel, { damage: 999 }), sentinel };
}

/** The first ally card of `player`'s deck, put into their play area ready, under their control (surgery). */
function withAlly(state: GameState, player: PlayerId): { state: GameState; ally: InstanceId } {
  const owner = playerOf(state, player);
  const ally = [...owner.hand, ...owner.deck].find(
    (id) => state.cardPool[state.instances[id]!.cardId]?.type === "ally",
  );
  if (!ally) throw new Error("no ally in the deck");
  const placed = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player
        ? {
            ...p,
            hand: p.hand.filter((i) => i !== ally),
            deck: p.deck.filter((i) => i !== ally),
            playArea: [...p.playArea, ally],
          }
        : p,
    ),
  };
  return { state: patchInstance(placed, ally, { controllerId: player, faceup: true, exhausted: false }), ally };
}

const attack = (player: PlayerId, attacker: InstanceId, target: InstanceId) =>
  ({ type: "basicAttack", playerId: player, attackerInstanceId: attacker, targetInstanceId: target }) as const;

describe("Rescue Captives 32173b: 'after you defeat a Sentinel minion' (#817)", () => {
  it.each([P1, P2])("is offered to %s when their identity defeats a Sentinel minion", (player) => {
    const { state, sentinel } = stage(player);
    const after = settled(run(state, attack(player, identityOf(state, player), sentinel)), offered);
    expect(offered(after)).toBe(true);
  });

  it.each([P1, P2])("is not offered to %s when an ally they control defeats it", (player) => {
    const { state, sentinel } = stage(player);
    const { state: withHelper, ally } = withAlly(state, player);
    const after = settled(run(withHelper, attack(player, ally, sentinel)), offered);
    expect(cardsInPlay(after)).not.toContain(sentinel);
    expect(offered(after)).toBe(false);
  });
});
