/**
 * docs/phase7-wave8.md §4.1 Q56 (owner ruling, B): a main scheme stage's B side is not active while its A side is the
 * faceup one, and an ability that becomes active when the stage turns over does not trigger for what happened before.
 *
 * Sources: RRG 1.8 Appendix II (p. 51): "11. Put Setup Cards Into Play. … 12. Resolve Scenario Setup and When Revealed
 * Abilities. a. Resolve any 'Setup' abilities on main scheme card 1A. b. Flip the main scheme card to side 1B and
 * resolve any 'When Revealed' abilities on that side." RRG 1.8 "Main Scheme" (p. 27), on an advance: "2. Resolve any
 * 'When Revealed' ability on the 'A' side of the new top card of the main scheme deck. 3. Flip the top card of the main
 * scheme deck to its 'B' side, … and resolve any 'When Revealed' ability on that side of the card."
 *
 * Synthetic cards. The scheme's stage 1 and stage 2 B sides both print "Forced Interrupt: When an environment enters
 * play, discard each other environment card in play" and a Forced Response that counts each environment entering
 * play. Environments: `setting` (setup keyword), `home` (1A's Setup puts it into play), `later` (a player action puts
 * it into play), `third` (2A's When Revealed puts it into play).
 */

import { flat } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { AbilityDefinition } from "./abilities.js";
import type { Command } from "./commands.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import { mustInstance } from "./query.js";
import { cardsInPlay } from "./select.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubMainScheme, stubSupport } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, TREACHERY, VILLAIN } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playerCardIntoPlay } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const self = { kind: "self" } as const;
const count = (counterType: string): EffectSpec => ({
  kind: "addCounters",
  target: self,
  counterType,
  amount: { kind: "const", value: 1 },
});
/** "Discard cards from the encounter deck until [the named environment] is discarded. Put that card into play." */
const putIntoPlay = (name: string): EffectSpec[] => [
  { kind: "discardEncounterUntil", filter: { categories: ["environment"], name }, bind: "found" },
  { kind: "putIntoPlay", card: { kind: "slot", slot: "found" }, controller: { kind: "firstPlayer" } },
];
const environmentEnters = { on: "cardEntersPlay", targetIs: { categories: ["environment"] } } as const;

const SETUP_1A = stubAbility("scheme.1a-setup", def({ trigger: { kind: "setup" }, effects: putIntoPlay("home") }));
const REVEALED_2A = stubAbility(
  "scheme.2a-when-revealed",
  def({ trigger: { kind: "whenRevealed" }, effects: putIntoPlay("third") }),
);
/** "Forced Interrupt: When an environment enters play, discard each other environment card in play." */
const onlyOne = (id: string) =>
  stubAbility(
    id,
    def({
      trigger: { kind: "interrupt", forced: true, on: environmentEnters },
      effects: [
        {
          kind: "discardFromPlay",
          target: { kind: "each", query: { categories: ["environment"], excluding: { kind: "eventTarget" } } },
        },
      ],
    }),
  );
/** "Forced Response: After an environment enters play, place 1 counter here." */
const hears = (id: string, counterType: string) =>
  stubAbility(
    id,
    def({ trigger: { kind: "response", forced: true, on: environmentEnters }, effects: [count(counterType)] }),
  );
const revealed = (id: string, counterType: string) =>
  stubAbility(id, def({ trigger: { kind: "whenRevealed" }, effects: [count(counterType)] }));
const ONLY_ONE_1B = onlyOne("scheme.1b-interrupt");
const HEARS_1B = hears("scheme.1b-response", "heard1");
const REVEALED_1B = revealed("scheme.1b-when-revealed", "revealed1");
const ONLY_ONE_2B = onlyOne("scheme.2b-interrupt");
const HEARS_2B = hears("scheme.2b-response", "heard2");
const REVEALED_2B = revealed("scheme.2b-when-revealed", "revealed2");

const SCHEME = stubMainScheme({
  id: "main",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(50),
      acceleration: flat(0),
      aSideAbilities: [SETUP_1A.ref],
      abilities: [ONLY_ONE_1B.ref, HEARS_1B.ref, REVEALED_1B.ref],
    },
    {
      startingThreat: flat(0),
      targetThreat: flat(50),
      acceleration: flat(0),
      aSideAbilities: [REVEALED_2A.ref],
      abilities: [ONLY_ONE_2B.ref, HEARS_2B.ref, REVEALED_2B.ref],
    },
  ],
});
/** The same scheme with nothing printed on 1A: only the setup keyword puts an environment into play before 1B. */
const QUIET_SCHEME = stubMainScheme({
  id: "main",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(50),
      acceleration: flat(0),
      abilities: [ONLY_ONE_1B.ref, HEARS_1B.ref, REVEALED_1B.ref],
    },
  ],
});

const SETTING = stubEnvironment({ id: "setting", keywords: [{ name: "setup" }] });
const SECOND_SETTING = stubEnvironment({ id: "second-setting", keywords: [{ name: "setup" }] });
const HOME = stubEnvironment({ id: "home" });
const LATER = stubEnvironment({ id: "later" });
const THIRD = stubEnvironment({ id: "third" });

/** "Action: Put [later] into play." / "Action: Advance the main scheme to stage 2." */
const BRING_ABILITY = stubAbility("bring.action", def({ trigger: { kind: "action" }, effects: putIntoPlay("later") }));
const ADVANCE_ABILITY = stubAbility(
  "advance.action",
  def({ trigger: { kind: "action" }, effects: [{ kind: "advanceMainScheme", to: { stageNumber: 2 } }] }),
);
const BRING = stubSupport({ id: "bring", cost: 0, abilities: [BRING_ABILITY.ref] });
const ADVANCE = stubSupport({ id: "advance", cost: 0, abilities: [ADVANCE_ABILITY.ref] });

const deps = depsOf(
  SETUP_1A,
  REVEALED_2A,
  ONLY_ONE_1B,
  HEARS_1B,
  REVEALED_1B,
  ONLY_ONE_2B,
  HEARS_2B,
  REVEALED_2B,
  BRING_ABILITY,
  ADVANCE_ABILITY,
);

interface Options {
  readonly setting?: boolean;
  readonly secondSetting?: boolean;
  readonly scheme?: typeof SCHEME;
}
/** A game through setup, at the first player's first turn. */
function setUp(options: Options = {}): GameState {
  return gameAtFirstTurn({
    cards: [SETTING, SECOND_SETTING, HOME, LATER, THIRD, BRING, ADVANCE],
    deps,
    mainScheme: options.scheme ?? SCHEME,
    deck: [BRING.id, ADVANCE.id],
    encounter: [
      ...(options.setting === false ? [] : [SETTING.id]),
      ...(options.secondSetting ? [SECOND_SETTING.id] : []),
      HOME.id,
      LATER.id,
      THIRD.id,
      ...copiesOf(TREACHERY.id, 26),
    ],
  });
}
const environments = (state: GameState): string[] =>
  cardsInPlay(state)
    .map((id) => mustInstance(state, id).cardId as string)
    .filter((cardId) => [SETTING, SECOND_SETTING, HOME, LATER, THIRD].some((card) => card.id === cardId))
    .sort();
const schemeCounters = (state: GameState) => mustInstance(state, state.mainScheme.instanceId).counters;
/** Uses the action on `card` (put into play by surgery), the log replayed to the same state. */
function use(state: GameState, card: typeof BRING, ability: typeof BRING_ABILITY) {
  const placed = playerCardIntoPlay(state, card.id);
  const command: Command = {
    type: "useAbility",
    playerId: P1,
    cardInstanceId: placed.id,
    abilityId: ability.ref.id as Extract<Command, { type: "useAbility" }>["abilityId"],
    payment: [],
  };
  const driven = driveSession(startSession(placed.state), deps, [command]);
  const replayed = replay(driven.session.log, deps);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(driven.session.state);
  return { state: driven.session.state, events: driven.events };
}
const discardedFromPlay = (state: GameState, events: readonly GameEvent[]): string[] =>
  events.flatMap((event) =>
    event.type === "cardDiscardedFromPlay" ? [mustInstance(state, event.instanceId).cardId as string] : [],
  );
const turnsToB = (events: readonly GameEvent[]) =>
  events.flatMap((event) =>
    event.type === "triggerEvent" && event.phase === "resolved" && event.event.kind === "mainSchemeTurnsToB"
      ? [event.event.stageIndex]
      : [],
  );

describe("setup: side 1B is not active while 1A is faceup (RRG 1.8 Appendix II steps 11 and 12, p. 51)", () => {
  it("the setup-keyword environment (step 11) and the one 1A's Setup puts into play (step 12a) both stay in play", () => {
    const state = setUp();
    expect(environments(state)).toEqual(["home", "setting"]);
  });

  it("1B heard neither enter play, and resolved its own When Revealed once it was faceup", () => {
    const state = setUp();
    expect(schemeCounters(state)).toEqual({ revealed1: 1 });
    expect(state.mainScheme.faceupSide).toBeUndefined();
  });

  it("nothing triggers retroactively when 1B becomes active: with two setup-keyword environments and 1A's, all three stay", () => {
    const state = setUp({ secondSetting: true });
    expect(environments(state)).toEqual(["home", "second-setting", "setting"]);
    expect(schemeCounters(state)).toEqual({ revealed1: 1 });
  });

  it("a 1A with no Setup of its own is still the faceup side at step 11: the setup-keyword environments stay", () => {
    const state = setUp({ scheme: QUIET_SCHEME, secondSetting: true });
    expect(environments(state)).toEqual(["second-setting", "setting"]);
    expect(schemeCounters(state)).toEqual({ revealed1: 1 });
  });

  it("without a setup-keyword environment the scenario's own is the only one, as before", () => {
    expect(environments(setUp({ setting: false }))).toEqual(["home"]);
  });
});

describe("once 1B is the faceup side its abilities are live", () => {
  it("a later environment entering play discards each other environment, and 1B's response hears it", () => {
    const before = setUp();
    const after = use(before, BRING, BRING_ABILITY);
    expect(environments(after.state)).toEqual(["later"]);
    expect(discardedFromPlay(after.state, after.events).sort()).toEqual(["home", "setting"]);
    expect(schemeCounters(after.state)).toEqual({ revealed1: 1, heard1: 1 });
  });
});

describe("an advance: the new stage's B side is not active while its A side resolves (RRG 1.8 'Main Scheme', p. 27)", () => {
  it("2A's When Revealed puts an environment into play: neither 1B (gone) nor 2B (not yet faceup) discards the others", () => {
    const before = setUp();
    const after = use(before, ADVANCE, ADVANCE_ABILITY);
    expect(after.state.mainScheme.stageIndex).toBe(1);
    expect(environments(after.state)).toEqual(["home", "setting", "third"]);
    // Counters stay on the main scheme card across the advance in this fixture; 2B heard nothing and was revealed.
    expect(schemeCounters(after.state).heard2 ?? 0).toBe(0);
    expect(schemeCounters(after.state).heard1 ?? 0).toBe(0);
    expect(schemeCounters(after.state).revealed2).toBe(1);
    expect(turnsToB(after.events)).toEqual([1]);
    expect(after.state.mainScheme.faceupSide).toBeUndefined();
  });

  it("then 2B is live: the next environment to enter play discards each other one, and 2B's response hears it", () => {
    const advanced = use(setUp(), ADVANCE, ADVANCE_ABILITY);
    const after = use(advanced.state, BRING, BRING_ABILITY);
    expect(environments(after.state)).toEqual(["later"]);
    expect(schemeCounters(after.state).heard2).toBe(1);
  });
});

describe("the order is in the log", () => {
  it("setup: the setup-keyword environment enters play, then 1A's, and only then does the stage turn to 1B", () => {
    const created = createGame(
      {
        seed: 21,
        cards: [...DEFAULT_CARDS, SCHEME, SETTING, HOME, LATER, THIRD],
        villainCardId: VILLAIN.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: [SETTING.id, HOME.id, LATER.id, THIRD.id, ...copiesOf(TREACHERY.id, 26)],
        players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK] }],
      },
      deps,
    );
    if (!created.ok) throw new Error(created.error.message);
    const driven = driveSession(startSession(created.state), deps);
    const state = driven.session.state;
    const events = [...created.events, ...driven.events];
    const order = events.flatMap((event) => {
      if (event.type !== "triggerEvent" || event.phase !== "resolved") return [];
      if (event.event.kind === "mainSchemeTurnsToB") return [`turns to B (stage index ${event.event.stageIndex})`];
      if (event.event.kind !== "cardEntersPlay") return [];
      const cardId = mustInstance(state, event.event.instanceId).cardId as string;
      return cardId === SETTING.id || cardId === HOME.id ? [`${cardId} enters play`] : [];
    });
    expect(order).toEqual(["setting enters play", "home enters play", "turns to B (stage index 0)"]);
    expect(environments(state)).toEqual(["home", "setting"]);
    expect(schemeCounters(state)).toEqual({ revealed1: 1 });
  });
});
