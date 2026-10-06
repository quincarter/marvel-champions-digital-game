import { ADAM_WARLOCK_POOL } from "./adam-warlock-pool.js";
import { CABLE_LEADERSHIP_LIVE_DANGEROUSLY } from "./cable-leadership-live-dangerously.js";
import { DEADPOOL_AGGRESSION } from "./deadpool-aggression.js";
import { DEADPOOL_POOL_BREAK_TIME } from "./deadpool-pool-break-time.js";
import { DOMINO_POOL } from "./domino-pool.js";
import { SPIDER_MAN_POOL } from "./spider-man-pool.js";
import { SPIDER_WOMAN_POOL_JUSTICE } from "./spider-woman-pool-justice.js";
import type { PoolFixture } from "./types.js";

export type { PoolFixture } from "./types.js";
export {
  ADAM_WARLOCK_POOL,
  CABLE_LEADERSHIP_LIVE_DANGEROUSLY,
  DEADPOOL_AGGRESSION,
  DEADPOOL_POOL_BREAK_TIME,
  DOMINO_POOL,
  SPIDER_MAN_POOL,
  SPIDER_WOMAN_POOL_JUSTICE,
};

/** The 'Pool QA decks, in the order the QA doc lists them. */
export const POOL_FIXTURE_DECKS: readonly PoolFixture[] = [
  DEADPOOL_POOL_BREAK_TIME,
  DEADPOOL_AGGRESSION,
  SPIDER_MAN_POOL,
  DOMINO_POOL,
  ADAM_WARLOCK_POOL,
  CABLE_LEADERSHIP_LIVE_DANGEROUSLY,
  SPIDER_WOMAN_POOL_JUSTICE,
];
