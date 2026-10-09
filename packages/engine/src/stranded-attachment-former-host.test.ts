/**
 * `TriggerEvent cardLeavesPlay.strandedAttachments` (docs/phase7-wave8.md §3.61): a permanent player card attached to an
 * encounter card stays in play, unattached, when its host leaves (RRG 1.8 "Permanent", p. 32; "Attach To", p. 8), and
 * the leaving is still "attached [card] leaves play" to it. Synthetic cards shaped like "Permanent. Forced Response:
 * After attached enemy leaves play, set this card aside."
 *
 * The leaving card's snapshot lists the attachments that stay; `hostOfSelf` and `TargetRef host` read that event's card
 * as the host of each of them while it is unattached.
 */

import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { InstanceId } from "./ids.js";
import { mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, minionEngagedWith, P1, playerCardIntoPlay, playFree } from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });

// "Forced Response: After attached enemy leaves play, set this card aside."
const CHILL_RESPONSE = stubAbility("chill.forced-response", {
  trigger: { kind: "response", forced: true, on: { on: "cardLeavesPlay", targetIs: { hostOfSelf: true } } },
  effects: [{ kind: "moveCards", cards: { kind: "ref", ref: { kind: "self" } }, to: "setAside" }],
});
const CHILL = stubUpgrade({
  id: "chill",
  cost: 0,
  keywords: [{ name: "permanent" }],
  abilities: [CHILL_RESPONSE.ref],
});
// Permanent with no ability: it stays unattached in its controller's play area.
const BADGE = stubUpgrade({ id: "badge", cost: 0, keywords: [{ name: "permanent" }] });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });
const GOON = stubMinion({ id: "goon", atk: 1, sch: 1, hp: 3 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attach = (card: string, host: string) =>
  event(`attach-${card}-${host}`, [{ kind: "attach", card: named(card), to: named(host) }]);
const CHILL_ON_THUG = attach("chill", "thug");
const BADGE_ON_THUG = attach("badge", "thug");
const DEFEAT_THUG = event("defeat-thug", [{ kind: "defeat", target: named("thug") }]);
const DEFEAT_GOON = event("defeat-goon", [{ kind: "defeat", target: named("goon") }]);
const BOUNCE_THUG = event("bounce-thug", [
  { kind: "moveCards", cards: { kind: "ref", ref: named("thug") }, to: "encounterDeckShuffle" },
]);
const EVENTS = [CHILL_ON_THUG, BADGE_ON_THUG, DEFEAT_THUG, DEFEAT_GOON, BOUNCE_THUG];

const deps: EngineDeps = depsOf(CHILL_RESPONSE, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly chill: InstanceId;
  readonly badge: InstanceId;
  readonly thug: InstanceId;
}

function start(): Table {
  const state = gameAtFirstTurn({
    cards: [CHILL, BADGE, THUG, GOON, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 28), THUG.id, GOON.id],
    deck: [CHILL.id, BADGE.id, ...EVENTS.map((e) => e.card.id)],
  });
  const chill = playerCardIntoPlay(state, CHILL.id);
  const badge = playerCardIntoPlay(chill.state, BADGE.id);
  const thug = minionEngagedWith(badge.state, THUG.id);
  const goon = minionEngagedWith(thug.state, GOON.id);
  return { state: goon.state, chill: chill.id, badge: badge.id, thug: thug.id };
}

const play = (state: GameState, ...cards: readonly { readonly card: { readonly id: string } }[]) => {
  let run = { state, events: [] as ReturnType<typeof playFree>["events"][number][], session: null as never };
  for (const { card } of cards) {
    const next = playFree(run.state, deps, card.id as never);
    run = { state: next.state, events: [...run.events, ...next.events], session: next.session as never };
  }
  return run;
};

describe("a permanent attachment answers its former host leaving play", () => {
  it("the host is defeated: the attachment is unattached, hears 'attached enemy leaves play' and is set aside", () => {
    const table = start();
    const attached = play(table.state, CHILL_ON_THUG).state;
    expect(mustInstance(attached, table.chill).attachedTo).toBe(table.thug);
    const after = play(attached, DEFEAT_THUG);
    expect(mustPlayer(after.state, P1).playArea).not.toContain(table.thug);
    expect(mustPlayer(after.state, P1).setAside).toContain(table.chill);
    expect(mustPlayer(after.state, P1).playArea).not.toContain(table.chill);
    expect(mustInstance(after.state, table.chill).attachedTo).toBeNull();
  });

  it("the host leaves play without a defeat (shuffled into the encounter deck): the same", () => {
    const table = start();
    const after = play(table.state, CHILL_ON_THUG, BOUNCE_THUG);
    expect(mustPlayer(after.state, P1).setAside).toContain(table.chill);
  });

  it("another card leaving play is not its host: an unattached copy in play hears nothing", () => {
    const table = start();
    const after = play(table.state, DEFEAT_GOON);
    expect(mustPlayer(after.state, P1).playArea).toContain(table.chill);
    expect(mustPlayer(after.state, P1).setAside).not.toContain(table.chill);
    // Nor a later leaving, once it was stranded by an earlier one that nothing answered for it.
    const stranded = play(table.state, BADGE_ON_THUG, DEFEAT_THUG, DEFEAT_GOON).state;
    expect(mustPlayer(stranded, P1).playArea).toContain(table.badge);
    expect(mustPlayer(stranded, P1).playArea).toContain(table.chill);
  });

  it("a permanent attachment with no such ability stays in its controller's play area, as before", () => {
    const table = start();
    const after = play(table.state, BADGE_ON_THUG, CHILL_ON_THUG, DEFEAT_THUG).state;
    expect(mustPlayer(after, P1).playArea).toContain(table.badge);
    expect(mustInstance(after, table.badge).attachedTo).toBeNull();
    expect(mustPlayer(after, P1).setAside).toContain(table.chill);
  });

  it("replays deep-equal", () => {
    const table = start();
    const attached = play(table.state, CHILL_ON_THUG).state;
    const run = playFree(attached, deps, DEFEAT_THUG.card.id);
    const replayed = replay(run.session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(run.state);
  });
});
