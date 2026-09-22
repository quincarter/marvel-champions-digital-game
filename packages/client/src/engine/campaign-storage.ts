/**
 * Where a campaign is kept between visits.
 *
 * A **third IndexedDB database, `mc-campaigns`**, separate from `mc-saves` and `mc-decks` for the reason
 * `deck-storage.ts` already documents: a campaign write must never be able to break a game resume, and the
 * cheapest guarantee is never opening the same database (docs/campaign-mode-design.md §10.1).
 *
 * Unlike `mc-saves` (whose baseline is ~68 KB and split across three object stores so a listing read touches only
 * the summary row), a `CampaignLog` is small — a handful of log fields and a short history, not a full replayable
 * game log — so one object store holding the whole record is enough. `create`/`put` write it whole, in one atomic
 * transaction: there is no append-log equivalent here, because `resolveBetweenGames`/`applyCampaignResult` already
 * hand back a complete `CampaignLog` for every step (design §7.3).
 *
 * **`CampaignRecord`, not a bare `CampaignLog`.** The design's own sketch (§10.1) types `create`/`put`/`load` over
 * `CampaignLog` alone, but the campaign browser needs a box's display name and code (design §10.2's
 * `campaign-list-model.ts`: "box name") and `CampaignLog` never carries them — `@mc/engine` holds no box names,
 * by the same discipline that keeps it from naming a card. `@mc/content`'s `Campaign` record has both
 * (`Campaign.name`, `Campaign.boxCode`), so the caller folds them in once, at creation, alongside the two
 * timestamps `SaveMeta` already carries for a game. That is the one place this module's shape differs from the
 * design sketch; documented here and in docs/campaign-mode-design.md §10.1.
 *
 * Two implementations share one contract test, the same shape as `game-storage.test.ts` and
 * `deck-storage.test.ts`: `MemoryCampaignStorage` here, for Vitest and the in-app default; `IdbCampaignStorage`
 * for the browser.
 */

import type { CampaignId, PlayModes } from "@mc/content";
import type { CampaignLog, CampaignPosition, CampaignStatus } from "@mc/engine";

/** Bumped when the stored record shape changes, so an old campaign is recognised instead of misread. */
export const CAMPAIGN_STORAGE_SCHEMA = 1;

/**
 * The whole-log write and read shape: `CampaignLog` (docs/campaign-mode-design.md §5) plus the listing metadata
 * design §10.1 names that `CampaignLog` itself doesn't carry.
 */
export interface CampaignRecord extends CampaignLog {
  /** Bumped like `SAVE_SCHEMA` — a stored *record's* shape, independent of `CampaignLog.schema` (§5's own stamp). */
  readonly recordSchema: number;
  /** `@mc/content` `Campaign.name`, e.g. "The Rise of Red Skull", folded in once at creation. */
  readonly name: string;
  /** `@mc/content` `Campaign.boxCode`, e.g. "MC10". */
  readonly box: string;
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** The lightweight row `list()` returns — everything `campaign-list-model.ts` renders, nothing a deck or a seat's full field set. */
export interface CampaignSummary {
  readonly id: string;
  readonly campaignId: CampaignId;
  readonly recordSchema: number;
  readonly schema: number;
  readonly definitionVersion: string;
  readonly name: string;
  readonly box: string;
  readonly status: CampaignStatus;
  readonly modes: PlayModes;
  readonly position: CampaignPosition;
  readonly seats: readonly { readonly seatNumber: number; readonly identityCardId: string }[];
  readonly createdAt: number;
  readonly updatedAt: number;
}

/** Shared so both storages project a `CampaignRecord` down to a `CampaignSummary` identically. */
export function summaryOf(record: CampaignRecord): CampaignSummary {
  return {
    id: record.id,
    campaignId: record.campaignId,
    recordSchema: record.recordSchema,
    schema: record.schema,
    definitionVersion: record.definitionVersion,
    name: record.name,
    box: record.box,
    status: record.status,
    modes: record.modes,
    position: record.position,
    seats: record.seats.map((seat) => ({ seatNumber: seat.seatNumber, identityCardId: seat.identityCardId })),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export interface CampaignStorage {
  /** Records a new campaign. Rejects if `record.id` already exists — a campaign, unlike a game, is never replaced by starting another. */
  create(record: CampaignRecord): Promise<void>;
  /** Whole-record write. A campaign step is small and must be atomic; there is no append-log equivalent here. */
  put(record: CampaignRecord): Promise<void>;
  load(id: string): Promise<CampaignRecord | null>;
  /** Every recorded campaign, most recently played first, projected down to `CampaignSummary`. */
  list(): Promise<readonly CampaignSummary[]>;
  setStatus(id: string, status: CampaignStatus): Promise<void>;
}

/**
 * The in-memory storage. Values are copied in and out with `structuredClone`, exactly as IndexedDB copies them,
 * so a test using this can't pass by accident on shared references the real storage would never have.
 */
export class MemoryCampaignStorage implements CampaignStorage {
  readonly #campaigns = new Map<string, CampaignRecord>();

  async create(record: CampaignRecord): Promise<void> {
    if (this.#campaigns.has(record.id)) throw new Error(`campaign ${record.id} already exists`);
    this.#campaigns.set(record.id, structuredClone(record));
  }

  async put(record: CampaignRecord): Promise<void> {
    this.#campaigns.set(record.id, structuredClone(record));
  }

  async load(id: string): Promise<CampaignRecord | null> {
    const found = this.#campaigns.get(id);
    return found ? structuredClone(found) : null;
  }

  async list(): Promise<readonly CampaignSummary[]> {
    return [...this.#campaigns.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((record) => structuredClone(summaryOf(record)));
  }

  async setStatus(id: string, status: CampaignStatus): Promise<void> {
    // `updatedAt` is not touched here, exactly as `GameStorage.setStatus` doesn't touch it: this storage never
    // reads a clock (`game-storage.ts`'s own discipline) — a caller that wants a fresh timestamp writes one via
    // `put`, the same way `applyCampaignResult`'s caller already has `CampaignResultMeta.at` in hand.
    const record = this.#campaigns.get(id);
    if (record) this.#campaigns.set(id, { ...record, status });
  }
}
