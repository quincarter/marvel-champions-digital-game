/**
 * docs/phase7-wave5.md §3.30: a player card attached to an encounter card and returned when its host leaves. Synthetic
 * cards shaped like Wrist Navigator (`sm` 27189a, campaign: "Setup. Permanent. Forced Response: After a minion or side
 * scheme enters play, attach Wrist Navigator to it. Interrupt: When the attached card is defeated, draw 1 card. (Return
 * this card to your play area.)").
 *
 * Sources: RRG 1.8 "Attach To" (p. 8: the attached card is discarded when its host leaves play), "Permanent" (p. 32: it
 * cannot leave play except by card abilities in its own set), "Ownership and Control" (p. 31: control stays constant;
 * an encounter card is controlled by the scenario, not a player, so the upgrade's owner keeps it).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, mustInstance, mustPlayer } from "./query.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubAttachment, stubEvent, stubMinion, stubSideScheme, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  minionEngagedWith,
  P1,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const named = (name: string): TargetRef => ({ kind: "each", query: { name } });

// "Interrupt: When the attached card is defeated, draw 1 card." Forced here only so the test needs no choice picker.
const NAVIGATOR_INTERRUPT = stubAbility("navigator.interrupt", {
  trigger: {
    kind: "interrupt",
    forced: true,
    on: { on: ["characterDefeated", "schemeDefeated"], targetIs: { hostOfSelf: true } },
  },
  effects: [{ kind: "draw", player: { kind: "controller" }, amount: { kind: "const", value: 1 } }],
});
const NAVIGATOR = stubUpgrade({
  id: "navigator",
  cost: 0,
  keywords: [{ name: "permanent" }],
  abilities: [NAVIGATOR_INTERRUPT.ref],
});
const GADGET = stubUpgrade({ id: "gadget", cost: 0 });
const MINION = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });
const SCHEME = stubSideScheme({ id: "plot", startingThreat: 2 });
// A permanent encounter attachment, which no printed card is: the §4 fallback.
const CURSE = stubAttachment({ id: "curse", attachesTo: { kind: "villain" }, keywords: [{ name: "permanent" }] });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const attach = (card: string, host: string) =>
  event(`attach-${card}-${host}`, [{ kind: "attach", card: named(card), to: named(host) }]);
const NAVIGATOR_ON_THUG = attach("navigator", "thug");
const NAVIGATOR_ON_PLOT = attach("navigator", "plot");
const GADGET_ON_THUG = attach("gadget", "thug");
const DEFEAT_THUG = event("defeat-thug", [{ kind: "defeat", target: named("thug") }]);
const THWART_PLOT = event("thwart-plot", [
  { kind: "removeThreat", target: named("plot"), amount: { kind: "const", value: 5 } },
]);
const DISCARD_PLOT = event("discard-plot", [
  { kind: "moveCards", cards: { kind: "ref", ref: named("plot") }, to: "discard" },
]);
const EVENTS = [NAVIGATOR_ON_THUG, NAVIGATOR_ON_PLOT, GADGET_ON_THUG, DEFEAT_THUG, THWART_PLOT, DISCARD_PLOT];

const deps: EngineDeps = depsOf(NAVIGATOR_INTERRUPT, ...EVENTS.map((e) => e.ability));

interface Table {
  readonly state: GameState;
  readonly navigator: InstanceId;
  readonly gadget: InstanceId;
  readonly thug: InstanceId;
  readonly plot: InstanceId;
}

function start(): Table {
  const state = gameAtFirstTurn({
    cards: [NAVIGATOR, GADGET, MINION, SCHEME, CURSE, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 27), MINION.id, SCHEME.id, CURSE.id],
    deck: [NAVIGATOR.id, GADGET.id, ...EVENTS.map((e) => e.card.id)],
  });
  const navigator = playerCardIntoPlay(state, NAVIGATOR.id);
  const gadget = playerCardIntoPlay(navigator.state, GADGET.id);
  const thug = minionEngagedWith(gadget.state, MINION.id);
  const plot = encounterCardInVillainArea(thug.state, SCHEME.id, 2);
  return { state: plot.state, navigator: navigator.id, gadget: gadget.id, thug: thug.id, plot: plot.id };
}

/** Plays each event in turn, each through its own session. */
function play(state: GameState, ...cards: readonly { readonly card: { readonly id: CardId } }[]) {
  let current = state;
  let last: ReturnType<typeof playFree> | null = null;
  for (const { card } of cards) {
    last = playFree(current, deps, card.id);
    current = last.state;
  }
  return last!;
}

const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [String(e.abilityId)] : []));
const drawn = (events: readonly GameEvent[]) => events.filter((e) => e.type === "cardDrawn").length;

describe("§3.30 a player card attached to an encounter card, returned when its host leaves", () => {
  it("attaching to a minion keeps its controller; the minion's defeat fires its interrupt, then it returns", () => {
    const table = start();
    const attached = play(table.state, NAVIGATOR_ON_THUG).state;
    expect(mustInstance(attached, table.navigator)).toMatchObject({ attachedTo: table.thug, controllerId: P1 });
    expect(mustInstance(attached, table.thug).attachments).toContain(table.navigator);
    const marked: GameState = {
      ...attached,
      instances: {
        ...attached.instances,
        [table.navigator]: { ...mustInstance(attached, table.navigator), counters: { dart: 2 }, exhausted: true },
      },
    };
    const { state, session, events } = playFree(marked, deps, DEFEAT_THUG.card.id);
    expect(resolved(events)).toContain("navigator.interrupt");
    expect(drawn(events)).toBe(1);
    expect(mustInstance(state, table.thug).attachedTo).toBeNull();
    expect(state.encounterDecks[activeEncounterDeckId(state)]!.discard).toContain(table.thug);
    expect(mustPlayer(state, P1).playArea).toContain(table.navigator);
    // It never left play: its counters, exhaustion and controller are as they were.
    expect(mustInstance(state, table.navigator)).toMatchObject({
      attachedTo: null,
      controllerId: P1,
      counters: { dart: 2 },
      exhausted: true,
    });
    expect(mustInstance(state, table.thug).attachments).not.toContain(table.navigator);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });

  it("a defeated side scheme fires the interrupt too; a discarded one returns it without the draw", () => {
    const table = start();
    const onPlot = play(table.state, NAVIGATOR_ON_PLOT).state;
    expect(mustInstance(onPlot, table.navigator).attachedTo).toBe(table.plot);

    const thwarted = playFree(onPlot, deps, THWART_PLOT.card.id);
    expect(drawn(thwarted.events)).toBe(1);
    const defeated = thwarted.state;
    expect(defeated.villainArea).not.toContain(table.plot);
    expect(mustPlayer(defeated, P1).playArea).toContain(table.navigator);

    const discard = playFree(onPlot, deps, DISCARD_PLOT.card.id);
    expect(resolved(discard.events)).not.toContain("navigator.interrupt");
    const discarded = discard.state;
    expect(discarded.villainArea).not.toContain(table.plot);
    expect(mustInstance(discarded, table.navigator).attachedTo).toBeNull();
    expect(mustPlayer(discarded, P1).playArea).toContain(table.navigator);
  });

  it("a player upgrade without permanent is discarded with its host (RRG 1.8 'Attach To', p. 8)", () => {
    const table = start();
    const state = play(table.state, GADGET_ON_THUG, DEFEAT_THUG).state;
    expect(mustPlayer(state, P1).discard).toContain(table.gadget);
    expect(mustPlayer(state, P1).playArea).not.toContain(table.gadget);
  });

  it("a permanent encounter attachment with no player to go to stays in the villain's play area (§4 default)", () => {
    const table = start();
    const curse = encounterCardInVillainArea(table.state, CURSE.id);
    // Surgery: attached to the minion, controlled by the scenario.
    const state: GameState = {
      ...curse.state,
      villainArea: curse.state.villainArea.filter((id) => id !== curse.id),
      instances: {
        ...curse.state.instances,
        [curse.id]: { ...mustInstance(curse.state, curse.id), attachedTo: table.thug, controllerId: null },
        [table.thug]: { ...mustInstance(curse.state, table.thug), attachments: [curse.id] },
      },
    };
    const after = playFree(state, deps, DEFEAT_THUG.card.id).state;
    expect(after.villainArea).toContain(curse.id);
    expect(mustInstance(after, curse.id).attachedTo).toBeNull();
  });
});
