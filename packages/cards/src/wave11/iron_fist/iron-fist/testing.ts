import { cardId } from "@mc/content";
import {
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { expect } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import {
  P1,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  putOnTopOfDeck,
  play,
  settle,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE11_ABILITIES, WAVE11_CARDS } from "../../index.js";

/** Test support for the Iron Fist module tests: a hand-built Iron Fist deck against Core's Rhino. */
export const IF_DEPS: EngineDeps = { abilities: WAVE11_ABILITIES };
export const FILLER = "01091"; // Avengers Mansion: one resource when paid with

export function ironFistGame(form: "hero" | "alterEgo" = "hero"): GameState {
  const base = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: WAVE11_CARDS,
  } as never);
  const deck = [
    "64002",
    "64003",
    "64004",
    "64005",
    "64006",
    "64007",
    "64008",
    "64009",
    "64010",
    "64011",
    "64012",
    ...Array(40).fill(FILLER),
  ].slice(0, 40);
  const created = createGame(
    {
      ...base,
      requireLegalDecks: false,
      players: [{ identityCardId: cardId("64001a"), aspects: ["leadership"], deck: deck.map((c) => cardId(c)) }],
    },
    IF_DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", IF_DEPS);
  return form === "hero" ? withForm(settled, { heroForm: 0 }) : withForm(settled, "alterEgo");
}

export const chiOf = (s: GameState): number => inst(s, identityOf(s)).counters["chi"] ?? 0;
export const withChi = (s: GameState, n: number): GameState =>
  patchInstance(s, identityOf(s), { counters: { ...inst(s, identityOf(s)).counters, chi: n } });

/** Applies a command and answers every prompt with `pick`; checks the log replays to the same state. */
export function drive(state: GameState, command: Command, pick: Picker = firstLegal) {
  let session = startSession(state);
  const events: GameEvent[] = [];
  const first = sessionApply(session, command, IF_DEPS);
  if (!first.ok) throw new Error(`${command.type} rejected: ${first.error.code}: ${first.error.message}`);
  session = first.session;
  events.push(...first.events);
  for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
    if (guard > 100) throw new Error("choices did not settle");
    const choice = session.state.pendingChoice;
    const next = sessionApply(
      session,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      },
      IF_DEPS,
    );
    if (!next.ok) throw new Error(`resolveChoice rejected: ${next.error.code}: ${next.error.message}`);
    session = next.session;
    events.push(...next.events);
  }
  const replayed = replay(session.log, IF_DEPS);
  if (!replayed.ok) throw new Error(replayed.error.message);
  expect(replayed.state).toEqual(session.state);
  return { state: session.state, events };
}

export const rejected = (state: GameState, command: Command): boolean =>
  !sessionApply(startSession(state), command, IF_DEPS).ok;

/** Moves `code` to hand and builds the command to play it, paying `cost` with other hand cards. */
export function staged(state: GameState, code: string, cost: number) {
  const given = moveToHand(state, P1, code);
  const [id] = given.ids as [InstanceId];
  return { state: given.state, id, command: play(P1, id, payWith(given.state, P1, cost, [id])) };
}

/** Takes the option whose label starts with `label` when offered, else `fallback`. */
export const byLabel =
  (label: string, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.label.startsWith(label));
    return hit ? [hit.optionId] : fallback(state);
  };

/** Takes the card option for `target` when offered, else `fallback`. */
export const pickCard =
  (target: InstanceId, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === target);
    return hit ? [hit.optionId] : fallback(state);
  };

/** Answers a "remove N counters" division by taking `n` of the offered counters; anything else as `fallback`. */
export const takeCounters =
  (n: number, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    return choice?.prompt.kind === "divide" ? choice.options.slice(0, n).map((o) => o.optionId) : fallback(state);
  };

/** Puts these cards on top of the deck (after the opening hand has been drawn), in order. */
export function withTopOfDeck(state: GameState, ...codes: readonly string[]): GameState {
  return putOnTopOfDeck(state, P1, ...codes).state;
}

/** Takes the offered trigger or ability option with this ability id; anything else as `fallback`. */
export const takeAbility =
  (abilityId: string, fallback: Picker = firstLegal): Picker =>
  (state) => {
    const hit = state.pendingChoice?.options.find(
      (o) => o.ref.kind === "ability" && o.ref.abilityId === (abilityId as never),
    );
    return hit ? [hit.optionId] : fallback(state);
  };

/** Plays a free upgrade (a Technique) from the hand onto the identity; returns its instance id. */
export function withUpgradeInPlay(state: GameState, code: string) {
  const s = staged(state, code, 0);
  const { state: after } = drive(s.state, s.command);
  return { state: after, id: s.id };
}
