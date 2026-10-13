/**
 * Wave 10 engine-rules QA: a seeded soak of OLDER scenarios and heroes (Core to wave 9, plus a few wave 10 heroes as
 * seat partners) after the engine-wide rule changes of 2026-10-11 to 2026-10-13 (threat-removal targets, reveal order,
 * entered-since, find decks, costs, setup abilities), played by the greedy driver (`testing/driver.ts`, which knows no
 * card names).
 *
 * Per game, at the end of 22 commands per seat (two checkpoints, 12 and 36, with `QA_WAVE10_FULL=1`; the game is
 * deterministic, so each checkpoint is a replay of the same seed):
 * - every command the driver was offered is accepted (the driver throws on a refusal, and on a state with no choice
 *   pending that is not a player turn: "the game never rests with nothing pending and no legal action");
 * - a game with no outcome and no pending choice is at a player turn with at least one legal action;
 * - a pending choice offers at least as many options as it needs;
 * - no response or interrupt window offers a card that is not in play, in a hand or in a discard pile (an option naming
 *   a card in a deck: "no response window opens for a card not in play");
 * - the stack is empty when nothing is pending, and no card sits in two zones at once;
 * - no negative damage, threat or counters; at most two stunned or confused cards;
 * - the session log replays from the seed to a deep-equal state (every third game, every game in the full run).
 *
 * Rotating sample: every second playable scenario that takes a modular set (every one in the full run), once, with a hero that rotates through
 * `MATRIX_HEROES` offset from the modular soak's and a seed range of its own; every sixth game has two players, every
 * fifth is expert.
 */
import { cardsInPlay, createGame, legalActions, replay, type GameState } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { PLAYABLE_DEPS } from "./playable/index.js";
import { playToOutcome } from "./testing/driver.js";
import { MATRIX_HEROES, MODULAR_SETS, PLAYABLE_SCENARIOS, buildPairing, pairingFor } from "./testing/modular-matrix.js";

const PARTNERS = ["hercules-leadership", "wonder-man-justice", "angel-protection", "core-black-panther-protection"];
/** Commands per seat. A game costs about 2 s a 30 commands; `QA_WAVE10_FULL=1` plays every scenario to 36 commands and replays each. */
const FULL =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.QA_WAVE10_FULL === "1";
const CHECKPOINTS = FULL ? [12, 36] : [22];
const TIMEOUT = 90_000;

interface Game {
  readonly set: string;
  readonly scenario: (typeof PLAYABLE_SCENARIOS)[number];
  readonly seats: readonly string[];
  readonly expert: boolean;
  readonly seed: number;
}

const games: Game[] = [];
PLAYABLE_SCENARIOS.forEach((scenario, index) => {
  if (!FULL && index % 2 === 1) return;
  const sets = MODULAR_SETS.filter((set) => pairingFor(set.id, scenario).kind === "build");
  if (sets.length === 0) return;
  const hero = MATRIX_HEROES[(index * 3 + 7) % MATRIX_HEROES.length]!;
  const two = index % 6 === 5;
  games.push({
    set: sets[(index * 5 + 2) % sets.length]!.id,
    scenario,
    seats: two ? [hero, PARTNERS[index % PARTNERS.length]!] : [hero],
    expert: index % 5 === 3,
    seed: 9100 + index,
  });
});

/** Every list a card can be in, for the two-zones-at-once check. */
function zonesOf(state: GameState): ReadonlyMap<string, string> {
  const where = new Map<string, string>();
  const put = (ids: readonly string[], zone: string): void => {
    for (const id of ids) {
      const earlier = where.get(id);
      if (earlier !== undefined && earlier !== zone)
        throw new Error(
          `${id} is in ${earlier} and in ${zone}: ${state.cardPool[state.instances[id]?.cardId ?? ""]?.name}`,
        );
      where.set(id, zone);
    }
  };
  for (const player of state.players) {
    put(player.hand, "hand");
    put(player.deck, `deck:${player.playerId}`);
    put(player.discard, `discard:${player.playerId}`);
  }
  for (const deck of Object.values(state.encounterDecks)) {
    put(deck.deck, "encounterDeck");
    put(deck.discard, "encounterDiscard");
  }
  put(cardsInPlay(state), "play");
  return where;
}

function check(state: GameState, where: string, full: boolean): void {
  const zones = zonesOf(state);
  for (const instance of Object.values(state.instances)) {
    expect(instance.damage, `${where}: damage on ${instance.instanceId}`).toBeGreaterThanOrEqual(0);
    expect(instance.threat, `${where}: threat on ${instance.instanceId}`).toBeGreaterThanOrEqual(0);
    for (const [name, amount] of Object.entries(instance.counters))
      expect(amount, `${where}: ${name} counters on ${instance.instanceId}`).toBeGreaterThanOrEqual(0);
    expect(instance.statuses.stunned, `${where}: stunned on ${instance.instanceId}`).toBeLessThanOrEqual(2);
    expect(instance.statuses.confused, `${where}: confused on ${instance.instanceId}`).toBeLessThanOrEqual(2);
  }
  const choice = state.pendingChoice;
  if (choice) {
    expect(
      choice.options.length,
      `${where}: a pending ${choice.prompt.kind} with too few options`,
    ).toBeGreaterThanOrEqual(choice.minSelections);
    if (choice.prompt.kind === "chooseTriggers") {
      for (const option of choice.options) {
        const id = option.optionId.split(":")[0]!;
        const zone = zones.get(id) ?? "elsewhere";
        expect(
          zone.startsWith("deck:") || zone === "encounterDeck",
          `${where}: a trigger window offers ${id} in ${zone}`,
        ).toBe(false);
      }
    }
    return;
  }
  if (state.outcome) return;
  expect(state.stack, `${where}: nothing pending but the stack is not empty`).toEqual([]);
  expect(state.step.phase, `${where}: at rest outside a player turn`).toBe("player");
  if (!full) return;
  const active = state.step.kind === "turn" ? state.step.activePlayerId : state.players[0]!.playerId;
  const legal = legalActions(state, active, PLAYABLE_DEPS);
  expect(legal.kind, `${where}: at rest and not at a turn`).toBe("turn");
  if (legal.kind === "turn") expect(legal.legal.length, `${where}: at rest with no legal action`).toBeGreaterThan(0);
}

describe("soak: older scenarios and heroes under the wave 10 engine rules", () => {
  it("covers a broad spread", () => {
    expect(games.length).toBeGreaterThanOrEqual(FULL ? 45 : 22);
    expect(new Set(games.map((g) => g.set)).size).toBeGreaterThanOrEqual(FULL ? 25 : 15);
    expect(new Set(games.flatMap((g) => g.seats)).size).toBeGreaterThanOrEqual(FULL ? 12 : 8);
  });

  for (const g of games) {
    const label = `${g.scenario.id} + ${g.set} (${g.seats.join(", ")}${g.expert ? ", expert" : ""})`;
    it(
      label,
      () => {
        const built = buildPairing(g.set, g.scenario, {
          seed: g.seed,
          players: g.seats.map((starterDeckId) => ({ starterDeckId })),
          expert: g.expert,
        });
        if (!built.config) throw new Error(`does not build: ${built.error ?? built.pairing.kind}`);
        const created = createGame(built.config, PLAYABLE_DEPS);
        if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
        let last: ReturnType<typeof playToOutcome> | undefined;
        for (const cap of CHECKPOINTS) {
          last = playToOutcome(created.state, PLAYABLE_DEPS, { maxCommands: cap * g.seats.length });
          check(last.session.state, `${label} @${cap}`, cap === CHECKPOINTS[CHECKPOINTS.length - 1]);
          if (last.outcome) break;
        }
        if (!FULL && g.seed % 3 !== 0) return;
        const replayed = replay(last!.session.log, PLAYABLE_DEPS);
        if (!replayed.ok) throw new Error(`replay failed: ${replayed.error.message}`);
        expect(replayed.state, "replay from the seed diverged").toEqual(last!.session.state);
      },
      TIMEOUT,
    );
  }
});
