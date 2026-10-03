import { ROGUE_CARDS, ROGUE_STARTER_DECKS } from "@mc/content";
import {
  applyCommand,
  createGame,
  replay,
  sessionApply,
  startSession,
  traitsOf,
  type Command,
  type GameEvent,
  type GameLog,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { abilityRefIds } from "../../../ability-refs.js";
import { playToOutcome } from "../../../testing/driver.js";
import { firstLegal, identityOf, inst, instancesOf, P1, playerOf, use } from "../../../testing/harness.js";
import { withForm } from "../../../testing/staging.js";
import { WAVE6_ABILITIES, WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { rogueGame } from "./support.js";

const SEED = 2026;
const SKIN = "38001a.skin-contact";
const PHASE_RESPONSE = "38001a.rogue-forced-response";
const TOUCHED = "38002";

/**
 * Whole games with Rogue's own precon (`rogue-protection`, `packages/content/src/data/rogue/starterDecks.ts`: 41
 * cards), modeled on `../../gambit/gambit/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome against
 * wave 6 scenarios (solo standard, solo expert, 2 players with Wolverine), each log replaying deep-equal. The games are
 * checked not to be vacuous: across them Touched was found and set aside at a player phase start, Skin Contact was used
 * and a Touched trait grant was live on Rogue.
 */

interface Trace {
  readonly events: GameEvent[];
  /** States after a command in which Touched was attached to a character and Rogue held all of that host's traits. */
  grantsActive: number;
}

/** Every event of the game, and what Touched was doing, by replaying the log's commands one at a time. */
function traceOf(log: GameLog): Trace {
  const trace: Trace = { events: [], grantsActive: 0 };
  let state: GameState = log.initialState;
  for (const command of log.commands) {
    const result = applyCommand(state, command, WAVE6_DEPS);
    if (!result.ok) throw new Error(`replay rejected ${command.type}: ${result.error.message}`);
    state = result.state;
    trace.events.push(...result.events);
    const touched = touchedHost(state);
    if (touched) {
      const rogueTraits = new Set(traitsOf(state, touched.rogue, WAVE6_DEPS).map(String));
      const hostTraits = traitsOf(state, touched.host, WAVE6_DEPS).map(String);
      if (hostTraits.length > 0 && hostTraits.every((t) => rogueTraits.has(t))) trace.grantsActive++;
    }
  }
  return trace;
}

/** Rogue's identity and the character Touched is attached to, when it is attached to a character other than her. */
function touchedHost(state: GameState): { rogue: InstanceId; host: InstanceId } | undefined {
  const rogue = state.players.find(
    (p) =>
      state.cardPool[inst(state, p.identity.instanceId).cardId]?.id === "38001a" ||
      state.cardPool[inst(state, p.identity.instanceId).cardId]?.id === "38001b",
  );
  if (!rogue) return undefined;
  for (const id of instancesOf(state, TOUCHED)) {
    const host = inst(state, id).attachedTo;
    if (host && host !== rogue.identity.instanceId) return { rogue: rogue.identity.instanceId, host };
  }
  return undefined;
}

const resolved = (events: readonly GameEvent[], abilityId: string): number =>
  events.filter((e) => e.type === "abilityResolved" && e.abilityId === abilityId).length;

const totals = { setAside: 0, skin: 0, grants: 0 };

function greedy(label: string, config: ReturnType<typeof wave6Scenario>): GameState {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] Rogue ${label} (seed ${SEED}): ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
  const trace = traceOf(result.session.log);
  totals.setAside += resolved(trace.events, PHASE_RESPONSE);
  totals.skin += resolved(trace.events, SKIN);
  totals.grants += trace.grantsActive;
  return result.session.state;
}

describe("Rogue (rogue-protection) precon", () => {
  it("seats with nothing unscripted (Med Lab 38028 is not in the precon)", () => {
    const deck = ROGUE_STARTER_DECKS.find((d) => d.id === "rogue-protection")!;
    const codes = new Set<string>(["38001a", ...deck.cards.map((l) => l.cardId as string)]);
    const cards = ROGUE_CARDS.filter(
      (c) =>
        codes.has(c.id as string) ||
        ("encounterSetIds" in c && c.encounterSetIds?.some((id) => (id as string) === "rogue_nemesis")),
    );
    expect(cards.length).toBeGreaterThan(deck.cards.length);
    expect(cards.flatMap(abilityRefIds).filter((id) => !(id in WAVE6_ABILITIES))).toEqual([]);
  });
});

describe("Rogue (rogue-protection) vs wave 6 scenarios", () => {
  it("solo, standard: Sabretooth plays to an outcome and replays deep-equal", () => {
    greedy(
      "solo standard vs Sabretooth",
      wave6Scenario("sabretooth", { players: [{ starterDeckId: "rogue-protection" }], seed: SEED }),
    );
  }, 120_000);

  it("solo, expert: Project Wideawake", () => {
    const config = wave6Scenario("project-wideawake", {
      players: [{ starterDeckId: "rogue-protection" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy("solo expert vs Project Wideawake", config);
  }, 120_000);

  it("2-player, standard: Rogue + Wolverine (Aggression) vs Master Mold", () => {
    greedy(
      "2-player with Wolverine vs Master Mold",
      wave6Scenario("master-mold", {
        players: [{ starterDeckId: "rogue-protection" }, { starterDeckId: "wolverine-aggression" }],
        seed: SEED,
      }),
    );
  }, 120_000);

  it("Rogue's own mechanics happened in the greedy games", () => {
    console.info(`[wave6 e2e] Rogue mechanics across the three games: ${JSON.stringify(totals)}`);
    expect(totals.setAside).toBeGreaterThan(0);
    expect(totals.skin).toBeGreaterThan(0);
    expect(totals.grants).toBeGreaterThan(0);
  });

  it("scripted: Skin Contact attaches Touched to the villain, Rogue gains its traits, and the log replays", () => {
    const base = withForm(rogueGame("rhino", { seed: SEED }), { heroForm: 0 });
    const rogue = identityOf(base, P1);
    const villain = base.villains[0]!.instanceId;
    let session = startSession(base);
    const step = (command: Command) => {
      const result = sessionApply(session, command, WAVE6_DEPS);
      if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.message}`);
      session = result.session;
    };
    step(use(P1, rogue, SKIN));
    for (let guard = 0; session.state.pendingChoice; guard++) {
      if (guard > 20) throw new Error("choices did not settle");
      const choice = session.state.pendingChoice;
      const villainOption = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === villain);
      step({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: villainOption ? [villainOption.optionId] : firstLegal(session.state),
      });
    }
    const touched = instancesOf(session.state, TOUCHED)[0]!;
    expect(inst(session.state, touched).attachedTo).toBe(villain);
    const villainTraits = traitsOf(session.state, villain, WAVE6_DEPS).map(String);
    expect(villainTraits.length).toBeGreaterThan(0);
    const rogueTraits = traitsOf(session.state, rogue, WAVE6_DEPS).map(String);
    for (const t of villainTraits) expect(rogueTraits).toContain(t);
    expect(playerOf(session.state, P1).identity.form).toBe("hero");
    const replayed = replay(session.log, WAVE6_DEPS);
    expect(replayed.ok).toBe(true);
    if (replayed.ok) expect(replayed.state).toEqual(session.state);
  });
});
