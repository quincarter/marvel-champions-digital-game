/**
 * The Mod Store's heads-up: Deadpool and Spider-Man, a round portrait each with a speech bubble, take turns
 * warning that mods carry risk (`view/mod-notice.ts` has the words, the buttons' outcomes and the layout). No panel
 * frame: the portraits and bubbles sit straight on a dimmed Mod Store. Launched over the store the first time it is
 * opened, before a first install if it was never seen, and from its "About mods" control. Answering it (either button, or
 * Back) remembers it was seen; "Report a problem" then opens the report tool (`scenes/report-button.ts`).
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { ensurePictureLoaded, type Picture } from "../art/pictures.js";
import { bangers, heroPicture, isPhoneWidth, speechBubble } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { holdLabelsOnMain } from "../ui/lazy-text.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { portraitCropRect } from "../view/badge-crop.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { MOD_NOTICE_BUTTONS, MOD_NOTICE_LINES, modNoticeLayoutOf, modNoticeOutcomeOf } from "../view/mod-notice.js";
import type { ModNoticeAnswer } from "../view/mod-notice.js";
import { rememberModNoticeSeen } from "../platform/mod-notice-seen.js";
import { FocusRoute } from "./focus-route.js";
import { bakedBadge } from "./board/team-up-badge.js";
import { SCENES } from "./keys.js";
import { giveBack } from "./option-notice.js";
import { openReportIssue } from "./report-button.js";

const buttonType = { ...typeRole.label, size: 13 };

export interface ModNoticeData {
  /** The scene it opened over: its input is off while this is up. */
  readonly from: string;
  /** Called after the notice closes, whichever button closed it (the install the notice was holding back). */
  readonly onClose?: (answer: ModNoticeAnswer) => void;
}

export class ModNoticeOverlay extends Phaser.Scene {
  #data!: ModNoticeData;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;
  #hints!: GlyphHints;

  constructor() {
    super(SCENES.modNotice);
  }

  create(data: ModNoticeData): void {
    this.#data = data;
    const from = this.scene.isActive(data.from) ? this.scene.get(data.from) : null;
    const paused = from && from.input.enabled ? [from] : [];
    for (const scene of paused) scene.input.enabled = false;
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hints = new GlyphHints(this);
    this.#route = new FocusRoute(this, { onCancel: () => this.#answer("close"), primary: () => "close" });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      holdLabelsOnMain(this, false);
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      giveBack(paused);
    });
    // Its first frame shows its words, not empty bubbles filled a few frames later by the text worker (issue #716): a
    // handful of labels, painted on the main thread for that one render.
    holdLabelsOnMain(this, true);
    this.events.once(Phaser.Scenes.Events.RENDER, () => holdLabelsOnMain(this, false));
    this.#draw();
  }

  #answer(answer: ModNoticeAnswer): void {
    const outcome = modNoticeOutcomeOf(answer);
    if (outcome.remember) rememberModNoticeSeen();
    const { from, onClose } = this.#data;
    const under = this.scene.isActive(from) ? this.scene.get(from) : null;
    this.scene.stop();
    onClose?.(answer);
    if (outcome.openReport && under) openReportIssue(under);
  }

  /**
   * A speaker's round portrait, its corners cut away in a baked texture rather than by a circular mask (issue #733, as
   * the Briefing did in #692). A circular mask is a Mask filter, which sized its framebuffer past the picture (3240 x
   * 5760 for Spider-Man's 2160 x 3840): on Android phones the game stopped drawing after Deadpool's row, so the notice
   * had no buttons and the store could not be left. Null until the picture has loaded; the notice redraws then.
   */
  #roundPortrait(picture: Picture, rect: Rect): Phaser.GameObjects.Image | null {
    const key = ensurePictureLoaded(this, picture, () => this.#draw());
    if (!key) return null;
    const source = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const square = portraitCropRect(source, picture.focus, 0.15);
    // Baked at three times its size, so a phone drawing at its own density still gets a sharp face.
    const baked = bakedBadge(this, key, source, Math.round(rect.width * 3), true, square);
    return this.add.image(rect.x, rect.y, baked).setOrigin(0, 0).setDisplaySize(rect.width, rect.height);
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    this.#hints.reset();

    const { width, height } = this.scale.gameSize;
    const phone = isPhoneWidth(formFactorFor(width, height));
    this.add.zone(0, 0, width, height).setOrigin(0, 0).setInteractive();
    this.add.graphics().fillStyle(surface.void.hex, 0.78).fillRect(0, 0, width, height);

    const layout = modNoticeLayoutOf(width, height, phone);
    MOD_NOTICE_LINES.forEach((line, index) => {
      const place = layout.speakers[index]!;
      const { portrait } = place;
      const radius = portrait.width / 2;
      const cx = portrait.x + radius;
      const cy = portrait.y + radius;
      this.add.graphics().fillStyle(surface.ink.hex, 1).fillCircle(cx, cy, radius);
      const picture = heroPicture(line.identityId);
      const image = picture ? this.#roundPortrait(picture, portrait) : null;
      if (!image) {
        this.add.text(cx, cy, line.speaker.charAt(0), textStyle(bangers(radius), surface.paper.hex)).setOrigin(0.5);
      }
      this.add.graphics().lineStyle(3, surface.paper.hex, 1).strokeCircle(cx, cy, radius);
      // The bubble's tail points at its speaker's portrait, from the side facing it.
      const target = { x: place.tailSide === "left" ? portrait.x + portrait.width : portrait.x, y: cy };
      speechBubble(this, place.bubble.x, place.bubble.y, place.bubble.width, line.text, {
        speaker: line.speaker,
        size: phone ? 13 : 16,
        pointAt: target,
      });
    });

    const stops = new Map<string, { rect: (typeof layout.buttons)[number]; activate: () => void }>();
    MOD_NOTICE_BUTTONS.forEach((def, index) => {
      const rect = layout.buttons[index]!;
      const press = (): void => this.#answer(def.id);
      this.#buttons.push(
        new McButton(this, {
          kind: def.id === "close" ? "primary" : "secondary",
          label: def.label,
          type: buttonType,
          rect: { ...rect, height: Math.max(rect.height, hit.primary) },
          onClick: press,
        }),
      );
      stops.set(def.id, { rect, activate: press });
    });
    this.#hints.button(this.#buttons[1]!, ["activate"], "paper");
    this.#route?.set(["close", "report"], stops);
    this.#route?.focusKey("close");
  }
}
