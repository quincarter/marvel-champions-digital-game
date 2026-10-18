/**
 * Wave 11, docs/phase7-wave11.md section 8.4 line 14: the printed Echo / Protection starter deck (`fne-echo-protection`)
 * played whole by the seeded greedy driver (`testing/driver.ts`, which knows no card names) against Core's Rhino,
 * standard mode, one player, to a win and to a loss. Each game's session log replays to a deep-equal state
 * (PLAN.md Phase 1), and its event stream shows the deck's own rules at work:
 * - Innate Reflexes (60038, Starting; MC60 p. 3): taken into the opening hand at setup (`startingHandCredited`), then
 *   played.
 * - Watch and Learn (60037a, identity response): an aspect or basic event is tucked under Echo (`cardMoved` to a
 *   `tucked` zone) after it is played.
 * - Photographic Reflexes (60040, MC60 FAQ p. 26): discarded from hand to play a tucked event as if in hand
 *   (`cardPlayed` with `from: "tucked"`).
 * - Protection cards (60046-60054) are played.
 *
 * Seed 12 is the one the scan found to show all of it in both outcomes. The greedy driver never wins on its own
 * (testing/driver.ts, campaigns/trors.test.ts header), so the win game starts from a staged board, flagged here rather
 * than presented as an organic win: Rhino is already on his last stage (II) with 9 damage on him. Every card played
 * and every command is real. The loss game is unstaged.
 */
import { FNE_STARTER_DECKS, PLAYABLE_CARDS } from "@mc/content";
import { applyCommand, createGame, replay, type GameEvent, type GameState } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { playToOutcome } from "../../../testing/driver.js";
import { WAVE11_DEPS } from "../../index.js";

vi.setConfig({ testTimeout: 600_000 });

const SEED = 12;
const PROTECTION = ["60046", "60047", "60048", "60049", "60050", "60051", "60052", "60053", "60054"];

function newGame(staged: boolean): GameState {
  const deck = FNE_STARTER_DECKS.find((d) => d.id === "fne-echo-protection")!;
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: SEED,
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
  const state = created.state;
  if (!staged) return state;
  const villain = state.villains[0]!;
  return {
    ...state,
    villains: state.villains.map((v) => ({ ...v, stageIndex: v.lastStageIndex })),
    instances: {
      ...state.instances,
      [villain.instanceId]: { ...state.instances[villain.instanceId]!, damage: 9 },
    },
  } as GameState;
}

function play(staged: boolean) {
  const initial = newGame(staged);
  const run = playToOutcome(initial, WAVE11_DEPS, { maxCommands: 3000 });
  const replayed = replay(run.session.log, WAVE11_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
  let state = run.session.log.initialState;
  const events: GameEvent[] = [];
  for (const command of run.session.log.commands) {
    const result = applyCommand(state, command, WAVE11_DEPS);
    if (!result.ok) throw new Error(`log command refused: ${result.error.message}`);
    state = result.state;
    events.push(...result.events);
  }
  return { run, replayed, events };
}

function expectDeckAtWork(events: readonly GameEvent[]): void {
  const played = events.flatMap((e) => (e.type === "cardPlayed" ? [e] : []));
  // Innate Reflexes: taken at setup, then played.
  expect(events.some((e) => e.type === "startingHandCredited")).toBe(true);
  expect(played.some((e) => (e.cardId as string) === "60038")).toBe(true);
  // Watch and Learn: an event went under Echo.
  expect(events.some((e) => e.type === "cardMoved" && e.to.kind === "tucked")).toBe(true);
  // Photographic Reflexes: discarded from hand, a tucked event played.
  expect(played.some((e) => e.from === "tucked")).toBe(true);
  expect(
    events.some((e) => e.type === "cardMoved" && (e.cardId as string).startsWith("60040") && e.from.kind === "hand"),
  ).toBe(true);
  // A Protection card.
  expect(played.some((e) => PROTECTION.includes(e.cardId as string))).toBe(true);
}

describe("fne-echo-protection against Rhino, standard, seeded greedy driver", () => {
  it(`seed ${SEED}, staged board: wins (villainDefeated) and replays deep-equal`, () => {
    const { run, replayed, events } = play(true);
    expect(run.outcome).toEqual({ result: "win", reason: "villainDefeated" });
    expect(run.session.state.pendingChoice).toBeNull();
    expect(replayed.state).toEqual(run.session.state);
    expectDeckAtWork(events);
  });

  it(`seed ${SEED}, unstaged: loses and replays deep-equal`, () => {
    const { run, replayed, events } = play(false);
    expect(run.outcome?.result).toBe("loss");
    expect(run.session.state.pendingChoice).toBeNull();
    expect(replayed.state).toEqual(run.session.state);
    expectDeckAtWork(events);
  });
});
