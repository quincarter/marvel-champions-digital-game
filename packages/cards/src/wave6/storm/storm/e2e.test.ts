import { cardId } from "@mc/content";
import {
  applyCommand,
  cardsInPlay,
  createGame,
  replay,
  separateDeckOf,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { playToOutcome } from "../../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  play,
  playerOf,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { WEATHER_DECK } from "./identity.js";
import { stormGame } from "./support.js";

const SEED = 2026;
const ADVANCE = "01186";
const WEATHER_CODES = ["36002", "36003", "36004", "36005"];
const THUNDERSTORM = "36004";

/**
 * Whole games with Storm's own precon (`storm-leadership`, `packages/content/src/data/storm/starterDecks.ts`: 40 cards
 * plus the WEATHER deck), modeled on `../../wolv/wolverine/e2e.test.ts`: the card-name-agnostic greedy driver to a real
 * outcome (solo, 2-player with Wolverine, expert), with every card of the kit scripted, and hand-scripted sessions
 * through it (Lightning Bolt resolving Thunderstorm's Special with Storm's Cape readying her; Claustrophobia flipping
 * her, holding her in alter-ego form and removed by its own action). Every scripted step goes through `sessionApply`,
 * so each log replays deep-equal.
 */

function settle(session: GameSession, pick: Picker): GameSession {
  let current = session;
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
  }
  return current;
}

function step(session: GameSession, command: Command, pick: Picker = firstLegal): GameSession {
  const result = sessionApply(session, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return settle(result.session, pick);
}

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

const villainOf = (state: GameState): InstanceId => state.villains[0]!.instanceId;
const costOf = (state: GameState, code: string): number =>
  (state.cardPool[cardId(code)] as { cost?: number }).cost ?? 0;

/** Picks, at each choice from the WEATHER deck, the card `code` names; anything else as `firstLegal`. */
const weatherPick =
  (code: string): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const option = choice?.options.find(
      (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(code),
    );
    return choice?.prompt.kind === "chooseCards" && option ? [option.optionId] : firstLegal(state);
  };
/** Takes every optional trigger whose label contains `text`; then targets `id` where offered; otherwise `firstLegal`. */
const accepting =
  (text: string, id?: InstanceId): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      return choice.options.filter((o) => o.label.includes(text) || o.optionId.includes(text)).map((o) => o.optionId);
    }
    if (id && choice?.options.some((o) => o.optionId === id)) return [id];
    return firstLegal(state);
  };

function greedy(config: ReturnType<typeof wave6Scenario>): GameState {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] Storm: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  return result.session.state;
}

/** The four WEATHER supports never leave the WEATHER deck except into play, one at a time. */
function expectWeatherIntact(state: GameState): void {
  const weather = Object.values(state.instances).filter((i) => WEATHER_CODES.includes(i.cardId));
  expect(weather).toHaveLength(4);
  const inPlay = weather.filter((i) => cardsInPlay(state).includes(i.instanceId));
  const inDeck = weather.filter((i) => separateDeckOf(state, P1, WEATHER_DECK).deck.includes(i.instanceId));
  // One in play while she plays; when every player is defeated the permanent supports go back to the WEATHER deck.
  expect(inPlay.length).toBeLessThanOrEqual(1);
  expect(inPlay.length + inDeck.length).toBe(4);
}

describe("Storm (storm-leadership) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    expectWeatherIntact(
      greedy(wave6Scenario("rhino", { players: [{ starterDeckId: "storm-leadership" }], seed: SEED })),
    );
  }, 120_000);

  it("2-player, standard: Storm + Wolverine (Aggression)", () => {
    expectWeatherIntact(
      greedy(
        wave6Scenario("rhino", {
          players: [{ starterDeckId: "storm-leadership" }, { starterDeckId: "wolverine-aggression" }],
          seed: SEED,
        }),
      ),
    );
  }, 120_000);

  it("solo, expert", () => {
    const config = wave6Scenario("rhino", {
      players: [{ starterDeckId: "storm-leadership" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    expectWeatherIntact(greedy(config));
  }, 120_000);

  it("scripted: Lightning Bolt deals 8 plus Thunderstorm's Special 2, and Storm's Cape readies her after the Special", () => {
    const base = withForm(stormGame("rhino", { seed: SEED, pick: weatherPick(THUNDERSTORM) }), { heroForm: 0 });
    expect(instancesOf(base, THUNDERSTORM).some((id) => cardsInPlay(base).includes(id))).toBe(true);
    const stocked: GameState = {
      ...base,
      players: base.players.map((p) =>
        p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, 8)], deck: p.deck.slice(8) } : p,
      ),
    };
    const given = moveToHand(stocked, P1, "36007", "36011");
    const [cape, bolt] = given.ids as [InstanceId, InstanceId];
    const hero = identityOf(given.state, P1);
    const villain = villainOf(given.state);
    // Exhausted (as after a basic power) so the Cape's ready shows.
    let session = startSession(patchInstance(given.state, hero, { exhausted: true }));
    session = step(session, play(P1, cape, payWith(session.state, P1, costOf(session.state, "36007"), [cape, bolt])));
    expect(inst(session.state, cape).attachedTo).toBe(hero);
    const paid = payWith(session.state, P1, costOf(session.state, "36011"), [bolt]);
    session = step(session, play(P1, bolt, paid), accepting("36007", villain));
    expect(inst(session.state, villain).damage).toBe(10);
    expect(inst(session.state, cape).exhausted).toBe(true);
    expect(inst(session.state, hero).exhausted).toBe(false);
    assertReplays(session);
  });

  it("scripted: Claustrophobia flips Storm to alter-ego form, holds her there, and its action removes it", () => {
    const base = withForm(stormGame("rhino", { seed: SEED }), { heroForm: 0 });
    const villain = villainOf(base);
    const stunned = patchInstance(base, villain, { statuses: { ...inst(base, villain).statuses, stunned: 1 } });
    let session = startSession(stackEncounterDeck(stunned, "36030", ADVANCE, ADVANCE));
    session = step(session, { type: "endTurn", playerId: P1 });
    const claustrophobia = instancesOf(session.state, "36030").find((id) => cardsInPlay(session.state).includes(id))!;
    expect(claustrophobia).toBeDefined();
    expect(playerOf(session.state, P1).identity.form).toBe("alterEgo");
    expect(applyCommand(session.state, toHero(P1), WAVE6_DEPS).ok).toBe(false);
    session = step(session, use(P1, claustrophobia, "36030.claustrophobia-action"));
    expect(session.state.removedFromGame).toContain(claustrophobia);
    expect(applyCommand(session.state, toHero(P1), WAVE6_DEPS).ok).toBe(true);
    assertReplays(session);
  });
});
