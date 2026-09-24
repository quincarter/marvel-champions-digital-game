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
import { accent, dotGrid, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, paintDotGrid } from "../ui/widgets.js";
import { TITLE_ART, coverFit, pickTitleArt, type TitleArt } from "../art/title-art.js";
import {
  CARDS_BY_ID,
  POOL_CARDS,
  POOL_DEPS,
  POOL_SCENARIOS,
  POOL_STARTER_DECKS,
  POOL_VERSION,
} from "../content/pool.js";
import { cardPoolCoverageOf, cardPoolCoverageText } from "../view/card-pool-coverage.js";
import { preconDecks } from "../view/deck-list-model.js";
import { initialSetupDraft, withSeatOne } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";
import { titleMenuFocusOrder } from "../view/screen-focus.js";
import { titleMenuLayout } from "../view/title-menu-layout.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { SeatsData } from "./seats.js";
import type { Deck } from "@mc/content";
import { destroyChildren } from "../ui/destroy-children.js";
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

export class TitleScene extends Phaser.Scene {
  #buttons: McButton[] = [];
  #status: Phaser.GameObjects.Text | null = null;
  #starting = false;
  /** The game in progress when this screen opened, if any — looked up asynchronously; the screen draws without it first. */
  #continuable: SaveMeta | null = null;
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
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#stops = new Map();
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const layout = titleMenuLayout({
      width,
      height,
      continuable: this.#continuable !== null,
    });

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
          type: typeRole.rowTitle,
          rect,
          enabled: !this.#starting,
          onClick: () => void this.#resume(save.id),
        }),
      );
      this.#stops.set("continue", {
        rect,
        activate: () => void this.#resume(save.id),
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
        type: typeRole.rowTitle,
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
        type: typeRole.rowTitle,
        rect: layout.campaign,
        onClick: openCampaign,
      }),
    );
    this.#stops.set("campaign", { rect: layout.campaign, activate: openCampaign });

    const openExtras = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      goToScreen(this, SCENES.extras);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Extras",
        type: typeRole.rowTitle,
        rect: layout.extras,
        onClick: openExtras,
      }),
    );
    this.#stops.set("extras", { rect: layout.extras, activate: openExtras });

    // W4's Settings is an overlay: launched over this scene, it stops itself on Back (`scenes/settings.ts`).
    const openSettings = (): void => {
      this.scene.launch(SCENES.settings);
    };
    this.#buttons.push(
      new McButton(this, {
        kind: menuKind,
        label: "Settings",
        type: typeRole.rowTitle,
        rect: layout.settings,
        onClick: openSettings,
      }),
    );
    this.#stops.set("settings", {
      rect: layout.settings,
      activate: openSettings,
    });

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
      `v${APP_VERSION}`,
      textStyle(typeRole.label, textColor, ink.meta),
    );
    versionText.setX(layout.footer.x + layout.footer.width - versionText.width);

    this.#status = this.add
      .text(layout.left, layout.footer.y - 24, "", textStyle(typeRole.body, textColor))
      .setWordWrapWidth(layout.column);

    this.#route?.set(titleMenuFocusOrder({ continuable: this.#continuable !== null }), this.#stops);
    this.#drawArt();
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
    if (this.textures.exists(art.key)) {
      place();
      return;
    }
    this.load.image(art.key, art.url);
    this.load.once(`filecomplete-image-${art.key}`, place);
    this.load.start();
  }

  #freshDraft() {
    return initialSetupDraft({
      scenarioId: POOL_SCENARIOS[0]!.id as string,
      seatDeckId: DEFAULT_SEAT_DECK_ID,
      seed: rollSeed(),
    });
  }

  #newGame(): void {
    if (this.#starting) return;
    const draft = this.#freshDraft();
    this.scale.off("resize", this.#rebuild, this);
    goToScreen(this, SCENES.scenarioSelect, {
      draft,
    } satisfies ScenarioSelectData);
  }

  async #resume(gameId: string): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild();
    const { store } = appSession();
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

/** Bump alongside `package.json`'s own `version` until a build step reads it directly. */
const APP_VERSION = "0.0.0";

/** "Continue — Rhino · Spider-Man · round 4". Names from content, never from the save's own text. */
function continueLabel(save: SaveMeta): string {
  const scenario =
    POOL_SCENARIOS.find((candidate) => (candidate.id as string) === save.config.scenarioId)?.name ??
    save.config.scenarioId;
  const heroes = save.config.players
    .map((player) => {
      if (!("starterDeckId" in player)) {
        return CARDS_BY_ID.get(player.identityCardId as string)?.name ?? player.identityCardId;
      }
      return (
        POOL_STARTER_DECKS.find((deck) => (deck.id as string) === player.starterDeckId)?.name.split(" — ")[0] ??
        player.starterDeckId
      );
    })
    .join(", ");
  return `Continue — ${scenario} · ${heroes} · round ${save.round}`;
}
