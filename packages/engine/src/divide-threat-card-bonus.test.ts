/**
 * A divided threat removal takes the resolving card's threat bonus (`modifyCardEffect`) once per scheme that takes a
 * share, as divided damage takes the damage bonus once per enemy (`divide-card-bonus.test.ts`).
 *
 * - RRG 1.8 "Event" (p. 19): "If an effect modifies the amount of damage an event deals or the amount of threat an
 *   event removes, and that event deals multiple instances of damage or removes multiple instances of threat, each of
 *   those instances is modified."
 * - FAQ "Shrink (#11)" (RRG 1.8 p. 59): "Shrink increases each instance of threat removed by a thwart event."
 * - RRG 1.8 "Thwart" (p. 44): a "(thwart)" ability is one thwart whose instances of threat removal are each increased.
 *   That one share of a division is one instance is the reading of `thwart-session.ts` (owner decision Q78,
 *   docs/phase7-wave6.md §4.1) and of the divided damage ruling, June 25, 2026 (2).
 *
 * Synthetic cards shaped like Inconspicuous (`trors` 04038) and Shrink (`msm` 05011).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { runCommandsPicking } from "./testing/drive.js";
import { stubEvent, stubSideScheme, stubSupport } from "./testing/fixtures.js";
import { defaultPick, giveCard } from "./testing/scenario.js";
import { copiesOf, encounterCardInVillainArea, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const n = (value: number) => ({ kind: "const", value }) as const;
const divided: EffectSpec = {
  kind: "divide",
  what: "threat",
  amount: n(3),
  among: { categories: ["scheme"] },
  chooser: { kind: "controller" },
};
const action = (label: boolean, ...effects: EffectSpec[]): AbilityDefinition => ({
  trigger: { kind: "action" },
  ...(label ? { label: ["thwart"] as const } : {}),
  effects,
});
/** "Hero Action (thwart): Remove a total of 3 threat from among schemes in play." */
const spread = stubAbility("spread.action", action(true, divided));
/** The same sentence with no label: a removal that is not a thwart. */
const sweep = stubAbility("sweep.action", action(false, divided));
/** "Hero Action (thwart): Remove 3 threat from the main scheme." */
const single = stubAbility(
  "single.action",
  action(true, { kind: "removeThreat", target: { kind: "mainScheme" }, amount: n(3) }),
);
/** "When you play an event, increase the amount of threat that event removes by 2" (a standing Shrink). */
const shrink = stubAbility("shrink.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: "cardBeingPlayed", playerIs: "controller", targetIs: { categories: ["event"] } },
  },
  effects: [{ kind: "modifyCardEffect", card: { kind: "eventTarget" }, threatRemoved: n(2) }],
});
const SPREAD = stubEvent({ id: "spread", cost: 0, abilities: [spread.ref] });
const SWEEP = stubEvent({ id: "sweep", cost: 0, abilities: [sweep.ref] });
const SINGLE = stubEvent({ id: "single", cost: 0, abilities: [single.ref] });
const SHRINK = stubSupport({ id: "shrink", cost: 0, abilities: [shrink.ref] });
const SIDE = stubSideScheme({ id: "side", startingThreat: 0 });
const PLAYER_CARDS = [SPREAD, SWEEP, SINGLE, SHRINK];

const deps: EngineDeps = depsOf(spread, sweep, single, shrink);

/** P1 in hero form, 10 threat on the main scheme and 10 on a side scheme; the bonus in play on request. */
function table(bonus: boolean): { state: GameState; main: InstanceId; side: InstanceId } {
  let state = gameAtFirstTurn({
    cards: [...PLAYER_CARDS, SIDE],
    deps,
    deck: PLAYER_CARDS.map((card) => card.id),
    encounter: [SIDE.id, ...copiesOf("treachery" as CardId, 20)],
  });
  const main = state.mainScheme.instanceId;
  state = {
    ...state,
    players: state.players.map((p) => ({ ...p, identity: { ...p.identity, form: "hero" as const } })),
    instances: { ...state.instances, [main]: { ...mustInstance(state, main), threat: 10 } },
  };
  const side = encounterCardInVillainArea(state, SIDE.id, 10);
  state = bonus ? playerCardIntoPlay(side.state, SHRINK.id).state : side.state;
  return { state, main, side: side.id };
}

/** Plays `card` for 0 and answers a division with `shares` (scheme → points). */
function play(state: GameState, card: CardId, shares: ReadonlyMap<InstanceId, number> = new Map()) {
  const given = giveCard(state, P1, card);
  const run = runCommandsPicking(
    given.state,
    deps,
    (current) =>
      current.pendingChoice?.prompt.kind === "divide"
        ? [...shares].flatMap(([id, points]) => Array.from({ length: points }, (_, i) => `${id}#${i + 1}`))
        : defaultPick(current),
    { type: "playCard", playerId: P1, cardInstanceId: given.id, payment: [], attachToInstanceId: null },
  );
  const replayed = replay(run.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(run.session.state);
  return { state: run.state, events: run.events as readonly GameEvent[] };
}

const threatOn = (state: GameState, id: InstanceId): number => mustInstance(state, id).threat;
/** The resolved thwarts' amounts: one entry per thwart made. */
const thwartAmounts = (events: readonly GameEvent[]): number[] =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "thwart" ? [e.event.amount ?? 0] : [],
  );

describe("a divided threat removal takes the card's threat bonus once per scheme (FAQ 'Shrink (#11)', RRG 1.8 p. 59)", () => {
  it("a '(thwart)' 3 split 2 / 1 over two schemes with a +2 bonus: each scheme loses its share + 2, in one thwart", () => {
    const t = table(true);
    const { state, events } = play(
      t.state,
      SPREAD.id,
      new Map([
        [t.main, 2],
        [t.side, 1],
      ]),
    );
    expect([threatOn(state, t.main), threatOn(state, t.side)]).toEqual([10 - 4, 10 - 3]);
    // Still one thwart (RRG 1.8 "Thwart", p. 44), whose amount is everything its instances removed.
    expect(thwartAmounts(events)).toEqual([7]);
  });

  it("all 3 on one of two schemes: + 2 once, and the scheme given no share loses nothing", () => {
    const t = table(true);
    const { state, events } = play(t.state, SPREAD.id, new Map([[t.main, 3]]));
    expect([threatOn(state, t.main), threatOn(state, t.side)]).toEqual([10 - 5, 10]);
    expect(thwartAmounts(events)).toEqual([5]);
  });

  it("an unlabeled division takes the bonus per scheme too, and is not a thwart", () => {
    const t = table(true);
    const { state, events } = play(
      t.state,
      SWEEP.id,
      new Map([
        [t.main, 2],
        [t.side, 1],
      ]),
    );
    expect([threatOn(state, t.main), threatOn(state, t.side)]).toEqual([10 - 4, 10 - 3]);
    expect(thwartAmounts(events)).toEqual([]);
  });

  it("without a bonus the shares are unchanged, labeled or not", () => {
    for (const card of [SPREAD, SWEEP]) {
      const t = table(false);
      const { state } = play(
        t.state,
        card.id,
        new Map([
          [t.main, 2],
          [t.side, 1],
        ]),
      );
      expect([threatOn(state, t.main), threatOn(state, t.side)]).toEqual([10 - 2, 10 - 1]);
    }
  });

  it("a single-target thwart with the bonus is unchanged: 3 + 2 from the one scheme", () => {
    const t = table(true);
    const { state, events } = play(t.state, SINGLE.id);
    expect([threatOn(state, t.main), threatOn(state, t.side)]).toEqual([10 - 5, 10]);
    expect(thwartAmounts(events)).toEqual([5]);
  });
});
