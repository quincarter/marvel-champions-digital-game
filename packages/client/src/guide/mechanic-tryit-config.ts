/**
 * The hero-mechanic "Try it" games (guided mode §3.14, `docs/guided-mode.md`): one `SessionConfig` per lesson, each
 * a solo standard Rhino game (`bomb_scare`, like the aspect Try-its in `guide/aspect-tryit-config.ts`) with the
 * hero the mechanic belongs to and a seed that pins the opening. `guide/mechanic-lessons.ts` is the lesson data
 * written against these openings; `mechanic-lessons.test.ts` plays every lesson to completion through the real
 * engine with the real card scripts, so a seed or card change that breaks an opening fails there.
 *
 * Every setup choice the engine asks before the first turn (the mulligan, a hero's own setup pick) is answered the
 * way `guide/start-mechanic-tryit.ts` answers it: kept as dealt, or the first option listed. Both are fixed by the
 * seed, which is what makes a lesson replay-safe.
 */
import { cardId } from "@mc/content";
import type { PlayerId } from "@mc/engine";
import { playerId } from "@mc/engine";
import type { SessionConfig } from "../engine/host.js";
import type { MechanicTryItId } from "./mechanic-tryits.js";

/** The lone seat in every mechanic "Try it" game. */
export const MECHANIC_TRYIT_PLAYER_ID: PlayerId = playerId("p1");

export interface MechanicTryItConfig {
  readonly config: SessionConfig;
}

/**
 * - Storm (`storm-leadership`): the setup pick takes the first Weather listed, Clear Skies. She starts as Ororo
 *   Munroe, so the lesson flips her first (Weather Control is printed on her hero side).
 */
const STORM: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "storm-leadership" }],
    seed: 4101,
  },
};

/**
 * - Phoenix (`phoenix-justice`): the stacked cards are her opening hand (Down Time, two Phoenix Firebirds, and the
 *   three resource cards) followed by round 2's two draws (Mission Training, twice, harmless filler). The lesson takes
 *   Phoenix Force from 4 power counters to 0 over two rounds: Down Time paid by Psionic Bond and one Firebird paid by
 *   Energy in round 1 (4 to 2), then the other Firebird paid by Psionic Bond in round 2 (2 to 0, which flips it).
 */
const PHOENIX: MechanicTryItConfig = {
  config: {
    scenarioId: "rhino",
    difficulty: "standard",
    modularSetIds: ["bomb_scare"],
    players: [{ starterDeckId: "phoenix-justice" }],
    seed: 4102,
    stack: {
      players: {
        0: [
          cardId("34024"), // Down Time: cost 1, the Psionic Bond play
          cardId("34013"), // Phoenix Firebird (A): paid by Energy in round 1
          cardId("34013"), // Phoenix Firebird (B): kept for round 2
          cardId("34025"), // Energy
          cardId("34026"), // Genius
          cardId("34027"), // Strength
          cardId("34016"), // Mission Training: round 2's draws
          cardId("34016"),
        ],
      },
    },
  },
};

export const MECHANIC_TRYIT_CONFIGS: Readonly<Record<MechanicTryItId, MechanicTryItConfig>> = {
  storm: STORM,
  phoenix: PHOENIX,
};
