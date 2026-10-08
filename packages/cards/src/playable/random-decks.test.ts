/**
 * Random-deck coverage (docs/custom-deck-testing.md, PR #88 step 6): seeded random LEGAL decks from the whole
 * playable pool (`../testing/random-deck.ts`), played by the greedy driver solo, two- to four-player and in Breakout's extreme mode against scenarios from
 * every wave. Each case asserts what no single rules ruling does: setup succeeds for a legal deck, the driver reaches
 * an outcome or the round cap without throwing (an illegal command, a pending choice it cannot answer, an engine
 * error), and the log replays deep-equal (RRG 1.8 "Game" determinism; the replay is the project's ground truth).
 *
 * Default run: 8 solo, 4 two-player, and 2 each of three-player, four-player and Breakout extreme (solo and
 * two-player) seeds. `MC_RANDOM_DECK_SEEDS=200` runs N of each kind for a local soak, and
 * `MC_RANDOM_DECK_FROM=<n>` shifts the first seed. A failure's title carries its seed; rerun with
 * `MC_RANDOM_DECK_FROM=<seed> MC_RANDOM_DECK_SEEDS=1`.
 */
import { describe, expect, test } from "vitest";
import {
  CORE_SCENARIOS,
  PLAYABLE_CARDS,
  WAVE1_SCENARIOS,
  WAVE2_SCENARIOS,
  WAVE3_SCENARIOS,
  WAVE4_SCENARIOS,
  WAVE5_SCENARIOS,
  WAVE8_SCENARIOS,
} from "@mc/content";
import { createGame, replay } from "@mc/engine";
import { playToOutcome } from "../testing/driver.js";
import { PLAYABLE_IDENTITY_IDS, randomLegalDeck, rng } from "../testing/random-deck.js";
import { PLAYABLE_DEPS, playableScenario } from "./index.js";

interface ProcessLike {
  readonly env: Readonly<Record<string, string | undefined>>;
}
const env = (globalThis as unknown as { process: ProcessLike }).process.env;
const SEEDS = Number(env.MC_RANDOM_DECK_SEEDS ?? "") || 0;
const FROM = Number(env.MC_RANDOM_DECK_FROM ?? "") || 1;
const SOLO = SEEDS || 8;
const DUO = SEEDS || 4;
const TRIO = SEEDS || 2;
const QUAD = SEEDS || 2;
const EXTREME = SEEDS || 2;
/** A rounds cap keeps a soak bounded; hitting it is a pass (no throw, no stuck prompt), not a failure. */
const MAX_COMMANDS = 6_000;

/**
 * KNOWN_FAILURES: seeds in the default range that fail today are listed here and skipped by default
 * (`MC_RANDOM_DECK_SEEDS` ignores the list so a soak still sees them). Format: seed (kind): hero / aspects / scenario - error.
 */
const KNOWN_FAILURES: ReadonlySet<string> = new Set<string>([]);

const SCENARIO_IDS: readonly string[] = [
  ...CORE_SCENARIOS,
  ...WAVE1_SCENARIOS,
  ...WAVE2_SCENARIOS,
  ...WAVE3_SCENARIOS,
  ...WAVE4_SCENARIOS,
  ...WAVE5_SCENARIOS,
  ...WAVE8_SCENARIOS,
].map((scenario) => scenario.id as string);

const nameOf = (id: string): string => (PLAYABLE_CARDS.find((card) => card.id === id) as { name?: string })?.name ?? id;

type Mode = "solo" | "duo" | "trio" | "quad" | "extreme-solo" | "extreme-duo";

/** Seats per mode; the "extreme" modes always run Breakout (the only scenario that accepts `difficulty: "extreme"`). */
const PLAYERS: Record<Mode, 1 | 2 | 3 | 4> = { solo: 1, duo: 2, trio: 3, quad: 4, "extreme-solo": 1, "extreme-duo": 2 };

function playSeed(seed: number, mode: Mode): void {
  const players = PLAYERS[mode];
  const extreme = mode.startsWith("extreme");
  const random = rng(seed ^ 0x9e3779b9);
  const scenarioId = extreme ? "breakout" : SCENARIO_IDS[Math.floor(random() * SCENARIO_IDS.length)]!;
  const first = randomLegalDeck(seed, PLAYABLE_DEPS);
  const seats = [first];
  for (let extra = 0; seats.length < players; extra++) {
    // Seats must not share a hero (Unique identity: engine `duplicate_unique_card`), so redraw until the title is new.
    const next = randomLegalDeck(
      seed * 31 + extra + 1,
      PLAYABLE_DEPS,
      PLAYABLE_IDENTITY_IDS[Math.floor(random() * PLAYABLE_IDENTITY_IDS.length)],
    );
    if (!seats.some((s) => s.heroName === next.heroName)) seats.push(next);
  }
  const label = `seed ${seed} ${mode} ${scenarioId}: ${seats.map((s) => `${nameOf(s.identityId)} [${s.aspects.join("+")}]`).join(" & ")}`;
  const config = {
    ...playableScenario(scenarioId, {
      seed,
      players: seats.map((s) => s.setup),
      ...(extreme ? { difficulty: "extreme" as const } : {}),
    }),
    requireLegalDecks: true,
  };
  const created = createGame(config, PLAYABLE_DEPS);
  if (!created.ok) throw new Error(`${label}: setup failed: ${created.error.message}`);
  let result;
  try {
    result = playToOutcome(created.state, PLAYABLE_DEPS, { maxCommands: MAX_COMMANDS });
  } catch (error) {
    throw new Error(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const replayed = replay(result.session.log, PLAYABLE_DEPS);
  if (!replayed.ok) throw new Error(`${label}: replay failed: ${JSON.stringify(replayed.error)}`);
  expect(replayed.state, label).toEqual(result.session.state);
}

const seeds = (n: number): number[] => Array.from({ length: n }, (_, i) => FROM + i);
const run = (seed: number, kind: string): boolean => SEEDS > 0 || !KNOWN_FAILURES.has(`${seed} ${kind}`);

const MODES: readonly { mode: Mode; name: string; count: number; timeout: number }[] = [
  { mode: "solo", name: "solo", count: SOLO, timeout: 120_000 },
  { mode: "duo", name: "two-player", count: DUO, timeout: 180_000 },
  { mode: "trio", name: "three-player", count: TRIO, timeout: 240_000 },
  { mode: "quad", name: "four-player", count: QUAD, timeout: 300_000 },
  { mode: "extreme-solo", name: "Breakout extreme solo", count: EXTREME, timeout: 180_000 },
  { mode: "extreme-duo", name: "Breakout extreme two-player", count: EXTREME, timeout: 240_000 },
];

describe("random legal decks from the whole playable pool", () => {
  for (const { mode, name, count, timeout } of MODES) {
    test.each(seeds(count).filter((s) => run(s, mode)))(
      `${name} seed %i plays without error, stuck prompt or replay drift`,
      (seed) => playSeed(seed, mode),
      timeout,
    );
  }
});
