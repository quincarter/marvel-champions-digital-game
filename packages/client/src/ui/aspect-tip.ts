/**
 * The aspect-chip info affordance (guided mode G10b, `docs/guided-mode.md` §3 decision 7, §5.4): a small
 * "i" badge drawn at an aspect chip/tile's own corner — hover opens it on desktop, tap opens it on
 * touch, the same convention `ui/term-text.ts`'s glossary terms already use (see that module's header) —
 * and the tip panel it opens: the aspect's name, tagline and short tip line, plus an "Aspects ▸" link to
 * that aspect's lesson page (`scenes/aspect-lesson.ts`, G10c) — live for the four playable aspects, dashed
 * "Coming soon" for Basic, which has this tip card but no lesson (`view/aspect-tip-model.ts`'s own
 * `linkAvailable`). The link opens the lesson `scene.launch`ed *over* whichever screen owns this panel
 * (Seats/Deck check/Deck builder) with `backTo: "previous"`, the same overlay shape `scenes/rules.ts`
 * already uses from here — never a fresh `scene.start`, which would drop that screen's own in-progress
 * draft.
 *
 * **Not `McTooltip` (G3b).** That widget's content shape is a glossary term's title + one-line
 * definition + a fixed "RULES GLOSSARY ▸" link, and its own header explains why closing has to live on a
 * viewport-wide `pointermove` watch rather than the anchoring zone's own `pointerout` (a term the open
 * tooltip visually covers can still fire `pointerover`/`pointerout`, which would otherwise fight the
 * pointer travelling onto the tooltip's own link). This sibling's own link is inert — dashed,
 * "Coming soon" — so there is nothing for the pointer to travel onto, and the badge's own `pointerout`
 * is enough to close it. It shares the same panel look (ink ground, caution bottom rule, the same arrow)
 * on purpose (`docs/guided-mode.md`: "don't create a new visual language").
 *
 * **Redrawn every `#rebuild()`, not a persisting instance.** `scenes/seats.ts`, `scenes/deck-check.ts`
 * and `scenes/deck-builder.ts` already tear down and redraw their whole screen
 * (`ui/destroy-children.ts`) on every state change, including a chip's own hover/tap; open/closed state
 * is a plain field on the host scene (`isOpen`, passed in fresh on each call), not something this module
 * tracks itself.
 */
import Phaser from "phaser";
import { border, hit, ink, signal, surface, typeRole } from "../tokens.js";
import type { AspectTipContent } from "../view/aspect-tip-model.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";
import { SCENES } from "../scenes/keys.js";
import type { AspectLessonSceneData } from "../scenes/aspect-lesson.js";

const BADGE_SIZE = 18;
const PANEL_WIDTH = 220;
const PAD = 10;
const GAP_FROM_ANCHOR = 8;
const ARROW_SIZE = 7;

/**
 * Draws the small "i" badge nudged half outside `anchorRect`'s top-right corner (a notification-dot
 * position that stays clear of the chip's own label) and wires its pointer handling. Returns the badge's
 * own on-screen rect, which the caller passes to `drawAspectTipPanel` as the tip's anchor.
 */
export function drawAspectInfoBadge(
  scene: Phaser.Scene,
  anchorRect: Rect,
  isOpen: boolean,
  onOpen: () => void,
  onClose: () => void,
): Rect {
  const rect: Rect = {
    x: anchorRect.x + anchorRect.width - BADGE_SIZE * 0.7,
    y: anchorRect.y - BADGE_SIZE * 0.3,
    width: BADGE_SIZE,
    height: BADGE_SIZE,
  };
  const cx = rect.x + BADGE_SIZE / 2;
  const cy = rect.y + BADGE_SIZE / 2;
  const g = scene.add.graphics();
  g.fillStyle(isOpen ? signal.caution.hex : surface.ink.hex, 1).fillCircle(cx, cy, BADGE_SIZE / 2);
  g.lineStyle(1.5, surface.paper.hex, 1).strokeCircle(cx, cy, BADGE_SIZE / 2);
  scene.add
    .text(cx, cy, "i", { ...textStyle(typeRole.label, isOpen ? surface.ink.hex : surface.paper.hex), fontSize: "12px" })
    .setOrigin(0.5, 0.5);

  const zone = scene.add
    .zone(rect.x, rect.y, rect.width, rect.height)
    .setOrigin(0, 0)
    .setInteractive({ useHandCursor: true });
  zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    if (!isOpen) onOpen();
  });
  zone.on("pointerout", (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    if (isOpen) onClose();
  });
  zone.on("pointerup", () => {
    if (isOpen) onClose();
    else onOpen();
  });
  return rect;
}

/**
 * Draws the tip panel itself, anchored at `anchor` (the badge's own rect from `drawAspectInfoBadge`) —
 * flipping above/below and clamping horizontally so the whole panel stays inside `viewport`, the same
 * placement math `ui/tooltip.ts#show` uses. Pure draw: the caller decides whether to call this at all
 * from its own `isOpen` state.
 */
export function drawAspectTipPanel(scene: Phaser.Scene, anchor: Rect, content: AspectTipContent, viewport: Rect): void {
  const title = scene.add
    .text(0, 0, content.title, textStyle(typeRole.sectionHeader, surface.paper.hex))
    .setFontSize(16);
  const tagline = scene.add.text(0, 0, content.tagline, {
    ...textStyle(typeRole.body, surface.paper.hex, ink.secondary),
    wordWrap: { width: PANEL_WIDTH - PAD * 2, useAdvancedWrap: true },
  });
  const tip = scene.add.text(0, 0, content.tipLine, {
    ...textStyle(typeRole.body, surface.paper.hex),
    wordWrap: { width: PANEL_WIDTH - PAD * 2, useAdvancedWrap: true },
  });
  const linkText = content.linkAvailable ? content.linkLabel : `${content.linkLabel} · ${content.linkReason}`;
  const link = scene.add.text(
    0,
    0,
    linkText,
    textStyle(typeRole.label, content.linkAvailable ? signal.caution.hex : surface.paper.hex),
  );
  link.setAlpha(content.linkAvailable ? 1 : ink.disabled);

  const contentHeight = PAD + title.height + 6 + tagline.height + 6 + tip.height + 8 + link.height + PAD;
  const anchorCenterX = anchor.x + anchor.width / 2;
  let panelX = anchorCenterX - PANEL_WIDTH / 2;
  panelX = Math.max(viewport.x + 4, Math.min(panelX, viewport.x + viewport.width - PANEL_WIDTH - 4));

  // Opens below the badge by default — every aspect chip/tile this panel anchors to sits near a screen's own
  // top (a quick-filter row, a rail), so "below" is almost always where the room is; flip above only when the
  // viewport genuinely doesn't have room below (e.g. the last visible row on a short viewport). Below also
  // steers clear of `ui/widgets.ts`'s one DOM element, `McTextInput` — a search field drawn just *above* the
  // aspect chips in `scenes/seats.ts` renders over the canvas regardless of Phaser depth, so a panel that opened
  // upward there got its own bottom rows clipped by that field.
  // `anchor` is the badge, nudged half outside the tile's own top-right corner (`drawAspectInfoBadge`'s
  // `y: anchorRect.y - BADGE_SIZE * 0.3`) — its own bottom edge sits only ~13px below the *tile's* top, nowhere
  // near the tile's actual bottom. Every caller's tile is a `tokens.ts#hit.target`-tall chip (Deck builder's
  // aspect grid, Deck check's and Seats' own aspect tiles), so gapping the panel off the badge alone opened it
  // with its own top still inside the tile — over the lower ~16px of the tile's own label. Backing the tile's
  // top out from the badge's own known offset and clearing the tile's full height, not just the badge, is what
  // keeps the panel off the chip it's attached to.
  const tileBottom = anchor.y + BADGE_SIZE * 0.3 + hit.target;
  const clearBelow = Math.max(anchor.y + anchor.height, tileBottom);
  const spaceBelow = viewport.y + viewport.height - clearBelow;
  const flipAbove = spaceBelow < contentHeight + GAP_FROM_ANCHOR + ARROW_SIZE;
  const panelY = flipAbove
    ? anchor.y - GAP_FROM_ANCHOR - ARROW_SIZE - contentHeight
    : clearBelow + GAP_FROM_ANCHOR + ARROW_SIZE;

  const rect: Rect = { x: panelX, y: panelY, width: PANEL_WIDTH, height: contentHeight };

  const panel = scene.add.graphics();
  panel.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  panel.fillStyle(signal.caution.hex, 1).fillRect(rect.x, rect.y + rect.height - 3, rect.width, 3);
  panel.lineStyle(border.detail, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
  const tipX = Math.max(rect.x + ARROW_SIZE, Math.min(anchorCenterX, rect.x + rect.width - ARROW_SIZE));
  panel.fillStyle(surface.ink.hex, 1);
  if (flipAbove) {
    const by = rect.y + rect.height;
    panel.fillTriangle(tipX - ARROW_SIZE, by, tipX + ARROW_SIZE, by, tipX, by + ARROW_SIZE);
  } else {
    panel.fillTriangle(tipX - ARROW_SIZE, rect.y, tipX + ARROW_SIZE, rect.y, tipX, rect.y - ARROW_SIZE);
  }

  title.setPosition(rect.x + PAD, rect.y + PAD);
  tagline.setPosition(rect.x + PAD, rect.y + PAD + title.height + 6);
  tip.setPosition(rect.x + PAD, rect.y + PAD + title.height + 6 + tagline.height + 6);
  link.setPosition(rect.x + PAD, rect.y + PAD + title.height + 6 + tagline.height + 6 + tip.height + 8);

  const containerChildren: Phaser.GameObjects.GameObject[] = [panel, title, tagline, tip, link];
  if (content.linkAvailable) {
    const zone = scene.add
      .zone(link.x, link.y, link.width, link.height)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    // The panel floats near the badge (`drawAspectTipPanel`'s own placement above), which on a narrow chip row
    // can land over a hero/card tile's own zone underneath (`scenes/seats.ts`'s grid) — stop the event here so
    // that tap only ever opens the lesson, never also fires whatever's drawn beneath the panel.
    zone.on(
      "pointerup",
      (_pointer: Phaser.Input.Pointer, _localX: number, _localY: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        scene.scene.launch(SCENES.aspectLesson, {
          aspect: content.aspect,
          backTo: "previous",
        } satisfies AspectLessonSceneData);
      },
    );
    containerChildren.push(zone);
  }

  const container = scene.add.container(0, 0, containerChildren).setDepth(1000);
  scene.children.bringToTop(container);
}
