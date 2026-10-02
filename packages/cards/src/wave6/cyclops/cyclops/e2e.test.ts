import {
  activeVillain,
  cardsInPlay,
  createGame,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameSession,
  type InstanceId,
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
  P2,
  payWith,
  play,
  playerOf,
  settle as settleState,
  stackEncounterDeck,
  toHero,
  use,
  type Picker,
} from "../../../testing/harness.js";
import { WAVE6_DEPS, wave6Scenario } from "../../index.js";
import { cyclopsGame } from "./support.js";

/**
 * Whole games with Cyclops's own precon (`cyclops-leadership`, `packages/content/src/data/cyclops/starterDecks.ts`),
 * modeled on `../../mut_gen/colossus/e2e.test.ts`: the card-name-agnostic greedy driver to a real outcome (solo,
 * 2-player with a Core hero, expert), and hand-scripted sessions through his kit (Optic Blast, Exploit Weakness, Ricochet
 * Beam, a Temporary upgrade discarded at round end, Field Commander's first turn, Lost Visor's reveal). Every scripted
 * step goes through `sessionApply`, so each log replays deep-equal.
 *
 * The card whose script is skipped (Coordinated Attack 33016, see `../../coverage.test.ts`) is in the precon and gets
 * dealt: it is a legal card with no ability yet, so the precon seats and plays as-is, and the greedy games treat it as
 * a plain card.
 */
const SEED = 2026;
const ADVANCE = "01186";

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

function assertReplays(session: GameSession): void {
  expect(session.state.pendingChoice).toBeNull();
  const replayed = replay(session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(session.state);
}

/** `n` more cards from P1's deck into the hand, to pay with. */
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
    `[wave6 e2e] Cyclops: ${result.outcome ? `${result.outcome.result} (${result.outcome.reason})` : "no outcome"} in round ${result.rounds}, ${result.commands} commands`,
  );
  expect(result.outcome).not.toBeNull();
  expect(result.rounds).toBeGreaterThanOrEqual(1);
  const replayed = replay(result.session.log, WAVE6_DEPS);
  expect(replayed.ok).toBe(true);
  if (replayed.ok) expect(replayed.state).toEqual(result.session.state);
}

describe("Cyclops (cyclops-leadership) vs Rhino", () => {
  it("solo, standard: plays to an outcome and replays deep-equal", () => {
    greedy(wave6Scenario("rhino", { players: [{ starterDeckId: "cyclops-leadership" }], seed: SEED }));
  }, 120_000);

  it("2-player, standard: Cyclops + Spider-Man (Justice)", () => {
    greedy(
      wave6Scenario("rhino", {
        players: [{ starterDeckId: "cyclops-leadership" }, { starterDeckId: "core-spider-man-justice" }],
        seed: SEED,
      }),
    );
  }, 120_000);

  it("solo, expert", () => {
    const config = wave6Scenario("rhino", {
      players: [{ starterDeckId: "cyclops-leadership" }],
      seed: SEED,
      difficulty: "expert",
    });
    expect(config.difficulty).toBe("expert");
    greedy(config);
  }, 120_000);

  it("scripted: Exploit Weakness, Optic Blast and Ricochet Beam, then the Temporary upgrade goes at round end", () => {
    const base = stocked(cyclopsGame("rhino", { seed: SEED }), 8);
    const given = moveToHand(base, P1, "33005", "33009");
    const [weakness, ricochet] = given.ids as [InstanceId, InstanceId];
    const villain = activeVillain(given.state).instanceId;
    let session = startSession(given.state);

    session = step(session, toHero(P1));
    expect(playerOf(session.state, P1).identity.form).toBe("hero");
    // Exploit Weakness (cost 1) onto the villain: every attack's damage is up by 1, and Optic Blast now has a target.
    session = step(
      session,
      play(P1, weakness, payWith(session.state, P1, 1, [weakness, ricochet]), { attachToInstanceId: villain }),
    );
    expect(inst(session.state, weakness).attachedTo).toBe(villain);
    const hero = identityOf(session.state, P1);
    const optic = (state: GameState) => {
      const pay = playerOf(state, P1).hand.find((id) => id !== ricochet)!;
      return use(P1, hero, "33001a.cyclops-constant", [{ fromHand: pay }]);
    };
    session = step(session, optic(session.state));
    expect(inst(session.state, villain).damage).toBe(4); // 3 + 1 from Exploit Weakness.
    expect(() => {
      const again = sessionApply(session, optic(session.state), WAVE6_DEPS);
      if (!again.ok) throw new Error("rejected");
    }).toThrow("rejected"); // once per round.

    // Ricochet Beam (cost 2): 3 to an enemy and 3 to an enemy with an upgrade attached, each +1 (FAQ #9): 4 + 8.
    session = step(session, play(P1, ricochet, payWith(session.state, P1, 2, [ricochet])));
    expect(inst(session.state, villain).damage).toBe(12);

    session = step(session, { type: "endTurn", playerId: P1 });
    expect(session.state.round).toBe(2);
    expect(inst(session.state, villain).attachments).not.toContain(weakness); // Temporary.
    expect(playerOf(session.state, P1).discard).toContain(weakness);
    session = step(session, { type: "endTurn", playerId: P1 });
    assertReplays(session);
  });

  it("scripted: 2 players, Field Commander gives Cyclops (player 2) the first turn of the next player phase", () => {
    const created = createGame(
      wave6Scenario("rhino", {
        seed: SEED,
        players: [{ starterDeckId: "core-captain-marvel-leadership" }, { starterDeckId: "cyclops-leadership" }],
      }),
      WAVE6_DEPS,
    );
    if (!created.ok) throw new Error(created.error.message);
    const opened = settleState(created.state, firstLegal, (st) => st.step.phase === "player", WAVE6_DEPS);
    let session = startSession(opened);
    session = step(session, { type: "endTurn", playerId: P1 });
    const given = moveToHand(session.state, P2, "33004");
    const [commander] = given.ids;
    session = { ...session, state: given.state };
    // Field Commander is an upgrade: attach it to Scott Summers (cost 1, paid from player 2's hand).
    session = step(
      session,
      play(P2, commander!, payWith(session.state, P2, 1, [commander!]), {
        attachToInstanceId: identityOf(session.state, P2),
      }),
    );
    expect(inst(session.state, commander!).attachedTo).toBe(identityOf(session.state, P2));
    session = step(session, { type: "endTurn", playerId: P2 });
    expect(session.state.round).toBe(2);
    expect(session.state.step).toMatchObject({ phase: "player", activePlayerId: P2, remainingPlayerIds: [P1] });
    session = step(session, { type: "endTurn", playerId: P2 });
    session = step(session, { type: "endTurn", playerId: P1 });
    assertReplays(session);
  });

  it("scripted: Lost Visor is revealed (tucking Ruby Quartz Visor), then Scott Summers recovers it and the game goes on", () => {
    const base = moveToHand(cyclopsGame("rhino", { seed: 5 }), P1, "33003").state;
    const initial = stackEncounterDeck(base, ADVANCE, "33027");
    let session = startSession(initial);
    session = step(session, { type: "endTurn", playerId: P1 });
    const [lostVisor] = instancesOf(session.state, "33027").filter((id) => cardsInPlay(session.state).includes(id));
    expect(lostVisor).toBeDefined();
    const visor = inst(session.state, lostVisor!).tucked?.[0];
    expect(visor).toBeDefined();
    expect(inst(session.state, visor!).cardId).toBe("33003");

    session = step(session, {
      type: "useAbility",
      playerId: P1,
      cardInstanceId: lostVisor!,
      abilityId: "33027.lost-visor-action" as never,
      payment: [],
    });
    expect(playerOf(session.state, P1).hand).toContain(visor);
    expect(session.state.removedFromGame).toContain(lostVisor);
    expect(inst(session.state, identityOf(session.state, P1)).exhausted).toBe(true);
    session = step(session, { type: "endTurn", playerId: P1 });
    expect(session.state.round).toBeGreaterThanOrEqual(3);
    assertReplays(session);
  });
});
