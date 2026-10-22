/**
 * The Title menu (docs/phase4-screen-gaps.md §3 W2, D01/P01): a real menu,
 * not a setup page. Continue (when a game is in progress), New game, Decks &
 * Collection, Campaign (drawn locked — out of scope, PLAN.md Phase 4) and
 * Settings (drawn unavailable until W4 lands it), and a footer with the app's
 * own card-pool coverage and build version.
 *
 * This retires the setup half `TitleScene` used to carry (scenario,
 * difficulty, modular sets, seats, seed) — that flow now lives across
 * `ScenarioSelectScene` → `SeatsScene` → `TableSetupScene`, each reading and
 * writing the one `SetupDraft` `New game` hands off to the first of them.
 *
 * Campaign opens The Saga (`scenes/campaign/saga.ts`, C00b) — campaign mode's own shelf of boxes, not part of
 * this menu's own layout beyond the one button. Extras (`scenes/extras.ts`) opens the comics, artwork, hero and
 * villain files and soundtrack that play has unlocked.
 */

import Phaser from "phaser";
import { accent, dotGrid, hit, ink, signal, surface, typeRole } from "../tokens.js";
import type { Rect } from "../view/layout.js";
import { cssOf, skin, textStyle } from "../ui/theme.js";
import { drawPlayPlatformIcon } from "../ui/play-platform-icon.js";
import { playPlatformMarkOf, playPlatformSlotIn } from "../view/play-platform-mark.js";
import { McButton, fitText, paintDotGrid } from "../ui/widgets.js";
import { TITLE_ART, coverFit, pickTitleArt, type TitleArt } from "../art/title-art.js";
import { ensurePictureLoaded } from "../art/pictures.js";
import { POOL_CARDS, POOL_DEPS, POOL_SCENARIOS, POOL_VERSION } from "../content/pool.js";
import { cardPoolCoverageOf, cardPoolCoverageText } from "../view/card-pool-coverage.js";
import { UPDATE_DISMISS_ID, appVersionText, buildCommit, releaseNotesUrl, updateActions } from "../view/app-version.js";
import { dismissUpdate, dismissedUpdateVersion, isUpdateDismissed } from "../platform/update-dismissal.js";
import { CLIENT_VERSION } from "../version.js";
import { detectPlatform, openExternal } from "../platform/platform.js";
import { onPowerSavingChange, powerSavingState } from "../platform/power-saving.js";
import { powerSavingFooterOf } from "../view/power-saving-notice.js";
import { onTap } from "../ui/tap.js";
import { checkForUpdate, type AvailableUpdate } from "../platform/update-check.js";
import { preconDecks } from "../view/deck-list-model.js";
import { initialSetupDraft, withSeatOne } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";
import { titleMenuFocusOrder } from "../view/screen-focus.js";
import {
  GAMES_PANEL_HEADER,
  RANK_BADGE_HEIGHT,
  titleMenuLayout,
  updateBannerActionCount,
  updateBannerParts,
} from "../view/title-menu-layout.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { appSession } from "../session.js";
import { drawGamesList } from "../ui/games-list.js";
import { GAME_LABEL_NAMES } from "../view/game-label-names.js";
import { gameRowsOf, shouldShowGamesList, type GameRow } from "../view/games-list-model.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { GamesListOverlayData } from "./games-list.js";
import { guidePrefs, setGuideRunLevelOverride } from "../guide/guide-store.js";
import { isFirstLaunch } from "../guide/guide-prefs.js";
import { continueLabelOf } from "../view/continue-label.js";
import {
  CIVIL_WAR_CYCLE_ID,
  CIVIL_WAR_TITLE_LABEL,
  civilWarTitleEntryOf,
  enterBuilder,
  setBuilderOrigin,
} from "../view/civil-war-entry.js";
import { lifetimeChampionPoints, refreshUnlocks, unlocks } from "../progression/progression.js";
import { lastRankSeen, rememberRankSeen } from "../platform/rank-seen.js";
import { rankUpAnnouncementOf, titleRankBadgeOf } from "../view/title-rank-badge.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { tutorialResumeDecisionFor } from "../guide/tutorial-resume.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import type { TutorialResumeConfirmData } from "./tutorial-resume-confirm.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { hasDesktopWindow, quitToDesktop } from "../platform/desktop-window.js";
import { onSyncApplied } from "../sync/sync-events.js";
import { takeReceiveLink, takeSyncLink } from "../save-data/receive-link.js";
import { maybeShowSyncSetupPrompt } from "./sync-setup-prompt-launch.js";
import { SCENES } from "./keys.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { SeatsData } from "./seats.js";
import type { Deck } from "@mc/content";
import { destroyChildren } from "../ui/destroy-children.js";
import { setReportSlot } from "../ui/report-slot.js";
import { setMusicSlot } from "../ui/music-slot.js";
import { musicSlotBeside } from "../view/music-player.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";

/**
 * "Play this deck ▸" (W9, docs/phase4-screen-gaps.md §3): the Decks screen starts Title with the deck to seat.
 * Title doesn't draw in that case — it builds a fresh draft with that deck alone in seat 1 (`withSeatOne`) and
 * goes straight to Take your seats, seeding the deck into that screen's list so it's seatable before
 * `deckStorage().list()` resolves (Seats prunes unknown seats on every rebuild).
 */
export interface TitleSceneData {
  readonly initialSeatDeckId?: string;
  /** The deck itself; ignored if its `id` doesn't match `initialSeatDeckId`. */
  readonly initialSeatDeck?: Deck;
}

/** The default seat: the first Core precon, as a `Deck` id — unchanged from before the setup flow split, so "New game" always starts from the same hero. */
const DEFAULT_SEAT_DECK_ID = preconDecks(POOL_VERSION)[0]!.id as string;

/** A fresh New game draft: the pool's first scenario, the default seat-one precon, a new seed. Shared with the
 * first-run chooser (`scenes/guide-chooser.ts`), whose "Hints only" / "No guide" continue straight into scenario select. */
export function newGameDraft(): ReturnType<typeof initialSetupDraft> {
  return initialSetupDraft({
    scenarioId: POOL_SCENARIOS[0]!.id as string,
    seatDeckId: DEFAULT_SEAT_DECK_ID,
    seed: rollSeed(),
  });
}

export class TitleScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #status: Phaser.GameObjects.Text | null = null;
  #platformTip: Phaser.GameObjects.Text | null = null;
  #starting = false;
  /** The game in progress when this screen opened, if any — looked up asynchronously; the screen draws without it first. */
  #continuable: SaveMeta | null = null;
  /** Every game in progress (several can be, #276), newest first, without guided lesson saves. */
  #games: readonly SaveMeta[] = [];
  /** The games panel's scroll offset, kept across the redraws a resize or a sync makes. */
  #gamesScroll = new VariableListScroll();
  /** The game the panel is asking "Remove this game?" about, or null while it lists. */
  #removing: string | null = null;
  #removeBusy = false;
  /** Why the last Remove failed, shown in the question until it is answered again. */
  #removeError: string | null = null;
  /** A newer release with an installer for this platform (native apps only), once GitHub has answered. */
  #update: AvailableUpdate | null = null;
  /** This visit's picture (`art/title-art.ts`), chosen once per `create` so a resize redraws the same one. */
  #art: TitleArt | null = null;
  #artPanel: { x: number; y: number; width: number; height: number } | null = null;
  /** Bumped by every `#rebuild`, so a picture that finishes loading after a redraw is placed by the current one only. */
  #artGeneration = 0;
  /** "Rank up: <title>" while the badge shows the fanfare (a few seconds after the Title opens), else null. */
  #rankUp: string | null = null;
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.title);
  }

  create(data: TitleSceneData = {}): void {
    if (data.initialSeatDeckId) {
      const draft = withSeatOne(this.#freshDraft(), data.initialSeatDeckId);
      const seedDecks =
        data.initialSeatDeck && data.initialSeatDeck.id === data.initialSeatDeckId ? [data.initialSeatDeck] : [];
      goToScreen(this, SCENES.seats, { draft, seedDecks } satisfies SeatsData);
      return;
    }
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    // The footer says when power saving mode is on (`platform/power-saving.ts`).
    const unsubscribePowerSaving = onPowerSavingChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    // A device sync that brought in saves from another device: Continue reads the newest save again (#276).
    const unsubscribeSync = onSyncApplied(() => {
      if (!this.sys.isActive()) return;
      void this.#refreshSaves();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      unsubscribePowerSaving();
      unsubscribeSync();
    });
    this.#route = new FocusRoute(this, {
      blocked: () =>
        this.scene.isActive(SCENES.inspect) ||
        this.scene.isActive(SCENES.settings) ||
        this.scene.isActive(SCENES.gamesList),
    });
    // Phaser reuses this scene instance across "back to title" round trips, so state from a previous visit
    // (a stuck "Starting…", a stale Continue) must not survive into this one.
    this.#continuable = null;
    this.#games = [];
    this.#removing = null;
    this.#removeBusy = false;
    this.#removeError = null;
    this.#gamesScroll = new VariableListScroll();
    this.#starting = false;
    this.#rankUp = null;
    this.#art = pickTitleArt(TITLE_ART, lastTitleArtKey);
    lastTitleArtKey = this.#art?.key ?? null;
    appSession().music?.playTitle();
    this.#checkRankUp();
    this.#rebuild();
    fadeScreenIn(this);
    // Opened from a Send screen's QR code: straight to Settings, Save data, Receive (read and cleared once).
    const receive = takeReceiveLink();
    if (receive) this.scene.launch(SCENES.settings, { receive });
    // Opened from a device-sync link's QR code: Save data, Sync across devices, asking to join (read and cleared once).
    const syncLink = takeSyncLink();
    if (syncLink) this.scene.launch(SCENES.settings, { syncLink });
    // The one-time "Set up cross-device sync?" question; it decides for itself and stays out of a link's way.
    else if (!receive) maybeShowSyncSetupPrompt(this);
    // Points may have moved since Boot read them (a game just ended): read again, and announce a rank gained.
    void refreshUnlocks()
      .catch(() => false)
      .then(() => {
        if (!this.sys.isActive()) return;
        this.#checkRankUp();
        this.#rebuild();
      });
    void this.#refreshSaves();
    void checkForUpdate().then((update) => {
      // A banner the player closed for this very release stays closed; a newer release brings it back.
      if (!update || !this.sys.isActive() || isUpdateDismissed(update.version, dismissedUpdateVersion())) return;
      this.#update = update;
      this.#rebuild();
    });
  }

  /**
   * The rank-up fanfare (docs/achievements.md): when the Title shows a higher rank than the last visit stored, the
   * badge turns red and reads "Rank up: <name>" for a few seconds, with the short Extras sting. The rank is
   * remembered at once, so a second check (after the refresh) or a redraw never repeats it.
   */
  #checkRankUp(): void {
    const result = rankUpAnnouncementOf(lastRankSeen(), lifetimeChampionPoints());
    rememberRankSeen(result.remember);
    if (!result.announce) return;
    this.#rankUp = result.text;
    appSession().music?.playEffect("extras-unlocked");
    this.time.delayedCall(RANK_UP_MS, () => {
      if (!this.sys.isActive()) return;
      this.#rankUp = null;
      this.#rebuild();
    });
  }

  /** The games the list shows: all of them, or none when Continue already is the only one (`shouldShowGamesList`). */
  #listedGames(): readonly SaveMeta[] {
    return shouldShowGamesList(
      this.#games.map((save) => save.id),
      this.#continuable?.id ?? null,
    )
      ? this.#games
      : [];
  }

  /** Reads the newest game (Continue) and every game in progress (the list) again, then redraws. */
  async #refreshSaves(): Promise<void> {
    const { store } = appSession();
    const [latest, games] = await Promise.all([store.latestSave(), store.activeSaves()]);
    if (!this.sys.isActive()) return;
    this.#continuable = latest;
    this.#games = games;
    // A game asked about that has since gone (synced away, removed on another screen): drop the question.
    if (this.#removing !== null && !games.some((save) => save.id === this.#removing)) this.#removing = null;
    this.#rebuild();
  }

  /** "Remove" confirmed: the game is retired (counts as played, cannot be resumed) and the list reads again. */
  async #removeGame(row: GameRow): Promise<void> {
    if (this.#removeBusy) return;
    this.#removeBusy = true;
    this.#removeError = null;
    // Drawn unavailable while the write is in flight, so a second tap can't ask twice.
    this.#rebuild();
    try {
      await appSession().store.retireSave(row.id);
      this.#removing = null;
    } catch (cause) {
      this.#removeError = `Could not remove it: ${cause instanceof Error ? cause.message : String(cause)}`;
    }
    this.#removeBusy = false;
    if (!this.sys.isActive()) return;
    await this.#refreshSaves();
  }

  /** The phone's "In-progress games (N)" row: the list full screen, over this one. */
  #openGamesList(): void {
    if (this.scene.isActive(SCENES.gamesList)) return;
    this.scene.launch(SCENES.gamesList, {
      from: this.scene.key,
      saves: this.#listedGames(),
      onResume: (save) => void this.#resume(save),
      onChanged: () => void this.#refreshSaves(),
    } satisfies GamesListOverlayData);
  }

  /** The desktop hover note under the Continue row's platform icon ("Played on Windows"); null closes it. */
  #showPlatformTip(tip: { readonly text: string; readonly box: Rect } | null): void {
    this.#platformTip?.destroy();
    this.#platformTip = null;
    if (!tip) return;
    const text = this.add
      .text(0, 0, tip.text, textStyle(typeRole.label, surface.paper.hex))
      .setDepth(TIP_DEPTH)
      .setPadding(10, 6, 10, 6)
      .setBackgroundColor(cssOf(surface.ink.hex));
    const x = Math.max(8, Math.min(tip.box.x, this.scale.gameSize.width - text.width - 8));
    text.setPosition(x, tip.box.y + tip.box.height + 10);
    this.#platformTip = text;
  }

  #rebuild(): void {
    this.#platformTip?.destroy();
    this.#platformTip = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const civilWar = civilWarTitleEntryOf(unlocks().waveLock(CIVIL_WAR_CYCLE_ID), POOL_SCENARIOS);
    const layout = titleMenuLayout({
      width,
      height,
      continuable: this.#continuable !== null,
      games: this.#listedGames().length,
      update: this.#update !== null,
      civilWar: civilWar !== null,
      quit: hasDesktopWindow(),
    });
    // The Report button's slot (#176): level with the eyebrow, at the menu column's right edge.
    const reportSize = layout.split ? 44 : 40;
    const reportRect = {
      x: layout.left + layout.column - reportSize,
      y: Math.max(8, Math.round(layout.eyebrow.y + layout.eyebrow.height / 2 - reportSize / 2)),
      width: reportSize,
      height: reportSize,
    };
    setReportSlot(this.scene.key, reportRect);
    // The music button's (#191), just left of it.
    setMusicSlot(this.scene.key, musicSlotBeside(reportRect));

    // Ground: split desktop/tablet (ink art panel left, red rule, paper menu panel right); one ink ground on phone.
    if (layout.split) {
      this.add
        .rectangle(
          layout.artPanel!.x,
          layout.artPanel!.y,
          layout.artPanel!.width,
          layout.artPanel!.height,
          surface.ink.hex,
        )
        .setOrigin(0, 0)
        .setDepth(ART_GROUND_DEPTH);
      paintDotGrid(this, layout.artPanel!, "ink", dotGrid.onInk).setDepth(ART_GROUND_DEPTH);
      this.#artPanel = layout.artPanel!;
      this.add
        .rectangle(
          layout.divider!.x,
          layout.divider!.y,
          layout.divider!.width,
          layout.divider!.height,
          accent.heroRed.hex,
        )
        .setOrigin(0, 0);
      this.add
        .rectangle(
          layout.menuPanel.x,
          layout.menuPanel.y,
          layout.menuPanel.width,
          layout.menuPanel.height,
          surface.paper.hex,
        )
        .setOrigin(0, 0);
      paintDotGrid(this, layout.menuPanel, "paper", dotGrid.onPaper);
    } else {
      this.add.rectangle(0, 0, width, height, surface.ink.hex).setOrigin(0, 0).setDepth(ART_GROUND_DEPTH);
      paintDotGrid(this, { x: 0, y: 0, width, height }, "ink", dotGrid.onInk).setDepth(ART_GROUND_DEPTH);
      // Phone has no art panel (P01 stacks everything on one ink ground): the picture goes full-bleed under an
      // ink scrim so the paper text on top stays legible.
      this.add.rectangle(0, 0, width, height, surface.ink.hex, 0.62).setOrigin(0, 0).setDepth(ART_SCRIM_DEPTH);
      this.#artPanel = { x: 0, y: 0, width, height };
    }

    // Text/menu color: ink-on-paper when split, paper-on-ink on phone (`surface.paper` doubles as the dark-ground text color).
    const onDark = !layout.split;
    const textColor = onDark ? surface.paper.hex : surface.ink.hex;
    const menuKind = onDark ? "onInk" : "secondary";

    this.add
      .text(layout.eyebrow.x, layout.eyebrow.y, "DIGITAL EDITION", textStyle(typeRole.label, accent.heroRed.hex, 1))
      .setLetterSpacing(1);
    this.add
      .text(layout.left, layout.eyebrow.y + layout.eyebrow.height + 8, "MARVEL\nCHAMPIONS", {
        ...textStyle(typeRole.screenTitle, textColor),
        fontSize: `${layout.titleSize}px`,
        lineSpacing: -Math.round(layout.titleSize * 0.16),
      })
      .setLetterSpacing(2);
    this.add.rectangle(layout.rule.x, layout.rule.y, layout.rule.width, layout.rule.height, textColor).setOrigin(0, 0);

    if (layout.continueRow) {
      const save = this.#continuable!;
      const rect = layout.continueRow;
      // Where the game was last played (device sync, #276): a mark at the row's left edge, beside the label.
      const mark = playPlatformMarkOf(save.lastPlayedOn);
      const slot = mark ? playPlatformSlotIn(rect) : null;
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: continueLabel(save),
          // A built game's label names its stages and sets: wrapped onto a second line rather than cut.
          wrap: true,
          type: typeRole.menuButton,
          rect,
          enabled: !this.#starting,
          ...(slot ? { labelInset: slot.labelInset } : {}),
          onHover: (over) =>
            this.#showPlatformTip(
              over && mark && slot && !this.input.activePointer.wasTouch ? { text: mark.label, box: slot.box } : null,
            ),
          onClick: () => void this.#resume(save),
        }),
      );
      // Dev-only e2e hook: the platform whose mark the Continue row drew (never read by product code).
      if (import.meta.env.DEV) {
        (window as unknown as { __mcContinuePlatform?: string | null }).__mcContinuePlatform = mark?.platform ?? null;
      }
      if (mark && slot) {
        const s = skin("primary", this.#starting ? "unavailable" : "rest");
        drawPlayPlatformIcon(this.add.graphics(), mark, slot.box, s.text, s.textAlpha);
      }
      this.#stops.set("continue", {
        rect,
        activate: () => void this.#resume(save),
      });
    }

    const gameRows = layout.gamesPanel ? gameRowsOf(this.#listedGames(), GAME_LABEL_NAMES, Date.now()) : [];
    if (layout.gamesPanel && layout.gamesPanelList) {
      this.#drawGamesPanel(layout.gamesPanel, layout.gamesPanelList, gameRows);
    }
    if (layout.gamesRow) {
      this.#buttons.push(
        new McButton(this, {
          kind: menuKind,
          label: `In-progress games (${this.#listedGames().length})`,
          type: typeRole.menuButton,
          rect: layout.gamesRow,
          enabled: !this.#starting,
          onClick: () => this.#openGamesList(),
        }),
      );
      this.#stops.set("games-row", { rect: layout.gamesRow, activate: () => this.#openGamesList() });
    }

    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Starting…" : "New game",
        type: typeRole.barTitle,
        rect: layout.newGame,
        enabled: !this.#starting,
        onClick: () => this.#newGame(),
      }),
    );
    this.#stops.set("new-game", {
      rect: layout.newGame,
      activate: () => this.#newGame(),
    });

    const openDecks = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.decks);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Decks & Collection",
        type: typeRole.menuButton,
        rect: layout.decks,
        onClick: openDecks,
      }),
    );
    this.#stops.set("decks", { rect: layout.decks, activate: openDecks });

    const openCampaign = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.campaignSaga);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Campaign",
        type: typeRole.menuButton,
        rect: layout.campaign,
        onClick: openCampaign,
      }),
    );
    this.#stops.set("campaign", { rect: layout.campaign, activate: openCampaign });

    // "Civil War!": the box's own entry, once it is open. The last build, or the first leader as printed.
    if (civilWar && layout.civilWar) {
      const openCivilWar = (): void => {
        const entry = enterBuilder("build", newGameDraft(), civilWar.scenarioId);
        setBuilderOrigin("title");
        this.scale.off("resize", this.#rebuild, this);
        goToScreen(this, SCENES.civilWarBuilder, {
          draft: entry.draft,
          step: entry.step,
        } satisfies CivilWarBuilderData);
      };
      this.#buttons.push(
        new McButton(this, {
          kind: menuKind,
          label: CIVIL_WAR_TITLE_LABEL,
          type: typeRole.menuButton,
          rect: layout.civilWar,
          onClick: openCivilWar,
        }),
      );
      this.#stops.set("civil-war", { rect: layout.civilWar, activate: openCivilWar });
    }

    const openExtras = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.extras);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Extras",
        type: typeRole.menuButton,
        rect: layout.extras,
        onClick: openExtras,
      }),
    );
    this.#stops.set("extras", { rect: layout.extras, activate: openExtras });

    const openTrophies = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.trophyRoom);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Trophy Room",
        type: typeRole.menuButton,
        rect: layout.trophies,
        onClick: openTrophies,
      }),
    );
    this.#stops.set("trophies", { rect: layout.trophies, activate: openTrophies });

    // "How to play" (guided mode G6c, `docs/guided-mode.md` §4): the learning hub. Not a guided run by itself —
    // starting a lesson from inside the hub is what sets `appSession().guidedRun` (`guide/start-tutorial.ts`).
    const openHowToPlay = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.howToPlay);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "How to play",
        type: typeRole.menuButton,
        rect: layout.howToPlay,
        onClick: openHowToPlay,
      }),
    );
    this.#stops.set("how-to-play", { rect: layout.howToPlay, activate: openHowToPlay });

    // W4's Settings is an overlay: launched over this scene, it stops itself on Back (`scenes/settings.ts`).
    const openSettings = (): void => {
      this.scene.launch(SCENES.settings);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Settings",
        type: typeRole.menuButton,
        rect: layout.settings,
        onClick: openSettings,
      }),
    );
    this.#stops.set("settings", {
      rect: layout.settings,
      activate: openSettings,
    });

    // The desktop app has no browser tab to close, so it offers its own way out (the owner, 2026-10-16).
    if (layout.quit) {
      const quit = (): void => void quitToDesktop();
      this.#buttons.push(
        new McButton(this, {
          kind: menuKind,
          label: "Quit to desktop",
          type: typeRole.menuButton,
          rect: layout.quit,
          onClick: quit,
        }),
      );
      this.#stops.set("quit", { rect: layout.quit, activate: quit });
    }

    const coverage = cardPoolCoverageOf(POOL_CARDS, POOL_DEPS);
    this.add.text(
      layout.footer.x,
      layout.footer.y,
      cardPoolCoverageText(coverage),
      textStyle(typeRole.label, textColor, ink.meta),
    );
    const versionText = this.add.text(
      0,
      layout.footer.y,
      appVersionText(CLIENT_VERSION, detectPlatform(), buildCommit()),
      textStyle(typeRole.label, textColor, ink.meta),
    );
    versionText.setX(layout.footer.x + layout.footer.width - versionText.width);
    const { detected, applied } = powerSavingState();
    const powerSaving = powerSavingFooterOf(detected, applied);
    if (powerSaving !== null) {
      const powerText = this.add.text(0, layout.footer.y - 20, powerSaving, textStyle(typeRole.label, textColor));
      powerText.setX(layout.footer.x + layout.footer.width - powerText.width);
    }

    // The release this build is on, on GitHub: its notes and downloads. Underlined in the footer's own ink rather
    // than red, which is the screen's one forward action.
    const releaseNotes = (): void => openExternal(releaseNotesUrl(CLIENT_VERSION));
    const linkText = this.add.text(0, layout.footer.y, "Release notes ↗", textStyle(typeRole.label, textColor));
    linkText.setX(versionText.x - 16 - linkText.width);
    this.add
      .graphics()
      .fillStyle(textColor, 0.6)
      .fillRect(linkText.x, linkText.y + linkText.height, linkText.width, 1);
    // A touch-sized target around the small label.
    const linkRect: Rect = {
      x: linkText.x - 6,
      // Hung from the footer's own top edge, so a tight menu's Settings row (just above) is never under it.
      y: layout.footer.y,
      width: linkText.width + 12,
      height: hit.target,
    };
    const releaseZone = this.add
      .zone(linkRect.x, linkRect.y, linkRect.width, linkRect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    onTap(releaseZone, releaseNotes, "title:release-notes");
    this.#stops.set("release-notes", { rect: linkRect, activate: releaseNotes });

    this.#status = this.add
      .text(layout.left, layout.footer.y - 24, "", textStyle(typeRole.body, textColor))
      .setWordWrapWidth(layout.column);

    const bannerStops = this.#drawUpdateBanner(layout.updateBanner);
    this.#drawRankBadge(layout.rankBadge, openTrophies);
    this.#route?.set(
      [
        ...titleMenuFocusOrder({
          continuable: this.#continuable !== null,
          civilWar: civilWar !== null,
          quit: layout.quit !== null,
          updateActions: bannerStops,
          gameIds: gameRows.map((row) => row.id),
          removeConfirm: this.#removing !== null && gameRows.some((row) => row.id === this.#removing),
          gamesRow: layout.gamesRow !== null,
        }),
        "rank-badge",
      ],
      this.#stops,
    );
    this.#drawArt();
  }

  /** The "In-progress games" panel in the art panel (split screens): heading, then the list or the remove question. */
  #drawGamesPanel(panel: Rect, list: Rect, rows: readonly GameRow[]): void {
    this.add
      .rectangle(panel.x, panel.y, panel.width, panel.height, surface.ink.hex, 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, surface.paper.hex);
    this.add
      .text(
        list.x,
        panel.y + 12 + (GAMES_PANEL_HEADER - typeRole.sectionHeader.size) / 2,
        `IN-PROGRESS GAMES (${rows.length})`,
        textStyle(typeRole.sectionHeader, surface.paper.hex),
      )
      .setLetterSpacing(1);
    const confirming = this.#removing === null ? null : (rows.find((row) => row.id === this.#removing) ?? null);
    const drawn = drawGamesList(this, {
      area: list,
      rows,
      scroll: this.#gamesScroll,
      confirming,
      enabled: !this.#starting && !this.#removeBusy,
      error: this.#removeError,
      onResume: (row) => void this.#resume(row.save),
      onAskRemove: (row) => {
        this.#removing = row.id;
        this.#rebuild();
      },
      onKeep: () => {
        this.#removing = null;
        this.#removeError = null;
        this.#rebuild();
      },
      onRemove: (row) => void this.#removeGame(row),
    });
    this.#buttons.push(...drawn.buttons);
    for (const [key, stop] of drawn.stops) this.#stops.set(key, stop);
  }

  /**
   * The update banner (native apps, `platform/update-check.ts`): caution yellow, the advisory color, with the new
   * version and a button per action: the changelog and this install's own installer. Returns its focus stops.
   */
  #drawUpdateBanner(banner: Rect | null): readonly string[] {
    const update = this.#update;
    if (!update || !banner) return [];
    const all = updateActions(update);
    const actions = all.slice(all.length - updateBannerActionCount(banner, all.length));
    const parts = updateBannerParts(banner, actions.length);
    this.add
      .rectangle(banner.x, banner.y, banner.width, banner.height, signal.caution.hex)
      .setOrigin(0, 0)
      .setStrokeStyle(2, surface.ink.hex);
    this.add
      .text(parts.text.x, parts.text.y, "UPDATE AVAILABLE", textStyle(typeRole.label, surface.ink.hex))
      .setLetterSpacing(1);
    this.add
      .text(parts.text.x, parts.text.y + 16, `Version ${update.version}`, textStyle(typeRole.rowTitle, surface.ink.hex))
      .setWordWrapWidth(parts.textWidth);
    actions.forEach((action, index) => {
      const rect = parts.buttons[index]!;
      const open = (): void => openExternal(action.url);
      this.#buttons.push(
        new McButton(this, {
          kind: action.id === "update-download" ? "primary" : "secondary",
          label: action.label,
          type: typeRole.rowTitle,
          rect,
          onClick: open,
        }),
      );
      this.#stops.set(action.id, { rect, activate: open });
    });
    const close = (): void => {
      dismissUpdate(update.version);
      this.#update = null;
      this.#rebuild();
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "×",
        type: typeRole.rowTitle,
        rect: parts.dismiss,
        onClick: close,
      }),
    );
    this.#stops.set(UPDATE_DISMISS_ID, { rect: parts.dismiss, activate: close });
    return actions.map((action) => action.id);
  }

  /**
   * The rank badge: rank, lifetime points and a thin bar to the next rank on an ink plate; a tap opens the Trophy
   * Room. While a rank-up is being announced the plate turns red and names the new rank instead of the bar.
   */
  #drawRankBadge(rect: Rect, open: () => void): void {
    const badge = titleRankBadgeOf(lifetimeChampionPoints());
    const up = this.#rankUp;
    this.add
      .rectangle(rect.x, rect.y, rect.width, rect.height, up ? accent.heroRed.hex : surface.ink.hex, up ? 1 : 0.9)
      .setOrigin(0, 0)
      .setStrokeStyle(2, surface.paper.hex);
    if (rect.height < RANK_BADGE_HEIGHT) {
      this.#drawCompactRankBadge(rect, badge, up);
    } else {
      this.#drawFullRankBadge(rect, badge, up);
    }
    const zone = this.add
      .zone(rect.x, rect.y, rect.width, rect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    onTap(zone, open, "title:rank-badge");
    this.#stops.set("rank-badge", { rect, activate: open });
  }

  /** The phone strip: "RANK 1 · Sidekick in Training" and the points on one line, then the bar and its caption. */
  #drawCompactRankBadge(rect: Rect, badge: ReturnType<typeof titleRankBadgeOf>, up: string | null): void {
    const pad = 8;
    const inner = rect.width - pad * 2;
    const paper = surface.paper.hex;
    const line = this.add.text(
      rect.x + pad,
      rect.y + 4,
      up ? `RANK UP · ${up.replace(/^Rank up: /, "")}` : `${badge.rankLabel} · ${badge.title}`,
      textStyle(typeRole.label, paper),
    );
    let room = inner;
    if (!up) {
      const points = this.add.text(0, rect.y + 4, badge.pointsLabel, textStyle(typeRole.label, paper));
      points.setX(rect.x + rect.width - pad - points.width);
      room = Math.max(20, inner - points.width - 6);
      const barY = rect.y + 21;
      this.add.rectangle(rect.x + pad, barY, inner, 4, paper, 0.3).setOrigin(0, 0);
      if (badge.fraction > 0) {
        this.add.rectangle(rect.x + pad, barY, Math.max(2, inner * badge.fraction), 4, paper).setOrigin(0, 0);
      }
      const next = this.add.text(
        rect.x + pad,
        rect.y + 27,
        badge.nextLabel,
        textStyle(typeRole.label, paper, ink.meta),
      );
      fitText(next, inner, typeRole.label.size);
    }
    fitText(line, room, typeRole.label.size);
  }

  /** The art-panel plate: rank and points, the rank's name, the bar and its caption. */
  #drawFullRankBadge(rect: Rect, badge: ReturnType<typeof titleRankBadgeOf>, up: string | null): void {
    const pad = 8;
    const inner = rect.width - pad * 2;
    const paper = surface.paper.hex;
    const label = this.add
      .text(rect.x + pad, rect.y + 5, up ? "RANK UP" : badge.rankLabel, textStyle(typeRole.label, paper))
      .setLetterSpacing(1);
    if (!up) {
      const points = this.add.text(0, rect.y + 5, badge.pointsLabel, textStyle(typeRole.label, paper));
      points.setX(rect.x + rect.width - pad - points.width);
      fitText(label, Math.max(20, inner - points.width - 6), typeRole.label.size);
    }
    const title = this.add.text(rect.x + pad, rect.y + 19, up ? up.replace(/^Rank up: /, "") : badge.title, {
      ...textStyle(typeRole.rowTitle, paper),
    });
    fitText(title, inner, typeRole.rowTitle.size);
    if (!up) {
      const barY = rect.y + 37;
      this.add.rectangle(rect.x + pad, barY, inner, 4, paper, 0.3).setOrigin(0, 0);
      if (badge.fraction > 0) {
        this.add.rectangle(rect.x + pad, barY, Math.max(2, inner * badge.fraction), 4, paper).setOrigin(0, 0);
      }
      const next = this.add.text(
        rect.x + pad,
        rect.y + 44,
        inner < 170 ? badge.shortNextLabel : badge.nextLabel,
        textStyle(typeRole.label, paper, ink.meta),
      );
      fitText(next, inner, typeRole.label.size);
    }
  }

  /** Draws this visit's picture if its texture is ready, otherwise loads it once and draws on arrival. */
  #drawArt(): void {
    const art = this.#art;
    const panel = this.#artPanel;
    if (!art || !panel) return;
    const generation = ++this.#artGeneration;
    const place = (): void => {
      if (generation !== this.#artGeneration || !this.sys.isActive() || !this.textures.exists(art.key)) return;
      const frame = this.textures.get(art.key).getSourceImage() as {
        width: number;
        height: number;
      };
      const fit = coverFit(frame, panel);
      this.add
        .image(panel.x + panel.width / 2, panel.y + panel.height / 2, art.key)
        .setScale(fit.scale)
        .setCrop(fit.cropX, fit.cropY, fit.cropWidth, fit.cropHeight)
        .setDepth(ART_DEPTH);
    };
    // Through the shared loader: the guide chooser draws the same wallpaper, and two scenes loading one key at once log
    // "Texture key already in use".
    if (ensurePictureLoaded(this, art, place) !== null) place();
  }

  #freshDraft() {
    return newGameDraft();
  }

  #newGame(): void {
    if (this.#starting) return;
    // A plain "New game" is never a guided run — clears a still-set flag from an earlier tutorial the player left
    // running rather than stopping outright (`session.ts`'s own `guidedRun` doc comment: "not cleared
    // automatically by starting a fresh non-guided game afterward" was this method's own TODO).
    appSession().guidedRun = false;
    appSession().guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    this.scale.off("resize", this.#rebuild, this);
    // The first New game ever (no guide choice made yet) asks "New to the fight?" first (guided mode, owner
    // 2026-09-29: the game opens on Title, and the chooser comes after you start a new game). Its "Hints only" /
    // "No guide" continue straight into scenario select; "Learn as you play" goes to How to win and the tutorial.
    if (isFirstLaunch(guidePrefs())) {
      goToScreen(this, SCENES.guideChooser);
      return;
    }
    const draft = this.#freshDraft();
    goToScreen(this, SCENES.scenarioSelect, {
      draft,
    } satisfies ScenarioSelectData);
  }

  /**
   * Continue on a saved guided run (guided mode §3.12): a tutorial or aspect "Try it" save asks first whether to
   * resume guidance or just open the save plainly (`guide/tutorial-resume.ts#tutorialResumeDecisionFor`). An
   * ordinary save skips straight to `#resumePlain`, exactly as before this decision existed.
   */
  async #resume(save: SaveMeta): Promise<void> {
    if (this.#starting) return;
    const decision = tutorialResumeDecisionFor(save, guidePrefs());
    if (decision.kind === "plain") {
      await this.#resumePlain(save.id);
      return;
    }
    // `TUTORIAL_LESSONS`' own order numbers "How to win" as lesson 1 (§5.1's table), so a lesson's 1-based
    // number is its index in that list plus one.
    const lessonNumber =
      decision.kind === "tutorial" ? TUTORIAL_LESSONS.findIndex((lesson) => lesson.id === decision.lessonId) + 1 : -1;
    const title =
      decision.kind === "tutorial"
        ? `Resume the tutorial at lesson ${lessonNumber}: ${decision.title}?`
        : decision.kind === "mechanic"
          ? "Restart this Try it?"
          : "Restart this aspect's Try it?";
    const body =
      decision.kind === "tutorial"
        ? "Finished lessons stay done. Or open this save as an ordinary game, with the guide off."
        : "It's a short, one-lesson game — restarting it plays the same opening again. Or open this save as an " +
          "ordinary game, with the guide off.";
    const resumeLabel = decision.kind === "tutorial" ? "Resume tutorial" : "Restart Try it";
    // Launched directly rather than through `askToResumeTutorial`, so the sheet's module stays out of the entry chunk
    // (`scenes/scene-loader.ts` loads it on this launch).
    if (this.scene.isActive(SCENES.tutorialResumeConfirm)) return;
    this.scene.launch(SCENES.tutorialResumeConfirm, {
      from: this.scene.key,
      title,
      body,
      resumeLabel,
      onResume: () => {
        // Imported on the tap, so the lesson configs stay out of the chunk Title loads before its first frame (#226).
        void (
          decision.kind === "tutorial"
            ? import("../guide/start-tutorial.js").then((m) =>
                m.startTutorialGame({ startAtLesson: decision.lessonId }),
              )
            : decision.kind === "mechanic"
              ? import("../guide/start-mechanic-tryit.js").then((m) => m.startMechanicTryItGame(decision.mechanic))
              : import("../guide/start-aspect-tryit.js").then((m) => m.startAspectTryItGame(decision.aspect))
        ).then(() => {
          if (!this.sys.isActive()) return;
          goToScreen(this, SCENES.board);
        });
      },
      onContinuePlain: () => void this.#resumePlain(save.id),
    } satisfies TutorialResumeConfirmData);
  }

  async #resumePlain(gameId: string): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild();
    const { store } = appSession();
    // "Continue" resumes a saved game, never a guided run (guidance isn't part of a save — `session.ts`'s own
    // `guidedRun` doc comment) — same reset as `#newGame`'s own, above.
    appSession().guidedRun = false;
    appSession().guidedRunKind = undefined;
    setGuideRunLevelOverride(null);
    await store.resume(gameId);
    if (store.state.status === "failed") {
      this.#starting = false;
      // Read the saves again rather than dropping Continue: the failed game was retired by the host, the others stand.
      await this.#refreshSaves();
      this.#status?.setText(store.state.error ?? "that game could not be resumed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    // A game saved before its mulligans were done resumes on the setup deal screen, the only place a mulligan can
    // be taken properly; that scene hands off to the Board itself once setup is over.
    goToScreen(this, store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board);
  }
}

/**
 * Depth ladder for the title picture: the ink ground and dot grid under it, the picture, then (phone only) the
 * legibility scrim — all below the default depth 0 every control and text draws at. Depth rather than display-list
 * order because the picture arrives asynchronously and would otherwise land on top of the menu.
 */
const ART_GROUND_DEPTH = -3;
const ART_DEPTH = -2;
const ART_SCRIM_DEPTH = -1;
/** The hover note over the buttons below the Continue row. */
const TIP_DEPTH = 50;

/** How long the rank-up fanfare holds the badge. */
const RANK_UP_MS = 5000;

/** The picture the last Title visit showed, so the next visit shows a different one (`pickTitleArt`). */
let lastTitleArtKey: string | null = null;

/** "Continue — Rhino · Spider-Man · round 4". See `view/continue-label.ts`. */
function continueLabel(save: SaveMeta): string {
  return continueLabelOf(save, GAME_LABEL_NAMES);
}
