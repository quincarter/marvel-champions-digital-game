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

export const MECHANIC_TRYIT_CONFIGS: Readonly<Record<MechanicTryItId, MechanicTryItConfig>> = {
  storm: STORM,
};
