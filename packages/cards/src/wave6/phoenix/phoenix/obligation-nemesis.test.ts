import { activeVillain, cardsInPlay, iconsOn, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  P1,
  patchInstance,
  runWith,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import {
  driveEventsPicking,
  revealFromEncounterDeck,
  stackSetAside,
  stageNemesisCardForReveal,
  withForm,
} from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { PHOENIX_OBLIGATION_NEMESIS } from "./obligation-nemesis.js";
import { phoenixGame } from "./support.js";

const ADVANCE = "01186";
const forceOf = (state: GameState): InstanceId => instancesOf(state, "34002a")[0]!;
const powerOf = (state: GameState): number => inst(state, forceOf(state)).counters.power ?? 0;
const pass = (state: GameState) => settle(runWith(WAVE6_DEPS, state, endTurn(P1)), firstLegal, undefined, WAVE6_DEPS);
const inPlay = (state: GameState, code: string): InstanceId | undefined =>
  instancesOf(state, code).find((id) => cardsInPlay(state).includes(id));
const resolved = (events: readonly GameEvent[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [e.abilityId as string] : []));
const stunVillain = (state: GameState) =>
  patchInstance(state, activeVillain(state).instanceId, {
    statuses: { ...inst(state, activeVillain(state).instanceId).statuses, stunned: 1 },
  });

/** Phoenix (alter-ego unless `hero`), Phoenix Force Restrained (counters) or Unleashed. The villain is stunned so only the staged reveal acts. */
function staged(opts: { unleashed?: boolean; counters?: number; hero?: boolean } = {}): GameState {
  let state = phoenixGame("rhino", { seed: 1 });
  if (opts.hero) state = withForm(state, { heroForm: 0 });
  state = patchInstance(state, forceOf(state), { flipped: !!opts.unleashed, counters: { power: opts.counters ?? 2 } });
  return stunVillain(state);
}

/** Dark Phoenix and Consume the World revealed from the nemesis set into play. */
function nemesisOut(state: GameState, fillers = 1): GameState {
  const { state: out } = revealFromEncounterDeck(WAVE6_DEPS, state, "34029", firstLegal, fillers);
  return out;
}

describe("Phoenix's obligation and nemesis set (34028-34031)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(PHOENIX_OBLIGATION_NEMESIS).sort()).toEqual([
      "34028.burning-hunger-constant",
      "34028.when-revealed",
      "34029.dark-phoenix-constant",
      "34029.when-revealed",
      "34030.consume-the-world-constant",
      "34030.consume-the-world-forced-response",
      "34031.when-revealed",
    ]);
    for (const definition of Object.values(PHOENIX_OBLIGATION_NEMESIS))
      expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Burning Hunger (34028)", () => {
    const hunger = (state: GameState) => pass(stackEncounterDeck(state, ADVANCE, "34028", ADVANCE));

    it("34028.when-revealed, Unleashed: reveals Dark Phoenix from the set-aside area (and Consume the World) and removes Burning Hunger from the game", () => {
      const before = staged({ unleashed: true });
      const after = hunger(before);
      const [card] = instancesOf(after, "34028");
      expect(inPlay(after, "34029")).toBeDefined();
      expect(inPlay(after, "34030")).toBeDefined();
      expect(after.removedFromGame).toContain(card);
      expect(powerOf(after)).toBe(powerOf(before));
    });

    it("34028.when-revealed, Restrained: removes 1 power counter from Phoenix Force, surges and discards the card", () => {
      const after = hunger(staged({ counters: 3 }));
      const [card] = instancesOf(after, "34028");
      expect(powerOf(after)).toBe(2);
      expect(inPlay(after, "34029")).toBeUndefined();
      expect(after.removedFromGame).not.toContain(card);
      const piles = Object.values(after.encounterDecks)[0]!;
      expect(piles.discard).toContain(card);
      // Surge: the card behind it was revealed as well (Advance is a treachery that lands in the same discard pile).
      expect(piles.discard.filter((i) => after.instances[i]!.cardId === ADVANCE).length).toBeGreaterThanOrEqual(2);
    });

    it("34028.when-revealed, Restrained: removing the last counter flips Phoenix Force to Unleashed", () => {
      const after = hunger(staged({ counters: 1 }));
      expect(powerOf(after)).toBe(0);
      expect(inst(after, forceOf(after)).flipped).toBe(true);
    });
  });

  describe("Dark Phoenix (34029)", () => {
    it("is revealed from the set-aside nemesis cards into play", () => {
      expect(inPlay(nemesisOut(staged()), "34029")).toBeDefined();
    });

    it("34029.when-revealed: searches for Consume the World and reveals it", () => {
      const out = nemesisOut(staged());
      const consume = inPlay(out, "34030")!;
      expect(consume).toBeDefined();
      expect(inst(out, consume).threat).toBe(6);
    });

    it("34029.dark-phoenix-constant: her scheme places its threat on Consume the World, not the main scheme", () => {
      const out = nemesisOut(staged());
      const consume = inPlay(out, "34030")!;
      const beforeThreat = inst(out, consume).threat ?? 0;
      // She schemes in the villain phase against an alter-ego player (the villain stays stunned).
      const dark = inPlay(out, "34029")!;
      const { state, events } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(out, ADVANCE, ADVANCE),
        firstLegal,
        endTurn(P1),
      );
      const scheme = events.find((e) => e.type === "schemeResolved" && e.enemyInstanceId === dark);
      expect(scheme?.type === "schemeResolved" && scheme.schemeInstanceId).toBe(consume);
      expect(scheme?.type === "schemeResolved" && scheme.threatPlaced).toBeGreaterThanOrEqual(2);
      expect(inst(state, consume).threat ?? 0).toBeGreaterThanOrEqual(beforeThreat + 2);
    });
  });

  describe("Consume the World (34030)", () => {
    it("34030.consume-the-world-constant: loses its amplify icon only while it holds no threat", () => {
      const out = nemesisOut(staged());
      const consume = inPlay(out, "34030")!;
      expect(iconsOn(out, WAVE6_DEPS, consume, "amplify")).toBe(1);
      const empty = patchInstance(out, consume, { threat: 0 });
      expect(iconsOn(empty, WAVE6_DEPS, consume, "amplify")).toBe(0);
    });

    it("34030.consume-the-world-forced-response: the players lose once 12 threat is on it", () => {
      const out = nemesisOut(staged());
      const consume = inPlay(out, "34030")!;
      // Fiery Rage with Dark Phoenix gone would put 1 threat there; here Dark Phoenix's own scheme pushes it over.
      const near = patchInstance(out, consume, { threat: 11 });
      const { state } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(near, ADVANCE, ADVANCE),
        firstLegal,
        endTurn(P1),
      );
      expect(inst(state, consume).threat ?? 0).toBeGreaterThanOrEqual(12);
      expect(state.outcome?.result).toBe("loss");
    });

    it("34030.consume-the-world-forced-response: below 12 threat the game goes on", () => {
      const out = nemesisOut(staged());
      const consume = inPlay(out, "34030")!;
      const { state } = driveEventsPicking(
        WAVE6_DEPS,
        stackEncounterDeck(patchInstance(out, consume, { threat: 3 }), ADVANCE, ADVANCE),
        firstLegal,
        endTurn(P1),
      );
      expect(inst(state, consume).threat ?? 0).toBeLessThan(12);
      expect(state.outcome?.result).not.toBe("loss");
    });
  });

  describe("Fiery Rage (34031)", () => {
    const rage = (state: GameState, fillers = 2) => {
      const start = stageNemesisCardForReveal(state, "34031", P1, fillers);
      return driveEventsPicking(WAVE6_DEPS, start, firstLegal, endTurn(P1));
    };
    const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
      events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

    it("34031.when-revealed, Dark Phoenix in play: she activates against you (schemes against an alter-ego)", () => {
      const out = nemesisOut(staged());
      const dark = inPlay(out, "34029")!;
      const { events } = rage(out);
      expect(resolved(events)).toContain("34031.when-revealed");
      expect(of(events, "schemeResolved").map((e) => e.enemyInstanceId)).toContain(dark);
    });

    it("34031.when-revealed, Dark Phoenix in play: she attacks a hero-form player", () => {
      const out = nemesisOut(staged({ hero: true }), 0);
      const dark = inPlay(out, "34029")!;
      const { events } = rage(out, 1);
      expect(of(events, "attackResolved").map((e) => e.enemyInstanceId)).toContain(dark);
    });

    it("34031.when-revealed, Dark Phoenix not in play: 1 threat on Consume the World and this card gains surge", () => {
      // Consume the World alone in play (Dark Phoenix still set aside): the threat goes there, the next card is revealed.
      const out = pass(stackEncounterDeck(stackSetAside(staged(), "34030"), ADVANCE, "34030"));
      const consume = inPlay(out, "34030")!;
      const before = inst(out, consume).threat ?? 0;
      const { state, events } = rage(out, 1);
      expect(inPlay(state, "34029")).toBeUndefined();
      expect(of(events, "threatPlaced").some((e) => e.amount === 1)).toBe(true);
      expect(inst(state, consume).threat ?? 0).toBe(before + 1);
      const piles = Object.values(state.encounterDecks)[0]!;
      expect(piles.discard.filter((i) => state.instances[i]!.cardId === ADVANCE).length).toBeGreaterThanOrEqual(1);
    });
  });
});
