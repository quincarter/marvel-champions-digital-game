import { activeVillain } from "./query.js";
import { flat, type AnyCard, type CardId } from "@mc/content";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { Command, Payment } from "./commands.js";
import { applyCommand, replay, sessionApply, startSession, type GameSession } from "./engine.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import { countUsableAs, describeRequirement, paidWith, poolOf, requirementOf, satisfies } from "./resources.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubAlly,
  stubEvent,
  stubMainScheme,
  stubResource,
  stubSupport,
  stubUpgrade,
  stubVillain,
} from "./testing/fixtures.js";
import {
  ALLY,
  expectOk,
  giveCards,
  newGame,
  resolvePending,
  RESOURCE,
  runWith,
  settleUntil,
} from "./testing/scenario.js";

const p1 = playerId("p1");
const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(40), acceleration: flat(1) }],
});
const ENERGY = stubResource({ id: "energy", icons: 0, produces: { energy: 2 } });
const MENTAL = stubResource({ id: "mental", icons: 0, produces: { mental: 1 } });
const CHEAP = stubEvent({ id: "cheap", cost: 1 });

const copies = (id: CardId, n = 4): readonly CardId[] => Array.from({ length: n }, () => id);

/** A 1-player game whose deck holds a few copies of every card the test needs. */
function setup(cards: readonly AnyCard[], ...abilities: StubAbility[]) {
  const deps = depsOf(...abilities);
  const extra = [ENERGY, MENTAL, CHEAP, ...cards];
  const state = newGame({
    villain: VILLAIN,
    mainScheme: SCHEME,
    extraCards: extra,
    deck: [...extra.flatMap((card) => copies(card.id)), ...copies(RESOURCE.id, 8), ...copies(ALLY.id)],
    deps,
  });
  return { deps, state };
}

const play = (
  id: InstanceId,
  payment: readonly Payment[],
  extra: Partial<Extract<Command, { type: "playCard" }>> = {},
): Command => ({
  type: "playCard",
  playerId: p1,
  cardInstanceId: id,
  payment,
  attachToInstanceId: null,
  ...extra,
});
const hand = (...ids: InstanceId[]) => ids.map((fromHand) => ({ fromHand }));
const ability = (instanceId: InstanceId, abilityId: string) => ({
  ability: { instanceId, abilityId: abilityId as never },
});
const use = (
  instanceId: InstanceId,
  abilityId: string,
  payment: readonly unknown[] = [],
  costChoices?: Record<string, readonly InstanceId[]>,
): Command => ({
  type: "useAbility",
  playerId: p1,
  cardInstanceId: instanceId,
  abilityId: abilityId as never,
  payment: payment as never,
  ...(costChoices ? { costChoices } : {}),
});
const rejected = (deps: EngineDeps, state: GameState, command: Command): string => {
  const result = applyCommand(state, command, deps);
  if (result.ok) throw new Error("expected the command to be rejected");
  return result.error.code;
};
const def = (definition: AbilityDefinition) => definition;

describe("resource pools (RRG 'Cost', wild resources)", () => {
  it("fills typed slots first and lets wilds cover any typed shortfall", () => {
    expect(satisfies(poolOf({ energy: 1, mental: 1, physical: 1 }), { energy: 1, mental: 1, physical: 1 })).toBe(true);
    expect(satisfies(poolOf({ energy: 2, wild: 1 }), { energy: 1, mental: 1, physical: 1 })).toBe(false);
    expect(satisfies(poolOf({ energy: 1, wild: 2 }), { energy: 1, mental: 1, physical: 1 })).toBe(true);
    expect(satisfies(poolOf({ physical: 3 }), { physical: 3 })).toBe(true);
    expect(satisfies(poolOf({ physical: 2, mental: 1 }), { generic: 3 })).toBe(true);
    expect(satisfies(poolOf({ physical: 2 }), { physical: 1, generic: 2 })).toBe(false);
  });

  it("counts a wild as the type the payer declares", () => {
    expect(paidWith(poolOf({ wild: 1 }), "energy")).toBe(true);
    expect(paidWith(poolOf({ mental: 2 }), "energy")).toBe(false);
    expect(countUsableAs(poolOf({ energy: 2, wild: 1, mental: 3 }), "energy")).toBe(3);
  });
});

describe("typed costs and payment", () => {
  it("a 'spend a [energy] resource' cost rejects other types but accepts a wild", () => {
    const rechannel = stubAbility(
      "rechannel",
      def({
        trigger: { kind: "action" },
        cost: { resources: { energy: 1 } },
        effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
      }),
    );
    const station = stubSupport({ id: "station", cost: 0, abilities: [rechannel.ref] });
    const { deps, state } = setup([station], rechannel);
    const given = giveCards(state, p1, "station", "mental", "energy", RESOURCE.id);
    const [stationId, mentalId, energyId, wildId] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(stationId, []));

    expect(rejected(deps, inPlay, use(stationId, "rechannel", hand(mentalId)))).toBe("insufficient_resources");
    const paidEnergy = runWith(deps, inPlay, use(stationId, "rechannel", hand(energyId)));
    expect(mustPlayer(paidEnergy, p1).discard).toContain(energyId);
    const paidWild = runWith(deps, inPlay, use(stationId, "rechannel", hand(wildId)));
    expect(mustPlayer(paidWild, p1).discard).toContain(wildId);
  });

  it("'if you paid for this card using a [energy] resource' reads the payment (a wild counts)", () => {
    const blast = stubAbility(
      "photonic",
      def({
        trigger: { kind: "action" },
        effects: [
          {
            kind: "if",
            condition: { kind: "paidWith", resource: "energy" },
            then: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
          },
        ],
      }),
    );
    const event = stubEvent({ id: "photon", cost: 1, abilities: [blast.ref] });
    const { deps, state } = setup([event], blast);
    const given = giveCards(state, p1, "photon", "photon", "photon", "mental", "energy", RESOURCE.id);
    const [e1, e2, e3, mentalId, energyId, wildId] = given.ids as InstanceId[] as [
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
      InstanceId,
    ];
    const size = (s: GameState) => mustPlayer(s, p1).hand.length;

    const withMental = runWith(deps, given.state, play(e1, hand(mentalId)));
    expect(size(withMental)).toBe(size(given.state) - 2);
    const withEnergy = runWith(deps, withMental, play(e2, hand(energyId)));
    expect(size(withEnergy)).toBe(size(withMental) - 2 + 1);
    const withWild = runWith(deps, withEnergy, play(e3, hand(wildId)));
    expect(size(withWild)).toBe(size(withEnergy) - 2 + 1);
  });

  it("The Power of X doubles its resources only while paying for a card of that aspect", () => {
    const doubling = stubAbility(
      "power-doubling",
      def({
        trigger: {
          kind: "constant",
          modifiers: [],
          resourceMultiplier: { factor: 2, whilePayingFor: { aspect: "aggression" } },
        },
        effects: [],
      }),
    );
    const power = stubResource({ id: "power", icons: 1, abilities: [doubling.ref] });
    const aggro = stubEvent({ id: "aggro", cost: 2, aspect: "aggression" });
    const basic = stubEvent({ id: "plain", cost: 2 });
    const { deps, state } = setup([power, aggro, basic], doubling);
    const given = giveCards(state, p1, "aggro", "plain", "power");
    const [aggroId, plainId, powerId] = given.ids as [InstanceId, InstanceId, InstanceId];

    expect(rejected(deps, given.state, play(plainId, hand(powerId)))).toBe("insufficient_resources");
    const played = runWith(deps, given.state, play(aggroId, hand(powerId)));
    expect(mustPlayer(played, p1).discard).toEqual(expect.arrayContaining([aggroId, powerId]));
  });

  it("a typed resource ability respects its limit and logs the typed pool", () => {
    const scientist = stubAbility(
      "scientist",
      def({
        trigger: { kind: "resource" },
        limit: { count: 1, period: "round" },
        generates: { mental: 1 },
        effects: [],
      }),
    );
    const desk = stubSupport({ id: "desk", cost: 0, abilities: [scientist.ref] });
    const { deps, state } = setup([desk], scientist);
    const given = giveCards(state, p1, "desk", "cheap", "cheap");
    const [deskId, c1, c2] = given.ids as [InstanceId, InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(deskId, []));

    const result = applyCommand(inPlay, play(c1, [ability(deskId, "scientist")] as never), deps);
    const after = expectOk(result);
    expect(result.ok && result.events.find((e) => e.type === "resourcesGenerated")).toMatchObject({
      pool: { mental: 1, physical: 0, energy: 0, wild: 0 },
    });
    expect(rejected(deps, after, play(c2, [ability(deskId, "scientist")] as never))).toBe("limit_reached");
  });

  it("Pepper Potts copies the top card of the discard pile as it stands during the payment", () => {
    const pepper = stubAbility(
      "pepper",
      def({
        trigger: { kind: "resource" },
        cost: { exhaustSelf: true },
        generates: { kind: "topCardOfDiscard" },
        effects: [],
      }),
    );
    const potts = stubSupport({ id: "potts", cost: 0, abilities: [pepper.ref] });
    const pricey = stubEvent({ id: "pricey", cost: 4 });
    const { deps, state } = setup([potts, pricey], pepper);
    const given = giveCards(state, p1, "potts", "pricey", "energy");
    const [pottsId, priceyId, energyId] = given.ids as [InstanceId, InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(pottsId, []));

    // Pepper first: the discard pile is empty, so only the Energy card's 2 count.
    expect(rejected(deps, inPlay, play(priceyId, [ability(pottsId, "pepper"), ...hand(energyId)] as never))).toBe(
      "insufficient_resources",
    );
    // Energy first: it is now the top of the discard pile, so Pepper generates 2 more.
    const paid = runWith(deps, inPlay, play(priceyId, [...hand(energyId), ability(pottsId, "pepper")] as never));
    expect(mustInstance(paid, pottsId).exhausted).toBe(true);
  });

  it("a hero-form resource ability can't be used in alter-ego form", () => {
    const shooter = stubAbility(
      "web-shooter",
      def({ trigger: { kind: "resource", form: "hero" }, generates: { wild: 1 }, effects: [] }),
    );
    const gadget = stubSupport({ id: "gadget", cost: 0, abilities: [shooter.ref] });
    const { deps, state } = setup([gadget], shooter);
    const given = giveCards(state, p1, "gadget", "cheap");
    const [gadgetId, cheapId] = given.ids as [InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(gadgetId, []));
    expect(rejected(deps, inPlay, play(cheapId, [ability(gadgetId, "web-shooter")] as never))).toBe("wrong_form");
    const asHero = runWith(
      deps,
      inPlay,
      { type: "changeForm", playerId: p1 },
      play(cheapId, [ability(gadgetId, "web-shooter")] as never),
    );
    expect(mustPlayer(asHero, p1).discard).toContain(cheapId);
  });

  it("a 'Hero Action' event can't be played in alter-ego form", () => {
    const kick = stubAbility("kick", def({ trigger: { kind: "action", form: "hero" }, effects: [] }));
    const event = stubEvent({ id: "kick", cost: 0, abilities: [kick.ref] });
    const { deps, state } = setup([event], kick);
    const given = giveCards(state, p1, "kick");
    expect(rejected(deps, given.state, play(given.ids[0] as InstanceId, []))).toBe("wrong_form");
  });
});

describe("cost reduction as a lasting effect (Helicarrier)", () => {
  const carrierAbility = stubAbility(
    "carrier",
    def({
      trigger: { kind: "action" },
      cost: { exhaustSelf: true },
      effects: [
        {
          kind: "reduceNextCardCost",
          player: { kind: "controller" },
          amount: { kind: "const", value: 1 },
          duration: "phase",
        },
      ],
    }),
  );
  const carrier = stubSupport({ id: "carrier", cost: 0, abilities: [carrierAbility.ref] });

  it("reduces only the next card played, then is used up", () => {
    const { deps, state } = setup([carrier], carrierAbility);
    const given = giveCards(state, p1, "carrier", "cheap", "cheap");
    const [carrierId, c1, c2] = given.ids as [InstanceId, InstanceId, InstanceId];
    const reduced = runWith(deps, given.state, play(carrierId, []), use(carrierId, "carrier"));
    expect(reduced.lastingEffects).toEqual([
      { id: "l1", kind: "costReduction", playerId: p1, amount: 1, duration: { kind: "endOfPhase" } },
    ]);
    const first = runWith(deps, reduced, play(c1, []));
    expect(first.lastingEffects).toEqual([]);
    expect(rejected(deps, first, play(c2, []))).toBe("insufficient_resources");
  });

  it("expires at the end of the phase if unused", () => {
    const { deps, state } = setup([carrier], carrierAbility);
    const given = giveCards(state, p1, "carrier");
    const reduced = runWith(
      deps,
      given.state,
      play(given.ids[0] as InstanceId, []),
      use(given.ids[0] as InstanceId, "carrier"),
    );
    expect(reduced.lastingEffects).toHaveLength(1);
    // Alter-ego form: the villain schemes, so this settles straight into round 2's player turn.
    const next = settleUntil(runWith(deps, reduced, { type: "endTurn", playerId: p1 }), "declareDefender", deps);
    expect(next.round).toBe(2);
    expect(next.lastingEffects).toEqual([]);
  });
});

describe("non-resource cost components", () => {
  it("'choose and discard up to N cards' binds the count; 'up to' needs at least one (RRG 'Cost')", () => {
    const practice = stubAbility(
      "practice",
      def({
        trigger: { kind: "action" },
        cost: { discardFromHand: { min: 1, max: 5, bind: "discarded" } },
        effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "var", name: "discarded" } }],
      }),
    );
    const event = stubEvent({ id: "practice", cost: 0, abilities: [practice.ref] });
    const { deps, state } = setup([event], practice);
    const given = giveCards(state, p1, "practice", "cheap", "cheap");
    const [eventId, a, b] = given.ids as [InstanceId, InstanceId, InstanceId];

    expect(rejected(deps, given.state, play(eventId, [], { costChoices: { discard: [] } }))).toBe("invalid_choice");
    expect(rejected(deps, given.state, play(eventId, [], { costChoices: { discard: [eventId] } }))).toBe(
      "card_not_in_zone",
    );
    const before = mustPlayer(given.state, p1).hand.length;
    const after = runWith(deps, given.state, play(eventId, [], { costChoices: { discard: [a, b] } }));
    expect(mustPlayer(after, p1).discard).toEqual(expect.arrayContaining([a, b, eventId]));
    expect(mustPlayer(after, p1).hand.length).toBe(before - 3 + 2);
  });

  it("'Spend X [energy]' binds X, and a discard-self cost snapshots the card's counters", () => {
    const charge = stubAbility(
      "channel-charge",
      def({
        trigger: { kind: "action" },
        cost: { resourcesX: { resource: "energy", bind: "x", min: 1 } },
        effects: [
          { kind: "addCounters", target: { kind: "self" }, counterType: "energy", amount: { kind: "var", name: "x" } },
        ],
      }),
    );
    const release = stubAbility(
      "channel-release",
      def({
        trigger: { kind: "action" },
        cost: { discardSelf: true },
        effects: [
          { kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "var", name: "self.counters.energy" } },
        ],
      }),
    );
    const channel = stubUpgrade({ id: "channel", cost: 0, abilities: [charge.ref, release.ref] });
    const { deps, state } = setup([channel], charge, release);
    const given = giveCards(state, p1, "channel", "energy", "mental");
    const [channelId, energyId, mentalId] = given.ids as [InstanceId, InstanceId, InstanceId];
    const inPlay = runWith(deps, given.state, play(channelId, []));

    expect(rejected(deps, inPlay, use(channelId, "channel-charge", hand(mentalId)))).toBe("insufficient_resources");
    const charged = runWith(deps, inPlay, use(channelId, "channel-charge", hand(energyId)));
    expect(mustInstance(charged, channelId).counters.energy).toBe(2);
    const released = runWith(deps, charged, use(channelId, "channel-release"));
    expect(mustInstance(released, activeVillain(released).instanceId).damage).toBe(2);
    expect(mustPlayer(released, p1).discard).toContain(channelId);
  });

  it("'Pay the printed cost of an ally in any player's discard pile' (Make the Call)", () => {
    const call = stubAbility(
      "make-the-call",
      def({
        trigger: { kind: "action" },
        cost: {
          payPrintedCostOf: { slot: "ally", from: { zone: "discard", player: "any", query: { categories: ["ally"] } } },
        },
        effects: [{ kind: "putIntoPlay", card: { kind: "slot", slot: "ally" }, controller: { kind: "controller" } }],
      }),
    );
    const event = stubEvent({ id: "call", cost: 0, abilities: [call.ref] });
    const { deps, state } = setup([event], call);
    const given = giveCards(state, p1, "call", ALLY.id, "cheap", RESOURCE.id, RESOURCE.id);
    const [callId, allyId, cheapId, r1, r2] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId, InstanceId];
    // Put the ally in the discard pile by spending it as a resource.
    const allyDiscarded = runWith(deps, given.state, play(cheapId, hand(allyId)));

    expect(rejected(deps, allyDiscarded, play(callId, hand(r1), { costChoices: { ally: [allyId] } }))).toBe(
      "insufficient_resources",
    );
    expect(rejected(deps, allyDiscarded, play(callId, hand(r1, r2), { costChoices: { ally: [cheapId] } }))).toBe(
      "no_valid_target",
    );
    const called = runWith(deps, allyDiscarded, play(callId, hand(r1, r2), { costChoices: { ally: [allyId] } }));
    expect(mustPlayer(called, p1).playArea).toContain(allyId);
  });
});

describe("paying for optional triggered abilities in a window", () => {
  const widowAbility = stubAbility(
    "widow",
    def({
      trigger: { kind: "response", forced: false, on: { on: "playerPhaseEnded" } },
      cost: { exhaustSelf: true, resources: { mental: 1 } },
      effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
    }),
  );
  const widow = stubAlly({ id: "widow", cost: 0, atk: 1, thw: 1, hp: 3, abilities: [widowAbility.ref] });

  function atPayment() {
    const { deps, state } = setup([widow], widowAbility);
    const given = giveCards(state, p1, "widow", "mental");
    const [widowId, mentalId] = given.ids as [InstanceId, InstanceId];
    const ended = runWith(deps, given.state, play(widowId, []), { type: "endTurn", playerId: p1 });
    const offered = settleUntil(ended, "chooseTriggers", deps);
    expect(offered.pendingChoice?.options.map((o) => o.optionId)).toEqual([`${widowId}:widow`]);
    const paying = resolvePending(offered, [`${widowId}:widow`], deps);
    expect(paying.pendingChoice?.prompt).toEqual({
      kind: "payForAbility",
      instanceId: widowId,
      abilityId: "widow",
      cost: 1,
    });
    return { deps, paying, widowId, mentalId };
  }

  it("the controller pays the resource and the cost's exhaust, then the ability resolves", () => {
    const { deps, paying, widowId, mentalId } = atPayment();
    const paid = resolvePending(paying, [`hand:${mentalId}`], deps);
    expect(mustPlayer(paid, p1).discard).toContain(mentalId);
    expect(mustInstance(paid, widowId).exhausted).toBe(true);
  });

  it("paying nothing declines, and nothing is paid", () => {
    const { deps, paying, widowId, mentalId } = atPayment();
    const declined = resolvePending(paying, [], deps);
    expect(mustPlayer(declined, p1).hand).toContain(mentalId);
    expect(mustInstance(declined, widowId).exhausted).toBe(false);
  });
});

test("typed payments, cost choices and lasting effects replay to an identical state", () => {
  const carrierAbility = stubAbility(
    "carrier",
    def({
      trigger: { kind: "action" },
      cost: { exhaustSelf: true },
      effects: [
        {
          kind: "reduceNextCardCost",
          player: { kind: "controller" },
          amount: { kind: "const", value: 1 },
          duration: "phase",
        },
      ],
    }),
  );
  const carrier = stubSupport({ id: "carrier", cost: 0, abilities: [carrierAbility.ref] });
  const { deps, state } = setup([carrier], carrierAbility);
  const given = giveCards(state, p1, "carrier", "cheap", "cheap", "energy");
  const [carrierId, c1, c2, energyId] = given.ids as [InstanceId, InstanceId, InstanceId, InstanceId];
  let session: GameSession = startSession(given.state);
  for (const command of [
    play(carrierId, []),
    use(carrierId, "carrier"),
    play(c1, []),
    play(c2, hand(energyId)),
    { type: "endTurn", playerId: p1 } as const,
  ]) {
    const result = sessionApply(session, command, deps);
    if (!result.ok) throw new Error(result.error.message);
    session = result.session;
  }
  const replayed = replay(session.log, deps);
  expect(replayed.ok && replayed.state).toEqual(session.state);
});

describe("describeRequirement: a refusal reads as a sentence, never as JSON", () => {
  it("names generic, typed and mixed requirements", () => {
    expect(describeRequirement(requirementOf(1))).toBe("1 resource");
    expect(describeRequirement(requirementOf(3))).toBe("3 resources");
    expect(describeRequirement(requirementOf({ physical: 1 }))).toBe("1 physical");
    expect(describeRequirement(requirementOf({ physical: 1, generic: 2 }))).toBe("1 physical and 2 of any type");
    expect(describeRequirement(requirementOf({ wild: 1, mental: 1, generic: 1 }))).toBe(
      "1 wild, 1 mental and 1 of any type",
    );
  });
});
