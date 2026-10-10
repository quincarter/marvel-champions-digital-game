/**
 * docs/phase7-wave6.md §3.65: incite on a villain's new face, and keywords granted to a card being revealed. Synthetic
 * cards shaped like Dial M for Mojo (`mojo` 39035: "Each other encounter card gains incite 1"), The One with the Breakup
 * (39064: "Each encounter card gains peril") and Spiral, whose flip reveals her new face.
 *
 * Sources: FAQ "Dial M for Mojo (#35)" (RRG 1.8 p. 64: "Villains are encounter cards, so Dial M for Mojo gives incite 1
 * to Spiral. When Spiral flips, her new face is revealed, meaning her incite 1 resolves."); RRG 1.8 "Encounter Card"
 * (p. 17), "Incite X" (p. 22), "Peril" (p. 32); ruling Jul 9, 2026 (3) #5 (granted peril); rulings Jan 26, Apr 30 and
 * Jun 25, 2026 (environments flip, they are not revealed). Decisions §4.1 Q36 (a villain's new face is a full reveal)
 * and Q37 (all eight types; a main scheme stage revealed by an advance takes its own incite).
 */

import { flat, type AnyCard, type CardId, type KeywordInstance } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance } from "./query.js";
import type { EffectSpec, TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import {
  stubEnvironment,
  stubEvent,
  stubMainScheme,
  stubSupport,
  stubTreachery,
  stubVillain,
} from "./testing/fixtures.js";
import {
  copiesOf,
  encounterCardInVillainArea,
  gameAtFirstTurn,
  onTopOfEncounterDeck,
  playerCardIntoPlay,
  playFree,
} from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const ENCOUNTER_CARD: TargetQuery = {
  categories: ["villain", "mainScheme", "sideScheme", "minion", "treachery", "attachment", "environment", "obligation"],
  controller: "encounter",
};
const counter = (id: string, counterType: string, on: StubAbility["definition"]["trigger"]) =>
  stubAbility(id, { trigger: on, effects: [{ kind: "addCounters", target: self, counterType, amount: one }] });

/** Dial M for Mojo: "Each other encounter card gains incite 1." */
const DIAL_GRANT = stubAbility("dial.constant", {
  trigger: {
    kind: "constant",
    keywordGrants: [{ keyword: { name: "incite", value: 1 }, target: { ...ENCOUNTER_CARD, self: false } }],
  },
  effects: [],
});
const DIAL = stubEnvironment({ id: "dial", abilities: [DIAL_GRANT.ref] });
/** The One with the Breakup: "Each encounter card gains peril." */
const BREAKUP_GRANT = stubAbility("breakup.constant", {
  trigger: { kind: "constant", keywordGrants: [{ keyword: { name: "peril" }, target: ENCOUNTER_CARD }] },
  effects: [],
});
const BREAKUP = stubEnvironment({ id: "breakup", abilities: [BREAKUP_GRANT.ref] });
/** A double-sided environment: flipping it is no reveal, whatever it gains. */
const FLIPPER_REVEALED = counter("flipper.when-revealed", "revealed", { kind: "whenRevealed" });
const FLIPPER = stubEnvironment({
  id: "flipper",
  flipSide: { name: "Flopper", abilities: [FLIPPER_REVEALED.ref] },
});

/** Spiral's shape: each face's When Revealed leaves a counter; two stages a side. */
const NEW_FACE_REVEALED = counter("spiral.when-revealed", "revealed", { kind: "whenRevealed" });
const stage = (keywords: readonly KeywordInstance[] = []) => ({
  hp: flat(10),
  atk: 1,
  sch: 1,
  keywords,
  abilities: [NEW_FACE_REVEALED.ref],
});
const SPIRAL = stubVillain({
  id: "spiral",
  name: "Spiral",
  stages: [stage(), stage()],
  back: { name: "Spiral (B)", stages: [stage(), stage()] },
});
/** A villain whose other face prints surge. */
const SURGER = stubVillain({
  id: "surger",
  stages: [stage()],
  back: { name: "Surger (B)", stages: [stage([{ name: "surge" }])] },
});
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [
    { startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) },
    { startingThreat: flat(2), targetThreat: flat(50), acceleration: flat(0) },
  ],
});

const BLANK = stubTreachery({ id: "blank", boostIcons: 0 });
/** A treachery whose When Revealed asks its revealer a question. */
const ASKS = stubAbility("asks.when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [
    {
      kind: "chooseOne",
      chooser: { kind: "controller" },
      options: [
        { label: "a", effects: [] },
        { label: "b", effects: [] },
      ],
    },
  ],
});
const ASKER = stubTreachery({ id: "asker", boostIcons: 0, abilities: [ASKS.ref] });

/** A player's support that sees every reveal: "when revealed" interrupts and "after revealed" responses. */
const SAW_REVEALING = counter("spy.interrupt", "sawRevealing", {
  kind: "interrupt",
  forced: true,
  on: { on: "encounterCardRevealing" },
});
const SAW_REVEALED = counter("spy.response", "sawRevealed", {
  kind: "response",
  forced: true,
  on: { on: "cardRevealed" },
});
const SPY = stubSupport({ id: "spy", cost: 0, abilities: [SAW_REVEALING.ref, SAW_REVEALED.ref] });

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const villain = { kind: "villain" } as const;
const FLIP_VILLAIN = action("flip-villain", [{ kind: "flipCard", target: villain }]);
const FLIP_ENVIRONMENT = action("flip-environment", [
  { kind: "flipCard", target: { kind: "each", query: { categories: ["environment"], name: "flipper" } } },
]);
const DEFEAT_STAGE = action("defeat-stage", [
  { kind: "dealDamage", target: villain, amount: { kind: "const", value: 10 } },
]);
const ADVANCE = action("advance", [{ kind: "advanceMainScheme" }]);
const REVEAL_TOP = action("reveal-top", [{ kind: "revealEncounterCard", player: { kind: "controller" } }]);
const ACTIONS = [FLIP_VILLAIN, FLIP_ENVIRONMENT, DEFEAT_STAGE, ADVANCE, REVEAL_TOP];

const deps: EngineDeps = depsOf(
  DIAL_GRANT,
  BREAKUP_GRANT,
  FLIPPER_REVEALED,
  NEW_FACE_REVEALED,
  ASKS,
  SAW_REVEALING,
  SAW_REVEALED,
  ...ACTIONS.map((a) => a.ability),
);
const ENCOUNTER: readonly CardId[] = [DIAL.id, BREAKUP.id, FLIPPER.id, ASKER.id, ...copiesOf(BLANK.id, 20)];

function start(options: { readonly villain?: AnyCard; readonly with?: readonly AnyCard[] } = {}): GameState {
  let state = gameAtFirstTurn({
    cards: [DIAL, BREAKUP, FLIPPER, BLANK, ASKER, SPY, SURGER, ...ACTIONS.map((a) => a.card)],
    deps,
    villain: (options.villain ?? SPIRAL) as ReturnType<typeof stubVillain>,
    mainScheme: SCHEME,
    encounter: ENCOUNTER,
    deck: [SPY.id, ...ACTIONS.map((a) => a.card.id)],
  });
  for (const card of options.with ?? []) state = encounterCardInVillainArea(state, card.id).state;
  return state;
}

const threat = (state: GameState): number => mustInstance(state, state.mainScheme.instanceId).threat;
const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const revealedCards = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "encounterCardRevealed" ? [String(e.cardId)] : []));

describe("§3.65 a villain's new face is revealed (FAQ #35, §4.1 Q36)", () => {
  it("FAQ #35: with Dial M for Mojo in play, a villain's flip resolves its granted incite 1", () => {
    const before = start({ with: [DIAL] });
    const spiral = activeVillain(before).instanceId;
    const { state, events } = playFree(before, deps, FLIP_VILLAIN.card.id);
    expect(activeVillain(state).side).toBe("B");
    expect(threat(state)).toBe(threat(before) + 1);
    expect(counters(state, spiral).revealed).toBe((counters(before, spiral).revealed ?? 0) + 1);
    expect(revealedCards(events)).toEqual(["spiral"]);
  });

  it("without the grant the flip places no threat; the new face's When Revealed still resolves", () => {
    const before = start();
    const spiral = activeVillain(before).instanceId;
    const { state } = playFree(before, deps, FLIP_VILLAIN.card.id);
    expect(threat(state)).toBe(threat(before));
    expect(counters(state, spiral).revealed).toBe((counters(before, spiral).revealed ?? 0) + 1);
  });

  it("the new face goes through the reveal windows: 'when revealed' interrupts and 'after revealed' responses", () => {
    const before = playerCardIntoPlay(start(), SPY.id);
    const { state } = playFree(before.state, deps, FLIP_VILLAIN.card.id);
    expect(counters(state, before.id)).toEqual({ sawRevealing: 1, sawRevealed: 1 });
  });

  it("a new face with surge surges, and the flipped villain is not discarded", () => {
    const before = onTopOfEncounterDeck(start({ villain: SURGER }), BLANK.id);
    const surger = activeVillain(before).instanceId;
    const { state, events } = playFree(before, deps, FLIP_VILLAIN.card.id);
    // Q22: the blank its surge deals is not revealed in the player phase; it waits facedown for step four.
    expect(revealedCards(events)).toEqual(["surger"]);
    expect(events.filter((e) => e.type === "surgeTriggered")).toHaveLength(1);
    expect(state.players[0]!.dealtEncounter).toHaveLength(1);
    expect(state.villains.map((v) => v.instanceId)).toContain(surger);
    expect(activeVillain(state)).toMatchObject({ instanceId: surger, side: "B", defeated: false });
  });

  it("the next stage is a new face too: its granted incite resolves after the stage advance", () => {
    const before = start({ with: [DIAL] });
    const spiral = activeVillain(before).instanceId;
    const { state, events } = playFree(before, deps, DEFEAT_STAGE.card.id);
    expect(activeVillain(state).stageIndex).toBe(1);
    expect(threat(state)).toBe(threat(before) + 1);
    expect(counters(state, spiral).revealed).toBe((counters(before, spiral).revealed ?? 0) + 1);
    expect(revealedCards(events)).toEqual(["spiral"]);
  });

  it("an environment's flip is still no reveal, granted incite or not", () => {
    const before = start({ with: [DIAL, FLIPPER] });
    const flipper = before.villainArea.find((id) => before.instances[id]?.cardId === FLIPPER.id)!;
    const { state, events } = playFree(before, deps, FLIP_ENVIRONMENT.card.id);
    expect(mustInstance(state, flipper).flipped).toBe(true);
    expect(threat(state)).toBe(threat(before));
    expect(counters(state, flipper).revealed).toBeUndefined();
    expect(revealedCards(events)).toEqual([]);
  });

  it("replays to the same state", () => {
    const { session } = playFree(start({ with: [DIAL] }), deps, FLIP_VILLAIN.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§3.65 a main scheme stage revealed by an advance resolves its own incite (§4 Q37)", () => {
  it("granted incite 1 lands on the new stage with its starting threat", () => {
    const { state } = playFree(start({ with: [DIAL] }), deps, ADVANCE.card.id);
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(threat(state)).toBe(2 + 1);
  });

  it("without the grant, only the starting threat", () => {
    const { state } = playFree(start(), deps, ADVANCE.card.id);
    expect(threat(state)).toBe(2);
  });
});

describe("§3.65 keywords granted to a card being revealed", () => {
  it("a grant over the eight encounter types reaches a treachery mid-reveal: granted incite resolves", () => {
    const before = onTopOfEncounterDeck(start({ with: [DIAL] }), BLANK.id);
    const { state } = playFree(before, deps, REVEAL_TOP.card.id);
    expect(threat(state)).toBe(threat(before) + 1);
  });

  it("granted peril is read where printed peril is (ruling Jul 9, 2026 (3) #5): the revealer decides alone", () => {
    const soleDecider = (withBreakup: boolean) => {
      const before = onTopOfEncounterDeck(start({ with: withBreakup ? [BREAKUP] : [] }), ASKER.id);
      const { events } = playFree(before, deps, REVEAL_TOP.card.id);
      const asked = events.flatMap((e) => (e.type === "choiceRequested" ? [e.choice] : []));
      expect(asked).toHaveLength(1);
      return asked[0]!.soleDecider;
    };
    expect(soleDecider(false)).toBe(false);
    expect(soleDecider(true)).toBe(true);
  });
});
