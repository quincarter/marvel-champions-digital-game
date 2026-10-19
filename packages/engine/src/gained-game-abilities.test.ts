/**
 * Game-triggered abilities a card gains (`RuleSpec gainsAbility` naming a When Defeated or When Revealed ability)
 * resolve like printed ones: `gameAbilityFrames` reads the card's live ability slots (`activeAbilityRefs`), printed and
 * gained, not its printed list alone. The Raft Breakout (`fne` 60142b): "Each minion gains: 'When Defeated: Remove 1
 * threat from the main scheme ...'".
 *
 * Sources: RRG 1.8 "'Gains'" (p. 21): "the card functions as if it possesses the gained characteristic. Gained
 * characteristics are not considered to be printed on the card."; "Ignore" (p. 23); "Damage" (p. 14, step 7: "When
 * Defeated" abilities resolve as the character is defeated, before it is discarded).
 *
 * Synthetic cards: a warden support whose constant gives each minion a When Defeated and a When Revealed, plain and
 * plotting minions, and events that defeat each minion (one ignoring When Defeated abilities, as Coup de Grâce).
 */

import type { CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { applyCommand, replay } from "./engine.js";
import { activeEncounterDeck, mustInstance } from "./query.js";
import { activeAbilityRefs } from "./select.js";
import type { EffectSpec, TargetRef } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubSupport } from "./testing/fixtures.js";
import {
  copiesOf,
  gameAtFirstTurn,
  minionEngagedWith,
  onTopOfEncounterDeck,
  P1,
  playFree,
  playerCardIntoPlay,
} from "./testing/wave3.js";

const amount = (value: number) => ({ kind: "const", value }) as const;
const plot = (threat: number): EffectSpec => ({
  kind: "placeThreat",
  target: { kind: "mainScheme" },
  amount: amount(threat),
});
const minions = { categories: ["minion"] } as const;

/** Granted: "When Defeated: Place 1 threat on the main scheme." */
const GAINED_DEFEAT = stubAbility("warden.granted-when-defeated", {
  trigger: { kind: "whenDefeated" },
  effects: [plot(1)],
});
/** Granted: "When Revealed: Place 10 threat on the main scheme." */
const GAINED_REVEAL = stubAbility("warden.granted-when-revealed", {
  trigger: { kind: "whenRevealed" },
  effects: [plot(10)],
});
const WARDEN_CONSTANT = stubAbility("warden.constant", {
  trigger: {
    kind: "constant",
    rules: [
      { kind: "gainsAbility", abilityId: GAINED_DEFEAT.ref.id, to: minions },
      { kind: "gainsAbility", abilityId: GAINED_REVEAL.ref.id, to: minions },
    ],
  },
  effects: [],
});
const WARDEN = stubSupport({ id: "warden", cost: 0, abilities: [WARDEN_CONSTANT.ref] });

/** "Each minion's text box is treated as blank." */
const HUSH_CONSTANT = stubAbility("hush.constant", {
  trigger: { kind: "constant", rules: [{ kind: "blankTextBox", target: minions }] },
  effects: [],
});
const HUSH = stubSupport({ id: "hush", cost: 0, abilities: [HUSH_CONSTANT.ref] });

/** "Ignore the granted When Defeated on each minion." */
const DEAF_CONSTANT = stubAbility("deaf.constant", {
  trigger: {
    kind: "constant",
    rules: [{ kind: "ignoreAbilities", on: minions, abilities: [GAINED_DEFEAT.ref.id] }],
  },
  effects: [],
});
const DEAF = stubSupport({ id: "deaf", cost: 0, abilities: [DEAF_CONSTANT.ref] });

/** Printed: "When Defeated: Place 3 threat on the main scheme." */
const PLOT = stubAbility("plotter.when-defeated", { trigger: { kind: "whenDefeated" }, effects: [plot(3)] });
const GRUNT = stubMinion({ id: "grunt", atk: 1, sch: 1, hp: 3 });
const PLOTTER = stubMinion({ id: "plotter", atk: 1, sch: 1, hp: 3, abilities: [PLOT.ref] });

const actionEvent = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const eachMinion: TargetRef = { kind: "each", query: minions };
const SLAY = actionEvent("slay", [{ kind: "defeat", target: eachMinion }]);
const COUP = actionEvent("coup", [{ kind: "defeat", target: eachMinion, ignoreWhenDefeated: true }]);

const deps: EngineDeps = depsOf(
  GAINED_DEFEAT,
  GAINED_REVEAL,
  WARDEN_CONSTANT,
  HUSH_CONSTANT,
  DEAF_CONSTANT,
  PLOT,
  SLAY.ability,
  COUP.ability,
);
const SUPPORTS = [WARDEN, HUSH, DEAF];
const CARDS = [...SUPPORTS, GRUNT, PLOTTER, SLAY.card, COUP.card];
const ENCOUNTER: readonly CardId[] = [GRUNT.id, PLOTTER.id, ...copiesOf(GRUNT.id, 2)];

const start = (...supports: readonly (typeof WARDEN)[]): GameState => {
  let state = gameAtFirstTurn({
    cards: CARDS,
    deps,
    encounter: ENCOUNTER,
    deck: [...SUPPORTS.map((s) => s.id), ...copiesOf(SLAY.card.id, 2), ...copiesOf(COUP.card.id, 2)],
  });
  for (const support of supports) state = playerCardIntoPlay(state, support.id).state;
  return state;
};
const threat = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).threat;
const resolved = (events: readonly { readonly type: string }[], id: string) =>
  events.filter((e) => e.type === "abilityResolved" && (e as { abilityId?: string }).abilityId === id).length;

describe("gained When Defeated / When Revealed abilities resolve (`gameAbilityFrames` reads active refs)", () => {
  it("a minion with no printed ability resolves the When Defeated it gains; without the grant, nothing", () => {
    const granted = minionEngagedWith(start(WARDEN), GRUNT.id);
    expect(activeAbilityRefs(granted.state, granted.id, deps).map((r) => r.id)).toContain(GAINED_DEFEAT.ref.id);
    const before = threat(granted.state);
    const slain = playFree(granted.state, deps, SLAY.card.id);
    expect(activeEncounterDeck(slain.state).discard).toContain(granted.id);
    expect(resolved(slain.events, GAINED_DEFEAT.ref.id)).toBe(1);
    expect(threat(slain.state)).toBe(before + 1);

    const plain = minionEngagedWith(start(), GRUNT.id);
    const plainBefore = threat(plain.state);
    const plainSlain = playFree(plain.state, deps, SLAY.card.id);
    expect(threat(plainSlain.state)).toBe(plainBefore);
  });

  it("printed and gained When Defeated both resolve, the printed one's slot first", () => {
    const granted = minionEngagedWith(start(WARDEN), PLOTTER.id);
    const before = threat(granted.state);
    const slain = playFree(granted.state, deps, SLAY.card.id);
    const order = slain.events.flatMap((e) =>
      e.type === "abilityResolved" && [PLOT.ref.id, GAINED_DEFEAT.ref.id].includes(e.abilityId) ? [e.abilityId] : [],
    );
    expect(order).toEqual([PLOT.ref.id, GAINED_DEFEAT.ref.id]);
    expect(threat(slain.state)).toBe(before + 4);
  });

  it("a defeat that ignores When Defeated abilities ignores the gained one too (RRG 1.8 'Ignore', p. 23)", () => {
    const granted = minionEngagedWith(start(WARDEN), PLOTTER.id);
    const before = threat(granted.state);
    const coup = playFree(granted.state, deps, COUP.card.id);
    expect(activeEncounterDeck(coup.state).discard).toContain(granted.id);
    expect(resolved(coup.events, GAINED_DEFEAT.ref.id)).toBe(0);
    expect(threat(coup.state)).toBe(before);
  });

  it("an `ignoreAbilities` rule naming the gained ability stops it", () => {
    const granted = minionEngagedWith(start(WARDEN, DEAF), GRUNT.id);
    const before = threat(granted.state);
    const slain = playFree(granted.state, deps, SLAY.card.id);
    expect(resolved(slain.events, GAINED_DEFEAT.ref.id)).toBe(0);
    expect(threat(slain.state)).toBe(before);
  });

  it("a blank text box takes away the printed When Defeated, not the gained one (not printed: RRG 1.8 'Gains', p. 21)", () => {
    const granted = minionEngagedWith(start(WARDEN, HUSH), PLOTTER.id);
    expect(activeAbilityRefs(granted.state, granted.id, deps).map((r) => r.id)).toEqual([
      GAINED_DEFEAT.ref.id,
      GAINED_REVEAL.ref.id,
    ]);
    const before = threat(granted.state);
    const slain = playFree(granted.state, deps, SLAY.card.id);
    expect(resolved(slain.events, PLOT.ref.id)).toBe(0);
    expect(resolved(slain.events, GAINED_DEFEAT.ref.id)).toBe(1);
    expect(threat(slain.state)).toBe(before + 1);

    // The control: blank text box, no grant: nothing.
    const hushed = minionEngagedWith(start(HUSH), PLOTTER.id);
    const hushedBefore = threat(hushed.state);
    expect(threat(playFree(hushed.state, deps, SLAY.card.id).state)).toBe(hushedBefore);
  });

  it("a minion revealed into play resolves the When Revealed it gains", () => {
    const state = onTopOfEncounterDeck(start(WARDEN), GRUNT.id);
    const ended = applyCommand(state, { type: "endTurn", playerId: P1 }, deps);
    if (!ended.ok) throw new Error(ended.error.message);
    // Drive the villain phase's prompts with the first option until the reveal happens.
    let current = ended.state;
    const events = [...ended.events];
    for (let guard = 0; guard < 50 && current.pendingChoice && !current.outcome; guard++) {
      const choice = current.pendingChoice;
      const next = applyCommand(
        current,
        {
          type: "resolveChoice",
          playerId: choice.playerId,
          choiceId: choice.choiceId,
          selectedOptionIds: [choice.options[0]!.optionId],
        },
        deps,
      );
      if (!next.ok) throw new Error(next.error.message);
      current = next.state;
      events.push(...next.events);
      if (resolved(events, GAINED_REVEAL.ref.id) > 0) break;
    }
    expect(resolved(events, GAINED_REVEAL.ref.id)).toBe(1);
  });

  it("replays to the same state", () => {
    const granted = minionEngagedWith(start(WARDEN), PLOTTER.id);
    const { session } = playFree(granted.state, deps, SLAY.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});
