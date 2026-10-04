/**
 * The aspect-chip info affordance (guided mode G10b, `docs/guided-mode.md` §3 decision 7, §5.4): an
 * "i" segment split off the right-hand end of an aspect chip/tile, like a split "Send ▾" button (it replaced a small
 * corner badge on 2026-09-30, which the chip rail clipped and a thumb could barely hit) — hover opens it on desktop,
 * tap opens it on touch, the same convention `ui/term-text.ts`'s glossary terms already use (see that module's header) —
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
 * pointer traveling onto the tooltip's own link). This sibling's own link is inert — dashed,
 * "Coming soon" — so there is nothing for the pointer to travel onto, and the segment's own `pointerout`
 * is enough to close it. It shares the same panel look (ink ground, caution bottom rule, the same arrow)
 * on purpose (`docs/guided-mode.md`: "don't create a new visual language").
 *
 * **Redrawn every `#rebuild()`, not a persisting instance.** `scenes/seats.ts`, `scenes/deck-check.ts`
 * and `scenes/deck-builder.ts` already tear down and redraw their whole screen
 * (`ui/destroy-children.ts`) on every state change, including a chip's own hover/tap; open/closed state
 * is a plain field on the host scene (`isOpen`, passed in fresh on each call), not something this module
 * tracks itself.
 *
 * **On a scrolling rail, also redrawn every `McChipRail#redraw()`, not just `#rebuild()`.** Seats' narrow
 * layout puts the aspect chips in `ui/chip-rail.ts`'s `McChipRail`, which scrolls without the host scene
 * rebuilding — a drag, a flick's momentum, `scrollIntoView`. `AspectInfoSegmentOptions.parent` lets a caller
 * (only `McChipRail` uses it) reparent the segment's own graphics/label/zone into the rail's own scrolling,
 * masked content layer instead of the scene root, so it moves and clips with its chip; `clip`/`suppressClick` then mirror `McButton`'s own guards for anything reparented
 * into scrolling, masked content.
 */
import Phaser from "phaser";
import { border, ink, signal, surface, typeRole } from "../tokens.js";
import type { AspectTipContent } from "../view/aspect-tip-model.js";
import type { Rect } from "../view/layout.js";
import { textStyle } from "./theme.js";
import { SCENES } from "../scenes/keys.js";
import type { AspectLessonSceneData } from "../scenes/aspect-lesson.js";
import { pointInRect } from "../view/drag-gesture.js";
import { onTap } from "./tap.js";

const PANEL_WIDTH = 220;
const PAD = 10;
const GAP_FROM_ANCHOR = 8;
const ARROW_SIZE = 7;
/** The drawn "i" ring inside a segment; the segment itself is the touch target. */
const GLYPH_RADIUS = 10;

/** Extra options for `drawAspectInfoSegment` beyond the rect and open/close callbacks every caller passes. */
export interface AspectInfoSegmentOptions {
  /** The chip's own stamp color (`McButtonOptions.tint`); the segment wears a darker shade of it. Paper when absent. */
  readonly tint?: { readonly fill: number; readonly ink: number };
  /**
   * Reparents the segment's graphics, label and hit zone into this container instead of leaving them on the scene's
   * own display list — the chip rail's own scrolling, masked content layer (`ui/chip-rail.ts`'s `#layer`), so the
   * segment scrolls and clips with the chip it belongs to (reported 2026-09-29: a badge drawn on the scene root sat
   * between two chips after the rail scrolled).
   */
  readonly parent?: Phaser.GameObjects.Container;
  /**
   * A viewport the segment must be visually inside of to respond, and whether the enclosing rail's own drag gesture
   * should swallow this tap — the same two guards `McButton` takes (`ui/widgets.ts`'s `McButtonOptions.clip` /
   * `suppressClick`) for a control reparented into scrolling, masked content.
   */
  readonly clip?: () => Rect | null;
  readonly suppressClick?: () => boolean;
}

/** `color` scaled toward black by `factor` (0–1), channel by channel. */
function shade(color: number, factor: number): number {
  const r = Math.round(((color >> 16) & 0xff) * factor);
  const g = Math.round(((color >> 8) & 0xff) * factor);
  const b = Math.round((color & 0xff) * factor);
  return (r << 16) | (g << 8) | b;
}

/**
 * Draws a split chip's info segment into `rect` (`view/chip-layout.ts`'s `splitInfoSegment`, the right-hand end of
 * the chip) and wires it: a darker shade of the chip's own color, an ink rule dividing it from the filter half, and
 * an "i" ring. Open, it inverts to an ink ground. The whole segment is the touch target, at least `hit.target` wide,
 * so the tip is as easy to hit as the filter beside it. Hover opens it on desktop, a tap toggles it on touch.
 *
 * Returns `rect`, the tip panel's anchor (`drawAspectTipPanel`), for symmetry with the callers that carve it.
 */
export function drawAspectInfoSegment(
  scene: Phaser.Scene,
  rect: Rect,
  isOpen: boolean,
  onOpen: () => void,
  onClose: () => void,
  options: AspectInfoSegmentOptions = {},
): Rect {
  const tint = options.tint;
  const ground = isOpen ? surface.ink.hex : tint ? shade(tint.fill, 0.78) : surface.paper.hex;
  const glyph = isOpen ? surface.paper.hex : tint ? tint.ink : surface.ink.hex;
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const g = scene.add.graphics();
  g.fillStyle(ground, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
  g.lineStyle(1.5, surface.ink.hex, 1).strokeRect(rect.x + 0.75, rect.y + 0.75, rect.width - 1.5, rect.height - 1.5);
  // The divider: heavier than the outline, so the chip reads as two buttons side by side.
  g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, 2.5, rect.height);
  g.lineStyle(2, glyph, 1).strokeCircle(cx + 1, cy, GLYPH_RADIUS);
  const label = scene.add
    .text(cx + 1, cy, "i", { ...textStyle(typeRole.label, glyph), fontSize: "14px" })
    .setOrigin(0.5, 0.5);

  const zone = scene.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive({
    useHandCursor: true,
  });
  zone.on("pointerover", (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    if (!isOpen) onOpen();
  });
  zone.on("pointerout", (pointer: Phaser.Input.Pointer) => {
    if (pointer.wasTouch) return;
    if (isOpen) onClose();
  });
  onTap(zone, (pointer) => {
    if (options.suppressClick?.()) return;
    const clip = options.clip?.() ?? null;
    if (clip && !pointInRect(pointer.x, pointer.y, clip)) return;
    if (isOpen) onClose();
    else onOpen();
  });
  options.parent?.add([g, label, zone]);
  return rect;
}

/**
 * Draws the tip panel itself, anchored at `anchor` (the segment `drawAspectInfoSegment` drew) —
 * flipping above/below and clamping horizontally so the whole panel stays inside `viewport`, the same
 * placement math `ui/tooltip.ts#show` uses. Pure draw: the caller decides whether to call this at all
 * from its own `isOpen` state. Returns the panel's own container, for a caller whose anchor scrolls without a
 * rebuild (`scenes/deck-builder.ts`'s narrow deck region) to move or hide it.
 */
export function drawAspectTipPanel(
  scene: Phaser.Scene,
  anchor: Rect,
  content: AspectTipContent,
  viewport: Rect,
): Phaser.GameObjects.Container {
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

  // Opens below the segment by default — every aspect chip/tile this panel anchors to sits near a screen's own
  // top (a quick-filter row, a rail), so "below" is almost always where the room is; flip above only when the
  // viewport genuinely doesn't have room below (e.g. the last visible row on a short viewport). Below also
  // steers clear of `ui/widgets.ts`'s one DOM element, `McTextInput` — a search field drawn just *above* the
  // aspect chips in `scenes/seats.ts` renders over the canvas regardless of Phaser depth, so a panel that opened
  // upward there got its own bottom rows clipped by that field.
  // `anchor` is the whole info segment, a full chip tall, so clearing its bottom keeps the panel off the chip.
  const clearBelow = anchor.y + anchor.height;
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
    // The panel floats near the segment (`drawAspectTipPanel`'s own placement above), which on a narrow chip row
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
  return container;
}
