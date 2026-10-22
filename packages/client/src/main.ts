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
import { SCENES } from "./scenes/keys.js";
import { installSceneLoader, startIdlePreload } from "./scenes/scene-loader.js";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { MusicScene } from "./audio/music-controller.js";
import { MusicButtonScene } from "./scenes/music-button.js";
import { MusicPlayerOverlay } from "./scenes/music-player.js";
import { ReportIssueOverlay } from "./scenes/report-issue.js";
import { ReportButtonScene } from "./scenes/report-button.js";
import { installDebugDump } from "./ui/debug-dump.js";
import { installFrameGuard } from "./ui/frame-guard.js";
import { installStartupWatchdog, probeWebgl } from "./ui/startup-watchdog.js";
import { installDesktopType, setDesktopType } from "./ui/desktop-type.js";
import { formFactorFor } from "./view/layout.js";
import { applyViewportFit } from "./platform/platform.js";
import { applyDesktopWindowOnLaunch, desktopLaunchSettings, setRenderSizeHandler } from "./platform/desktop-window.js";
import { storedSettingsOverrides } from "./settings-store.js";
import { applyRenderSize } from "./ui/render-resolution.js";
import { isAndroidEdge, rendererOptionsOf } from "./platform/renderer-options.js";
import { onPowerSavingChange, watchPowerSaving } from "./platform/power-saving.js";
import { gpuRendererName, installRenderScale } from "./ui/render-scale.js";
import { installIdleRender } from "./ui/idle-render.js";
import { onHardwareChange, readHardware } from "./platform/device-hardware.js";
import {
  drawsAtScreenDensity,
  renderScaleFor,
  screenEnvironment,
  textResolutionFor,
} from "./platform/screen-density.js";
import { applyScreenSettings, readRefreshInfo } from "./platform/screen-settings.js";
import { PowerSavingNoticeScene } from "./scenes/power-saving-notice.js";
import { AchievementToastScene } from "./scenes/achievement-toast.js";

// The one `Settings` instance for the whole app (`appSession().settings`), not a
// second copy: `scenes/settings.ts` mutates that same object, and every text
// object this game creates from here on must read the resolution it left behind.
const settings = appSession().settings;

// The game draws at the screen's own density (`platform/screen-settings.ts`), unless `?renderscale=off`.
const screen = screenEnvironment();
const renderScale = renderScaleFor(settings, screen);

// Every text object the theme creates renders at the device pixel ratio, so
// text stays sharp. Phaser 4 has no game-level equivalent.
setTextResolution(textResolutionFor(settings, renderScale, drawsAtScreenDensity(screen.search)));

// Before the canvas first takes its parent's size, which depends on whether #game is inset by the safe area.
applyViewportFit();
installLazyText();
installDesktopType();
setDesktopType(formFactorFor(window.innerWidth, window.innerHeight) === "desktop");

// A device whose WebGL cannot draw gets a plain-text reason instead of a black page (`ui/startup-watchdog.ts`).
const watchStartup = installStartupWatchdog();
// Edge on Android reads its WebGL renderer first: on ANGLE's Vulkan backend its multisampled canvas shows black (#157).
// At 2x and up there is no multisampled canvas either (#328).
const rendererOptions = rendererOptionsOf(
  window.location.search,
  isAndroidEdge(navigator.userAgent)
    ? { userAgent: navigator.userAgent, webglRenderer: probeWebgl()?.renderer ?? null }
    : null,
  renderScale,
);

const game = new Phaser.Game({
  // `?renderer=canvas` and `?gl=…` test links for a device whose WebGL shows black (`platform/renderer-options.ts`).
  type: rendererOptions.canvas ? Phaser.CANVAS : Phaser.WEBGL,
  ...(rendererOptions.transparent ? { transparent: true } : {}),
  render: {
    ...(rendererOptions.preserveDrawingBuffer ? { preserveDrawingBuffer: true } : {}),
    ...(rendererOptions.antialiasGL === false ? { antialiasGL: false } : {}),
    ...(rendererOptions.powerPreference ? { powerPreference: rendererOptions.powerPreference } : {}),
  },
  parent: "game",
  // Before the renderer asks the canvas for its WebGL context, so the context is wrapped from its first call.
  callbacks: { preBoot: (booting: Phaser.Game) => installRenderScale(booting, renderScale, Phaser.Scale.RESIZE) },
  backgroundColor: cssOf(surface.void.hex),
  // Off by default in Phaser 4; the Board's focus route is otherwise wired
  // for it already (`view/gamepad.ts`, `scenes/board/input.ts#bindGamepad`).
  input: { gamepad: true },
  scale: {
    // RESIZE makes the canvas exactly its parent's size, so game coordinates
    // are CSS pixels and every layout rectangle is drawn at its real size.
    // Centering is deliberately not set: with RESIZE there is nothing to
    // center, and an autoCenter offset would desynchronize pointer input from
    // the interactive zones the widgets place.
    mode: Phaser.Scale.RESIZE,
  },
  // `McTextInput` (ui/widgets.ts) is a DOM-backed rexUI `InputText` — the
  // app's one DOM element (PLAN.md Phase 4). Phaser 4 only creates the DOM
  // container Phaser.GameObjects.DOMElement needs when asked to.
  dom: { createContainer: true },
  // Boot, Title and the always-on chrome only; every other screen loads on demand (`scenes/scene-loader.ts`). In draw order,
  // chrome last so it draws above every screen and overlay (#176, #191).
  scene: [
    BootScene,
    TitleScene,
    MusicScene,
    PowerSavingNoticeScene,
    AchievementToastScene,
    MusicPlayerOverlay,
    MusicButtonScene,
    ReportIssueOverlay,
    ReportButtonScene,
  ],
});

// Every other screen is added the first time something starts it (`scenes/scene-loader.ts`), and the rest in idle
// time once Title has drawn its first frame.
const sceneLoader = installSceneLoader(game, Phaser.Scenes.ScenePlugin);
const preloadAfterTitle = (): void => {
  game.scene.getScene(SCENES.title)?.events.once(Phaser.Scenes.Events.CREATE, () => {
    game.events.once(Phaser.Core.Events.POST_RENDER, () => startIdlePreload(sceneLoader));
  });
};
if (game.scene.isBooted) preloadAfterTitle();
else game.events.once(Phaser.Core.Events.READY, preloadAfterTitle);

// The desktop app's saved window mode and resolution (Settings > Display > Window); nothing off desktop. A Steam
// Deck or Bazzite starts in Fullscreen until the player picks a window mode of their own.
setRenderSizeHandler((size) => applyRenderSize(game, size));
void desktopLaunchSettings(settings, storedSettingsOverrides().displayMode !== undefined).then((launch) => {
  if (launch !== settings) appSession().settings = launch;
  applyDesktopWindowOnLaunch(launch);
});
watchStartup(game);

// Device sync (#276, `sync/sync-wiring.ts`): its code loads after the first frame, so it stays out of the entry chunk. It
// syncs in the background when this device is linked, and leaves alone the game on the table (the Board, or its deal),
// which waits for the next sync.
const startSync = (): void => {
  void import("./sync/sync-wiring.js").then((wiring) =>
    wiring.startDeviceSync(() =>
      [SCENES.board, SCENES.setupDeal].some(
        (key) => game.scene.isActive(key) || game.scene.isPaused(key) || game.scene.isSleeping(key),
      ),
    ),
  );
};
if (game.scene.isBooted) game.events.once(Phaser.Core.Events.POST_RENDER, startSync);
else game.events.once(Phaser.Core.Events.READY, () => game.events.once(Phaser.Core.Events.POST_RENDER, startSync));

// The frame rate, and on Android the refresh rate the app asks the OS for. Power saving mode (`platform/power-saving.ts`)
// moves the session's defaults (a 30 fps cap, 1x text), so they are applied again whenever it changes.
applyScreenSettings(game, settings);
void readRefreshInfo();
// The hardware check: the GPU is known once the renderer exists, and the Android app reports the rest. A fuller reading
// moves the defaults of a player who never set Resolution or Frame rate (`platform/device-tier.ts`).
onHardwareChange(() => applyScreenSettings(game, appSession().settings));
void readHardware(gpuRendererName());
// The display's scale changes when the window moves to another monitor, when Windows' scaling changes, and with browser
// zoom: Native follows it. A media query on the current ratio fires once when it stops matching.
const followPixelRatio = (): void => {
  globalThis.matchMedia?.(`(resolution: ${globalThis.devicePixelRatio || 1}dppx)`).addEventListener(
    "change",
    () => {
      applyScreenSettings(game, appSession().settings);
      followPixelRatio();
    },
    { once: true },
  );
};
followPixelRatio();
onPowerSavingChange(() => applyScreenSettings(game, appSession().settings));
watchPowerSaving();

// Registered before any scene's own resize listener, so a screen redrawing on resize already draws at the new size.
game.scale.on("resize", (size: Phaser.Structs.Size) =>
  setDesktopType(formFactorFor(size.width, size.height) === "desktop"),
);

// Right-click is the desktop Inspect gesture, so the browser's own menu has to
// stay out of the way of it. Phaser 4 has no game-config flag for this, only
// this call on the mouse manager.
game.input.mouse?.disableContextMenu();

// A frame that would look exactly like the last one isn't drawn again (#328, `ui/idle-render.ts`). Before the frame
// guard, which wraps whatever `step` is by then.
installIdleRender(game, Phaser, window.location.search);

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
      seedSm: (stop?: Parameters<typeof fixtures.seedSmRun>[1], options?: { expertCampaign?: boolean }) =>
        fixtures.seedSmRun(session.campaignService(), stop, options),
      seedSmComposed: (stop?: Parameters<typeof fixtures.seedSmComposed>[1]) =>
        fixtures.seedSmComposed(session.campaignService(), stop),
      seedSmWon: (stop?: Parameters<typeof fixtures.seedSmWonGame>[1]) =>
        seedWon(() => fixtures.seedSmWonGame(session.campaignService(), stop)),
      seedMojo: (stop?: Parameters<typeof fixtures.seedMojoRun>[1]) =>
        fixtures.seedMojoRun(session.campaignService(), stop),
      seedMojoWon: (stop?: Parameters<typeof fixtures.seedMojoWonGame>[1]) =>
        seedWon(() => fixtures.seedMojoWonGame(session.campaignService(), stop)),
      seedAoa: (
        stop?: Parameters<typeof fixtures.seedAoaRun>[1],
        options?: Parameters<typeof fixtures.seedAoaRun>[2],
      ) => fixtures.seedAoaRun(session.campaignService(), stop, options),
      seedAos: (
        stop?: Parameters<typeof fixtures.seedAosRun>[1],
        options?: Parameters<typeof fixtures.seedAosRun>[2],
      ) => fixtures.seedAosRun(session.campaignService(), stop, options),
      seedAosWon: (stop?: Parameters<typeof fixtures.seedAosWonGame>[1]) =>
        seedWon(() => fixtures.seedAosWonGame(session.campaignService(), stop)),
      seedNextEvolWon: (stop?: Parameters<typeof fixtures.seedNextEvolWonGame>[1]) =>
        seedWon(() => fixtures.seedNextEvolWonGame(session.campaignService(), stop)),
      seedAoaWon: (stop?: Parameters<typeof fixtures.seedAoaWonGame>[1]) =>
        seedWon(() => fixtures.seedAoaWonGame(session.campaignService(), stop)),
    };
  });
}
