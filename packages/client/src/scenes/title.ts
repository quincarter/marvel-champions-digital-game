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
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { TITLE_ART, coverFit, pickTitleArt, type TitleArt } from "../art/title-art.js";
import { ensurePictureLoaded } from "../art/pictures.js";
import {
  CARDS_BY_ID,
  POOL_CARDS,
  POOL_DEPS,
  POOL_SCENARIOS,
  POOL_STARTER_DECKS,
  POOL_VERSION,
} from "../content/pool.js";
import { cardPoolCoverageOf, cardPoolCoverageText } from "../view/card-pool-coverage.js";
import { UPDATE_DISMISS_ID, appVersionText, buildCommit, releaseNotesUrl, updateActions } from "../view/app-version.js";
import { dismissUpdate, dismissedUpdateVersion, isUpdateDismissed } from "../platform/update-dismissal.js";
import { CLIENT_VERSION } from "../version.js";
import { detectPlatform, openExternal } from "../platform/platform.js";
import { checkForUpdate, type AvailableUpdate } from "../platform/update-check.js";
import { preconDecks } from "../view/deck-list-model.js";
import { cardDisplayName } from "../view/hero-names.js";
import { initialSetupDraft, withSeatOne } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";
import { titleMenuFocusOrder } from "../view/screen-focus.js";
import { titleMenuLayout, updateBannerParts } from "../view/title-menu-layout.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { appSession } from "../session.js";
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
import { unlocks } from "../progression/progression.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { tutorialResumeDecisionFor } from "../guide/tutorial-resume.js";
import { TUTORIAL_LESSONS } from "../guide/tutorial-lessons.js";
import { startTutorialGame } from "../guide/start-tutorial.js";
import { startAspectTryItGame } from "../guide/start-aspect-tryit.js";
import { startMechanicTryItGame } from "../guide/start-mechanic-tryit.js";
import { askToResumeTutorial } from "./tutorial-resume-confirm.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { hasDesktopWindow, quitToDesktop } from "../platform/desktop-window.js";
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
  #starting = false;
  /** The game in progress when this screen opened, if any — looked up asynchronously; the screen draws without it first. */
  #continuable: SaveMeta | null = null;
  /** A newer release with an installer for this platform (native apps only), once GitHub has answered. */
  #update: AvailableUpdate | null = null;
  /** This visit's picture (`art/title-art.ts`), chosen once per `create` so a resize redraws the same one. */
  #art: TitleArt | null = null;
  #artPanel: { x: number; y: number; width: number; height: number } | null = null;
  /** Bumped by every `#rebuild`, so a picture that finishes loading after a redraw is placed by the current one only. */
  #artGeneration = 0;
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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
    });
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect) || this.scene.isActive(SCENES.settings),
    });
    // Phaser reuses this scene instance across "back to title" round trips, so state from a previous visit
    // (a stuck "Starting…", a stale Continue) must not survive into this one.
    this.#continuable = null;
    this.#starting = false;
    this.#art = pickTitleArt(TITLE_ART, lastTitleArtKey);
    lastTitleArtKey = this.#art?.key ?? null;
    appSession().music?.playTitle();
    this.#rebuild();
    fadeScreenIn(this);
    void appSession()
      .store.latestSave()
      .then((save) => {
        if (!save || !this.sys.isActive()) return;
        this.#continuable = save;
        this.#rebuild();
      });
    void checkForUpdate().then((update) => {
      // A banner the player closed for this very release stays closed; a newer release brings it back.
      if (!update || !this.sys.isActive() || isUpdateDismissed(update.version, dismissedUpdateVersion())) return;
      this.#update = update;
      this.#rebuild();
    });
  }

  #rebuild(): void {
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
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: continueLabel(save),
          // A built game's label names its stages and sets: wrapped onto a second line rather than cut.
          wrap: true,
          type: typeRole.menuButton,
          rect,
          enabled: !this.#starting,
          onClick: () => void this.#resume(save),
        }),
      );
      this.#stops.set("continue", {
        rect,
        activate: () => void this.#resume(save),
      });
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
    this.add
      .zone(linkRect.x, linkRect.y, linkRect.width, linkRect.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on("pointerup", releaseNotes);
    this.#stops.set("release-notes", { rect: linkRect, activate: releaseNotes });

    this.#status = this.add
      .text(layout.left, layout.footer.y - 24, "", textStyle(typeRole.body, textColor))
      .setWordWrapWidth(layout.column);

    const bannerStops = this.#drawUpdateBanner(layout.updateBanner);
    this.#route?.set(
      titleMenuFocusOrder({
        continuable: this.#continuable !== null,
        civilWar: civilWar !== null,
        quit: layout.quit !== null,
        updateActions: bannerStops,
      }),
      this.#stops,
    );
    this.#drawArt();
  }

  /**
   * The update banner (native apps, `platform/update-check.ts`): caution yellow, the advisory color, with the new
   * version and a button per action: the changelog and this install's own installer. Returns its focus stops.
   */
  #drawUpdateBanner(banner: Rect | null): readonly string[] {
    const update = this.#update;
    if (!update || !banner) return [];
    const actions = updateActions(update);
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
    askToResumeTutorial(this, {
      title,
      body,
      resumeLabel,
      onResume: () => {
        void (
          decision.kind === "tutorial"
            ? startTutorialGame({ startAtLesson: decision.lessonId })
            : decision.kind === "mechanic"
              ? startMechanicTryItGame(decision.mechanic)
              : startAspectTryItGame(decision.aspect)
        ).then(() => {
          if (!this.sys.isActive()) return;
          goToScreen(this, SCENES.board);
        });
      },
      onContinuePlain: () => void this.#resumePlain(save.id),
    });
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
      this.#continuable = null;
      this.#rebuild();
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

/** The picture the last Title visit showed, so the next visit shows a different one (`pickTitleArt`). */
let lastTitleArtKey: string | null = null;

/** "Continue — Rhino · Spider-Man · round 4". See `view/continue-label.ts`. */
function continueLabel(save: SaveMeta): string {
  return continueLabelOf(save, {
    scenarioName: (id) => POOL_SCENARIOS.find((candidate) => (candidate.id as string) === id)?.name,
    identityName: (id) => {
      const identity = CARDS_BY_ID.get(id);
      return identity ? cardDisplayName(identity) : undefined;
    },
    starterDeckName: (id) => POOL_STARTER_DECKS.find((deck) => (deck.id as string) === id)?.name,
  });
}
