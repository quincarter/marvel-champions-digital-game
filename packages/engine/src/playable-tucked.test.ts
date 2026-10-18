/**
 * docs/phase7-wave11.md §3.8: a card in play lets its controller play the card tucked under it "as if it were in your
 * hand" (`AbilityTriggerSpec playableAsIfInHand { zone: { tuckedUnder } }`, the general form of `playableTopOfDeck`).
 * Synthetic cards shaped like Contingency Planning (`fne` 60030): "You may play the upgrade tucked here as if it were
 * in your hand."
 *
 * Sources: RRG 1.8 "Play Restrictions and Permissions" (p. 33): a permission to play a card from an out-of-play area.
 * "Tuck" (p. 45): tucked cards are out of play, and are discarded when the card they are tucked under leaves play.
 * "Initiating Abilities" (p. 24): the card leaves its zone at step 1, then its cost is paid. RRG 1.8 FAQ "Magik
 * (#30A)" (p. 64): a card played "as if it was in your hand" is considered played from the hand.
 *
 * Synthetic cards only; the engine never names a card.
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { asIfInHandPermissions, playCostOf } from "./actions.js";
import type { Command } from "./commands.js";
import { applyCommand, replay, startSession } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { legalActions } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession, runCommands } from "./testing/drive.js";
import { stubAlly, stubEvent, stubMinion, stubSupport, stubUpgrade } from "./testing/fixtures.js";
import { defaultPick, giveCard, RESOURCE, TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";
import { choiceExclusions } from "./why-not.js";

const UPGRADES: TargetQuery = { categories: ["upgrade"] };
const permission = (cards?: TargetQuery, costReduction?: number): AbilityDefinition => ({
  trigger: {
    kind: "constant",
    playableAsIfInHand: {
      player: { kind: "controller" },
      zone: { tuckedUnder: { kind: "self" } },
      ...(cards ? { cards } : {}),
      ...(costReduction ? { costReduction } : {}),
    },
  },
  effects: [],
});
/** "You may play the upgrade tucked here as if it were in your hand." */
const PLAN_CONSTANT = stubAbility("plan.constant", permission(UPGRADES));
const PLAN = stubUpgrade({ id: "plan", cost: 0, abilities: [PLAN_CONSTANT.ref] });
/** The same, reducing the tucked card's cost by 1: the permission's `costReduction`. */
const CHEAP_CONSTANT = stubAbility("cheap.constant", permission(UPGRADES, 1));
const CHEAP = stubSupport({ id: "cheap", cost: 0, abilities: [CHEAP_CONSTANT.ref] });
/** The near miss: a card with a tuck and no permission. */
const SHELF = stubSupport({ id: "shelf", cost: 0 });
/** "Attach to a minion." Costs 1. */
const SNARE = { ...stubUpgrade({ id: "snare", cost: 1 }), attachesTo: { kind: "minion" as const } };
const PAL = stubAlly({ id: "pal", cost: 0, atk: 1, thw: 1, hp: 3 });
const GOON = stubMinion({ id: "goon", atk: 0, sch: 0, hp: 5 });
/** "Discard each plan": takes the host, and the tuck with it, out of play. */
const SCRAP_ACTION = stubAbility("scrap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "discardFromPlay", target: { kind: "each", query: { name: "plan" } } }],
});
const SCRAP = stubEvent({ id: "scrap", cost: 0, abilities: [SCRAP_ACTION.ref] });

/** Any tucked card, reduced by 1: for a tucked event played in its window. */
const OPEN_CONSTANT = stubAbility("open.constant", permission(undefined, 1));
const OPEN = stubSupport({ id: "open", cost: 0, abilities: [OPEN_CONSTANT.ref] });
/** Any tucked card, once per round: the permission's limit. */
const ONCE_CONSTANT = stubAbility("once.constant", { ...permission(), limit: { count: 1, period: "round" } });
const ONCE = stubSupport({ id: "once", cost: 0, abilities: [ONCE_CONSTANT.ref] });
/** "Response: After you play an ally, draw 1 card." Costs 1. */
const CHEER_RESPONSE = stubAbility("cheer.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "cardPlayed", playerIs: "controller", targetIs: { categories: ["ally"] } },
  },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
const CHEER = stubEvent({ id: "cheer", cost: 1, abilities: [CHEER_RESPONSE.ref] });
/** "Play a card from your hand." */
const GATHER_ACTION = stubAbility("gather.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "playFromHand", player: { kind: "controller" } }],
});
const GATHER = stubEvent({ id: "gather", cost: 0, abilities: [GATHER_ACTION.ref] });

const deps: EngineDeps = depsOf(
  PLAN_CONSTANT,
  CHEAP_CONSTANT,
  OPEN_CONSTANT,
  ONCE_CONSTANT,
  SCRAP_ACTION,
  CHEER_RESPONSE,
  GATHER_ACTION,
);
const HOSTS = [PLAN, CHEAP, SHELF, OPEN, ONCE];
const CARDS = [...HOSTS, SNARE, PAL, GOON, SCRAP, CHEER, GATHER];

interface Table {
  readonly state: GameState;
  readonly host: InstanceId;
  readonly tucked: InstanceId;
  readonly goon: InstanceId;
  readonly resource: InstanceId;
  /** The cards `also` tucked after the first, in order. */
  readonly more: readonly InstanceId[];
  /** The cards `hand` put in the hand besides the resource card, in order. */
  readonly hand: readonly InstanceId[];
}

/**
 * p1 in hero form with `host` in play, `card` (then `also`) tucked under it, a goon engaged, and one resource card
 * and `hand` in hand.
 */
function table(
  opts: { host?: CardId; card?: CardId; also?: readonly CardId[]; hand?: readonly CardId[]; players?: 1 | 2 } = {},
): Table {
  const start = gameAtFirstTurn({
    cards: CARDS,
    deps,
    players: opts.players ?? 1,
    deck: [...HOSTS.map((c) => c.id), SNARE.id, CHEER.id, GATHER.id, SCRAP.id, ...copiesOf(PAL.id, 20)],
    encounter: [...copiesOf(TREACHERY.id, 28), GOON.id],
  });
  // Test surgery: an empty hand, then exactly one resource card.
  let state: GameState = {
    ...start,
    players: start.players.map((p) => ({
      ...p,
      identity: { ...p.identity, form: "hero" },
      hand: [],
      deck: [...p.hand, ...p.deck],
    })),
  };
  const resource = giveCard(state, P1, RESOURCE.id);
  state = resource.state;
  const host = playerCardIntoPlay(state, opts.host ?? PLAN.id);
  const goon = minionEngagedWith(host.state, GOON.id);
  state = goon.state;
  const under: InstanceId[] = [];
  for (const card of [opts.card ?? SNARE.id, ...(opts.also ?? [])]) {
    const given = giveCard(state, P1, card, under);
    state = given.state;
    under.push(given.id);
  }
  const hand: InstanceId[] = [];
  for (const card of opts.hand ?? []) {
    const given = giveCard(state, P1, card, [...under, ...hand]);
    state = given.state;
    hand.push(given.id);
  }
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, hand: p.hand.filter((id) => !under.includes(id)) })),
    instances: { ...state.instances, [host.id]: { ...mustInstance(state, host.id), tucked: under } },
  };
  const [tucked, ...more] = under;
  return { state, host: host.id, tucked: tucked!, goon: goon.id, resource: resource.id, more, hand };
}

/** p1 plays the tucked card onto the goon, paying with the resource card. */
const playTucked = (t: Table): Command & { readonly type: "playCard" } => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: t.tucked,
  payment: [{ fromHand: t.resource }],
  attachToInstanceId: t.goon,
});

/** p1 plays a card that costs nothing and attaches to nothing (an ally, an event). */
const playFromHandCommand = (id: InstanceId): Command => ({
  type: "playCard",
  playerId: P1,
  cardInstanceId: id,
  payment: [],
  attachToInstanceId: null,
});

/** Picks the first option naming one of `ids` in a trigger or card choice, pays with all offered, else the default. */
const picking =
  (ids: readonly InstanceId[]) =>
  (state: GameState): readonly string[] => {
    const choice = state.pendingChoice!;
    const kind = choice.prompt.kind;
    const named = choice.options.filter((o) => "instanceId" in o.ref && ids.includes(o.ref.instanceId as InstanceId));
    if ((kind === "chooseTriggers" || kind === "chooseCards") && named[0]) return [named[0].optionId];
    if (kind === "spendResources" || kind === "payForCard") return choice.options.map((o) => o.optionId);
    return defaultPick(state);
  };

const offered = (state: GameState, id: InstanceId, player = P1) => {
  const actions = legalActions(state, player, deps);
  const legal = "legal" in actions ? actions.legal : [];
  return legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === id);
};

describe("§3.8 playing a card tucked under a card as if it were in your hand", () => {
  it("offers the tucked upgrade as a hand card, plays it onto a minion, and it leaves the tuck; replay deep-equal", () => {
    const t = table();
    const action = offered(t.state, t.tucked);
    expect(action?.action).toEqual({ kind: "playCard", instanceId: t.tucked, from: "tucked" });
    expect(action?.targets).toContain(t.goon);
    const command = playTucked(t);
    const { session, events } = driveSession(startSession(t.state), deps, [command]);
    const state = session.state;
    expect(mustInstance(state, t.goon).attachments).toContain(t.tucked);
    expect(mustInstance(state, t.host).tucked).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(t.resource);
    expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === t.tucked)).toMatchObject({
      from: "tucked",
      countsAsFrom: "hand",
      resourcesPaid: 1,
    });
    // Nothing is left under the host, so nothing more is offered.
    expect(asIfInHandPermissions(state, deps, P1)).toEqual([]);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("control: with the host discarded, the tuck goes with it and nothing is offered", () => {
    const t = table();
    const scrap = giveCard(t.state, P1, SCRAP.id);
    const scrapped = runCommands(scrap.state, deps, {
      type: "playCard",
      playerId: P1,
      cardInstanceId: scrap.id,
      payment: [],
      attachToInstanceId: null,
    }).state;
    expect(mustPlayer(scrapped, P1).discard).toEqual(expect.arrayContaining([t.host, t.tucked]));
    expect(offered(scrapped, t.tucked)).toBeUndefined();
    const result = applyCommand(scrapped, playTucked({ ...t, state: scrapped }), deps);
    expect(!result.ok && result.error.code).toBe("card_not_in_zone");
  });

  it("control: a card tucked under a card with no permission is not offered and cannot be played", () => {
    const t = table({ host: SHELF.id });
    expect(asIfInHandPermissions(t.state, deps, P1)).toEqual([]);
    expect(offered(t.state, t.tucked)).toBeUndefined();
    const result = applyCommand(t.state, playTucked(t), deps);
    expect(!result.ok && result.error.code).toBe("card_not_in_zone");
  });

  it("control: a tucked card the permission's `cards` does not match is not offered", () => {
    const t = table({ card: PAL.id });
    expect(asIfInHandPermissions(t.state, deps, P1)).toEqual([]);
    expect(offered(t.state, t.tucked)).toBeUndefined();
  });

  it("the permission serves only the players it names: another player is not offered the card", () => {
    const t = table({ players: 2 });
    expect(asIfInHandPermissions(t.state, deps, P1).map((p) => p.instanceId)).toEqual([t.tucked]);
    expect(asIfInHandPermissions(t.state, deps, P2)).toEqual([]);
  });

  it("the permission's cost reduction comes off the play's cost, its card named as the source", () => {
    const t = table({ host: CHEAP.id });
    expect(playCostOf(t.state, P1, t.tucked, deps, t.goon)).toMatchObject({
      printed: 1,
      current: 0,
      contributions: [{ sourceInstanceId: t.host, delta: -1 }],
    });
    const { state } = runCommands(t.state, deps, { ...playTucked(t), payment: [] });
    expect(mustInstance(state, t.goon).attachments).toContain(t.tucked);
    expect(mustPlayer(state, P1).hand).toContain(t.resource);
  });

  it("a tucked Response event is offered in its window, priced less the permission's reduction, and logged as tucked", () => {
    const t = table({ host: OPEN.id, card: CHEER.id, hand: [PAL.id] });
    const pal = t.hand[0]!;
    const { session, events } = driveSession(
      startSession(t.state),
      deps,
      [playFromHandCommand(pal)],
      picking([t.tucked]),
    );
    const state = session.state;
    expect(events.filter((e) => e.type === "cardPlayed").map((e) => e.type === "cardPlayed" && e.instanceId)).toEqual([
      pal,
      t.tucked,
    ]);
    expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === t.tucked)).toMatchObject({
      from: "tucked",
      countsAsFrom: "hand",
      resourcesPaid: 0,
    });
    expect(mustInstance(state, t.host).tucked).toEqual([]);
    expect(mustPlayer(state, P1).discard).toContain(t.tucked);
    // Its response drew a card; the resource card was not needed (cost 1, less 1).
    expect(mustPlayer(state, P1).hand).toHaveLength(2);
    expect(mustPlayer(state, P1).hand).toContain(t.resource);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("control: the same event tucked under a card with no permission is not offered in the window", () => {
    const t = table({ host: SHELF.id, card: CHEER.id, hand: [PAL.id] });
    const asked: string[] = [];
    const pick = (state: GameState) => {
      asked.push(state.pendingChoice!.prompt.kind);
      return picking([t.tucked])(state);
    };
    const { session, events } = driveSession(startSession(t.state), deps, [playFromHandCommand(t.hand[0]!)], pick);
    expect(asked).not.toContain("chooseTriggers");
    expect(events.some((e) => e.type === "cardPlayed" && e.instanceId === t.tucked)).toBe(false);
    expect(mustInstance(session.state, t.host).tucked).toEqual([t.tucked]);
  });

  it("'play a card from your hand' (EffectSpec playFromHand) offers the tucked card and plays it from the tuck", () => {
    const t = table({ hand: [GATHER.id] });
    const asking = applyCommand(t.state, playFromHandCommand(t.hand[0]!), deps);
    if (!asking.ok) throw new Error(asking.error.message);
    expect(asking.state.pendingChoice?.prompt).toEqual({ kind: "chooseCards", slot: "playFromHand" });
    expect(asking.state.pendingChoice?.options.map((option) => option.ref)).toEqual([
      { kind: "card", instanceId: t.tucked },
    ]);
    const { session, events } = driveSession(
      startSession(t.state),
      deps,
      [playFromHandCommand(t.hand[0]!)],
      picking([t.tucked]),
    );
    expect(mustInstance(session.state, t.goon).attachments).toContain(t.tucked);
    expect(mustInstance(session.state, t.host).tucked).toEqual([]);
    expect(events.find((e) => e.type === "cardPlayed" && e.instanceId === t.tucked)).toMatchObject({
      from: "tucked",
      countsAsFrom: "hand",
      resourcesPaid: 1,
    });
  });

  it("with a limit, a second tucked card is listed illegal with limit_reached, refused, and excluded with a reason", () => {
    const t = table({ host: ONCE.id, card: PAL.id, also: [PAL.id], hand: [GATHER.id, PAL.id] });
    const second = t.more[0]!;
    const first = runCommands(t.state, deps, playFromHandCommand(t.tucked)).state;
    expect(mustPlayer(first, P1).playArea).toContain(t.tucked);
    expect(asIfInHandPermissions(first, deps, P1)).toMatchObject([{ instanceId: second, limitUsed: true }]);
    expect(offered(first, second)).toBeUndefined();
    const actions = legalActions(first, P1, deps);
    const illegal = "illegal" in actions ? actions.illegal : [];
    expect(illegal.find((a) => a.action.kind === "playCard" && a.action.instanceId === second)).toMatchObject({
      action: { kind: "playCard", instanceId: second, from: "tucked" },
      reason: "limit_reached",
      message: "you have already played a card tucked there this round",
    });
    const refused = applyCommand(first, playFromHandCommand(second), deps);
    expect(refused.ok ? null : refused.error.code).toBe("limit_reached");
    // "Play a card from your hand" offers the hand's ally only, and says why the tucked one is missing.
    const asking = applyCommand(first, playFromHandCommand(t.hand[0]!), deps);
    if (!asking.ok) throw new Error(asking.error.message);
    expect(asking.state.pendingChoice?.options.map((option) => option.ref)).toEqual([
      { kind: "card", instanceId: t.hand[1] },
    ]);
    expect(choiceExclusions(asking.state, deps)).toEqual([{ instanceId: second, reason: "deckTopPlayLimitUsed" }]);
  });
});
