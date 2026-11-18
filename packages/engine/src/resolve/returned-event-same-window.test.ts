/**
 * An event a window played that comes back to hand is offered again for the same occurrence; a card in play that used
 * its response is not (issue #804). RRG 1.8 "Response" (p. 38) and "Triggering Condition" (p. 45): each response is
 * used once per occurrence per card, and several copies may each answer it. FFG ruling (RRG 1.0-1.4 rulings, Ms.
 * Marvel): an event returned to hand by Morphogenetics "can be played again in response to the same instance. It's the
 * same as if you had 2 copies".
 *
 * Synthetic cards, one player: P1 plays Zap (deal 1 damage to the villain). Watch (in play) and Echo (an event in hand)
 * each answer that damage with a response that marks the main scheme. Recall (in play): "Response: After you play an
 * event, exhaust Recall → return that event to your hand."
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "../abilities.js";
import type { InstanceId } from "../ids.js";
import { mustInstance, mustPlayer } from "../query.js";
import type { GameState } from "../state.js";
import { depsOf, stubAbility } from "../testing/abilities.js";
import { runCommandsPicking } from "../testing/drive.js";
import { defaultPick, giveCard } from "../testing/scenario.js";
import { stubEvent, stubMainScheme, stubSupport, stubVillain } from "../testing/fixtures.js";
import { gameAtFirstTurn, P1, playerCardIntoPlay } from "../testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const mainScheme = { kind: "each", query: { categories: ["mainScheme"] } } as const;
const damageToVillain = { on: "dealDamage", targetIs: { categories: ["villain"] } } as const;
const mark = (counterType: string) => ({ kind: "addCounters", target: mainScheme, counterType, amount: one }) as const;

const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "named", name: "villain" }, amount: one }],
});
const WATCH_RESPONSE = stubAbility("watch.response", {
  trigger: { kind: "response", forced: false, on: damageToVillain },
  effects: [mark("watch")],
});
const ECHO_RESPONSE = stubAbility("echo.response", {
  trigger: { kind: "response", forced: false, on: damageToVillain },
  effects: [mark("echo")],
});
const RECALL_RESPONSE = stubAbility("recall.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "cardPlayed", targetIs: { categories: ["event"] }, playerIs: "controller" },
  },
  cost: { exhaustSelf: true },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "eventTarget" } }, to: "hand" }],
});

const ZAP = stubEvent({ id: "zap", cost: 0, abilities: [ZAP_ACTION.ref] });
const ECHO = stubEvent({ id: "echo", cost: 0, abilities: [ECHO_RESPONSE.ref] });
const PRICEY_RESPONSE = stubAbility("pricey.response", {
  trigger: { kind: "response", forced: false, on: damageToVillain },
  effects: [mark("pricey")],
});
/** Echo's text at a cost of 1, paid with a Coin (one wild resource). */
const PRICEY = stubEvent({ id: "pricey", cost: 1, abilities: [PRICEY_RESPONSE.ref] });
const COIN = stubEvent({ id: "coin", cost: 5, resources: 1 });
const WATCH = stubSupport({ id: "watch", cost: 0, abilities: [WATCH_RESPONSE.ref] });
const RECALL = stubSupport({ id: "recall", cost: 0, abilities: [RECALL_RESPONSE.ref] });
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 0, sch: 0 }] });
const SCHEME = stubMainScheme({
  id: "calm",
  stages: [{ startingThreat: flat(0), targetThreat: flat(99), acceleration: flat(0) }],
});

const deps: EngineDeps = depsOf(ZAP_ACTION, WATCH_RESPONSE, ECHO_RESPONSE, RECALL_RESPONSE, PRICEY_RESPONSE);

function table(withRecall: boolean): { readonly state: GameState; readonly echo: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [ZAP, ECHO, WATCH, RECALL, PRICEY, COIN],
    deps,
    villain: VILLAIN,
    mainScheme: SCHEME,
    deck: [WATCH.id, RECALL.id, ZAP.id, ECHO.id, PRICEY.id, COIN.id, COIN.id, ZAP.id, ZAP.id, ZAP.id],
  });
  state = playerCardIntoPlay(state, WATCH.id, P1).state;
  if (withRecall) state = playerCardIntoPlay(state, RECALL.id, P1).state;
  const echo = giveCard(state, P1, ECHO.id);
  return { state: echo.state, echo: echo.id };
}

/**
 * P1 plays Zap. Every response offered is picked, Echo up to `echoPlays` times; each `chooseTriggers` prompt's
 * offered abilities are recorded.
 */
function zap(withRecall: boolean, echoPlays: number) {
  const { state, echo } = table(withRecall);
  const offers: string[][] = [];
  let played = 0;
  const pick = (current: GameState): readonly string[] => {
    const choice = current.pendingChoice;
    if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(current);
    const ids = choice.options.map((option) => option.optionId);
    offers.push(ids.map((id) => id.split(":").slice(1).join(":")));
    return ids.filter((id) => {
      if (!id.endsWith(":echo.response")) return true;
      if (played >= echoPlays) return false;
      played++;
      return true;
    });
  };
  const given = giveCard(state, P1, ZAP.id);
  const after = runCommandsPicking(given.state, deps, pick, {
    type: "playCard",
    playerId: P1,
    cardInstanceId: given.id,
    payment: [],
    attachToInstanceId: null,
  }).state;
  const counters = mustInstance(after, after.mainScheme.instanceId).counters ?? {};
  return { state: after, echo, offers, watch: counters["watch"] ?? 0, echoes: counters["echo"] ?? 0 };
}

const offeredCount = (offers: readonly (readonly string[])[], ability: string): number =>
  offers.filter((ids) => ids.includes(ability)).length;

describe("an event returned to hand answers the same occurrence again (#804)", () => {
  it("Echo returned by Recall is offered again and resolves twice; Watch, used once, is not offered again", () => {
    const run = zap(true, 2);
    expect(run.state.stack).toEqual([]);
    expect(run.echoes).toBe(2);
    expect(run.watch).toBe(1);
    expect(offeredCount(run.offers, "echo.response")).toBe(2);
    expect(offeredCount(run.offers, "watch.response")).toBe(1);
    // Recall exhausted after the first return: the second Echo stays in the discard.
    expect(mustPlayer(run.state, P1).discard).toContain(run.echo);
  });

  it("without Recall, Echo is played once and not offered again", () => {
    const run = zap(false, 2);
    expect(run.echoes).toBe(1);
    expect(run.watch).toBe(1);
    expect(offeredCount(run.offers, "echo.response")).toBe(1);
  });

  it("a returned paid event picked again but backed out of at its payment is not offered a third time", () => {
    let { state } = table(true);
    const pricey = giveCard(state, P1, PRICEY.id);
    state = giveCard(giveCard(pricey.state, P1, COIN.id).state, P1, COIN.id).state;
    const offers: string[][] = [];
    let payments = 0;
    const pick = (current: GameState): readonly string[] => {
      const choice = current.pendingChoice;
      if (choice?.prompt.kind === "payForCard") {
        payments++;
        // The first play pays with one Coin; the second, after Recall returned it, backs out with nothing.
        return payments === 1 ? choice.options.slice(0, 1).map((option) => option.optionId) : [];
      }
      if (choice?.prompt.kind !== "chooseTriggers") return defaultPick(current);
      const ids = choice.options.map((option) => option.optionId);
      offers.push(ids.map((id) => id.split(":").slice(1).join(":")));
      return ids.filter((id) => !id.endsWith(":echo.response"));
    };
    const given = giveCard(state, P1, ZAP.id);
    const after = runCommandsPicking(given.state, deps, pick, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: given.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    expect(after.stack).toEqual([]);
    expect(payments).toBe(2);
    expect(offeredCount(offers, "pricey.response")).toBe(2);
    expect(mustInstance(after, after.mainScheme.instanceId).counters?.["pricey"]).toBe(1);
    expect(mustPlayer(after, P1).hand).toContain(pricey.id);
  });
});
