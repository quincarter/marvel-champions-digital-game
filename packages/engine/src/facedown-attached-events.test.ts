/**
 * docs/phase7-wave5.md §3.15: facedown attached cards — playable events, a count, a maximum. Synthetic cards shaped like
 * George Stacy (`sm` 27018: "Events attached to George Stacy may be played as if they were in your hand. Action: Exhaust
 * George Stacy → attach 1 event from your hand facedown here (to a maximum of 3)") and Spider-Man Noir ("X is equal to
 * the number of facedown cards attached").
 *
 * Sources: ruling Mar 30, 2026 (1) (George Stacy's "to a maximum of 3" is local to the ability); RRG 1.8 "Facedown".
 *
 * Also: an attached Response event is offered in its timing window as one in hand is (Jocasta's "You may play the event
 * attached to Jocasta as if it were in your hand", whose events are all Defense Interrupts/Responses). RRG 1.8 "Play
 * Restrictions and Permissions" (p. 33), "Event" (p. 18), "Response" (p. 38).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef, ValueSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEvent, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";
import { faceVisible } from "./visibility.js";

const self: TargetRef = { kind: "self" };
const attachedFacedown: ValueSpec = { kind: "count", query: { host: self, facedown: true } };

const STACY_CONSTANT = stubAbility("stacy.constant", {
  trigger: { kind: "constant", playableAttachments: { categories: ["event"] } },
  effects: [],
});
// "Attach 1 event from your hand facedown here (to a maximum of 3)": the maximum as an `if` on the count.
const STACY_ACTION = stubAbility("stacy.action", {
  trigger: { kind: "action" },
  effects: [
    {
      kind: "if",
      condition: { kind: "compare", left: attachedFacedown, op: "atMost", right: { kind: "const", value: 2 } },
      then: [
        {
          kind: "chooseCards",
          slot: "event",
          from: { kind: "zone", zone: "hand", player: { kind: "controller" }, filter: { categories: ["event"] } },
          chooser: { kind: "controller" },
          min: 1,
          max: 1,
        },
        { kind: "attach", card: { kind: "slot", slot: "event" }, to: self, facedown: true },
      ],
    },
    { kind: "setVar", name: "attached", value: attachedFacedown },
    { kind: "addCounters", target: self, counterType: "seen", amount: { kind: "var", name: "attached" } },
  ],
});
const STACY = stubSupport({ id: "stacy", cost: 0, abilities: [STACY_CONSTANT.ref, STACY_ACTION.ref] });

const ZAP_ACTION = stubAbility("zap.action", {
  trigger: { kind: "action" },
  effects: [{ kind: "dealDamage", target: { kind: "villain" }, amount: { kind: "const", value: 2 } }] as EffectSpec[],
});
const ZAP = stubEvent({ id: "zap", cost: 0, resources: 1, abilities: [ZAP_ACTION.ref] });

// "Response: After you play an event, …": answers ZAP's resolution (an event, not Stacy's own action).
const BRACE_RESPONSE = stubAbility("brace.response", {
  trigger: {
    kind: "response",
    forced: false,
    on: { on: "abilityResolved", playerIs: "controller", sourceIs: { categories: ["event"] } },
  },
  effects: [
    {
      kind: "addCounters",
      target: { kind: "identityOf", player: { kind: "controller" } },
      counterType: "braced",
      amount: { kind: "const", value: 1 },
    },
  ] as EffectSpec[],
});
const BRACE = stubEvent({ id: "brace", cost: 1, abilities: [BRACE_RESPONSE.ref] });

const deps: EngineDeps = depsOf(STACY_CONSTANT, STACY_ACTION, ZAP_ACTION, BRACE_RESPONSE);

function start(extraDeck: readonly CardId[] = []): { readonly state: GameState; readonly stacy: string } {
  const state = gameAtFirstTurn({
    cards: [STACY, ZAP, BRACE],
    deps,
    deck: [STACY.id, ...copiesOf(ZAP.id, 5), ...extraDeck],
  });
  const placed = playerCardIntoPlay(state, STACY.id);
  return { state: placed.state, stacy: placed.id };
}

function useStacy(state: GameState, stacy: string) {
  let s = giveCard(state, P1, ZAP.id).state;
  // Ready it between uses (test surgery): the exhaust cost is not what is under test.
  s = { ...s, instances: { ...s.instances, [stacy]: { ...mustInstance(s, stacy as never), exhausted: false } } };
  return driveSession(startSession(s), deps, [
    { type: "useAbility", playerId: P1, cardInstanceId: stacy as never, abilityId: STACY_ACTION.ref.id, payment: [] },
  ]);
}

const villainDamage = (state: GameState) => mustInstance(state, state.villains[0]!.instanceId).damage;

describe("§3.15 events attached facedown, played as if from hand", () => {
  it("an event attached facedown is counted, then played faceup from there and resolves; replay deep-equal", () => {
    const { state, stacy } = start();
    const used = useStacy(state, stacy).session.state;
    const host = mustInstance(used, stacy as never);
    expect(host.attachments).toHaveLength(1);
    const [zap] = host.attachments;
    expect(mustInstance(used, zap!).facedownAs).not.toBeNull();
    // Its owner may look at it (table-wide today).
    expect(faceVisible(used, zap!)).toBe(true);
    expect(host.counters["seen"]).toBe(1);
    const { session } = driveSession(startSession(used), deps, [
      { type: "playCard", playerId: P1, cardInstanceId: zap!, payment: [], attachToInstanceId: null },
    ]);
    const played = session.state;
    expect(villainDamage(played)).toBe(villainDamage(used) + 2);
    expect(mustPlayer(played, P1).discard).toContain(zap);
    expect(mustInstance(played, zap!)).toMatchObject({ facedownAs: null, faceup: true });
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("'to a maximum of 3': a fourth use attaches nothing", () => {
    let { state } = start();
    const { stacy } = start();
    for (let i = 0; i < 4; i++) state = useStacy(state, stacy).session.state;
    expect(mustInstance(state, stacy as never).attachments).toHaveLength(3);
  });
});

describe("an attached Interrupt/Response event is offered in its window, as from hand", () => {
  it("offers the attached response, prices it as from hand, and plays it off its host; replay deep-equal", () => {
    const { state, stacy } = start([BRACE.id]);
    const given = giveCard(state, P1, BRACE.id);
    const brace = given.id;
    // Attach Brace (not a Zap) with Stacy's action: the test picks it from hand.
    const attached = driveSession(
      startSession(given.state),
      deps,
      [
        {
          type: "useAbility",
          playerId: P1,
          cardInstanceId: stacy as never,
          abilityId: STACY_ACTION.ref.id,
          payment: [],
        },
      ],
      (s) => {
        const options = s.pendingChoice?.options.map((o) => o.optionId) ?? [];
        return options.includes(brace) ? [brace] : defaultPick(s);
      },
    ).session.state;
    expect(mustInstance(attached, brace).attachedTo).toBe(stacy);
    expect(mustInstance(attached, brace).facedownAs).not.toBeNull();
    // Zap to play, and one more card in hand to pay Brace's cost of 1 with.
    const withZap = giveCard(attached, P1, ZAP.id);
    const zap = withZap.id;
    const payer = giveCard(withZap.state, P1, ZAP.id, [zap]);
    const offered: string[][] = [];
    const { session, events } = driveSession(
      startSession(payer.state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: zap, payment: [], attachToInstanceId: null }],
      (s) => {
        const choice = s.pendingChoice;
        if (choice?.prompt.kind === "chooseTriggers") {
          offered.push(choice.options.map((o) => o.optionId));
          return choice.options
            .filter((o) => o.optionId === `${brace}:${BRACE_RESPONSE.ref.id}`)
            .map((o) => o.optionId);
        }
        if (choice?.prompt.kind === "payForCard") return [`hand:${payer.id}`];
        return defaultPick(s);
      },
    );
    const played = session.state;
    expect(offered.flat()).toContain(`${brace}:${BRACE_RESPONSE.ref.id}`);
    const identity = mustInstance(played, mustPlayer(played, P1).identity.instanceId);
    expect(identity.counters["braced"]).toBe(1);
    // Paid as from hand: the payment card was discarded; the played event left its host for the discard pile, faceup.
    expect(mustPlayer(played, P1).discard).toEqual(expect.arrayContaining([brace, payer.id]));
    expect(mustInstance(played, stacy as never).attachments).not.toContain(brace);
    expect(mustInstance(played, brace)).toMatchObject({ attachedTo: null, facedownAs: null, faceup: true });
    expect(events).toContainEqual(expect.objectContaining({ type: "cardPlayed", instanceId: brace }));
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("an event attached to a host without the permission is not offered", () => {
    const { state } = start([BRACE.id]);
    const given = giveCard(state, P1, BRACE.id);
    const brace = given.id;
    // Test surgery: Brace attached to the identity, which prints no "as if it were in your hand" constant.
    const identityId = mustPlayer(given.state, P1).identity.instanceId;
    const owner = mustPlayer(given.state, P1);
    const surgery: GameState = {
      ...given.state,
      players: given.state.players.map((p) =>
        p.playerId === P1 ? { ...owner, hand: owner.hand.filter((i) => i !== brace) } : p,
      ),
      instances: {
        ...given.state.instances,
        [brace]: { ...mustInstance(given.state, brace), attachedTo: identityId },
        [identityId]: {
          ...mustInstance(given.state, identityId),
          attachments: [...mustInstance(given.state, identityId).attachments, brace],
        },
      },
    };
    const withZap = giveCard(surgery, P1, ZAP.id);
    const offered: string[] = [];
    driveSession(
      startSession(withZap.state),
      deps,
      [{ type: "playCard", playerId: P1, cardInstanceId: withZap.id, payment: [], attachToInstanceId: null }],
      (s) => {
        if (s.pendingChoice?.prompt.kind === "chooseTriggers")
          offered.push(...s.pendingChoice.options.map((o) => o.optionId));
        return defaultPick(s);
      },
    );
    expect(offered).not.toContain(`${brace}:${BRACE_RESPONSE.ref.id}`);
  });
});
