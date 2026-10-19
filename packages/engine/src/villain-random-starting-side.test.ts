/**
 * docs/phase7-wave11-scenarios.md §S3.4: a villain put into play on a random side, and toughness on a villain face a
 * flip reveals. Synthetic cards shaped like Typhoid Mary (`fne` 60110/60111: one villain card, two faces per stage,
 * toughness on one face of stage B) and Disturbed Psyche (60112: "Setup. Setup: Put the villain into play on a random
 * side (and reveal it).").
 *
 * Sources: RRG 1.8 "Setup (Triggered Ability)" (p. 40: encounter cards' Setup abilities resolve in step 12),
 * Appendix II (p. 51), "Toughness" (p. 45), "Flip" (p. 20: a flip of the same card type keeps status cards); MC60 p. 26
 * FAQ (when Typhoid Mary (B) flips, "the ability or keyword on her new faceup side resolves"); FAQ "Dial M for Mojo
 * (#35)" (a villain's flip reveals the new face). The step 12 placing of the side draw is an engine interpretation
 * (§S3.4 (a)).
 */

import { flat, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { EngineDeps } from "./abilities.js";
import { replay, startSession } from "./engine.js";
import type { GameEvent } from "./events.js";
import type { InstanceId } from "./ids.js";
import { activeVillain, mustInstance } from "./query.js";
import { createGame } from "./setup.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { driveSession } from "./testing/drive.js";
import { stubEnvironment, stubEvent, stubMainScheme, stubVillain } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, TREACHERY } from "./testing/scenario.js";
import { copiesOf, playFree } from "./testing/wave3.js";

const one = { kind: "const", value: 1 } as const;
const self = { kind: "self" } as const;
const villain = { kind: "villain" } as const;
const counter = (id: string, counterType: string, trigger: StubAbility["definition"]["trigger"]) =>
  stubAbility(id, { trigger, effects: [{ kind: "addCounters", target: self, counterType, amount: one }] });

// Each face's When Revealed and Setup leave a counter named for the face, so a test can read which face resolved.
const FRONT_REVEALED = counter("mary.front.when-revealed", "frontRevealed", { kind: "whenRevealed" });
const BACK_REVEALED = counter("mary.back.when-revealed", "backRevealed", { kind: "whenRevealed" });
const FRONT_SETUP = counter("mary.front.setup", "frontSetup", { kind: "setup" });
const BACK_SETUP = counter("mary.back.setup", "backSetup", { kind: "setup" });
const stage = (abilities: readonly StubAbility[], tough = false) => ({
  hp: flat(10),
  atk: 1,
  sch: 1,
  keywords: tough ? [{ name: "toughness" as const }] : [],
  traits: [],
  abilities: abilities.map((a) => a.ref),
});
/** Front: no toughness. Back: toughness on its first stage (Typhoid Mary's B face carries it on stage B). */
const MARY = stubVillain({
  id: "mary",
  name: "Bloody",
  stages: [stage([FRONT_REVEALED, FRONT_SETUP])],
  back: { name: "Typhoid", stages: [stage([BACK_REVEALED, BACK_SETUP], true)] },
});

const RANDOM_SIDE = stubAbility("psyche.setup", {
  trigger: { kind: "setup" },
  effects: [{ kind: "setVillainSide", villain, side: "random" }],
});
const PSYCHE = stubEnvironment({ id: "psyche", keywords: [{ name: "setup" }], abilities: [RANDOM_SIDE.ref] });

/** 1A's Setup and 1B's When Revealed leave counters on the scheme, to place them against the villain's. */
const SCHEME_A_SETUP = counter("scheme.1a.setup", "schemeSetup", { kind: "setup" });
const SCHEME_B_REVEALED = counter("scheme.1b.when-revealed", "schemeRevealed", { kind: "whenRevealed" });
const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(50), acceleration: flat(0) }],
});
const SCHEME_WITH_TEXT = stubMainScheme({
  id: "scheme-with-text",
  stages: [
    {
      startingThreat: flat(0),
      targetThreat: flat(50),
      acceleration: flat(0),
      aSideAbilities: [SCHEME_A_SETUP.ref],
      abilities: [SCHEME_B_REVEALED.ref],
    },
  ],
});

const action = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, { trigger: { kind: "action" }, effects });
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const FLIP = action("flip-villain", [{ kind: "flipCard", target: villain }]);
const FORM_NO_REVEAL = (trait: string) =>
  action(`form-${trait}`, [{ kind: "changeVillainForm", villain, toFaceWithTrait: trait as never, reveal: false }]);

const deps: EngineDeps = depsOf(
  FRONT_REVEALED,
  BACK_REVEALED,
  FRONT_SETUP,
  BACK_SETUP,
  RANDOM_SIDE,
  SCHEME_A_SETUP,
  SCHEME_B_REVEALED,
  FLIP.ability,
);

function start(seed: number, options: { readonly psyche?: boolean } = {}) {
  const encounter: readonly CardId[] = [
    ...(options.psyche === false ? [] : [PSYCHE.id]),
    ...copiesOf(TREACHERY.id, 20),
  ];
  const created = createGame(
    {
      seed,
      cards: [...DEFAULT_CARDS, MARY, SCHEME_WITH_TEXT, PSYCHE, FLIP.card],
      villainCardId: MARY.id,
      mainSchemeCardId: SCHEME_WITH_TEXT.id,
      encounterDeck: encounter,
      players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, FLIP.card.id] }],
    },
    deps,
  );
  if (!created.ok) throw new Error(created.error.message);
  const driven = driveSession(startSession(created.state), deps);
  return { state: driven.session.state, events: [...created.events, ...driven.events] };
}

const counters = (state: GameState, id: InstanceId) => mustInstance(state, id).counters;
const tough = (state: GameState) => mustInstance(state, activeVillain(state).instanceId).statuses.tough;
const sideSets = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { type: "villainSideSet" }> => e.type === "villainSideSet");
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe("§S3.4 (a) a villain put into play on a random side", () => {
  it("draws a side from the seed: both sides occur across seeds, and each seed always draws the same one", () => {
    const sides = SEEDS.map((seed) => activeVillain(start(seed).state).side);
    expect(new Set(sides)).toEqual(new Set(["A", "B"]));
    expect(SEEDS.map((seed) => activeVillain(start(seed).state).side)).toEqual(sides);
  });

  it("logs one villainSideSet, random, naming the face that is up", () => {
    for (const seed of SEEDS) {
      const { state, events } = start(seed);
      const [set, ...more] = sideSets(events);
      expect(more).toEqual([]);
      expect(set).toMatchObject({ instanceId: activeVillain(state).instanceId, from: "A", random: true });
      expect(set?.to).toBe(activeVillain(state).side);
    }
  });

  it("step 12c resolves the chosen face's Setup and When Revealed once, and nothing of the other face", () => {
    for (const seed of SEEDS) {
      const { state } = start(seed);
      const mary = activeVillain(state);
      const own = mary.side === "A" ? { frontSetup: 1, frontRevealed: 1 } : { backSetup: 1, backRevealed: 1 };
      expect(counters(state, mary.instanceId)).toEqual(own);
    }
  });

  it("the face it lands on gives its tough status card; the other face gives none", () => {
    for (const seed of SEEDS) {
      const { state } = start(seed);
      expect(tough(state)).toBe(activeVillain(state).side === "B" ? 1 : 0);
    }
  });

  it("is no flip and no reveal: no villainFlipped, no encounterCardRevealed for the villain during setup", () => {
    for (const seed of SEEDS) {
      const { state, events } = start(seed);
      const id = activeVillain(state).instanceId;
      expect(events.some((e) => e.type === "villainFlipped")).toBe(false);
      expect(events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === id)).toBe(false);
    }
  });

  it("resolves in step 12 before 12a, and the villain's 12c after 1B's When Revealed", () => {
    const { state, events } = start(1);
    const scheme = state.mainScheme.instanceId;
    const mary = activeVillain(state).instanceId;
    const at = (predicate: (e: GameEvent) => boolean) => events.findIndex(predicate);
    const added = (on: InstanceId, type: string) => (e: GameEvent) =>
      e.type === "counterAdded" && e.instanceId === on && e.counterType === type;
    const drawn = at((e) => e.type === "villainSideSet");
    const schemeSetup = at(added(scheme, "schemeSetup"));
    const schemeRevealed = at(added(scheme, "schemeRevealed"));
    const villainRevealed = Math.max(at(added(mary, "frontRevealed")), at(added(mary, "backRevealed")));
    expect(drawn).toBeGreaterThanOrEqual(0);
    expect(drawn).toBeLessThan(schemeSetup);
    expect(schemeSetup).toBeLessThan(schemeRevealed);
    expect(schemeRevealed).toBeLessThan(villainRevealed);
  });

  it("without an encounter card's Setup ability, the villain keeps its starting side and its step sequence", () => {
    const { state, events } = start(1, { psyche: false });
    expect(activeVillain(state).side).toBe("A");
    expect(sideSets(events)).toEqual([]);
    expect(events.some((e) => e.type === "stepChanged" && e.to.kind === "villainSetupAbilities")).toBe(false);
    expect(counters(state, activeVillain(state).instanceId)).toEqual({ frontSetup: 1, frontRevealed: 1 });
  });

  it("replays to the same state", () => {
    const { session } = playFree(start(3).state, deps, FLIP.card.id);
    const replayed = replay(session.log, deps);
    if (!replayed.ok) throw new Error(replayed.error.message);
    expect(replayed.state).toEqual(session.state);
  });
});

describe("§S3.4 (b) toughness on a villain face a flip reveals (MC60 p. 26 FAQ)", () => {
  const onSide = (side: "A" | "B") => {
    const seed = SEEDS.find((s) => activeVillain(start(s).state).side === side);
    if (seed === undefined) throw new Error(`no seed lands on ${side}`);
    return start(seed).state;
  };

  it("a flip to the face with toughness gives a tough status card, and resolves that face's When Revealed", () => {
    const before = onSide("A");
    const id = activeVillain(before).instanceId;
    const { state } = playFree(before, deps, FLIP.card.id);
    expect(activeVillain(state).side).toBe("B");
    expect(tough(state)).toBe(1);
    expect(counters(state, id).backRevealed).toBe(1);
  });

  it("flipping away keeps the tough card (RRG 1.8 'Flip', p. 20); flipping back gives no second one", () => {
    const flipped = playFree(onSide("A"), deps, FLIP.card.id).state;
    const away = playFree(flipped, deps, FLIP.card.id).state;
    expect(activeVillain(away).side).toBe("A");
    expect(tough(away)).toBe(1);
    const back = playFree(away, deps, FLIP.card.id).state;
    expect(activeVillain(back).side).toBe("B");
    expect(tough(back)).toBe(1);
  });

  it("a used tough card comes back on the next flip to the face with toughness", () => {
    const start = onSide("B");
    const id = activeVillain(start).instanceId;
    const spent: GameState = {
      ...start,
      instances: {
        ...start.instances,
        [id]: { ...mustInstance(start, id), statuses: { ...mustInstance(start, id).statuses, tough: 0 } },
      },
    };
    const away = playFree(spent, deps, FLIP.card.id).state;
    expect(tough(away)).toBe(0);
    expect(tough(playFree(away, deps, FLIP.card.id).state)).toBe(1);
  });
});

describe("§S3.4 (b) a change of form that is no reveal gives no toughness", () => {
  const BACK_TRAIT = "TYPHOID";
  const FORM = FORM_NO_REVEAL(BACK_TRAIT);
  const TRAITED = stubVillain({
    id: "traited",
    stages: [stage([])],
    back: { name: "Traited (B)", stages: [{ ...stage([], true), traits: [BACK_TRAIT as never] }] },
  });
  const formDeps = depsOf(FORM.ability);

  it("changeVillainForm reveal: false turns the face and places no tough card", () => {
    const created = createGame(
      {
        seed: 1,
        cards: [...DEFAULT_CARDS, TRAITED, SCHEME, FORM.card],
        villainCardId: TRAITED.id,
        mainSchemeCardId: SCHEME.id,
        encounterDeck: copiesOf(TREACHERY.id, 20),
        players: [{ identityCardId: HERO.id, deck: [...DEFAULT_DECK, FORM.card.id] }],
      },
      formDeps,
    );
    if (!created.ok) throw new Error(created.error.message);
    const before = driveSession(startSession(created.state), formDeps).session.state;
    const { state } = playFree(before, formDeps, FORM.card.id);
    expect(activeVillain(state).side).toBe("B");
    expect(tough(state)).toBe(0);
  });
});
