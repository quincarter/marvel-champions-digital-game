/**
 * What the Briefing does, apart from how it looks: load the run, compose the issue (asking one choice at a time and
 * composing again on every answer, the service's own re-entry loop), open or continue the issue, edit a deck, and save a
 * mode or the easier start. The scene owns the panel and the route; this owns the state changes and the navigation.
 *
 * Composing (`campaignService().compose`) re-runs from the top on every answer (`campaign-service.ts`'s own doc comment),
 * so `state.answers` accumulates across re-entries and `compose` is called again until it comes back `"done"`. Nothing
 * half-answered is ever shown as settled: `state.pending` is only ever the current unanswered question.
 */
import type Phaser from "phaser";
import type { PlayerSetup } from "@mc/engine";
import { issueStoryFor } from "../../../campaign/story.js";
import { gameInProgressOf } from "../../../campaign/unfolded-game.js";
import { campaignCardsById, campaignPool } from "../../../content/campaign-pool.js";
import type { CampaignRecord } from "../../../engine/campaign-storage.js";
import { t } from "../../../i18n/translate.js";
import { appSession, campaignService } from "../../../session.js";
import { goToScreen } from "../../../ui/transitions.js";
import { answersOfAttempt, deckProblemsOf } from "../../../view/campaign-briefing-model.js";
import { easierStartIsOn } from "../../../view/campaign-easier-start-model.js";
import { awaitsIssuePick, currentNodeIdOf, issueNumberOfRecord } from "../../../view/campaign-issue-pick.js";
import { isMarketPendingChoice } from "../../../view/campaign-market-model.js";
import { applyIssueMode } from "../../../view/campaign-modes-model.js";
import { SCENES } from "../../keys.js";
import { routeUnfoldedGame } from "../unfolded-game-route.js";
import type { CampaignOpenerData } from "../routes.js";
import { resetCallState, type BriefingState } from "./context.js";

export class BriefingFlow {
  readonly #scene: Phaser.Scene;
  readonly #state: BriefingState;
  readonly #redraw: () => void;
  readonly #leave: () => void;

  /**
   * `redraw` draws the screen again; `leave` is called just before the scene hands over to another (it stops listening to
   * the screen's size, so nothing redraws under the fade).
   */
  constructor(scene: Phaser.Scene, state: BriefingState, redraw: () => void, leave: () => void) {
    this.#scene = scene;
    this.#state = state;
    this.#redraw = redraw;
    this.#leave = leave;
  }

  get #alive(): boolean {
    return this.#scene.sys.isActive();
  }

  async load(): Promise<void> {
    const state = this.#state;
    const service = campaignService();
    const loaded = await service.load(state.data.runId);
    if (loaded && (await routeUnfoldedGame(this.#scene, loaded))) return;
    // An issue composed before removed cards left decks on their own is composed again, without them.
    const record = loaded ? await service.discardStaleAttempt(loaded) : null;
    if (!this.#alive) return;
    if (!record) {
      goToScreen(this.#scene, SCENES.campaignSaga);
      return;
    }
    const definition = service.definitionFor(record);
    // A `choice` graph (Fear No Evil) has no next node until the group has drawn and picked one, and that draw is
    // part of composing this briefing: only a finished run has nowhere left to go.
    if (!currentNodeIdOf(record) && !awaitsIssuePick(definition, record)) {
      goToScreen(this.#scene, SCENES.campaignDossier, { runId: record.id });
      return;
    }
    appSession().music?.playInterlude(record.campaignId as string);
    state.inProgress =
      state.data.replaySeed === undefined && gameInProgressOf(record, await appSession().store.listSaves()) !== null;
    if (!this.#alive) return;
    state.record = record;
    state.definition = definition;
    state.nodeAtLoad = currentNodeIdOf(record);
    state.nodeIds = definition.graph.nodes.map((node) => node.id);
    this.#syncIssue(record);
    this.#redraw();
    void this.compose();
  }

  /** The issue being briefed: its story and number, from the node the record has settled on (none yet, in a choice). */
  #syncIssue(record: CampaignRecord): void {
    const state = this.#state;
    const nodeId = currentNodeIdOf(record);
    state.story = nodeId ? issueStoryFor(record.campaignId, nodeId) : null;
    if (state.definition) state.issueNumber = issueNumberOfRecord(state.definition, record);
  }

  async compose(): Promise<void> {
    const state = this.#state;
    const record = state.record;
    if (!record || record.attempt || state.composing) {
      this.#redraw();
      return;
    }
    state.composing = true;
    this.#redraw();
    const result = await campaignService().compose(record, state.answers);
    if (!this.#alive) return;
    state.composing = false;
    if (result.kind === "pending") {
      // A Market-shaped choice (`view/campaign-market-model.ts`) gets its own screen, never this generic panel —
      // detected by shape (every option prices in the campaign's currency field), never by `campaignId`.
      if (isMarketPendingChoice(result.choice, (id) => campaignCardsById().get(id))) {
        this.#leave();
        goToScreen(this.#scene, SCENES.campaignMarket, {
          runId: record.id,
          answers: state.answers,
          ...(state.data.replaySeed === undefined ? {} : { replaySeed: state.data.replaySeed }),
        });
        return;
      }
      state.pending = result.choice;
      resetCallState(state);
    } else {
      state.record = result.record;
      this.#syncIssue(result.record);
      state.pending = null;
      state.answers = [];
      // A choice graph's issue was only just picked, so its opener never played: play its comic now, then come back
      // here (the composed issue is saved, so this screen reopens on it). An issue with no comic needs no detour.
      const picked = currentNodeIdOf(result.record);
      const unread = state.nodeAtLoad === null && picked !== state.data.openerReadNodeId;
      if (unread && picked !== null && (state.story?.comicBeats?.length ?? 0) > 0) {
        this.#leave();
        goToScreen(this.#scene, SCENES.campaignOpener, {
          runId: result.record.id,
          nodeId: picked,
          returnTo: {
            key: SCENES.campaignBriefing,
            data: {
              runId: result.record.id,
              ...(state.data.replaySeed === undefined ? {} : { replaySeed: state.data.replaySeed }),
            },
          },
        } satisfies CampaignOpenerData);
        return;
      }
    }
    this.#redraw();
  }

  /** Submits one answer for the current pending choice and composes again. */
  answer(picked: readonly string[]): void {
    const state = this.#state;
    const pending = state.pending;
    if (!pending) return;
    state.answers = [
      ...state.answers,
      { instructionId: pending.instructionId, slot: pending.slot, seatNumber: pending.seatNumber, picked },
    ];
    state.pending = null;
    resetCallState(state);
    void this.compose();
  }

  /**
   * The seats whose deck `createGame` would refuse for the composed issue, by the engine's own check
   * (`illegalDecksOf`), so the Briefing shows before the press what pressing Open issue would say. Empty before an
   * issue is composed. Memoized on the attempt: it validates every seat against the whole pool.
   */
  deckProblems(record: CampaignRecord): ReadonlyMap<number, string> {
    const state = this.#state;
    const attempt = record.attempt;
    if (!attempt) return new Map();
    if (state.deckProblemsFor?.key === attempt) return state.deckProblemsFor.problems;
    let problems: ReadonlyMap<number, string> = new Map();
    try {
      const { players, campaign } = campaignService().launchConfig(record);
      // A campaign issue always names its decks; a precon-by-id seat cannot occur here.
      const decked = players.filter((player): player is PlayerSetup => "deck" in player);
      problems = deckProblemsOf(record, { players: decked, ...(campaign ? { campaign } : {}), cards: campaignPool() });
    } catch {
      // A composed issue this build cannot even configure is the setup screen's to report, as it always was.
    }
    state.deckProblemsFor = { key: attempt, problems };
    return problems;
  }

  /**
   * Opens one seat's deck. The composed attempt is thrown away on the way (a deck edit makes it stale), but the calls
   * it already answered, and any answered so far, ride back with the Briefing so the issue composes again without
   * re-asking them (a role, a role-building pick), and its random draws replay from the restored RNG.
   */
  async editDecks(seatNumber?: number): Promise<void> {
    const state = this.#state;
    const record = state.record;
    if (!record) return;
    const seats = record.seats.map((seat) => seat.seatNumber);
    const problemSeat = [...this.deckProblems(record).keys()][0];
    const target = seatNumber ?? problemSeat ?? (seats.length > 1 ? null : (seats[0] ?? 1));
    if (target === null) {
      state.seatPicker = true;
      this.#redraw();
      return;
    }
    const kept = [...state.answers, ...(record.attempt ? answersOfAttempt(record.attempt) : [])];
    if (record.attempt) await campaignService().discardAttempt(record);
    this.#leave();
    goToScreen(this.#scene, SCENES.campaignDeckEdit, {
      runId: state.data.runId,
      seatNumber: target,
      returnTo: {
        key: SCENES.campaignBriefing,
        data: {
          runId: state.data.runId,
          ...(kept.length > 0 ? { answers: kept } : {}),
          ...(record.attempt ? { openerReadNodeId: record.attempt.nodeId } : {}),
        },
      },
    });
  }

  async openIssue(): Promise<void> {
    const state = this.#state;
    const record = state.record;
    if (!record?.attempt || state.starting || state.toggling) return;
    state.starting = true;
    state.startError = null;
    this.#redraw();
    const { store } = appSession();
    // This issue is already on the table (left by a refresh or Back to title): pick that game up, never deal anew.
    // Not on Rewind's "Same hands", which deals the issue again on purpose.
    const playing = state.data.replaySeed === undefined ? gameInProgressOf(record, await store.listSaves()) : null;
    if (playing) {
      await store.resume(playing.id);
      if (!this.#alive) return;
      if (store.state.status !== "failed") {
        this.#leave();
        goToScreen(this.#scene, store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board);
        return;
      }
    }
    const composed = campaignService().launchConfig(record);
    const replaySeed = state.data.replaySeed;
    const config = replaySeed === undefined ? composed : { ...composed, seed: replaySeed };
    await store.start(state.watchable ? { ...config, watchable: true } : config);
    if (!this.#alive) return;
    if (store.state.status === "failed") {
      state.starting = false;
      state.startError = store.state.setupError?.illegalDecks[0]
        ? t("briefing.error.illegalDeck")
        : (store.state.error ?? t("briefing.error.setup"));
      this.#redraw();
      return;
    }
    this.#leave();
    goToScreen(this.#scene, SCENES.setupDeal);
  }

  /** One mode chip: stores the modes and composes the issue again under them. */
  async setIssueMode(action: string): Promise<void> {
    const state = this.#state;
    const record = state.record;
    if (!record?.attempt || state.starting || state.toggling) return;
    const { scenarioId, villainSetId } = campaignService().launchConfig(record);
    // The calls this issue already answered ride along, as they do through a deck edit (`editDecks`): composing again
    // never asks them twice, and an issue picked on this visit does not replay its comic.
    state.answers = [...state.answers, ...answersOfAttempt(record.attempt)];
    state.data = { ...state.data, openerReadNodeId: record.attempt.nodeId };
    state.toggling = true;
    state.startError = null;
    this.#redraw();
    try {
      state.record = await campaignService().setIssueModes(
        record,
        applyIssueMode(scenarioId, record.issueModes ?? {}, action, villainSetId),
      );
    } catch (error) {
      state.startError = error instanceof Error ? error.message : t("briefing.error.mode");
    } finally {
      state.toggling = false;
    }
    if (this.#alive) void this.compose();
  }

  /** Flips the toggle (stored on the run, off by default) and redraws; nothing is composed again. */
  async toggleEasierStart(): Promise<void> {
    const state = this.#state;
    const record = state.record;
    if (!record?.attempt || state.starting || state.toggling) return;
    state.toggling = true;
    state.startError = null;
    this.#redraw();
    try {
      state.record = await campaignService().setEasierStart(record, !easierStartIsOn(record));
    } catch (error) {
      state.startError = error instanceof Error ? error.message : t("briefing.error.easier");
    } finally {
      state.toggling = false;
    }
    if (this.#alive) this.#redraw();
  }
}
