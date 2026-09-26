/**
 * The app's entry point: the one place a Phaser game is created.
 *
 * The scale manager runs in resize mode, so every screen asks the layout module
 * for rectangles at the current size rather than scaling a fixed canvas
 * (PLAN.md Phase 4). Physics is not configured — the game has none.
 */

// The three families, bundled rather than linked from Google Fonts, so a
// packaged app (Tauri/Capacitor) draws in its own faces offline and never races
// a CDN. Exactly the faces `WEB_FONTS` (tokens.ts) waits for.
import "@fontsource/bangers/400.css";
import "@fontsource/public-sans/400.css";
import "@fontsource/public-sans/700.css";
import "@fontsource/public-sans/800.css";
import "@fontsource/ibm-plex-mono/400.css";
import Phaser from "phaser";
import { surface } from "./tokens.js";
import { cssOf, setTextResolution } from "./ui/theme.js";
import { recoverTextOnContextRestore } from "./ui/context-recovery.js";
import { installLazyText } from "./ui/lazy-text.js";
import { appSession } from "./session.js";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { ScenarioSelectScene } from "./scenes/scenario-select.js";
import { SeatsScene } from "./scenes/seats.js";
import { TableSetupScene } from "./scenes/table-setup.js";
import { SetupDealScene } from "./scenes/setup-deal.js";
import { ScenarioIntroScene } from "./scenes/scenario-intro.js";
import { BoardScene } from "./scenes/board.js";
import { ChoiceOverlay } from "./scenes/choice.js";
import { InspectOverlay } from "./scenes/inspect.js";
import { VillainPhaseOverlay } from "./scenes/villain-phase.js";
import { GameOverScene } from "./scenes/game-over.js";
import { DecksScene } from "./scenes/decks.js";
import { DeckBuilderScene } from "./scenes/deck-builder.js";
import { DeckCheckScene } from "./scenes/deck-check.js";
import { PauseOverlay } from "./scenes/pause.js";
import { RulesOverlay } from "./scenes/rules.js";
import { SettingsOverlay } from "./scenes/settings.js";
import { UnlocksOverlay } from "./scenes/unlocks.js";
import { UnlockConfirmOverlay } from "./scenes/unlock-confirm.js";
import { CampaignSagaScene } from "./scenes/campaign/saga.js";
import { CampaignCoverScene } from "./scenes/campaign/cover.js";
import { CampaignRosterScene } from "./scenes/campaign/roster.js";
import { CampaignOpenerScene } from "./scenes/campaign/opener.js";
import { CampaignBriefingScene } from "./scenes/campaign/briefing.js";
import { CampaignMarketScene } from "./scenes/campaign/market.js";
import { CampaignAftermathScene } from "./scenes/campaign/aftermath.js";
import { CampaignRewindScene } from "./scenes/campaign/rewind.js";
import { CampaignRunScene } from "./scenes/campaign/run.js";
import { CampaignIssueScene } from "./scenes/campaign/issue.js";
import { CampaignDossierScene } from "./scenes/campaign/dossier.js";
import { CampaignFinaleScene } from "./scenes/campaign/finale.js";
import { CampaignDeckEditScene } from "./scenes/campaign/deck-edit.js";
import { CampaignFrozenDeckScene } from "./scenes/campaign/frozen-deck.js";
import { CampaignBeatOverlay } from "./scenes/campaign/beat.js";
import { MusicScene } from "./audio/music-controller.js";
import { ExtrasScene } from "./scenes/extras.js";
import { ExtrasViewerScene } from "./scenes/extras-viewer.js";
import { ExtrasReaderScene } from "./scenes/extras-reader.js";
import { installDebugDump } from "./ui/debug-dump.js";
import { installFrameGuard } from "./ui/frame-guard.js";
import { installDesktopType, setDesktopType } from "./ui/desktop-type.js";
import { formFactorFor } from "./view/layout.js";
import { applyViewportFit } from "./platform/platform.js";

// The one `Settings` instance for the whole app (`appSession().settings`), not a
// second copy: `scenes/settings.ts` mutates that same object, and every text
// object this game creates from here on must read the resolution it left behind.
const settings = appSession().settings;

// Every text object the theme creates renders at the device pixel ratio, so
// text stays sharp. Phaser 4 has no game-level equivalent.
setTextResolution(settings.textResolution);

// Before the canvas first takes its parent's size, which depends on whether #game is inset by the safe area.
applyViewportFit();
installLazyText();
installDesktopType();
setDesktopType(formFactorFor(window.innerWidth, window.innerHeight) === "desktop");

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  backgroundColor: cssOf(surface.void.hex),
  // Off by default in Phaser 4; the Board's focus route is otherwise wired
  // for it already (`view/gamepad.ts`, `scenes/board/input.ts#bindGamepad`).
  input: { gamepad: true },
  scale: {
    // RESIZE makes the canvas exactly its parent's size, so game coordinates
    // are CSS pixels and every layout rectangle is drawn at its real size.
    // Centering is deliberately not set: with RESIZE there is nothing to
    // centre, and an autoCentre offset would desynchronise pointer input from
    // the interactive zones the widgets place.
    mode: Phaser.Scale.RESIZE,
  },
  // `McTextInput` (ui/widgets.ts) is a DOM-backed rexUI `InputText` — the
  // app's one DOM element (PLAN.md Phase 4). Phaser 4 only creates the DOM
  // container Phaser.GameObjects.DOMElement needs when asked to.
  dom: { createContainer: true },
  scene: [
    BootScene,
    TitleScene,
    ScenarioSelectScene,
    SeatsScene,
    TableSetupScene,
    SetupDealScene,
    ScenarioIntroScene,
    BoardScene,
    DecksScene,
    DeckBuilderScene,
    DeckCheckScene,
    CampaignSagaScene,
    CampaignCoverScene,
    CampaignRosterScene,
    CampaignOpenerScene,
    CampaignBriefingScene,
    CampaignMarketScene,
    CampaignAftermathScene,
    CampaignRewindScene,
    CampaignRunScene,
    CampaignIssueScene,
    CampaignDossierScene,
    CampaignFinaleScene,
    CampaignDeckEditScene,
    CampaignFrozenDeckScene,
    ExtrasScene,
    ExtrasReaderScene,
    ChoiceOverlay,
    InspectOverlay,
    VillainPhaseOverlay,
    GameOverScene,
    PauseOverlay,
    RulesOverlay,
    SettingsOverlay,
    UnlocksOverlay,
    UnlockConfirmOverlay,
    CampaignBeatOverlay,
    ExtrasViewerScene,
    MusicScene,
  ],
});
// Registered before any scene's own resize listener, so a screen redrawing on resize already draws at the new size.
game.scale.on("resize", (size: Phaser.Structs.Size) =>
  setDesktopType(formFactorFor(size.width, size.height) === "desktop"),
);

// Right-click is the desktop Inspect gesture, so the browser's own menu has to
// stay out of the way of it. Phaser 4 has no game-config flag for this, only
// this call on the mouse manager.
game.input.mouse?.disableContextMenu();

// One bad frame must not end the game: a throwing tween is removed, anything else skips that frame (`ui/frame-guard.ts`).
installFrameGuard(game);

// Ctrl/Cmd+Shift+D copies a snapshot of every overlay's and the store's state, in production too (`ui/debug-dump.ts`).
installDebugDump(game);

// A GPU reset in the native webviews turns every label into a black box
// unless the text is redrawn once the context is back (`ui/context-recovery.ts`).
recoverTextOnContextRestore(game);

/**
 * A canvas has no inspectable DOM, so in development the game is reachable from
 * the console — enough to read `scale.gameSize`, walk a scene's display list, or
 * fire a widget's `pointerup` when a screenshot can't be trusted. Stripped from
 * production builds.
 */
if (import.meta.env.DEV) {
  (globalThis as unknown as { __mcGame?: Phaser.Game }).__mcGame = game;
  // Campaign screens in a known state without playing four games first (`campaign/dev-fixtures.ts`):
  //   const run = await __mcCampaign.seed("afterIssue2"); __mcGame.scene.start("CampaignRun", { runId: run.id });
  //   const gmwRun = await __mcCampaign.seedGmw("afterIssue1");
  // A real, unfolded win in the live store, so the Aftermath (C05) runs a real `fold` against a live game rather
  // than this file's own `foldState` shortcut:
  //   const { runId } = await __mcCampaign.seedGmwWon("afterIssue3");
  //   __mcGame.scene.start("CampaignAftermath", { runId });
  void Promise.all([
    import("./session.js"),
    import("./campaign/dev-fixtures.js"),
    import("./engine/idb-game-storage.js"),
    import("./engine/game-storage.js"),
  ]).then(([session, fixtures, idbGameStorage, gameStorage]) => {
    /**
     * Writes `WonGame.won` as a fresh save's own replay baseline (0 commands — `resume` replays nothing, so the
     * live session lands on exactly the state stored) directly to the same `mc-saves` IndexedDB the engine worker
     * reads (`engine.worker.ts`'s own `new IdbGameStorage()`), then resumes the live store from it through its
     * normal `resume` path — the same door a returning player's "Continue" uses, not a new one. Dev/QA only: a
     * production build never calls this, and nothing it does is reachable from the UI.
     */
    async function seedWon(
      seed: () => Promise<{
        readonly record: import("./engine/campaign-storage.js").CampaignRecord;
        readonly won: import("@mc/engine").GameState;
      }>,
    ): Promise<{ readonly runId: string; readonly gameId: string }> {
      const { record, won } = await seed();
      const storage = new idbGameStorage.IdbGameStorage();
      const gameId = crypto.randomUUID();
      const at = Date.now();
      const { cardPool: _cardPool, ...withoutPool } = won;
      await storage.create(
        {
          id: gameId,
          schema: gameStorage.SAVE_SCHEMA,
          config: session.campaignService().launchConfig(record),
          createdAt: at,
          updatedAt: at,
          status: "won",
          round: won.round,
          commandCount: 0,
          outcome: won.outcome,
          campaignId: record.campaignId,
          campaignNodeId: record.attempt?.nodeId ?? null,
        },
        withoutPool,
      );
      await session.appSession().store.resume(gameId);
      return { runId: record.id, gameId };
    }

    (globalThis as unknown as { __mcCampaign?: unknown }).__mcCampaign = {
      service: session.campaignService(),
      seed: (stop?: Parameters<typeof fixtures.seedDesignRun>[1], options?: { expertCampaign?: boolean }) =>
        fixtures.seedDesignRun(session.campaignService(), stop, options),
      seedGmw: (stop?: Parameters<typeof fixtures.seedGmwRun>[1], options?: { expertCampaign?: boolean }) =>
        fixtures.seedGmwRun(session.campaignService(), stop, options),
      seedGmwWon: (stop?: Parameters<typeof fixtures.seedGmwWonGame>[1], options?: { expertCampaign?: boolean }) =>
        seedWon(() => fixtures.seedGmwWonGame(session.campaignService(), stop, options)),
      seedDesignWon: (
        stop?: Parameters<typeof fixtures.seedDesignWonGame>[1],
        options?: { expertCampaign?: boolean },
      ) => seedWon(() => fixtures.seedDesignWonGame(session.campaignService(), stop, options)),
      seedMts: (stop?: Parameters<typeof fixtures.seedMtsRun>[1]) =>
        fixtures.seedMtsRun(session.campaignService(), stop),
      seedMtsComposed: (stop?: Parameters<typeof fixtures.seedMtsComposed>[1]) =>
        fixtures.seedMtsComposed(session.campaignService(), stop),
      seedMtsWon: (stop?: Parameters<typeof fixtures.seedMtsWonGame>[1]) =>
        seedWon(() => fixtures.seedMtsWonGame(session.campaignService(), stop)),
    };
  });
}
