/**
 * The Mod Store's heads-up: Deadpool and Spider-Man, a round portrait each with a speech bubble, take turns
 * warning that mods carry risk (`view/mod-notice.ts` has the words, the buttons' outcomes and the layout). No panel
 * frame: the portraits and bubbles sit straight on a dimmed Mod Store. Launched over the store the first time it is
 * opened, before a first install if it was never seen, and from its "About mods" control. Answering it (either button, or
 * Back) remembers it was seen; "Report a problem" then opens the report tool (`scenes/report-button.ts`).
 */
import Phaser from "phaser";
import { hit, surface, typeRole } from "../tokens.js";
import { bangers, drawPicture, heroPicture, isPhoneWidth, speechBubble } from "../ui/campaign-chrome.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { setMask } from "../ui/rex.js";
import { textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { formFactorFor } from "../view/layout.js";
import { MOD_NOTICE_BUTTONS, MOD_NOTICE_LINES, modNoticeLayoutOf, modNoticeOutcomeOf } from "../view/mod-notice.js";
import type { ModNoticeAnswer } from "../view/mod-notice.js";
import { rememberModNoticeSeen } from "../platform/mod-notice-seen.js";
import { FocusRoute } from "./focus-route.js";
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
      this.#hints.dispose();
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      giveBack(paused);
    });
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
      const image = picture ? drawPicture(this, picture, portrait, () => this.#draw(), { focusY: 0.15 }) : null;
      if (image) {
        const maskShape = this.make.graphics({}, false);
        maskShape.fillStyle(0xffffff).fillCircle(cx, cy, radius);
        setMask(image, maskShape, "world");
        image.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());
      } else {
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
