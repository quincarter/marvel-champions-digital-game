/**
 * docs/phase7-wave5.md §3.25: resources generated, as an event, and counters spent as resources. Synthetic cards shaped
 * like M.O.R.B.I.U.S. (`spdr` 31027, errata RRG 1.8 p. 68: "Forced Response: After the engaged player generates any
 * number of resources, deal an equal amount of damage to that player's hero.") and Spider-Ham's "Each toon counter on
 * Spider-Ham can be spent as if it were a [wild] resource." (`spiderham` 30001a), carried here by a support so the
 * stub hero stays the default one.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId, PlayerId } from "./ids.js";
import { paymentFor, tryPayment } from "./legal.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import { giveCard, RESOURCE } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, P2, playerCardIntoPlay } from "./testing/wave3.js";

const TOON = stubAbility("toons.toon-resource", {
  // Spent, not generated (docs/phase7-wave5.md §4.1 Q5).
  trigger: { kind: "resource", repeatable: true, spentAsIfResource: true },
  cost: { spendCounters: { counterType: "toon", amount: 1 } },
  generates: 1,
  effects: [],
});
const TOONS = stubSupport({ id: "toons", cost: 0, abilities: [TOON.ref] });

const ONCE = stubAbility("gadget.resource", {
  trigger: { kind: "resource" },
  cost: { spendCounters: { counterType: "charge", amount: 1 } },
  generates: 1,
  effects: [],
});
const GADGET = stubSupport({ id: "gadget", cost: 0, abilities: [ONCE.ref] });

const SIPHON = stubAbility("siphon.forced-response", {
  trigger: {
    kind: "response",
    forced: true,
    on: { on: "resourcesGenerated", playerIn: { kind: "engagedWith", of: { kind: "self" } } },
  },
  effects: [
    {
      kind: "dealDamage",
      target: { kind: "identityOf", player: { kind: "eventPlayer" } },
      amount: { kind: "eventAmount" },
    },
  ],
});
const SIPHON_MINION = stubMinion({ id: "siphon", atk: 1, sch: 1, hp: 5, abilities: [SIPHON.ref] });

const BLAST = stubAbility("big-event.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 1 } }],
});
const BIG_EVENT = stubEvent({ id: "big-event", cost: 3, abilities: [BLAST.ref] });

const deps: EngineDeps = depsOf(TOON, ONCE, SIPHON, BLAST);

function withCounters(state: GameState, id: InstanceId, counterType: string, n: number): GameState {
  const instance = mustInstance(state, id);
  return {
    ...state,
    instances: { ...state.instances, [id]: { ...instance, counters: { ...instance.counters, [counterType]: n } } },
  };
}

function start(opts: { readonly engagedWith?: PlayerId; readonly players?: 1 | 2; readonly toons?: number } = {}) {
  const base = gameAtFirstTurn({
    cards: [TOONS, GADGET, SIPHON_MINION, BIG_EVENT],
    deps,
    players: opts.players ?? 1,
    deck: [TOONS.id, GADGET.id, BIG_EVENT.id, ...copiesOf(RESOURCE.id, 3)],
    encounter: [SIPHON_MINION.id, ...copiesOf("treachery" as never, 10)],
  });
  const toons = playerCardIntoPlay(base, TOONS.id);
  const gadget = playerCardIntoPlay(toons.state, GADGET.id);
  let state = withCounters(gadget.state, toons.id, "toon", opts.toons ?? 2);
  state = withCounters(state, gadget.id, "charge", 2);
  if (opts.engagedWith) state = minionEngagedWith(state, SIPHON_MINION.id, opts.engagedWith).state;
  const event = giveCard(state, P1, BIG_EVENT.id);
  const res = giveCard(event.state, P1, RESOURCE.id);
  return { state: res.state, toons: toons.id, gadget: gadget.id, event: event.id, res: res.id };
}

const heroDamage = (state: GameState, player: PlayerId = P1) =>
  mustInstance(state, mustPlayer(state, player).identity.instanceId).damage;
const toonUse = (toons: InstanceId) => ({ ability: { instanceId: toons, abilityId: TOON.ref.id } });
/** The `resourcesGenerated` trigger events that resolved, in order. */
const generatedEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "resourcesGenerated" ? [e.event] : [],
  );

describe("§3.25 counters spent as resources (a repeatable resource ability)", () => {
  it("spends one counter per use, several uses in one payment; replay deep-equal", () => {
    const { state, toons, event, res } = start();
    const { session } = driveSession(startSession(state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), { fromHand: res }],
        attachToInstanceId: null,
      },
    ]);
    expect(mustInstance(session.state, toons).counters.toon ?? 0).toBe(0);
    expect(mustPlayer(session.state, P1).discard).toContain(event);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("offers one payment option per counter, and refuses a use with no counter left to pay for it", () => {
    const { state, toons, event, res } = start();
    const query = paymentFor(state, P1, { kind: "playCard", instanceId: event }, {}, deps);
    const ids = query?.sources.map((source) => source.optionId) ?? [];
    const base = `ability:${toons}:${TOON.ref.id}`;
    expect(ids).toContain(base);
    expect(ids).toContain(`${base}:2`);
    expect(ids).not.toContain(`${base}:3`);
    const attempt = tryPayment(
      state,
      P1,
      { kind: "playCard", instanceId: event },
      [base, `${base}:2`, `hand:${res}`],
      {},
      deps,
    );
    expect(attempt.ok).toBe(true);
    const tooMany = driveSession(startSession(state), deps);
    expect(() =>
      driveSession(tooMany.session, deps, [
        {
          type: "playCard",
          playerId: P1,
          cardInstanceId: event,
          payment: [toonUse(toons), toonUse(toons), toonUse(toons)],
          attachToInstanceId: null,
        },
      ]),
    ).toThrow(/cannot be used 3 times/);
  });

  it("a resource ability that is not repeatable is still used once per payment", () => {
    const { state, gadget, event, res } = start();
    const once = { ability: { instanceId: gadget, abilityId: ONCE.ref.id } };
    expect(() =>
      driveSession(startSession(state), deps, [
        {
          type: "playCard",
          playerId: P1,
          cardInstanceId: event,
          payment: [once, once, { fromHand: res }],
          attachToInstanceId: null,
        },
      ]),
    ).toThrow(/duplicate resource ability/);
  });
});

describe("§3.25 resources generated, an event (M.O.R.B.I.U.S.)", () => {
  it("counters spent as resources are not generated: a mixed payment's amount leaves them out (§4.1 Q5)", () => {
    const { state, toons, event, res } = start({ engagedWith: P1 });
    const { session } = driveSession(startSession(state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), { fromHand: res }],
        attachToInstanceId: null,
      },
    ]);
    // Two toon counters and a one-resource hand card: only the hand card was generated (RRG 1.8 "Cost", p. 13).
    expect(heroDamage(session.state)).toBe(heroDamage(state) + 1);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("counts overpaid resources: they were generated, then lost (RRG 1.8 'Cost', p. 13)", () => {
    const { state, toons, event, res } = start({ engagedWith: P1 });
    const more = giveCard(state, P1, RESOURCE.id, [res]);
    const { session } = driveSession(startSession(more.state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), { fromHand: res }, { fromHand: more.id }],
        attachToInstanceId: null,
      },
    ]);
    expect(heroDamage(session.state)).toBe(heroDamage(state) + 2);
  });

  it("a payment made only with counters raises no resourcesGenerated event (§4.1 Q5); replay deep-equal", () => {
    const { state, toons, event } = start({ engagedWith: P1, toons: 3 });
    const { session, events } = driveSession(startSession(state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), toonUse(toons)],
        attachToInstanceId: null,
      },
    ]);
    expect(mustPlayer(session.state, P1).discard).toContain(event);
    expect(mustInstance(session.state, toons).counters.toon ?? 0).toBe(0);
    expect(generatedEvents(events)).toEqual([]);
    expect(heroDamage(session.state)).toBe(heroDamage(state));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("another resource ability still generates: its uses count, the counters' do not (§4.1 Q5)", () => {
    const { state, toons, gadget, event } = start({ engagedWith: P1 });
    const { session, events } = driveSession(startSession(state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), { ability: { instanceId: gadget, abilityId: ONCE.ref.id } }],
        attachToInstanceId: null,
      },
    ]);
    expect(generatedEvents(events).map((e) => e.amount)).toEqual([1]);
    expect(heroDamage(session.state)).toBe(heroDamage(state) + 1);
  });

  it("does not trigger for a player the minion is not engaged with", () => {
    const { state, toons, event, res } = start({ engagedWith: P2, players: 2 });
    const { session } = driveSession(startSession(state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), { fromHand: res }],
        attachToInstanceId: null,
      },
    ]);
    expect(heroDamage(session.state, P1)).toBe(heroDamage(state, P1));
    expect(heroDamage(session.state, P2)).toBe(heroDamage(state, P2));
  });

  it("resolves before the card paid for, like the 'after you spend' windows (RRG 1.8 p. 24, steps 5-6)", () => {
    const { state, toons, event, res } = start({ engagedWith: P1 });
    const { events } = driveSession(startSession(state), deps, [
      {
        type: "playCard",
        playerId: P1,
        cardInstanceId: event,
        payment: [toonUse(toons), toonUse(toons), { fromHand: res }],
        attachToInstanceId: null,
      },
    ]);
    const hero = mustPlayer(state, P1).identity.instanceId;
    const villain = state.villains[0]!.instanceId;
    const damageTo = (id: InstanceId) => events.findIndex((e) => e.type === "damageDealt" && e.targetInstanceId === id);
    expect(damageTo(hero)).toBeGreaterThanOrEqual(0);
    expect(damageTo(villain)).toBeGreaterThan(damageTo(hero));
  });
});
