/**
 * Whether online sync is on offer right now, asked before the one-time setup prompt so a player is never invited to
 * something that would answer "unavailable": no Worker URL in this build, the Worker switched sync off (503), an older
 * Worker with no status route (it answers the GET with a 404 JSON `not-found`), or no network.
 *
 * The probe is `GET /sync/status` (`@mc/sync-worker/sync-protocol`): no credential, no preflight, answered before any
 * rate limiter or space object, so it costs the caller nothing. "Unavailable" is remembered for the page load, so
 * Title coming back around does not ask again; "available" is asked every time (it is only asked when the prompt is due).
 */
import { syncServiceUrl } from "../save-data/transfer-config.js";

const PROBE_TIMEOUT_MS = 6000;

export interface SyncAvailabilityDeps {
  readonly baseUrl: string | null;
  readonly fetch: typeof fetch;
}

/** What this page load has learned; a fresh object per test. */
export interface AvailabilityMemory {
  unavailable: boolean;
}

const pageLoad: AvailabilityMemory = { unavailable: false };

export async function syncIsAvailable(
  deps: SyncAvailabilityDeps = { baseUrl: syncServiceUrl(), fetch: (...args) => globalThis.fetch(...args) },
  memory: AvailabilityMemory = pageLoad,
): Promise<boolean> {
  if (memory.unavailable || !deps.baseUrl) return false;
  try {
    const response = await deps.fetch(`${deps.baseUrl}/sync/status`, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    const body = response.status === 200 ? ((await response.json()) as { sync?: unknown } | null) : null;
    if (body?.sync === true) return true;
  } catch {
    // A dropped connection reads the same as an answer of "no".
  }
  memory.unavailable = true;
  return false;
}
