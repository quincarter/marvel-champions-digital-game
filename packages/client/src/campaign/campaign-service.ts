/**
 * The campaign loop as the client drives it: one object that owns "where is this campaign kept" and "which runner
 * call comes next", so no scene has to get the order of `resolveBetweenGames` → `startGameFromLog` → play →
 * `campaignResultOf` → `applyCampaignResult` right by hand (docs/campaign-mode-design.md §7).
 *
 * Plain TypeScript over a `CampaignStorage` and the engine's own runner — no Phaser — so the whole loop is tested
 * with Vitest against the real MC10 definition.
 *
 * **Nothing half-answered is ever written.** The runner asks one choice at a time and re-runs from the top on every
 * answer (runner.ts's "re-entry is re-running"), so a pending result is returned to the caller with the record
 * untouched, and only a `done` result is persisted. Reloading the page mid-choice therefore asks the same
 * question again with the same options, and a `random` op cannot be rerolled by refreshing.
 */
import { campaignDefinitionOf } from "@mc/cards";
import { CAMPAIGNS as CONTENT_CAMPAIGNS, type Campaign, type CardId, type Deck, type PlayModes } from "@mc/content";
import {
  applyCommands,
  createCampaignLog,
  resolveBetweenGames,
  type CampaignChoiceAnswer,
  type CampaignDefinition,
  type CampaignDeps,
  type CampaignGameInput,
  type CampaignLog,
  type CampaignPendingChoice,
  type EngineDeps,
  type GameEvent,
  type GameState,
} from "@mc/engine";
import type { SessionConfig, SavedGame } from "../engine/host.js";
import { CAMPAIGN_STORAGE_SCHEMA, type CampaignRecord, type CampaignStorage } from "../engine/campaign-storage.js";
import { campaignLaunchConfig, campaignPostGameFold } from "../view/campaign-step-model.js";

/**
 * Every campaign box's `@mc/content` record this client knows, by `Campaign.id`. A box is playable only when
 * `@mc/cards` also ships its `CampaignDefinition` (`campaignDefinitionOf`); a record without one is listed as
 * sealed rather than hidden.
 */
export const CAMPAIGN_RECORDS: Readonly<Record<string, Campaign>> = Object.fromEntries(
  CONTENT_CAMPAIGNS.map((campaign) => [campaign.id as string, campaign]),
);

/** A new campaign's seat: the identity locked for the campaign, and the campaign's own copy of a deck. */
export interface CampaignSeatChoice {
  readonly identityCardId: CardId;
  readonly deck: Deck;
}

export interface StartCampaignInput {
  readonly campaignId: string;
  readonly seats: readonly CampaignSeatChoice[];
  /** The Expert Campaign modifier (MC10 p. 17), stored as `modes.campaign.expertCampaign`. */
  readonly expertCampaign?: boolean;
  readonly poolVersion: string;
  readonly seed: number;
}

/** A step that finished, with the record as now stored, or the one question still blocking it. */
export type CampaignStepResult =
  | { readonly kind: "done"; readonly record: CampaignRecord }
  | { readonly kind: "pending"; readonly choice: CampaignPendingChoice };

export interface CampaignServiceOptions {
  readonly storage: CampaignStorage;
  /** Card pool every `campaignSet`/`collection`/`ownDeck` choice draws from. */
  readonly campaignDeps: CampaignDeps;
  /** The engine deps a finished game is replayed and read with. */
  readonly engineDeps: EngineDeps;
  /** Epoch ms. Injected so tests are deterministic; the engine itself never reads a clock. */
  readonly now?: () => number;
  /** A fresh id for a new campaign. */
  readonly newId?: () => string;
  readonly definitionOf?: (campaignId: string) => CampaignDefinition | undefined;
}

export class CampaignService {
  readonly storage: CampaignStorage;
  readonly #campaignDeps: CampaignDeps;
  readonly #engineDeps: EngineDeps;
  readonly #now: () => number;
  readonly #newId: () => string;
  readonly #definitionOf: (campaignId: string) => CampaignDefinition | undefined;

  constructor(options: CampaignServiceOptions) {
    this.storage = options.storage;
    this.#campaignDeps = options.campaignDeps;
    this.#engineDeps = options.engineDeps;
    this.#now = options.now ?? Date.now;
    this.#newId =
      options.newId ?? (() => `campaign-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
    this.#definitionOf = options.definitionOf ?? campaignDefinitionOf;
  }

  definitionFor(record: Pick<CampaignLog, "campaignId">): CampaignDefinition {
    const definition = this.#definitionOf(record.campaignId as string);
    if (!definition) throw new Error(`this build has no campaign definition for "${record.campaignId as string}"`);
    return definition;
  }

  /** Signs the roster: a fresh log positioned on the first issue, stored. Nothing is composed yet. */
  async start(input: StartCampaignInput): Promise<CampaignRecord> {
    const content = CAMPAIGN_RECORDS[input.campaignId];
    const definition = this.#definitionOf(input.campaignId);
    if (!content || !definition) throw new Error(`campaign "${input.campaignId}" is not playable in this build`);
    // Expert campaign is a modification of *campaign* mode (`CampaignModeRef.expertCampaign`), which is where
    // `matchesModes` reads it — never a top-level `PlayModes` key.
    const modes: PlayModes = {
      campaign: {
        campaignId: definition.campaignId,
        ...(input.expertCampaign ? { expertCampaign: true as const } : {}),
      },
    };
    const log = createCampaignLog(definition, {
      id: this.#newId(),
      seats: input.seats.map((seat, index) => ({
        seatNumber: index + 1,
        identityCardId: seat.identityCardId,
        // The campaign's own copy (design Q5): only the contents, never the `mc-decks` id it was copied from.
        deck: { identityCardId: seat.deck.identityCardId, aspects: seat.deck.aspects, cards: seat.deck.cards },
      })),
      modes,
      poolVersion: input.poolVersion,
      seed: input.seed,
    });
    const at = this.#now();
    const record: CampaignRecord = {
      ...log,
      recordSchema: CAMPAIGN_STORAGE_SCHEMA,
      name: content.name,
      box: content.boxCode,
      createdAt: at,
      updatedAt: at,
    };
    await this.storage.create(record);
    return record;
  }

  load(id: string): Promise<CampaignRecord | null> {
    return this.storage.load(id);
  }

  /**
   * Composes the next issue (its between-games setup instructions), answering choices from `answers`. Returns the
   * next unanswered choice without writing anything, or stores the composed record (`record.attempt` set). A record
   * that already holds a composed attempt is returned as-is: composing is idempotent from the caller's side.
   */
  async compose(record: CampaignRecord, answers: readonly CampaignChoiceAnswer[] = []): Promise<CampaignStepResult> {
    if (record.attempt) return { kind: "done", record };
    const definition = this.definitionFor(record);
    const result = resolveBetweenGames(definition, record, this.#campaignDeps, record.modes, answers);
    if (result.kind === "pending") return result;
    return { kind: "done", record: await this.#put(record, result.value) };
  }

  /**
   * Throws away a composed-but-unplayed attempt so the issue can be composed again — the Briefing's "change my
   * answer" and the deck-edit round trip. Restores the snapshot the attempt was composed from, so a `random` draw
   * re-runs from the same RNG state and reproduces itself.
   */
  async discardAttempt(record: CampaignRecord): Promise<CampaignRecord> {
    const attempt = record.attempt;
    if (!attempt) return record;
    const { attempt: _dropped, ...rest } = record;
    const before = attempt.logBefore;
    return this.#put(record, {
      ...rest,
      seats: before.seats,
      shared: before.shared,
      hidden: before.hidden,
      // RRG 1.8 p. 29: a removal outlives even a retry, so it outlives an attempt that was never played.
      removedFromCampaign: record.removedFromCampaign,
      position: before.position,
      rng: before.rng,
    });
  }

  /** The `SessionConfig` that starts the composed issue through the ordinary host path. */
  launchConfig(record: CampaignRecord): SessionConfig {
    return campaignLaunchConfig(this.definitionFor(record), record);
  }

  /**
   * Folds a finished game back into the campaign. The events are replayed from the save's own baseline and command
   * log (`EngineHost.save()`), never from what the Board happened to animate, so a game resumed after a refresh
   * folds exactly like one played start to finish.
   */
  async fold(
    record: CampaignRecord,
    saved: SavedGame,
    answers: readonly CampaignChoiceAnswer[] = [],
    gameId: string | null = null,
  ): Promise<CampaignStepResult> {
    const replayed = applyCommands(saved.initialState, saved.commands, this.#engineDeps);
    if (!replayed.ok) throw new Error(`the finished game no longer replays: ${replayed.error.message}`);
    return this.foldState(record, replayed.state, replayed.events, answers, gameId);
  }

  /** `fold` for a caller that already has the final state and the whole event stream. */
  async foldState(
    record: CampaignRecord,
    finalState: GameState,
    events: readonly GameEvent[],
    answers: readonly CampaignChoiceAnswer[] = [],
    gameId: string | null = null,
  ): Promise<CampaignStepResult> {
    const definition = this.definitionFor(record);
    const result = campaignPostGameFold(
      definition,
      record,
      finalState,
      events,
      { at: this.#now(), gameId },
      this.#campaignDeps,
      this.#engineDeps,
      answers,
    );
    if (result.kind === "pending") return result;
    return { kind: "done", record: await this.#put(record, result.value) };
  }

  /**
   * The stored campaign a campaign game belongs to: the most recently played active record of that box whose
   * composed attempt is that node. `CampaignGameInput` carries the box's id and the node, not the log's own id,
   * so this is how Game over (or a resumed game) finds its way back.
   */
  async recordForGame(input: Pick<CampaignGameInput, "campaignId" | "nodeId">): Promise<CampaignRecord | null> {
    for (const summary of await this.storage.list()) {
      if (summary.status !== "active" || summary.campaignId !== input.campaignId) continue;
      const record = await this.storage.load(summary.id);
      if (record?.attempt?.nodeId === input.nodeId) return record;
    }
    return null;
  }

  /**
   * Between issues a seat may change aspects and deck contents, never the identity (MC10 p. 3). The caller has
   * already validated `deck` with `campaign-deck-edit-model.ts`; this refuses only what would corrupt the log — an
   * identity change, or editing while an issue is composed (discard the attempt first, so its snapshot is not stale).
   */
  async setSeatDeck(record: CampaignRecord, seatNumber: number, deck: Deck): Promise<CampaignRecord> {
    if (record.attempt) throw new Error("discard the composed issue before editing a deck");
    const seat = record.seats.find((candidate) => candidate.seatNumber === seatNumber);
    if (!seat) throw new Error(`campaign ${record.id} has no seat ${seatNumber}`);
    if (deck.identityCardId !== seat.identityCardId) throw new Error("a campaign identity is locked (MC10 p. 3)");
    return this.#put(record, {
      ...record,
      seats: record.seats.map((candidate) =>
        candidate.seatNumber === seatNumber
          ? { ...candidate, deck: { identityCardId: deck.identityCardId, aspects: deck.aspects, cards: deck.cards } }
          : candidate,
      ),
    });
  }

  /** "Start over": the run is kept on the shelf as abandoned, never deleted. */
  async abandon(id: string): Promise<void> {
    await this.storage.setStatus(id, "abandoned");
  }

  async #put(previous: CampaignRecord, log: CampaignLog): Promise<CampaignRecord> {
    const next: CampaignRecord = {
      ...log,
      recordSchema: previous.recordSchema,
      name: previous.name,
      box: previous.box,
      createdAt: previous.createdAt,
      updatedAt: this.#now(),
    };
    await this.storage.put(next);
    return next;
  }
}
