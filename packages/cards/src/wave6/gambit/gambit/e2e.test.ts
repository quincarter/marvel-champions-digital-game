import { GAMBIT_CARDS, GAMBIT_STARTER_DECKS, cardId } from "@mc/content";
import {
  applyCommand,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameLog,
  type GameState,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { playToOutcome } from "../../../testing/driver.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  playerOf,
  stackEncounterDeck,
  use,
} from "../../../testing/harness.js";
import { WAVE6_ABILITIES, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { gambitGame } from "./support.js";

const SEED = 2026;
const CHARGE = "37001a.charge-de-card";
const THROW = "37001a.throw-de-card";
const THIEF = "37001b.thief-extraordinaire";
const TWO_ICONS = "01190"; // Shadow of the Past, 2 boost icons.
const NO_ICONS = "01186"; // Advance, 0 boost icons.

/**
 * Whole games with Gambit's own precon (`gambit-justice`, `packages/content/src/data/gambit/starterDecks.ts`: 40
 * cards), modeled on `../../storm/storm/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome against
 * wave 6 scenarios (solo standard, solo expert, 2 players with Wolverine), each log replaying deep-equal. The games are
 * checked not to be vacuous: across them Gambit's own abilities (Charge de Card, Throw de Card, Thief Extraordinaire)
 * actually resolved. Every ability the driver can use is a real `useAbility` / trigger the engine accepted.
 */

/** Every event of the game, by replaying the log's commands one at a time. */
function eventsOf(log: GameLog): GameEvent[] {
  const events: GameEvent[] = [];
  let state: GameState = log.initialState;
  for (const command of log.commands) {
    const result = applyCommand(state, command, WAVE6_DEPS);
    if (!result.ok) throw new Error(`replay rejected ${command.type}: ${result.error.message}`);
    state = result.state;
    events.push(...result.events);
  }
  return events;
}

const resolved = (events: readonly GameEvent[], abilityId: string): number =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;

const used: Record<string, number> = { [CHARGE]: 0, [THROW]: 0, [THIEF]: 0 };

function greedy(label: string, config: ReturnType<typeof wave6Scenario>): GameState {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] Gambit ${label} (seed ${SEED}): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  const events = eventsOf(result.session.log);
  for (const id of Object.keys(used)) used[id]! += resolved(events, id);
  return result.session.state;
}

describe("Gambit (gambit-justice) precon", () => {
  it("seats with every ability scripted except Bishop's interrupt (the known skip)", () => {
    const deck = GAMBIT_STARTER_DECKS.find((d) => d.id === "gambit-justice")!;
    const codes = new Set<string>(["37001a", "37025", ...deck.cards.map((l) => l.cardId as string)]);
    const cards = GAMBIT_CARDS.filter(
      (c) =>
        codes.has(c.id as string) ||
        ("encounterSetIds" in c && c.encounterSetIds?.some((id) => (id as string) === "gambit_nemesis")),
    );
    expect(cards.length).toBeGreaterThan(deck.cards.length);
    const unscripted = cards.flatMap(abilityRefIds).filter((id) => !(id in WAVE6_ABILITIES));
    expect(unscripted).toEqual(["37011.bishop-interrupt"]);
  });
});

describe("Gambit (gambit-justice) vs wave 6 scenarios", () => {
  it("solo, standard: Sabretooth plays to an outcome and replays deep-equal", () => {
    greedy(
      "solo standard vs Sabretooth",
      wave6Scenario("sabretooth", { players: [{ starterDeckId: "gambit-justice" }], seed: SEED }),
    );
  }, 120_000);

  it("solo, expert: Project Wideawake", () => {
    const config = wave6Scenario("project-wideawake", {
      players: [{ starterDeckId: "gambit-justice" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy("solo expert vs Project Wideawake", config);
  }, 120_000);

  it("2-player, standard: Gambit + Wolverine (Aggression) vs Master Mold", () => {
    greedy(
      "2-player with Wolverine vs Master Mold",
      wave6Scenario("master-mold", {
        players: [{ starterDeckId: "gambit-justice" }, { starterDeckId: "wolverine-aggression" }],
        seed: SEED,
      }),
    );
  }, 120_000);

  it("Gambit's own mechanics happened in the greedy games: charge counters placed, Throw de Card used", () => {
    console.info(`[wave6 e2e] Gambit abilities resolved across the three games: ${JSON.stringify(used)}`);
    expect(used[CHARGE]).toBeGreaterThan(0);
    expect(used[THROW]).toBeGreaterThan(0);
    // The greedy driver turns Remy into Gambit on its first turn and never goes back, so Thief Extraordinaire (an
    // alter-ego action) is exercised by the scripted session below instead.
  });

  it("scripted: Remy's Thief Extraordinaire discards the 2-icon card he picks and removes 2 threat, and the log replays", () => {
    const base = gambitGame("rhino", { seed: SEED });
    const top = stackEncounterDeck(base, TWO_ICONS, NO_ICONS);
    const staged = patchInstance(top, top.mainScheme.instanceId, { threat: 6 });
    expect(playerOf(staged, P1).identity.form).toBe("alterEgo");
    const remy = identityOf(staged, P1);
    let session = startSession(staged);
    const events: GameEvent[] = [];
    const step = (command: Command) => {
      const result = sessionApply(session, command, WAVE6_DEPS);
      if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
      session = result.session;
      events.push(...result.events);
    };
    const twoIcons = (state: GameState): readonly string[] => {
      const choice = state.pendingChoice!;
      const option = choice.options.find(
        (o) => o.ref.kind === "card" && state.instances[o.ref.instanceId]?.cardId === cardId(TWO_ICONS),
      );
      return option ? [option.optionId] : firstLegal(state);
    };
    step(use(P1, remy, THIEF));
    for (let guard = 0; session.state.pendingChoice; guard++) {
      if (guard > 20) throw new Error("choices did not settle");
      const choice = session.state.pendingChoice;
      step({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: twoIcons(session.state),
      });
    }
    expect(resolved(events, THIEF)).toBe(1);
    expect(inst(session.state, session.state.mainScheme.instanceId).threat).toBe(4);
    expect(inst(session.state, remy).exhausted).toBe(true);
    const replayed = replay(session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(session.state);
  });
});
