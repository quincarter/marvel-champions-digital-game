/** "Deal it out": starts the engine on the draft, then routes to the deal (or the scenario's intro), or back to a fix. */
import type Phaser from "phaser";
import { currentScenarios } from "../../../content/pool.js";
import { appSession } from "../../../session.js";
import { tableRulesOf } from "../../../settings.js";
import { noteDeckFeat } from "../../../progression/deck-feats.js";
import { refreshUnlocks } from "../../../progression/progression.js";
import { ART_CATALOG, introArtFor } from "../../../art/scenario-art.js";
import { scenarioIntroFor } from "../../../campaign/scenario-intros.js";
import { keepRoomDraft, roomSetupActive } from "../../../view/room-table-setup.js";
import { corePlayerForSeat } from "../../../view/deck-seat.js";
import { toSessionConfig, type SetupDraft } from "../../../view/setup-draft.js";
import { parseSeed } from "../../../view/seed.js";
import type { DeckOption } from "../../../view/deck-list-model.js";
import { goToScreen } from "../../../ui/transitions.js";
import { SCENES } from "../../keys.js";
import type { DecksSceneData } from "../../decks.js";
import type { ScenarioIntroData } from "../../scenario-intro.js";

/** What dealing needs of the screen. */
export interface DealHost {
  readonly scene: Phaser.Scene;
  readonly draft: SetupDraft;
  readonly seedText: string;
  readonly players: readonly ReturnType<typeof corePlayerForSeat>[];
  readonly deckOptions: readonly DeckOption[];
  readonly watchable: boolean;
  readonly blocked: string | null;
  /** Set while dealing (the Deal button dims, Back waits); false when it failed. */
  readonly working: (on: boolean) => void;
  readonly leaving: () => void;
  readonly stopRedraw: () => void;
  readonly status: (text: string) => void;
}

export async function dealIt(h: DealHost): Promise<void> {
  if (h.blocked !== null) return;
  if (parseSeed(h.seedText) === null) return h.status("seed");
  if (roomSetupActive()) {
    // Room mode (#880): the draft is kept (it names no heroes: every player brings their own deck) and the lobby returns.
    keepRoomDraft(h.draft);
    h.leaving();
    h.stopRedraw();
    goToScreen(h.scene, SCENES.roomLobby);
    return;
  }
  h.working(true);
  const { store } = appSession();
  const config = toSessionConfig(
    h.draft,
    h.players,
    currentScenarios().find((s) => (s.id as string) === h.draft.scenarioId),
    tableRulesOf(appSession().settings),
  );
  await store.start(h.watchable ? { ...config, watchable: true } : config);
  // The screen was left while the game was being made: nothing here is on screen any more.
  if (!h.scene.sys.isActive()) return;
  if (store.state.status === "failed") {
    h.working(false);
    const problem = store.state.setupError;
    if (problem?.code === "illegal_deck") {
      const seat = problem.illegalDecks[0];
      h.stopRedraw();
      goToScreen(h.scene, SCENES.decks, {
        focusDeckId: (seat ? h.draft.seats[seat.seatIndex] : undefined) ?? null,
        message: seat?.problems[0]?.message ?? store.state.error ?? "This deck is not legal.",
      } satisfies DecksSceneData);
      return;
    }
    h.status(store.state.error ?? "setup failed");
    return;
  }
  // A game dealt with a deck the player built (achievements).
  const seated = new Set(h.draft.seats);
  if (
    h.deckOptions.some((o) => seated.has(o.deck.id as string) && o.deck.source.kind === "userBuilt") &&
    noteDeckFeat("playedBuilt")
  )
    void refreshUnlocks().catch(() => false);
  h.stopRedraw();
  // "Deal it out" goes through the setup deal and mulligan screen, never straight to the Board. A scenario with a one-off
  // intro (`campaign/scenario-intros.ts`) and its artboard reads that first; the intro hands off to the deal itself.
  const scenarioId = h.draft.scenarioId;
  if (scenarioIntroFor(scenarioId) && introArtFor(ART_CATALOG, scenarioId)) {
    goToScreen(h.scene, SCENES.scenarioIntro, { scenarioId } satisfies ScenarioIntroData);
    return;
  }
  goToScreen(h.scene, SCENES.setupDeal);
}
