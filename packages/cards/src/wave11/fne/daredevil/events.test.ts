import { FNE_STARTER_DECKS, PLAYABLE_CARDS, trait } from "@mc/content";
import { createGame, separateDeckOf, type EngineDeps, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  moveToHand,
  patchInstance,
  play,
  runWith,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { constant, gainsTrait } from "../../../dsl/index.js";
import { playFromHand, withForm } from "../../../testing/staging.js";
import { engageMinion } from "../../../wave9/falcon/testing.js";
import { WAVE11_DEPS } from "../../index.js";
import { FNE_DAREDEVIL_EVENTS as REGISTRY, FNE_DAREDEVIL_EVENTS_SKIPPED as SKIPPED } from "./events.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Daredevil's events (docs/phase7-wave11.md section 8.4 line 3) from the printed starter deck `fne-daredevil-justice`
 * against Core's Rhino. Upgrades are staged onto enemies and the main scheme by surgery (Sense card 60002); Rhino has
 * no guard, so every enemy is attackable. Raising Hell follows owner question 1 = A (section 4.1). The Aerial branch
 * of Raising Hell (3 per upgrade) is not exercised: Daredevil has no way to gain the trait in this pool yet.
 */
const CROSS = "60008";
const DEPOSITION = "60009";
const LIE_DETECTOR = "60010";
const RAISING_HELL = "60011";
const REFS = [
  "60008.cross-examination-action",
  "60009.deposition-action",
  "60010.living-lie-detector-action",
  "60011.raising-hell-action",
];

function newGame(seed = 1): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-daredevil-justice")!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: PLAYABLE_CARDS,
  } as never);
  const seat = {
    identityCardId: deck.identityCardId,
    aspects: deck.aspects,
    deck: deck.cards.flatMap(({ cardId: id, quantity }) => Array.from({ length: quantity }, () => id)),
  };
  const created = createGame({ ...config, players: [seat] }, WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
}

const heroGame = (): GameState => withForm(newGame(), { heroForm: 0 });
const villainOf = (s: GameState): InstanceId => s.activeVillainId!;

/** Stages `n` upgrades attached to `host`, by surgery. */
function withUpgrades(state: GameState, host: InstanceId, n: number): GameState {
  let current = state;
  for (let i = 0; i < n; i++) {
    const id = `u-${host}-${i}` as InstanceId;
    const instance = {
      instanceId: id,
      cardId: "60002",
      ownerId: P1,
      controllerId: P1,
      home: { kind: "playArea", playerId: P1 },
      faceup: true,
      exhausted: false,
      damage: 0,
      threat: 0,
      statuses: { stunned: 0, confused: 0, tough: 0 },
      counters: {},
      attachedTo: host,
      attachments: [],
      boostCards: [],
      tucked: [],
      facedownAs: null,
      engagedWith: null,
      flipped: false,
    } as never;
    current = { ...current, instances: { ...current.instances, [id]: instance } };
    current = patchInstance(current, host, { attachments: [...inst(current, host).attachments, id] });
  }
  return current;
}

/** Answers a "how many" prompt with `n` and any other prompt with the first legal choice. */
const numbers =
  (n: number): Picker =>
  (s) =>
    s.pendingChoice?.prompt.kind === "chooseNumber" ? [String(n)] : firstLegal(s);

/** The maximum of the "how many" prompt the event puts, if it puts one. */
const askedMax = (state: GameState, code: string, cost: number): number | undefined => {
  let seen: number | undefined;
  playFromHand(WAVE11_DEPS, state, code, cost, (s) => {
    const prompt = s.pendingChoice?.prompt;
    if (prompt?.kind === "chooseNumber") seen = prompt.max;
    return firstLegal(s);
  });
  return seen;
};

const AGGRESSIVE_ENERGY = "32047";
const accepting: Picker = (s) =>
  s.pendingChoice?.prompt.kind === "chooseTriggers" ? s.pendingChoice.options.map((o) => o.optionId) : firstLegal(s);

/**
 * Plays the event paying with a copy of Aggressive Energy (June 25, 2026 R2: +1 damage to each enemy the event
 * damages) and then other cards for the rest of the cost. The copy is made by relabelling a hand card.
 */
function withAggressiveEnergy(state: GameState, code: string, cost: number, deps: EngineDeps = WAVE11_DEPS) {
  const given = moveToHand(state, P1, code);
  const [event] = given.ids as [InstanceId];
  const others = given.state.players.find((p) => p.playerId === P1)!.hand.filter((i) => i !== event);
  const energy = others[0]!;
  const relabelled = patchInstance(given.state, energy, { cardId: AGGRESSIVE_ENERGY as never });
  const payment = [energy, ...others.slice(1, cost)];
  return settle(runWith(deps, relabelled, play(P1, event, payment)), accepting, undefined, deps);
}

const senseDeck = (s: GameState) => separateDeckOf(s, P1, "Sense").deck;
const handSize = (s: GameState) => s.players.find((p) => p.playerId === P1)!.hand.length;
const withMainThreat = (s: GameState, threat: number) => patchInstance(s, s.mainScheme.instanceId, { threat });

describe("wave 11 fne/daredevil/events", () => {
  it("registers only valid definitions", () => {
    for (const id of Object.keys(REGISTRY)) expect(validateDefinition(REGISTRY[id]!), id).toEqual([]);
  });

  it("scripts all four events, so nothing is skipped", () => {
    expect(Object.keys(REGISTRY).sort()).toEqual([...REFS].sort());
    expect(SKIPPED).toEqual({});
  });

  describe("60008.cross-examination-action", () => {
    it("deals 3 to an enemy with no upgrades and asks for no extra", () => {
      const s = heroGame();
      expect(askedMax(s, CROSS, 1)).toBeUndefined();
      const { state } = playFromHand(WAVE11_DEPS, s, CROSS, 1);
      expect(inst(state, villainOf(state)).damage).toBe(3);
    });

    it("may add 1 per upgrade on the chosen enemy: asked 0 to the count; all, some or none", () => {
      const s = heroGame();
      const base = withUpgrades(s, villainOf(s), 2);
      expect(askedMax(base, CROSS, 1)).toBe(2);
      for (const [pick, damage] of [
        [2, 5],
        [1, 4],
        [0, 3],
      ] as const) {
        const { state } = playFromHand(WAVE11_DEPS, base, CROSS, 1, numbers(pick));
        expect(inst(state, villainOf(state)).damage, `pick ${pick}`).toBe(damage);
      }
    });

    it("Aggressive Energy (June 25, 2026 R2) adds its +1 once to the one summed attack", () => {
      const s = heroGame();
      const base = withUpgrades(s, villainOf(s), 2);
      const after = withAggressiveEnergy(base, CROSS, 1);
      // 3 + 0 chosen upgrades (first legal answer) + 1; the energy is the only payment for a cost of 1.
      expect(inst(after, villainOf(after)).damage).toBe(4);
    });

    it("counts only the upgrades on the chosen enemy", () => {
      const engaged = engageMinion(heroGame(), "01102", "m-sandman");
      const staged = withUpgrades(engaged, "m-sandman" as InstanceId, 3);
      // The villain, the first legal target, has none.
      expect(askedMax(staged, CROSS, 1)).toBeUndefined();
    });
  });

  describe("60010.living-lie-detector-action", () => {
    it("removes 2 threat, and 1 more per upgrade on that scheme that he chooses", () => {
      const s = heroGame();
      const start = withMainThreat(withUpgrades(s, s.mainScheme.instanceId, 2), 9);
      expect(askedMax(start, LIE_DETECTOR, 1)).toBe(2);
      for (const [pick, left] of [
        [2, 5],
        [1, 6],
        [0, 7],
      ] as const) {
        const { state } = playFromHand(WAVE11_DEPS, start, LIE_DETECTOR, 1, numbers(pick));
        expect(mainThreat(state), `pick ${pick}`).toBe(left);
      }
    });

    it("is a plain thwart of 2 on a scheme with no upgrades, from the alter-ego face too (Action)", () => {
      const { state } = playFromHand(WAVE11_DEPS, withMainThreat(newGame(), 9), LIE_DETECTOR, 1);
      expect(mainThreat(state)).toBe(7);
    });
  });

  describe("60009.deposition-action", () => {
    const alterEgo = (): GameState => withMainThreat(newGame(), 9);

    it("plays a chosen Sense upgrade free from the deck, leaves the rest in order, then removes 2 threat", () => {
      const start = alterEgo();
      const before = senseDeck(start);
      const third = before[2]!;
      const pick: Picker = (s) => {
        const choice = s.pendingChoice;
        const wanted = choice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === third);
        return wanted ? [wanted.optionId] : firstLegal(s);
      };
      const { state } = playFromHand(WAVE11_DEPS, start, DEPOSITION, 1, pick);
      expect(senseDeck(state)).toEqual(before.filter((i) => i !== third));
      expect(inst(state, third).attachedTo).not.toBeNull();
      expect(mainThreat(state)).toBe(7);
      // Only the event's own cost of 1 was paid (the event is added to the hand, then leaves it with the paid card):
      // the upgrade's cost was ignored.
      expect(handSize(state)).toBe(handSize(start) - 1);
    });

    it("may decline the play: the Sense deck is untouched and the threat is still removed", () => {
      const start = alterEgo();
      const before = senseDeck(start);
      // The Sense-deck choice is the only prompt that may be answered with nothing (min 0): decline it.
      const decline: Picker = (s) =>
        s.pendingChoice?.prompt.kind === "chooseCards" && s.pendingChoice.minSelections === 0 ? [] : firstLegal(s);
      const { state } = playFromHand(WAVE11_DEPS, start, DEPOSITION, 1, decline);
      expect(senseDeck(state)).toEqual(before);
      expect(mainThreat(state)).toBe(7);
    });
  });

  describe("60011.raising-hell-action", () => {
    it("deals 2 damage to each enemy for each upgrade on it, and attacks an enemy with none not at all", () => {
      const engaged = engageMinion(engageMinion(heroGame(), "01102", "m-sandman"), "01103", "m-shocker");
      const staged = withUpgrades(withUpgrades(engaged, villainOf(engaged), 2), "m-sandman" as InstanceId, 1);
      const { state } = playFromHand(WAVE11_DEPS, staged, RAISING_HELL, 2);
      expect(inst(state, villainOf(state)).damage).toBe(4);
      // Sandman (4 hit points) takes 2; the Shocker (no upgrades) is untouched.
      expect(inst(state, "m-sandman" as InstanceId).damage).toBe(2);
      expect(inst(state, "m-shocker" as InstanceId).damage).toBe(0);
      // Not attacked, so it did not retaliate either.
      expect(inst(state, identityOf(state)).damage).toBe(0);
    });

    it("Aggressive Energy (June 25, 2026 R2): +1 to each enemy damaged (2 upgrades: 4 + 1; 1 upgrade: 2 + 1)", () => {
      const engaged = engageMinion(heroGame(), "01102", "m-sandman");
      const staged = withUpgrades(withUpgrades(engaged, villainOf(engaged), 2), "m-sandman" as InstanceId, 1);
      const after = withAggressiveEnergy(staged, RAISING_HELL, 2);
      expect(inst(after, villainOf(after)).damage).toBe(5);
      expect(inst(after, "m-sandman" as InstanceId).damage).toBe(3);
    });

    it("deals 3 per upgrade when Daredevil has the Aerial trait", () => {
      const deps: EngineDeps = {
        abilities: {
          ...WAVE11_DEPS.abilities,
          // Test override: the hero face's Forced Interrupt id stands in for a constant that grants Aerial.
          "60001a.daredevil-forced-interrupt": constant(gainsTrait(trait("AERIAL"), { self: true })),
        },
      };
      const s = heroGame();
      const staged = withUpgrades(s, villainOf(s), 2);
      const { state } = playFromHand(deps, staged, RAISING_HELL, 2);
      expect(inst(state, villainOf(state)).damage).toBe(6);
    });

    it("attacks no enemy without an upgrade: a retaliate minion with none deals nothing back (question 1 = A)", () => {
      // Whiplash (Core 01172) has retaliate 1, so an attack on him would hurt the hero.
      const engaged = engageMinion(heroGame(), "01172", "m-retaliate");
      const staged = withUpgrades(engaged, villainOf(engaged), 1);
      const { state } = playFromHand(WAVE11_DEPS, staged, RAISING_HELL, 2);
      expect(inst(state, villainOf(state)).damage).toBe(2);
      expect(inst(state, "m-retaliate" as InstanceId).damage).toBe(0);
      expect(inst(state, identityOf(state)).damage).toBe(0);
    });

    it("does nothing when no enemy has an upgrade (question 1 = A)", () => {
      const { state } = playFromHand(WAVE11_DEPS, heroGame(), RAISING_HELL, 2);
      expect(inst(state, villainOf(state)).damage).toBe(0);
    });
  });
});
