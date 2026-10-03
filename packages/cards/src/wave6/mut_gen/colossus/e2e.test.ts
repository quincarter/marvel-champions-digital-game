import {
  activeVillain,
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type GameState,
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
  type Picker,
} from "../../../testing/harness.js";
import { stackSetAside, stageNemesisCardForReveal, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { colossusGame } from "./support.js";

/**
 * Whole games with Colossus's own precon (`colossus-protection`, `packages/content/src/data/mut_gen/starterDecks.ts`),
 * modeled on `../../../wave5/sm/ghost-spider/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome
 * (solo, 2-player with a Core hero, expert), and hand-scripted sessions that drive his own kit (two tough cards, Iron
 * Will and Organic Steel on a piercing attack, Steel Fist, Homesick, a Juggernaut reveal). Every scripted step goes
 * through `sessionApply`, so each log replays deep-equal.
 */
const SEED = 2026;

function step(session: GameSession, command: Command, pick: Picker = firstLegal): GameSession {
  const result = sessionApply(session, command, WAVE6_DEPS);
  if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
  return settle(result.session, pick);
}

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

/** Accepts every offered optional trigger of the named abilities (recording each) and a choice option whose label
 * contains one of `labels`; pays `payForAbility` with the first card; declines the rest. */
const choosing =
  (accepted: string[], wanted: readonly string[], labels: readonly string[] = []): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers") {
      const hits = choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
      if (hits.length > 0) {
        accepted.push(...hits);
        return hits;
      }
    }
    if (choice?.prompt.kind === "chooseOption") {
      for (const label of labels) {
        const hit = choice.options.find((o) => o.label.includes(label));
        if (hit) return [hit.optionId];
      }
    }
    return firstLegal(state);
  };

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

const hero = (state: GameState) => identityOf(state, P1);
const tough = (state: GameState) => inst(state, hero(state)).statuses.tough;
const asHeroWithTough = (state: GameState, n: number) => {
  const inHero = withForm(state, { heroForm: 0 });
  return patchInstance(inHero, hero(inHero), { statuses: { ...inst(inHero, hero(inHero)).statuses, tough: n } });
};
/** `n` more cards from the deck into the hand, to pay with. */
const stocked = (state: GameState, n: number): GameState => ({
  ...state,
  players: state.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, n)], deck: p.deck.slice(n) } : p,
  ),
});

function greedy(config: ReturnType<typeof wave6Scenario>) {
  const created = createGame(config, WAVE6_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  const result = playToOutcome(created.state, WAVE6_DEPS);
  console.info(
    `[wave6 e2e] Colossus: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

describe("Colossus (colossus-protection) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    greedy(wave6Scenario("rhino", { players: [{ starterDeckId: "colossus-protection" }], seed: SEED }));
  }, 120_000);

  it("2-player, standard: Colossus + Spider-Man (Justice)", () => {
    greedy(
      wave6Scenario("rhino", {
        players: [{ starterDeckId: "colossus-protection" }, { starterDeckId: "core-spider-man-justice" }],
        seed: SEED,
      }),
    );
  }, 120_000);

  it("solo, expert", () => {
    const config = wave6Scenario("rhino", {
      players: [{ starterDeckId: "colossus-protection" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy(config);
  }, 120_000);

  it("scripted: two tough cards, Iron Will, Organic Steel and Steel Fist, then a piercing attack (Juggernaut boost)", () => {
    const base = asHeroWithTough(stocked(colossusGame("rhino", { seed: SEED }), 8), 2);
    const given = moveToHand(base, P1, "32004", "32006", "32008");
    const staged = given.state;
    // Juggernaut as Rhino's boost card (his "[star] Boost" gives the attack piercing); stacked on top of the deck.
    const initial = stackSetAside(staged, "32026");
    const villain = activeVillain(initial).instanceId;
    let session = startSession(initial);
    const accepted: string[] = [];
    const pick = choosing(accepted, ["32004.iron-will-response", "32006.organic-steel-response"], ["stun and confuse"]);
    expect(tough(session.state)).toBe(2); // Colossus holds two tough cards (his extra slot).

    const [ironWill, steel, steelFist] = given.ids;
    for (const id of [ironWill!, steel!]) {
      session = step(session, play(P1, id, payWith(session.state, P1, 2, [id])), pick);
    }
    expect(inst(session.state, steel!).counters.steel).toBe(2);
    expect(inst(session.state, ironWill!).attachedTo).toBe(hero(session.state));

    // Round 1 ends: Juggernaut is Rhino's boost card, so his attack pierces. Both tough cards go, in one shared window:
    // Iron Will answers each (2 draws), Organic Steel (exhausts as a cost) once, handing one tough card back.
    session = step(session, { type: "endTurn", playerId: P1 }, pick);
    expect(accepted.filter((id) => id.includes("32004.iron-will-response"))).toHaveLength(2);
    expect(accepted.filter((id) => id.includes("32006.organic-steel-response")).length).toBeGreaterThanOrEqual(1);
    expect(inst(session.state, steel!).counters.steel).toBe(1);
    expect(tough(session.state)).toBe(1);
    expect(inst(session.state, hero(session.state)).damage).toBeGreaterThan(0); // piercing: the damage landed.
    expect(session.state.round).toBe(2);

    // Round 2: Steel Fist, discarding that tough card: 5 damage, the villain stunned and confused, both upgrades answer.
    const drawsBefore = accepted.length;
    session = step(session, play(P1, steelFist!, payWith(session.state, P1, 2, [steelFist!])), pick);
    expect(inst(session.state, villain).damage).toBeGreaterThanOrEqual(5);
    expect(inst(session.state, villain).statuses.stunned).toBe(1);
    expect(inst(session.state, villain).statuses.confused).toBe(1);
    expect(accepted.slice(drawsBefore).some((id) => id.includes("32004.iron-will-response"))).toBe(true);

    assertReplays(session);
  });

  it("scripted: Homesick is revealed and resolved (discarding the tough cards), then the game goes on", () => {
    const base = stocked(asHeroWithTough(colossusGame("rhino", { seed: 4 }), 2), 0);
    const initial = stackEncounterDeck(base, "01186", "32025");
    let session = startSession(initial);
    session = step(
      session,
      { type: "endTurn", playerId: P1 },
      choosing([], [], ["Stay in hero form", "Discard this card"]),
    );
    const [homesick] = instancesOf(session.state, "32025");
    expect(homesick).toBeDefined();
    expect(tough(session.state)).toBe(0);
    session = step(session, { type: "endTurn", playerId: P1 });
    expect(session.state.round).toBeGreaterThanOrEqual(3);
    assertReplays(session);
  });

  it("scripted: a Juggernaut reveal puts the nemesis minion in play and the game goes on", () => {
    const base = asHeroWithTough(colossusGame("rhino", { seed: 5 }), 2);
    const initial = stageNemesisCardForReveal(base, "32026");
    let session = startSession(initial);
    session = step(session, { type: "endTurn", playerId: P1 });
    const [juggernaut] = instancesOf(session.state, "32026");
    expect(cardsInPlay(session.state)).toContain(juggernaut);
    session = step(session, { type: "endTurn", playerId: P1 });
    assertReplays(session);
    expect(playerOf(session.state, P1)).toBeDefined();
  });
});
