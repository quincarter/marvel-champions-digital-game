/**
 * QA of PR #122 (v0.20.0): "numbers each picked card in the order it will be discarded and tags the last one 'on top'".
 * The client promise (view/payment-model.ts `PaymentSourceView.onTop`): the last picked hand card "ends up on top of
 * your discard pile".
 *
 * Sources: RRG 1.8 "Discard" p. 16 (the player chooses the order of cards one effect discards from their hand);
 * RRG 1.8 "Event" p. 18 (an event card is discarded after its effect resolves, so it lands on its owner's discard pile
 * AFTER the cards that paid for it); FAQ "Pepper Potts (#33)" p. 57 (reads the top card of the discard pile).
 */
import { flat } from "@mc/content";
import type { Command, Payment } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMainScheme, stubResource, stubSupport, stubVillain } from "./testing/fixtures.js";
import { giveCards, newGame, runWith } from "./testing/scenario.js";

const p1 = playerId("p1");
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(1) }],
});
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const copies = <T>(x: T, n = 4): T[] => Array.from({ length: n }, () => x);

const hand = (...ids: InstanceId[]): Payment[] => ids.map((fromHand) => ({ fromHand }));
const play = (id: InstanceId, payment: readonly Payment[]): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
});

describe("payment discard order (#122)", () => {
  it("an event paid with two hand cards: the EVENT, not the last picked card, ends on top of the discard pile", () => {
    const event = stubEvent({ id: "two-cost-event", cost: 2 });
    const extra = [MENTAL, event];
    const state = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: extra,
      deck: [...extra.flatMap((c) => copies(c.id)), ...copies(MENTAL.id, 8)],
      deps: depsOf(),
    });
    const given = giveCards(state, p1, "two-cost-event", "mental", "mental");
    const [eventId, a, b] = given.ids as [InstanceId, InstanceId, InstanceId];
    const after = runWith(depsOf(), given.state, play(eventId, hand(a, b)));
    const discard = mustPlayer(after, p1).discard;
    // RRG "Event" p. 18: the event is discarded after it resolves, on top of the cards that paid for it.
    expect(discard.slice(0, 3)).toEqual([eventId, b, a]);
  });

  // The view model tags the last picked card "on top" for every play, events included. For an event that card ends one
  // below the event itself, so Pepper Potts (top card of the discard pile) reads the event, not the tagged card.
  it.fails("event play: the card the payment view tags 'on top' (last picked) is the top card of the discard pile", () => {
    const event = stubEvent({ id: "two-cost-event", cost: 2 });
    const extra = [MENTAL, event];
    const state = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: extra,
      deck: [...extra.flatMap((c) => copies(c.id)), ...copies(MENTAL.id, 8)],
      deps: depsOf(),
    });
    const given = giveCards(state, p1, "two-cost-event", "mental", "mental");
    const [eventId, a, b] = given.ids as [InstanceId, InstanceId, InstanceId];
    const after = runWith(depsOf(), given.state, play(eventId, hand(a, b)));
    expect(mustPlayer(after, p1).discard[0]).toBe(b);
  });

  it("an ability cost paid from hand discards in picked order, last on top", () => {
    const zap = stubAbility("zap", {
      trigger: { kind: "action" },
      cost: { resources: { mental: 2 } },
      effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
    } as never);
    const station = stubSupport({ id: "station", cost: 0, abilities: [zap.ref] });
    const extra = [MENTAL, station];
    const deps = depsOf(zap);
    const state = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: extra,
      deck: [...extra.flatMap((c) => copies(c.id)), ...copies(MENTAL.id, 8)],
      deps,
    });
    const given = giveCards(state, p1, "station", "mental", "mental");
    const [stationId, a, b] = given.ids as [InstanceId, InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(stationId, []));
    const useAbility = (payment: readonly Payment[]): Command =>
      ({
        type: "useAbility",
        playerId: p1,
        cardInstanceId: stationId,
        abilityId: "zap" as never,
        payment,
      }) as never;
    const ab = runWith(deps, inPlay, useAbility(hand(a, b)));
    expect(mustPlayer(ab, p1).discard.slice(0, 2)).toEqual([b, a]);
    const ba = runWith(deps, inPlay, useAbility(hand(b, a)));
    expect(mustPlayer(ba, p1).discard.slice(0, 2)).toEqual([a, b]);
  });

  it("a resource ability in play mixed with hand cards: only the hand cards are discarded, in picked order", () => {
    const brawn = stubAbility("brawn", {
      trigger: { kind: "resource" },
      generates: { mental: 1 },
      effects: [],
    } as never);
    const desk = stubSupport({ id: "desk", cost: 0, abilities: [brawn.ref] });
    const target = stubSupport({ id: "three-cost", cost: 3 });
    const extra = [MENTAL, desk, target];
    const deps = depsOf(brawn);
    const state = newGame({
      villain: VILLAIN,
      mainScheme: SCHEME,
      extraCards: extra,
      deck: [...extra.flatMap((c) => copies(c.id)), ...copies(MENTAL.id, 8)],
      deps,
    });
    const given = giveCards(state, p1, "desk", "three-cost", "mental", "mental");
    const [deskId, targetId, a, b] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const ready = runWith(deps, given.state, play(deskId, []));
    const payment = [{ ability: { instanceId: deskId, abilityId: "brawn" } }, ...hand(a, b)] as unknown as Payment[];
    const after = runWith(deps, ready, play(targetId, payment));
    const player = mustPlayer(after, p1);
    expect(player.discard.slice(0, 2)).toEqual([b, a]);
    expect(player.discard).not.toContain(deskId);
    expect(player.playArea).toContain(deskId);
  });
});
