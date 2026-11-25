/**
 * When an Epic table host tries again after its table's start failed. Suppression is tied to the current Epic start id
 * and the lobby's authoritative revision (`RoomState.rev`, bumped on every stored lobby change, including any deck
 * submit, even one whose public summary is identical): a failed attempt is not repeated at the same revision, and any
 * stored change re-enables it. Transient failures (no answer, the check, a lobby change mid-check, the engine start)
 * retry on their own with a bounded backoff, then wait for an explicit Retry.
 */

export const EPIC_RETRY_DELAYS_MS: readonly number[] = [2000, 4000, 8000, 16000, 32000];
export const EPIC_RETRY_MAX = EPIC_RETRY_DELAYS_MS.length;

export interface EpicStartRetry {
  readonly startId: string;
  /** The lobby revision the last failed attempt ran at; null when none failed (or Retry was pressed). */
  readonly failedRev: number | null;
  /** Automatic retries spent on transient failures at that revision. */
  readonly tries: number;
  readonly transient: boolean;
  /** Not before this time (ms) for the next automatic retry. */
  readonly nextAt: number;
}

export function freshEpicStartRetry(startId: string): EpicStartRetry {
  return { startId, failedRev: null, tries: 0, transient: false, nextAt: 0 };
}

export type EpicStartFailure =
  | "not-host"
  | "no-seats"
  | "no-answer"
  | "check-failed"
  | "lobby-changed"
  | "unfilled"
  | "decks"
  | "start-failed";

const TRANSIENT: ReadonlySet<string> = new Set(["no-answer", "check-failed", "lobby-changed", "start-failed"]);

export function isTransientEpicFailure(reason: EpicStartFailure): boolean {
  return TRANSIENT.has(reason);
}

/** Whether the host should attempt its table's start now. */
export function shouldAttemptEpicStart(
  state: EpicStartRetry | null,
  startId: string,
  rev: number,
  now: number,
): boolean {
  if (!state || state.startId !== startId || state.failedRev === null) return true;
  if (rev !== state.failedRev) return true;
  return state.transient && state.tries < EPIC_RETRY_MAX && now >= state.nextAt;
}

/** The state after an attempt made at `rev` failed with `reason`. */
export function epicStartFailed(
  state: EpicStartRetry | null,
  startId: string,
  rev: number,
  reason: EpicStartFailure,
  now: number,
): EpicStartRetry {
  const same = state !== null && state.startId === startId && state.failedRev === rev;
  const tries = same ? state.tries : 0;
  if (!isTransientEpicFailure(reason)) return { startId, failedRev: rev, tries: 0, transient: false, nextAt: 0 };
  const delay = EPIC_RETRY_DELAYS_MS[Math.min(tries, EPIC_RETRY_MAX - 1)] ?? 0;
  return { startId, failedRev: rev, tries: tries + 1, transient: true, nextAt: now + delay };
}

/** Milliseconds until the next automatic retry, or null when none is scheduled (a deck problem, or retries spent). */
export function epicRetryDelay(state: EpicStartRetry | null, now: number): number | null {
  if (!state || state.failedRev === null || !state.transient || state.tries >= EPIC_RETRY_MAX) return null;
  return Math.max(0, state.nextAt - now);
}

/** Retries spent on a transient failure: the host sees an explicit Retry control. */
export function epicRetryExhausted(state: EpicStartRetry | null, startId: string): boolean {
  return state !== null && state.startId === startId && state.transient && state.tries >= EPIC_RETRY_MAX;
}

/** The host pressed Retry. */
export function epicRetryNow(state: EpicStartRetry): EpicStartRetry {
  return freshEpicStartRetry(state.startId);
}
