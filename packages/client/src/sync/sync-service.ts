/**
 * The app's device-sync service (issue #276, step 2): the one object every screen talks to. It owns the saved recovery
 * code and what is derived from it, the engine, the scheduler and the status store, and answers the player's actions
 * (set up, join, link another device, sync now, unlink, delete the cloud copy) with plain results, so a scene never
 * touches the API, the crypto or the engine.
 *
 * Plain TypeScript with everything outside it injected (`SyncServiceDeps`); `sync-wiring.ts` builds the one real
 * instance. A scene calls `setUp()`, `join(code)` and `isOn()` and needs nothing else to turn sync on.
 *
 * Conflicts: when both devices changed a game and neither log extends the other, the engine awaits the player. The
 * service queues each as a `PendingConflict` and hands it to the listener (the conflict overlay); with no listener it
 * waits in the queue. Unlinking, deleting the cloud copy or joining another space answers whatever is still queued with
 * "later": nothing is written on either side, and the game is asked about again at the next sync.
 */
import { parseRecoveryCode } from "@mc/sync-worker/sync-protocol";
import type { SpaceInfo } from "@mc/sync-worker/sync-protocol";
import type { TransferFailure } from "../save-data/transfer-client.js";
import { onSaveDataChanged, type SaveDataChangeReason } from "./save-data-changed.js";
import * as syncApi from "./sync-api.js";
import type { SyncFailure, SyncResult } from "./sync-api.js";
import {
  clearSyncCode,
  deriveCredentials,
  loadSyncCode,
  newRecoveryCode,
  saveSyncCode,
  type CodeStorage,
  type SyncCredentials,
} from "./sync-credentials.js";
import { SyncEngine, type SyncEngineApi, type SyncRunResult } from "./sync-engine.js";
import {
  formatLinkCode,
  parseLinkCode,
  receiveSyncLink,
  receiveSyncLinkCode,
  sendSyncLink,
  type ReceiveLinkResult,
  type SendLinkResult,
  type SyncLinkAddress,
  type SyncLinkCode,
} from "./sync-link.js";
import {
  SyncScheduler,
  type EventSource,
  type ResumeSync,
  type SchedulerEngine,
  type Timers,
} from "./sync-scheduler.js";
import { OFF_STATUS, SyncStatusStore } from "./sync-status.js";
import type { ConflictChoice, GameConflict, LocalSaveData, SyncStateStore } from "./sync-types.js";

/** What the service's own calls to the space need (the engine has its own, `SyncEngineApi`). */
export interface SyncServiceApi {
  readonly createSpace: (
    creds: SyncCredentials,
  ) => Promise<SyncResult<{ readonly info: SpaceInfo; readonly created: boolean }>>;
  readonly spaceInfo: (creds: SyncCredentials) => Promise<SyncResult<{ readonly info: SpaceInfo }>>;
  readonly deleteSpace: (creds: SyncCredentials) => Promise<SyncResult<object>>;
}

export const defaultServiceApi: SyncServiceApi = {
  createSpace: (creds) => syncApi.createSpace(creds),
  spaceInfo: (creds) => syncApi.spaceInfo(creds),
  deleteSpace: (creds) => syncApi.deleteSpace(creds),
};

export interface SyncServiceDeps {
  /** `localStorage`, where the recovery code is kept. */
  readonly storage: CodeStorage;
  readonly local: LocalSaveData;
  readonly state: SyncStateStore;
  readonly describeGame?: (meta: unknown) => string | null;
  /** The card-pool fingerprint (`POOL_VERSION`) sealed into every record this build writes. */
  readonly contentVersion?: string;
  readonly api?: SyncServiceApi;
  readonly engineApi?: SyncEngineApi;
  readonly sendLink?: (recoveryCode: string) => Promise<SendLinkResult>;
  readonly receiveLink?: (link: SyncLinkAddress) => Promise<ReceiveLinkResult>;
  readonly receiveLinkCode?: (typed: SyncLinkCode) => Promise<ReceiveLinkResult>;
  /**
   * Whether a game is on the table. A conflict about another game is not put to the player mid-game: it is answered
   * "later" at once, the run goes on, and `hasHeldConflicts()` says one is waiting for them to leave the table.
   */
  readonly onTable?: () => boolean;
  readonly newCode?: () => string;
  readonly derive?: (code: string) => Promise<SyncCredentials>;
  readonly onSaveDataChanged?: (listener: (reason: SaveDataChangeReason) => void) => () => void;
  readonly document?: EventSource & { readonly visibilityState: string };
  readonly window?: EventSource;
  readonly timers?: Timers;
  readonly now?: () => number;
}

/** Why a service call failed, in the words a screen has wording for (`view/sync-model.ts`). */
export type SyncServiceFailure =
  | SyncFailure
  /** The typed code isn't 25 letters and digits. */
  | { readonly kind: "invalid-code" }
  /** A well-formed code that no synced saves belong to. */
  | { readonly kind: "wrong-code" }
  /** The link's room failed: expired, used, unreachable, damaged. */
  | { readonly kind: "link"; readonly failure: TransferFailure }
  /** This browser can't keep the code (storage refused) or can't encrypt. */
  | { readonly kind: "storage" }
  | { readonly kind: "not-on" }
  | { readonly kind: "error"; readonly message: string };

export type ServiceResult<T = object> =
  | ({ readonly ok: true } & T)
  | { readonly ok: false; readonly failure: SyncServiceFailure };

/** A game the player must decide about, and the one way to answer it. */
export interface PendingConflict {
  readonly conflict: GameConflict;
  /** Answers once; later calls are ignored. "keep-both" on a campaign game is refused (`conflict.campaign`). */
  readonly answer: (choice: ConflictChoice) => void;
}

type Unsubscribe = () => void;

export class SyncService {
  readonly status: SyncStatusStore;
  readonly #d: SyncServiceDeps;
  readonly #api: SyncServiceApi;
  readonly #scheduler: SyncScheduler;
  #code: string | null;
  #engine: SchedulerEngine | null = null;
  #inFlight: Promise<unknown> | null = null;
  readonly #conflictListeners = new Set<(pending: PendingConflict) => void>();
  readonly #queue: PendingConflict[] = [];
  readonly #appliedListeners = new Set<() => void>();
  readonly #changeListeners = new Set<() => void>();
  readonly #resumeListeners = new Set<(checking: boolean) => void>();
  #started = false;
  #held = false;

  constructor(deps: SyncServiceDeps) {
    this.#d = deps;
    this.#api = deps.api ?? defaultServiceApi;
    this.status = new SyncStatusStore(OFF_STATUS);
    this.#code = loadSyncCode(deps.storage);
    this.#scheduler = new SyncScheduler({
      engine: () => this.#engine,
      status: this.status,
      onSaveDataChanged: deps.onSaveDataChanged ?? onSaveDataChanged,
      ...(deps.document ? { document: deps.document } : {}),
      ...(deps.window ? { window: deps.window } : {}),
      ...(deps.timers ? { timers: deps.timers } : {}),
      ...(deps.now ? { now: deps.now } : {}),
    });
  }

  /** Whether this device is linked to a sync space (a saved recovery code), before or after the engine is up. */
  isOn(): boolean {
    return this.#code !== null;
  }

  /** The saved recovery code (ungrouped), for "Show recovery code"; null when sync is off. */
  recoveryCode(): string | null {
    return this.#code;
  }

  /** Boot: derives the saved code's credentials and starts syncing. Safe to call once; a damaged code reads as off. */
  async start(): Promise<void> {
    if (this.#started) return;
    this.#started = true;
    if (this.#code !== null) {
      try {
        await this.#engageWith(this.#code);
      } catch {
        // WebCrypto is missing: sync stays off for this session, the code stays saved.
        this.#engine = null;
      }
    }
    this.#scheduler.start();
  }

  /** Turns sync on with a fresh recovery code. Nothing is saved when the space can't be created. */
  async setUp(): Promise<ServiceResult<{ readonly recoveryCode: string }>> {
    if (this.#code !== null) return { ok: true, recoveryCode: this.#code };
    const code = (this.#d.newCode ?? newRecoveryCode)();
    let creds: SyncCredentials;
    try {
      creds = await (this.#d.derive ?? deriveCredentials)(code);
    } catch {
      return { ok: false, failure: { kind: "unsupported" } };
    }
    const created = await this.#api.createSpace(creds);
    if (!created.ok) return created;
    return this.#adopt(creds).then((ok) => (ok ? { ok: true, recoveryCode: creds.recoveryCode } : STORAGE_FAILURE));
  }

  /** Joins the space a typed recovery code belongs to. A code no space belongs to is `wrong-code`: nothing is created. */
  async join(recoveryCode: string): Promise<ServiceResult> {
    const code = parseRecoveryCode(recoveryCode);
    if (!code) return { ok: false, failure: { kind: "invalid-code" } };
    if (this.#code === code) return { ok: true };
    let creds: SyncCredentials;
    try {
      creds = await (this.#d.derive ?? deriveCredentials)(code);
    } catch {
      return { ok: false, failure: { kind: "unsupported" } };
    }
    // The space is looked up, not created: every code derives a valid space id, so a mistyped one would otherwise
    // quietly start an empty space and the player would believe they had joined theirs.
    const found = await this.#api.spaceInfo(creds);
    if (!found.ok) return found.failure.kind === "not-found" ? { ok: false, failure: { kind: "wrong-code" } } : found;
    if (this.#code !== null) await this.#stopSyncing();
    return (await this.#adopt(creds)) ? { ok: true } : STORAGE_FAILURE;
  }

  /** A second device's QR code: puts the recovery code in a transfer room under a long key. */
  async linkDevice(): Promise<
    ServiceResult<{ readonly link: SyncLinkAddress; readonly expiresAt: number; readonly typedText: string }>
  > {
    if (this.#code === null) return { ok: false, failure: { kind: "not-on" } };
    try {
      const sent = await (this.#d.sendLink ?? sendSyncLink)(this.#code);
      return sent.ok
        ? { ok: true, link: sent.link, expiresAt: sent.expiresAt, typedText: formatLinkCode(sent.typed) }
        : { ok: false, failure: { kind: "link", failure: sent.failure } };
    } catch (error) {
      return { ok: false, failure: { kind: "error", message: error instanceof Error ? error.message : String(error) } };
    }
  }

  /** Join's one field: a typed link code (16 characters) or a 25-character recovery code, in that order. */
  async joinWithInput(input: string): Promise<ServiceResult> {
    const code = parseLinkCode(input);
    if (code) {
      let got: ReceiveLinkResult;
      try {
        got = await (this.#d.receiveLinkCode ?? receiveSyncLinkCode)(code);
      } catch (error) {
        return {
          ok: false,
          failure: { kind: "error", message: error instanceof Error ? error.message : String(error) },
        };
      }
      return got.ok ? this.join(got.recoveryCode) : { ok: false, failure: { kind: "link", failure: got.failure } };
    }
    return this.join(input);
  }

  /** Scanned a link: fetches the recovery code from its room and joins. The caller has asked the player first. */
  async joinFromLink(link: SyncLinkAddress): Promise<ServiceResult> {
    let got: ReceiveLinkResult;
    try {
      got = await (this.#d.receiveLink ?? receiveSyncLink)(link);
    } catch (error) {
      return { ok: false, failure: { kind: "error", message: error instanceof Error ? error.message : String(error) } };
    }
    if (!got.ok) return { ok: false, failure: { kind: "link", failure: got.failure } };
    return this.join(got.recoveryCode);
  }

  /** The Sync now button. Resolves when the run ends; null when sync is off. */
  syncNow(): Promise<SyncRunResult | null> {
    return this.#scheduler.syncNow();
  }

  /** Continue: runs (or joins) a sync, but never waits longer than the scheduler's timeout. */
  async syncBeforeResume(gameId: string): Promise<ResumeSync> {
    if (!this.isOn()) return "off";
    this.#emitResume(true);
    try {
      const result = await this.#scheduler.syncBeforeResume(gameId);
      // A question about this very game is the player's to answer: resuming past it would play the wrong copy.
      if (result === "timeout" && this.#queue.some((p) => p.conflict.gameId === gameId) && this.#inFlight) {
        try {
          await this.#inFlight;
        } catch {
          // The run's own failure was already shown.
        }
        return "synced";
      }
      return result;
    } finally {
      this.#emitResume(false);
    }
  }

  /** Stops syncing on this device. Local saves stay; the cloud copy stays for other devices. */
  async unlink(): Promise<void> {
    await this.#stopSyncing();
  }

  /** Deletes the cloud copy for every device, then unlinks this one. On failure nothing changes. */
  async deleteCloudData(): Promise<ServiceResult> {
    if (this.#code === null) return { ok: false, failure: { kind: "not-on" } };
    let creds: SyncCredentials;
    try {
      creds = await (this.#d.derive ?? deriveCredentials)(this.#code);
    } catch {
      return { ok: false, failure: { kind: "unsupported" } };
    }
    const deleted = await this.#api.deleteSpace(creds);
    // A space that is already gone is the state the player asked for.
    if (!deleted.ok && deleted.failure.kind !== "not-found") return deleted;
    await this.#stopSyncing();
    return { ok: true };
  }

  // ---- what screens listen to ------------------------------------------------------------------------------------

  /** Conflicts waiting for an answer are delivered at once to a new listener. Returns the unsubscribe. */
  onConflict(listener: (pending: PendingConflict) => void): Unsubscribe {
    this.#conflictListeners.add(listener);
    for (const pending of [...this.#queue]) listener(pending);
    return () => this.#conflictListeners.delete(listener);
  }

  /** True once a conflict was put off ("later") because a game was on the table; reading it clears it. */
  takeHeldConflicts(): boolean {
    const held = this.#held;
    this.#held = false;
    return held;
  }

  /** Conflicts not yet answered. */
  pendingConflicts(): readonly PendingConflict[] {
    return [...this.#queue];
  }

  /** A sync wrote records to this device (a list or a deck screen should read again). */
  onApplied(listener: () => void): Unsubscribe {
    this.#appliedListeners.add(listener);
    return () => this.#appliedListeners.delete(listener);
  }

  /** This device was linked or unlinked (screens that show the state redraw). */
  onLinkChange(listener: () => void): Unsubscribe {
    this.#changeListeners.add(listener);
    return () => this.#changeListeners.delete(listener);
  }

  /** True while Continue is waiting on the check for newer saves (the busy banner shows after a beat). */
  onResumeChecking(listener: (checking: boolean) => void): Unsubscribe {
    this.#resumeListeners.add(listener);
    return () => this.#resumeListeners.delete(listener);
  }

  // ---- internals -------------------------------------------------------------------------------------------------

  #emitResume(checking: boolean): void {
    for (const listener of [...this.#resumeListeners]) listener(checking);
  }

  /** Saves the code, brings the engine up and runs the first sync. `false` when the code could not be kept. */
  async #adopt(creds: SyncCredentials): Promise<boolean> {
    if (!saveSyncCode(this.#d.storage, creds.recoveryCode)) return false;
    this.#code = creds.recoveryCode;
    this.#install(creds);
    for (const listener of [...this.#changeListeners]) listener();
    // The first sync: pulls what the space holds and pushes this device's saves. Not awaited, the status shows it.
    void this.#scheduler.syncNow();
    return true;
  }

  async #engageWith(code: string): Promise<void> {
    const creds = await (this.#d.derive ?? deriveCredentials)(code);
    this.#install(creds);
  }

  #install(creds: SyncCredentials): void {
    const engine = new SyncEngine({
      credentials: creds,
      local: this.#d.local,
      state: this.#d.state,
      resolveConflict: (conflict) => this.#ask(conflict),
      ...(this.#d.contentVersion ? { contentVersion: this.#d.contentVersion } : {}),
      ...(this.#d.engineApi ? { api: this.#d.engineApi } : {}),
      ...(this.#d.describeGame ? { describeGame: this.#d.describeGame } : {}),
      ...(this.#d.now ? { now: this.#d.now } : {}),
    });
    this.#engine = {
      sync: () => {
        const run = engine.sync().then((result) => {
          if (result.applied > 0) for (const listener of [...this.#appliedListeners]) listener();
          return result;
        });
        this.#inFlight = run;
        return run;
      },
    };
  }

  #ask(conflict: GameConflict): Promise<ConflictChoice> {
    if (this.#d.onTable?.()) {
      this.#held = true;
      return Promise.resolve("later");
    }
    return new Promise<ConflictChoice>((resolve) => {
      let answered = false;
      const pending: PendingConflict = {
        conflict,
        answer: (choice) => {
          if (answered) return;
          // The engine treats "keep both" on a campaign game as a programming error: refuse it here.
          if (choice === "keep-both" && conflict.campaign) return;
          answered = true;
          const at = this.#queue.indexOf(pending);
          if (at >= 0) this.#queue.splice(at, 1);
          resolve(choice);
        },
      };
      this.#queue.push(pending);
      for (const listener of [...this.#conflictListeners]) listener(pending);
    });
  }

  /** Waits out a run in progress (answering its questions), then forgets the space, the code and the sync state. */
  async #stopSyncing(): Promise<void> {
    for (const pending of [...this.#queue]) pending.answer("later");
    const running = this.#inFlight;
    this.#engine = null;
    if (running) {
      try {
        await running;
      } catch {
        // The run's own failure was already shown; the space is being left anyway.
      }
    }
    for (const pending of [...this.#queue]) pending.answer("later");
    this.#inFlight = null;
    clearSyncCode(this.#d.storage);
    this.#code = null;
    try {
      await this.#d.state.clear();
    } catch {
      // The state is keyed by space id: a leftover is discarded at the next link.
    }
    this.status.set({ state: "off", lastSyncedAt: null });
    for (const listener of [...this.#changeListeners]) listener();
  }
}

const STORAGE_FAILURE: { readonly ok: false; readonly failure: SyncServiceFailure } = {
  ok: false,
  failure: { kind: "storage" },
};
