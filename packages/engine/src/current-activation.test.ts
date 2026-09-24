/**
 * docs/phase7-wave3.md's `gmw` Band of Badoon modular set: `Predicate currentActivationIs`, and letting a card's
 * own "[star] Boost:" ability adjust its own boost-icon count (`adjustBoostCount`/`replaceBoostCount` no longer
 * require `boost.step === "count"`; `step === "ability"`, while the Boost ability itself is still resolving, now
 * qualifies too — the two steps share the same `boost.countAdjust` field, so setting it early is equivalent).
 *
 * Modeled on Badoon Warlord (16121, `gmw`): "[star] Badoon Warlord's attacks gain overkill. [star] Boost: If this
 * activation is an attack, this card gets +2 boost icons for this activation." and Badoon Lieutenant (16119): "[star]
 * Boost: If this activation is a scheme, this card gets +2 boost icons for this activation." A minion's own "Boost:"
 * text fires whenever *that card* is drawn as *any* enemy's boost card (RRG 1.8 "Boost", p. 11; "Villainous", p. 47:
 * only the villain or a villainous minion is dealt one automatically) — not only during its own activation, which is
 * why the wording asks about "this activation" rather than "Badoon Warlord's activation". So this test drives the
 * *villain's* activation with the minion card stacked as its boost card, not the minion's own activation.
 *
 * Sources: RRG 1.8 "Activation" (p. 6): a player in hero form is attacked, a player in alter-ego form is schemed
 * against. "Boost" (p. 11): the Boost ability resolves before the card's icons are counted.
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { EffectSpec } from "./spec.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubMinion, stubVillain } from "./testing/fixtures.js";
import { defaultPick } from "./testing/scenario.js";
import { gameAtFirstTurn, onTopOfEncounterDeck, P1 } from "./testing/wave3.js";
import type { GameState } from "./state.js";

/** +2 boost icons for this card's activation, when `condition` holds. */
const boostBonus = (condition: "attack" | "scheme"): EffectSpec => ({
  kind: "if",
  condition: { kind: "currentActivationIs", activation: condition },
  then: [{ kind: "adjustBoostCount", delta: { kind: "const", value: 2 } }],
});

const WARLORD_BOOST = stubAbility("warlord.boost", { trigger: { kind: "boost" }, effects: [boostBonus("attack")] });
const WARLORD = stubMinion({ id: "warlord", atk: 2, sch: 1, hp: 8, boostIcons: 1, abilities: [WARLORD_BOOST.ref] });

const LIEUTENANT_BOOST = stubAbility("lieutenant.boost", {
  trigger: { kind: "boost" },
  effects: [boostBonus("scheme")],
});
const LIEUTENANT = stubMinion({
  id: "lieutenant",
  atk: 2,
  sch: 1,
  hp: 8,
  boostIcons: 1,
  abilities: [LIEUTENANT_BOOST.ref],
});

/** Attacks/schemes for 1, so its own printed stat plus the boost card's icons is easy to read back. */
const DRANG = stubVillain({ id: "drang-stub", stages: [{ hp: flat(30), atk: 1, sch: 1 }] });

const deps: EngineDeps = depsOf(WARLORD_BOOST, LIEUTENANT_BOOST);

function start(boostCard: typeof WARLORD, form: "hero" | "alterEgo"): GameState {
  const base = gameAtFirstTurn({ cards: [boostCard, DRANG], deps, villain: DRANG, encounter: [boostCard.id] });
  const stacked = onTopOfEncounterDeck(base, boostCard.id);
  return {
    ...stacked,
    players: stacked.players.map((p) => (p.playerId === P1 ? { ...p, identity: { ...p.identity, form } } : p)),
  };
}

function runVillainPhase(state: GameState): readonly GameEvent[] {
  const { events } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
  return events;
}

const boostIconsOf = (events: readonly GameEvent[], kind: "attackResolved" | "schemeResolved"): number | undefined =>
  events.find((e): e is Extract<GameEvent, { type: typeof kind }> => e.type === kind)?.boostIcons;

describe("§3.26 currentActivationIs / a Boost ability adjusting its own count (gmw Band of Badoon)", () => {
  it("Badoon Warlord's own boost applies its +2 when drawn as the boost card of an attack", () => {
    const events = runVillainPhase(start(WARLORD, "hero"));
    expect(boostIconsOf(events, "attackResolved")).toBe(3);
  });

  it("Badoon Warlord's own boost does not apply when drawn as the boost card of a scheme", () => {
    const events = runVillainPhase(start(WARLORD, "alterEgo"));
    expect(boostIconsOf(events, "schemeResolved")).toBe(1);
  });

  it("Badoon Lieutenant's own boost applies its +2 when drawn as the boost card of a scheme", () => {
    const events = runVillainPhase(start(LIEUTENANT, "alterEgo"));
    expect(boostIconsOf(events, "schemeResolved")).toBe(3);
  });

  it("Badoon Lieutenant's own boost does not apply when drawn as the boost card of an attack", () => {
    const events = runVillainPhase(start(LIEUTENANT, "hero"));
    expect(boostIconsOf(events, "attackResolved")).toBe(1);
  });

  it("replays deep-equal", () => {
    const state = start(WARLORD, "hero");
    const { session } = driveSession(startSession(state), deps, [{ type: "endTurn", playerId: P1 }], defaultPick);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
