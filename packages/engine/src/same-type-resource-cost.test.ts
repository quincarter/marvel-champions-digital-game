/**
 * docs/phase7-wave3.md §3.43: `AbilityCost.sameResourceType`, "Spend N resources of the same type →". Synthetic cards
 * shaped like Kree Combat Armor (`gmw` 16131): "Hero Action: Spend 3 resources of the same type → discard this card."
 *
 * Sources: RRG 1.8 "Wild Resource" (p. 48): a wild resource may be declared as any type when it is generated; RRG 1.8
 * "Cost" (p. 13): a player may generate resources beyond the cost, and those are overpaid — so a card printing two
 * different icons can give one of them to the cost and overpay the other.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommands, runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubResource, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCards } from "./testing/scenario.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const ARMOR_ACTION = stubAbility("armor.action", {
  trigger: { kind: "action" },
  cost: { resources: 3, sameResourceType: true },
  effects: [{ kind: "discardFromPlay", target: { kind: "self" } }],
});
const ARMOR = stubSupport({ id: "armor", cost: 0, abilities: [ARMOR_ACTION.ref] });
/** The same cost on a response, paid in a timing window: "After you play a card, spend 2 of the same type → draw 1." */
const ECHO_RESPONSE = stubAbility("echo.response", {
  trigger: { kind: "response", forced: false, on: { on: "cardPlayed", playerIs: "controller" } },
  cost: { resources: 2, sameResourceType: true },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
const ECHO = stubSupport({ id: "echo", cost: 0, abilities: [ECHO_RESPONSE.ref] });
const PING = stubEvent({ id: "ping", cost: 0 });

const P = stubResource({ id: "p", icons: 0, produces: { physical: 1 } });
const M = stubResource({ id: "m", icons: 0, produces: { mental: 1 } });
const E = stubResource({ id: "e", icons: 0, produces: { energy: 1 } });
const W = stubResource({ id: "w", icons: 0, produces: { wild: 1 } });
/** A card printing two different icons. */
const PM = stubResource({ id: "pm", icons: 0, produces: { physical: 1, mental: 1 } });

const deps: EngineDeps = depsOf(ARMOR_ACTION, ECHO_RESPONSE);
const RESOURCES = [P, M, E, W, PM];
const CARDS = [ARMOR, ECHO, PING, ...RESOURCES];
const DECK: readonly CardId[] = [
  ARMOR.id,
  ECHO.id,
  PING.id,
  ...RESOURCES.flatMap((card) => [card.id, card.id, card.id]),
];

/** A table with `support` in play and exactly `hand` in p1's hand (the rest back into the deck). */
function table(support: CardId, hand: readonly CardId[]): { state: GameState; source: InstanceId; hand: InstanceId[] } {
  const base = gameAtFirstTurn({ cards: CARDS, deps, deck: DECK });
  const placed = playerCardIntoPlay(base, support);
  const seat = mustPlayer(placed.state, P1);
  const emptied: GameState = {
    ...placed.state,
    players: placed.state.players.map((p) =>
      p.playerId === P1 ? { ...p, hand: [], deck: [...seat.hand, ...seat.deck] } : p,
    ),
  };
  const given = giveCards(emptied, P1, ...hand);
  return { state: given.state, source: placed.id, hand: [...given.ids] };
}

const pay = (ids: readonly InstanceId[]): readonly Payment[] => ids.map((fromHand) => ({ fromHand }));
const use = (source: InstanceId, payment: readonly Payment[]): Command => ({
  type: "useAbility",
  playerId: P1,
  cardInstanceId: source,
  abilityId: ARMOR_ACTION.ref.id,
  payment,
});
const armorAction = (state: GameState, source: InstanceId) => {
  const legal = legalActions(state, P1, deps);
  if (legal.kind !== "turn") throw new Error("not p1's turn");
  const matches = (a: { action: { kind: string } }) =>
    a.action.kind === "useAbility" && "instanceId" in a.action && a.action.instanceId === source;
  return { legal: legal.legal.find(matches), illegal: legal.illegal.find(matches) };
};

describe("§3.43 'Spend N resources of the same type'", () => {
  it("three of one type pay; the card is discarded", () => {
    const t = table(ARMOR.id, [P.id, P.id, P.id]);
    const { state, session } = runCommands(t.state, deps, use(t.source, pay(t.hand)));
    expect(mustPlayer(state, P1).discard).toContain(t.source);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a mixed payment is refused, and legalActions does not offer an unpayable hand", () => {
    const mixed = table(ARMOR.id, [P.id, P.id, M.id]);
    const result = applyCommand(mixed.state, use(mixed.source, pay(mixed.hand)), deps);
    expect(result).toMatchObject({
      ok: false,
      error: { code: "insufficient_resources", message: "spend 3 resources of the same type" },
    });
    const rainbow = table(ARMOR.id, [P.id, M.id, E.id, M.id]);
    const offered = armorAction(rainbow.state, rainbow.source);
    expect(offered.legal).toBeUndefined();
    expect(offered.illegal).toMatchObject({ reason: "insufficient_resources" });
  });

  it("a wild counts as the chosen type", () => {
    const t = table(ARMOR.id, [P.id, P.id, W.id]);
    expect(applyCommand(t.state, use(t.source, pay(t.hand)), deps).ok).toBe(true);
    const wilds = table(ARMOR.id, [W.id, W.id, W.id]);
    expect(applyCommand(wilds.state, use(wilds.source, pay(wilds.hand)), deps).ok).toBe(true);
  });

  it("a two-type card gives one icon to the cost and overpays the other", () => {
    // [P][M] + P + wild: 3 physical (the wild declared physical), the mental overpaid.
    const t = table(ARMOR.id, [PM.id, P.id, W.id]);
    expect(applyCommand(t.state, use(t.source, pay(t.hand)), deps).ok).toBe(true);
    // [P][M] + M + E: at most 2 of any one type.
    const short = table(ARMOR.id, [PM.id, M.id, E.id]);
    expect(applyCommand(short.state, use(short.source, pay(short.hand)), deps).ok).toBe(false);
  });

  it("legalActions offers it once the hand can pay, and its example is accepted", () => {
    const t = table(ARMOR.id, [M.id, P.id, E.id, P.id, P.id]);
    const offered = armorAction(t.state, t.source);
    expect(offered.legal).toBeDefined();
    expect(applyCommand(t.state, offered.legal!.example, deps).ok).toBe(true);
  });

  it("a payment made in a timing window is held to the same rule: mixed declines, one type resolves", () => {
    const answer = (payWith: readonly InstanceId[]) => (state: GameState) => {
      const choice = state.pendingChoice;
      if (choice?.prompt.kind === "chooseTriggers") return choice.options.map((o) => o.optionId);
      if (choice?.prompt.kind === "payForAbility") return payWith.map((id) => `hand:${id}`);
      return defaultPick(state);
    };
    const playPing = (t: ReturnType<typeof table>, payWith: readonly InstanceId[]) => {
      const withPing = giveCards(t.state, P1, PING.id);
      const before = mustPlayer(withPing.state, P1).hand.length;
      const run = runCommandsPicking(withPing.state, deps, answer(payWith), {
        type: "playCard",
        playerId: P1,
        cardInstanceId: withPing.ids[0]!,
        payment: [],
        attachToInstanceId: null,
      });
      return { drew: mustPlayer(run.state, P1).hand.length - (before - 1) };
    };
    const mixed = table(ECHO.id, [P.id, M.id]);
    expect(playPing(mixed, mixed.hand).drew).toBe(0);
    const same = table(ECHO.id, [M.id, M.id]);
    // The two spent cards leave the hand and one card is drawn.
    expect(playPing(same, same.hand).drew).toBe(-1);
  });
});
