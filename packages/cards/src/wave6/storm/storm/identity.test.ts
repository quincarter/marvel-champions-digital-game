import { cardId } from "@mc/content";
import {
  characterProfile,
  createGame,
  hasKeyword,
  keywordTotal,
  separateDeckOf,
  sessionApply,
  startSession,
  replay,
  type Command,
  type GameEvent,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  P1,
  patchInstance,
  playerOf,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { engageMinion } from "../../mut_gen/project-wideawake-testing.js";
import { STORM_IDENTITY, WEATHER_DECK } from "./identity.js";
import { stormGame } from "./support.js";
import { STORM_WEATHER } from "./weather.js";

const CLEAR_SKIES = "36002";
const HURRICANE = "36003";
const THUNDERSTORM = "36004";
const BLIZZARD = "36005";
const WEATHER_CODES = [CLEAR_SKIES, HURRICANE, THUNDERSTORM, BLIZZARD];
const CONTROL = "36001a.weather-control";

/** Picks, at each choice from the WEATHER deck, the card `codes` names next; anything else as `firstLegal`. */
const weatherPicks = (...codes: readonly string[]): Picker => {
  const wanted = [...codes];
  return (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseCards") {
      const option = choice.options.find(
        (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(wanted[0] ?? ""),
      );
      if (option) {
        wanted.shift();
        return [option.optionId];
      }
    }
    return firstLegal(state);
  };
};

/** Storm's game past setup with `code` put into play by "I feel a storm coming...", in hero form. */
const stormWith = (code: string, seed = 1): GameState =>
  withForm(stormGame("rhino", { seed, pick: weatherPicks(code) }), { heroForm: 0 });

const weatherInPlay = (state: GameState): readonly string[] =>
  playerOf(state, P1)
    .playArea.map((id) => state.instances[id]!.cardId as string)
    .filter((code) => WEATHER_CODES.includes(code));
const weatherDeck = (state: GameState) => separateDeckOf(state, P1, WEATHER_DECK);
const one = (state: GameState, code: string): InstanceId => instancesOf(state, code)[0]!;
const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

function settle(session: GameSession, pick: Picker): { session: GameSession; events: GameEvent[] } {
  let current = session;
  const events: GameEvent[] = [];
  for (let guard = 0; current.state.pendingChoice && !current.state.outcome; guard++) {
    if (guard > 200) throw new Error(`choices did not settle (${current.state.pendingChoice.prompt.kind})`);
    const choice = current.state.pendingChoice;
    const result = sessionApply(
      current,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(current.state),
      },
      WAVE6_DEPS,
    );
    if (!result.ok) throw new Error(`resolveChoice rejected: ${result.error.code}: ${result.error.message}`);
    current = result.session;
    events.push(...result.events);
  }
  return { session: current, events };
}

/** Applies `command` through a session, answering every choice with `pick`. */
function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  const result = sessionApply(startSession(state), command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  const settled = settle(result.session, pick);
  return { state: settled.session.state, session: settled.session, events: [...result.events, ...settled.events] };
}

const weatherControl = (state: GameState): Command => use(P1, identityOf(state, P1), CONTROL);

describe("Storm / Ororo Munroe (36001a/b)", () => {
  it("registers the identity refs the card data names, all valid", () => {
    expect(Object.keys(STORM_IDENTITY).sort()).toEqual([
      "36001a.weather-control",
      "36001b.i-feel-a-storm-coming",
      "36001b.ororo-munroe-constant",
    ]);
    for (const definition of Object.values(STORM_IDENTITY)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("36001b.ororo-munroe-constant (the WEATHER deck)", () => {
    it("is reminder text with no effect of its own: setup built the four-card deck outside her player deck", () => {
      expect(STORM_IDENTITY["36001b.ororo-munroe-constant"]).toEqual({ trigger: { kind: "constant" }, effects: [] });
      const config = wave6Scenario("rhino", { seed: 1, players: [{ starterDeckId: "storm-leadership" }] });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const deck = weatherDeck(created.state).deck;
      expect(deck.map((id) => created.state.instances[id]!.cardId).sort()).toEqual(WEATHER_CODES);
      for (const id of deck) expect(inst(created.state, id).faceup).toBe(false);
      const player = playerOf(created.state, P1);
      for (const code of WEATHER_CODES) {
        expect([...player.deck, ...player.hand, ...player.setAside]).not.toContain(one(created.state, code));
      }
    });
  });

  describe("36001b.i-feel-a-storm-coming (Setup)", () => {
    it.each(WEATHER_CODES)("puts the chosen support (%s) into play and shuffles the WEATHER deck after", (code) => {
      const config = wave6Scenario("rhino", { seed: 1, players: [{ starterDeckId: "storm-leadership" }] });
      const created = createGame(config, WAVE6_DEPS);
      if (!created.ok) throw new Error(created.error.message);
      const { session, events } = settle(startSession(created.state), weatherPicks(code));
      const state = session.state;
      expect(weatherInPlay(state)).toEqual([code]);
      const chosen = one(state, code);
      expect(inst(state, chosen)).toMatchObject({ faceup: true, exhausted: false, controllerId: P1 });
      expect(weatherDeck(state).deck).toHaveLength(3);
      expect(weatherDeck(state).deck).not.toContain(chosen);
      for (const id of weatherDeck(state).deck) expect(inst(state, id).faceup).toBe(false);
      const entered = events.findIndex(
        (e) => e.type === "cardMoved" && e.instanceId === chosen && e.to.kind === "playArea",
      );
      const shuffled = events.findIndex(
        (e, i) => i > entered && e.type === "deckShuffled" && e.zone.kind === "separateDeck",
      );
      expect(entered).toBeGreaterThanOrEqual(0);
      expect(shuffled).toBeGreaterThan(entered);
      expect(playerOf(state, P1).identity.form).toBe("alterEgo");
    });
  });

  describe("36001a.weather-control (Weather Control)", () => {
    it("swaps the support in play for the chosen one, which enters play ready, and resolves its Special", () => {
      const start = stormWith(THUNDERSTORM);
      const thunderstorm = one(start, THUNDERSTORM);
      const clearSkies = one(start, CLEAR_SKIES);
      // Exhausted: the incoming support enters ready all the same, and nothing transfers.
      const worn = patchInstance(start, thunderstorm, { exhausted: true });
      const hand = playerOf(worn, P1).hand.length;
      const { state, events } = drive(worn, weatherControl(worn), weatherPicks(CLEAR_SKIES));
      expect(weatherInPlay(state)).toEqual([CLEAR_SKIES]);
      expect(inst(state, clearSkies)).toMatchObject({ faceup: true, exhausted: false, controllerId: P1 });
      expect(weatherDeck(state).deck).toContain(thunderstorm);
      expect(weatherDeck(state).deck).toHaveLength(3);
      expect(inst(state, thunderstorm)).toMatchObject({ faceup: false, exhausted: false });
      expect(ofType(events, "cardsSwapped")).toEqual([
        {
          type: "cardsSwapped",
          how: "leftAndEntered",
          outgoing: thunderstorm,
          incoming: clearSkies,
          cardIds: [cardId(THUNDERSTORM), cardId(CLEAR_SKIES)],
        },
      ]);
      // Storm's own ability moves her permanent support (RRG 1.8 "Permanent", p. 32: same set).
      expect(ofType(events, "leavePlayBlocked")).toEqual([]);
      const swapped = events.findIndex((e) => e.type === "cardsSwapped");
      const shuffled = events.findIndex(
        (e, i) => i > swapped && e.type === "deckShuffled" && e.zone.kind === "separateDeck",
      );
      expect(shuffled).toBeGreaterThan(swapped);
      // Clear Skies' Special, not Thunderstorm's: draw 1 card.
      expect(playerOf(state, P1).hand).toHaveLength(hand + 1);
      expect(inst(state, villainOf(state)).damage).toBe(inst(worn, villainOf(worn)).damage);
    });

    it("is limited to once per round, and is not live in alter-ego form", () => {
      const start = stormWith(THUNDERSTORM);
      const { state } = drive(start, weatherControl(start), weatherPicks(HURRICANE));
      expect(sessionApply(startSession(state), weatherControl(state), WAVE6_DEPS).ok).toBe(false);
      const alterEgo = withForm(start, "alterEgo");
      expect(sessionApply(startSession(alterEgo), weatherControl(alterEgo), WAVE6_DEPS).ok).toBe(false);
    });

    it("replays deep-equal", () => {
      const start = stormWith(THUNDERSTORM);
      const { session } = drive(start, weatherControl(start), weatherPicks(BLIZZARD));
      expect(session.state.pendingChoice).toBeNull();
      const replayed = replay(session.log, WAVE6_DEPS);
      if (!replayed.ok) throw new Error(replayed.error.message);
      expect(replayed.state).toEqual(session.state);
    });
  });
});

describe("Storm's WEATHER supports (36002-36005)", () => {
  it("registers each support's constant and Special, all valid", () => {
    expect(Object.keys(STORM_WEATHER).sort()).toEqual([
      "36002.clear-skies-constant",
      "36002.clear-skies-special",
      "36003.hurricane-constant",
      "36003.hurricane-special",
      "36004.thunderstorm-constant",
      "36004.thunderstorm-special",
      "36005.blizzard-constant",
      "36005.blizzard-special",
    ]);
    for (const definition of Object.values(STORM_WEATHER)) expect(validateDefinition(definition)).toEqual([]);
  });

  it("are permanent", () => {
    const state = stormWith(CLEAR_SKIES);
    for (const code of WEATHER_CODES) expect(hasKeyword(state, one(state, code), "permanent", WAVE6_DEPS)).toBe(true);
  });

  describe("36002.clear-skies-constant / -special (Clear Skies)", () => {
    it("each character gains stalwart, friendly and enemy, only while it is in play", () => {
      const state = stormWith(CLEAR_SKIES);
      expect(hasKeyword(state, identityOf(state, P1), "stalwart", WAVE6_DEPS)).toBe(true);
      expect(hasKeyword(state, villainOf(state), "stalwart", WAVE6_DEPS)).toBe(true);
      const other = stormWith(HURRICANE);
      expect(hasKeyword(other, identityOf(other, P1), "stalwart", WAVE6_DEPS)).toBe(false);
      expect(hasKeyword(other, villainOf(other), "stalwart", WAVE6_DEPS)).toBe(false);
    });

    it("Special: draw 1 card", () => {
      const start = stormWith(HURRICANE);
      const { state } = drive(start, weatherControl(start), weatherPicks(CLEAR_SKIES));
      expect(playerOf(state, P1).hand).toHaveLength(playerOf(start, P1).hand.length + 1);
    });
  });

  describe("36003.hurricane-constant / -special (Hurricane)", () => {
    it("each character gains retaliate 1, friendly and enemy", () => {
      const state = stormWith(HURRICANE);
      expect(keywordTotal(state, identityOf(state, P1), "retaliate", WAVE6_DEPS)).toBe(1);
      expect(keywordTotal(state, villainOf(state), "retaliate", WAVE6_DEPS)).toBe(1);
      const other = stormWith(CLEAR_SKIES);
      expect(keywordTotal(other, identityOf(other, P1), "retaliate", WAVE6_DEPS)).toBe(0);
      expect(keywordTotal(other, villainOf(other), "retaliate", WAVE6_DEPS)).toBe(0);
    });

    it("Special: remove 2 threat from a scheme (not a thwart)", () => {
      const base = stormWith(CLEAR_SKIES);
      const scheme = base.mainScheme.instanceId;
      const start = patchInstance(base, scheme, { threat: 5 });
      const { state, events } = drive(start, weatherControl(start), weatherPicks(HURRICANE));
      expect(inst(state, scheme).threat).toBe(3);
      expect(events.some((e) => e.type === "triggerEvent" && e.event.kind === "thwart")).toBe(false);
    });
  });

  describe("36004.thunderstorm-constant / -special (Thunderstorm)", () => {
    it("each character gets +1 ATK, friendly and enemy", () => {
      const state = stormWith(THUNDERSTORM);
      const plain = stormWith(CLEAR_SKIES);
      expect(characterProfile(state, identityOf(state, P1), WAVE6_DEPS)!.atk).toBe(3);
      expect(characterProfile(plain, identityOf(plain, P1), WAVE6_DEPS)!.atk).toBe(2);
      expect(characterProfile(state, villainOf(state), WAVE6_DEPS)!.atk).toBe(
        characterProfile(plain, villainOf(plain), WAVE6_DEPS)!.atk + 1,
      );
    });

    it("Special: deal 2 damage to an enemy (not an attack)", () => {
      const start = stormWith(CLEAR_SKIES);
      const villain = villainOf(start);
      const { state } = drive(start, weatherControl(start), weatherPicks(THUNDERSTORM));
      expect(inst(state, villain).damage).toBe(inst(start, villain).damage + 2);
    });
  });

  describe("36005.blizzard-constant / -special (Blizzard)", () => {
    it("each character gets -1 ATK, friendly and enemy", () => {
      const state = stormWith(BLIZZARD);
      const plain = stormWith(CLEAR_SKIES);
      expect(characterProfile(state, identityOf(state, P1), WAVE6_DEPS)!.atk).toBe(1);
      expect(characterProfile(state, villainOf(state), WAVE6_DEPS)!.atk).toBe(
        characterProfile(plain, villainOf(plain), WAVE6_DEPS)!.atk - 1,
      );
    });

    it("Special: a non-ELITE minion's text box is blank until the end of the round (its guard is gone)", () => {
      const { state: engaged, id: mercenary } = engageMinion(stormWith(CLEAR_SKIES), "01101", P1);
      expect(hasKeyword(engaged, mercenary, "guard", WAVE6_DEPS)).toBe(true);
      const { state } = drive(engaged, weatherControl(engaged), weatherPicks(BLIZZARD));
      expect(weatherInPlay(state)).toEqual([BLIZZARD]);
      expect(hasKeyword(state, mercenary, "guard", WAVE6_DEPS)).toBe(false);
      expect(state.lastingEffects.filter((l) => l.kind === "blankTextBox")).toEqual([
        expect.objectContaining({ kind: "blankTextBox", targets: [mercenary], duration: { kind: "endOfRound" } }),
      ]);
    });

    it("Special: an ELITE minion is never offered; with no non-ELITE minion it does nothing", () => {
      const { state: engaged, id: sandman } = engageMinion(stormWith(CLEAR_SKIES), "01102", P1);
      const { state } = drive(engaged, weatherControl(engaged), weatherPicks(BLIZZARD));
      expect(weatherInPlay(state)).toEqual([BLIZZARD]);
      expect(state.lastingEffects.filter((l) => l.kind === "blankTextBox")).toEqual([]);
      expect(hasKeyword(state, sandman, "toughness", WAVE6_DEPS)).toBe(true);
    });
  });
});
