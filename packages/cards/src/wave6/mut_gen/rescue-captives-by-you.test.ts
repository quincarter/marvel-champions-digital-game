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
  inst,
  instancesOf,
  P1,
  P2,
  patchInstance,
  playerOf,
  runWith,
  settle,
  toHero,
  type Picker,
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
function stage(player: PlayerId): { state: GameState; sentinel: InstanceId; scheme: InstanceId } {
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
  return { state: patchInstance(ready, sentinel, { damage: 999 }), sentinel, scheme };
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

  it("P2's response runs through: P2 picks it, pays 1 resource from P2's hand, and the chosen captive enters play under P2", () => {
    const { state, sentinel, scheme } = stage(P2);
    const captive = inst(state, scheme).tucked[0]!;
    const asked = settled(run(state, attack(P2, identityOf(state, P2), sentinel)), offered);
    expect(offered(asked)).toBe(true);
    const p1Before = playerOf(asked, P1);
    const p2Before = playerOf(asked, P2);
    const pick: Picker = (s) => {
      const options = s.pendingChoice?.options ?? [];
      const response = options.find((o) => o.optionId.endsWith(RESPONSE));
      if (response) return [response.optionId];
      const kind = s.pendingChoice?.prompt.kind;
      if (kind === "chooseCards") return [captive];
      if (kind === "payForAbility") {
        // Whatever pays must be P2's own card.
        expect(options.every((o) => p2Before.hand.includes(o.optionId.replace("hand:", "") as InstanceId))).toBe(true);
        return [options[0]!.optionId];
      }
      return firstLegal(s);
    };
    const done = settle(asked, pick, undefined, WAVE6_DEPS);
    expect(playerOf(done, P2).playArea).toContain(captive);
    expect(inst(done, captive).controllerId).toBe(P2);
    expect(inst(done, scheme).tucked).not.toContain(captive);
    expect(playerOf(done, P2).hand.length).toBe(p2Before.hand.length - 1);
    expect(playerOf(done, P1).hand).toEqual(p1Before.hand);
    expect(playerOf(done, P1).discard).toEqual(p1Before.discard);
    expect(playerOf(done, P1).playArea).not.toContain(captive);
  });
});
