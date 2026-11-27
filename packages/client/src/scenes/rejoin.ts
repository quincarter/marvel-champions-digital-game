/**
 * "Rejoining room ABC123…" and "Resuming your game…" (reload resume): the small sheet shown while a refreshed page
 * reconnects to its room, or loads the single-player save named by the address (`platform/room-address.ts`,
 * `platform/game-address.ts`). Modeled on `scenes/online-name.ts` (scrim and box, the screen underneath takes no input).
 *
 * - `room`: launched over Play online while its rejoin runs; it only says so and offers Cancel (the screen underneath
 *   stops it when the room answers).
 * - `game`: started by Boot in place of Title. It loads the local save (no network) and goes to the board, as Continue
 *   does; the sheet only shows if that takes a moment. A save that cannot be resumed goes to Title.
 *
 * Cancel leaves to Play online (room) or Title (game) and clears the address.
 *
 * The box is a Lit panel over the canvas (`dom/popup-sheet.ts`); the scene keeps the press shield, the focus route (ring
 * in the panel layer) and the answers.
 */
import Phaser from "phaser";
import { domFocusRing } from "../dom/dom-ring.js";
import { PopupSheet } from "../dom/popup-sheet.js";
import { SheetGlyphs } from "../dom/sheet-glyphs.js";
import { t } from "../i18n/translate.js";
import { clearGameAddress } from "../platform/game-address.js";
import { clearRoomAddress } from "../platform/room-address.js";
import { leaveRoom } from "../platform/room.js";
import { cssOf } from "../ui/theme.js";
import { hit, surface, typeRole } from "../tokens.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { glyphsFitFormFactor } from "../view/glyph-placement.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { resumeLocalSave } from "./resume-save.js";
import { guidePrefs } from "../guide/guide-store.js";
import { tutorialResumeDecisionFor } from "../guide/tutorial-resume.js";
import { appSession } from "../session.js";

export type RejoinData =
  | {
      readonly kind: "room";
      /** The room's 6-character code, shown in the line. */
      readonly code: string;
      /** Cancel pressed: the caller leaves the room and goes back to its own screen. */
      readonly onCancel: () => void;
    }
  | { readonly kind: "game"; readonly gameId: string };

/** The save-resume sheet waits this long before it shows: a quick load never flashes it. */
export const RESUME_SHEET_DELAY_MS = 600;

const buttonType = { ...typeRole.label, size: 13 };

export class RejoinOverlay extends Phaser.Scene {
  #data: RejoinData | null = null;
  #route: FocusRoute | null = null;
  #panel!: PopupSheet;
  #glyphs!: SheetGlyphs;
  #shown = false;
  #cancelled = false;
  #alive = false;

  constructor() {
    super(SCENES.rejoin);
  }

  init(data: RejoinData): void {
    this.#data = data;
    this.#shown = data.kind === "room";
    this.#cancelled = false;
  }

  create(): void {
    this.#alive = true;
    const data = this.#data;
    if (!data) return;
    if (data.kind === "game") this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#panel = new PopupSheet(
      this,
      (key) => {
        if (key === "cancel") this.#cancel();
      },
      undefined,
      { onDismiss: () => this.#cancel() },
    );
    this.#glyphs = new SheetGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.#panel.leaving,
      onCancel: () => this.#cancel(),
      primary: () => "cancel",
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
    });
    if (data.kind === "game") {
      fadeScreenIn(this);
      this.time.delayedCall(RESUME_SHEET_DELAY_MS, () => {
        if (!this.#alive || this.#cancelled) return;
        this.#shown = true;
        this.#draw();
      });
      void this.#resume(data.gameId);
    } else {
      this.#draw();
    }
  }

  /** The same resume as Title's Continue: a local save only, never a guided run, setup deal when the mulligans are not done. */
  async #resume(gameId: string): Promise<void> {
    // A guided lesson's save opens through Title's own Continue (its resume prompt), never as plain play from here.
    const saved = await appSession()
      .store.listSaves()
      .catch(() => []);
    const meta = saved.find((save) => save.id === gameId);
    if (meta && tutorialResumeDecisionFor(meta, guidePrefs()).kind !== "plain") {
      clearGameAddress();
      goToScreen(this, SCENES.title);
      return;
    }
    const screen = await resumeLocalSave(gameId);
    // A Cancel while it loaded: the game finished loading anyway, so the address it rewrote is cleared again.
    if (this.#cancelled || !this.#alive) {
      clearGameAddress();
      return;
    }
    if (!screen) {
      clearGameAddress();
      goToScreen(this, SCENES.title);
      return;
    }
    goToScreen(this, screen);
  }

  #cancel(): void {
    const data = this.#data;
    if (this.#cancelled || !data) return;
    this.#cancelled = true;
    if (data.kind === "room") {
      leaveRoom();
      clearRoomAddress();
      this.#panel.close(() => {
        data.onCancel();
      });
      return;
    }
    clearGameAddress();
    goToScreen(this, SCENES.title);
  }

  #draw(): void {
    const data = this.#data;
    if (!data || !this.#shown) return;
    destroyChildren(this);
    this.#glyphs.reset();

    const { width, height } = this.scale.gameSize;
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    const b = this.#panel.begin(width, height);

    const boxWidth = Math.min(480, width - 32);
    const textWidth = boxWidth - 40;
    const titleSpec = typeRole.barTitle;
    const bodySpec = typeRole.body;
    const title = t("rejoin.title");
    const line = data.kind === "room" ? t("rejoin.room", { code: data.code }) : t("rejoin.game");
    const titleSize = b.measure(title, titleSpec);
    const bodySize = b.measure(line, bodySpec, { wrapWidth: textWidth });
    const boxHeight = 20 + titleSize.height + 8 + bodySize.height + 18 + hit.primary + 20;
    const box: Rect = {
      x: (width - boxWidth) / 2,
      y: Math.max(16, (height - boxHeight) / 3),
      width: boxWidth,
      height: boxHeight,
    };
    b.box(box, { fill: surface.paper.hex, stroke: surface.ink.hex, strokeWidth: 4 });
    b.text(box.x + 20, box.y + 20, title, titleSpec, { color: surface.ink.hex });
    b.text(box.x + 20, box.y + 20 + titleSize.height + 8, line, bodySpec, {
      color: surface.ink.hex,
      alpha: 0.9,
      wrapWidth: textWidth,
    });
    const cancelRect: Rect = {
      x: box.x + 20,
      y: box.y + box.height - 20 - hit.primary,
      width: textWidth,
      height: hit.primary,
    };
    // Glyphs are for desktop and tablet landscape (`glyphsFitFormFactor`), as every other pop-up.
    const glyphsFit = glyphsFitFormFactor(formFactorFor(width, height));
    this.#glyphs.button(b, {
      key: "cancel",
      rect: cancelRect,
      label: t("rejoin.cancel"),
      look: "secondary",
      type: buttonType,
      ids: glyphsFit ? ["cancel"] : [],
      ground: "paper",
    });
    this.#panel.mount(b, width, height);
    const stops = new Map([["cancel", { rect: cancelRect, activate: () => this.#cancel() }]]);
    this.#route?.set(["cancel"], stops);
  }
}
