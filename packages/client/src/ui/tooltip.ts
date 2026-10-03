/**
 * `McTooltip` (guided mode G3b, `docs/guided-mode.md` §4): the small ink panel a `McTermText` term
 * opens — the term's own display name in Bangers, its one-line definition, and a "RULES GLOSSARY ▸"
 * link that deep-links `SCENES.rules` at that term (`view/rules-reference.ts`'s `rulesGlossaryOf`/
 * `rulesGlossaryPoolOf` both search a query against an entry's own `displayName`, so `show`'s caller
 * passes that rather than the bare glossary id — the same choice `scenes/inspect.ts#openRulesAt`
 * already makes for its own keyword chips).
 *
 * One instance is meant to be shared by every `McTermText` block on a screen (there is only ever one
 * tooltip open at a time), matching `ui/coach-state.ts`'s "one coach card" shape: `show` replaces
 * whatever was open, `hide` closes it.
 *
 * **This widget owns hover-based closing itself**, rather than leaning on the anchoring term's own
 * `pointerout` (found the hard way, headlessly clicking "RULES GLOSSARY ▸": Phaser's `pointerover`/
 * `pointerout` aren't `topOnly`-gated the way `pointerdown`/`pointerup` are, so a term zone the open
 * tooltip visually *covers* — the flipped-below case, where the panel sits on top of the next line or
 * two of body text — still fires `pointerover` for whatever term happens to be under it. Closing on
 * the anchoring term's own `pointerout` (a mouse moving from the term down toward the link necessarily
 * leaves the term) reopened the tooltip somewhere else entirely before the pointer ever reached the
 * link. Tracked here instead: `show` starts a `pointermove` watch that only closes once the pointer is
 * outside *both* the panel (`#rect`) and the anchor's hold area (`view/tooltip-hover.ts`: the term's whole
 * touch-sized hit zone plus the gap up to the panel), so traveling from the term into the panel itself —
 * including onto the link — never closes it early, whichever direction the mouse came in from.
 *
 * **Escape.** This widget does not bind a keyboard listener of its own. Phaser 4 runs each scene's own
 * keyboard handlers in scene-start order, so a tooltip drawn inside a scene that isn't on top of the
 * stack could never out-race the scene above it for an Escape key the way a raw listener would assume
 * (`ui/coach-state.ts`'s own header, the "gotcha" `docs/guided-mode.md` §7 points at). Instead the host
 * scene calls `handleEscape()` from its own keyboard binding (`scenes/board/input.ts#bindKeyboard`'s
 * `IntentBinding`-style shape) before doing anything else with that key, exactly as `coachKeyFor` is
 * consulted for the coach overlay.
 */
import Phaser from "phaser";
import { border, ink, signal, surface, typeRole } from "../tokens.js";
import type { TermTooltipContent } from "../view/term-text-model.js";
import type { Rect } from "../view/layout.js";
import { tooltipHoldRects } from "../view/tooltip-hover.js";
import { textStyle } from "./theme.js";

const PANEL_WIDTH = 280;
const PAD = 12;
const GAP_FROM_ANCHOR = 10;
const ARROW_SIZE = 8;
const BOTTOM_RULE_HEIGHT = 3;

export class McTooltip {
  readonly #scene: Phaser.Scene;
  readonly #container: Phaser.GameObjects.Container;
  readonly #panel: Phaser.GameObjects.Graphics;
  readonly #title: Phaser.GameObjects.Text;
  readonly #definition: Phaser.GameObjects.Text;
  readonly #link: Phaser.GameObjects.Text;
  readonly #linkZone: Phaser.GameObjects.Zone;
  readonly #outsidePointerDown: (pointer: Phaser.Input.Pointer) => void;
  readonly #trackPointer: (pointer: Phaser.Input.Pointer) => void;
  #open = false;
  #rect: Rect = { x: 0, y: 0, width: PANEL_WIDTH, height: 0 };
  #anchor: Rect = { x: 0, y: 0, width: 0, height: 0 };
  #onClose: (() => void) | null = null;

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    this.#panel = scene.add.graphics();
    this.#title = scene.add.text(0, 0, "", textStyle(typeRole.sectionHeader, surface.paper.hex)).setFontSize(16);
    this.#definition = scene.add.text(0, 0, "", {
      ...textStyle({ ...typeRole.body, size: 13 }, surface.paper.hex, ink.secondary),
      wordWrap: { width: PANEL_WIDTH - PAD * 2, useAdvancedWrap: true },
    });
    this.#link = scene.add.text(0, 0, "RULES GLOSSARY ▸", textStyle(typeRole.label, signal.caution.hex));
    this.#linkZone = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.#container = scene.add
      .container(0, 0, [this.#panel, this.#title, this.#definition, this.#link, this.#linkZone])
      .setVisible(false)
      .setDepth(1000);

    const inside = (pointer: Phaser.Input.Pointer, rect: Rect): boolean =>
      pointer.x >= rect.x &&
      pointer.x <= rect.x + rect.width &&
      pointer.y >= rect.y &&
      pointer.y <= rect.y + rect.height;

    this.#outsidePointerDown = (pointer) => {
      if (!this.#open) return;
      if (inside(pointer, this.#rect) || inside(pointer, this.#anchor)) return;
      this.hide();
    };
    scene.input.on("pointerdown", this.#outsidePointerDown);

    // Hover-based close (desktop only — a touch tap toggles via the term's own zone instead, see the
    // module header): only once the pointer is outside both the panel and the anchoring term.
    this.#trackPointer = (pointer) => {
      if (!this.#open || pointer.wasTouch) return;
      if (inside(pointer, this.#rect) || tooltipHoldRects(this.#anchor, this.#rect).some((r) => inside(pointer, r))) {
        return;
      }
      this.hide();
    };
    scene.input.on("pointermove", this.#trackPointer);
  }

  get isOpen(): boolean {
    return this.#open;
  }

  /** The "RULES GLOSSARY ▸" link's own on-screen rect, while open — a headless click-through's only way to find it (`scenes/term-text-demo.ts`'s dev-only hook; canvas-drawn, so there's no DOM selector for it). */
  get linkRect(): Rect | null {
    return this.#open
      ? { x: this.#linkZone.x, y: this.#linkZone.y, width: this.#linkZone.width, height: this.#linkZone.height }
      : null;
  }

  /**
   * Opens the tooltip anchored at `anchor` (a term's own on-screen rect, in this scene's coordinates),
   * flipping above/below and clamping horizontally so the whole panel stays inside `viewport`.
   * `onOpenGlossary` is what "RULES GLOSSARY ▸" does — the caller owns the actual scene launch.
   * `onClose`, if given, runs once whenever this tooltip next closes for *any* reason (hover-out,
   * outside click/tap, Escape, or opening a different term) — a host coordinating several `McTermText`
   * blocks that shared this tooltip uses it to undo whatever it disabled while this one was open.
   */
  show(
    anchor: Rect,
    content: TermTooltipContent,
    viewport: Rect,
    onOpenGlossary: () => void,
    onClose?: () => void,
  ): void {
    if (this.#open) this.#fireClose();
    this.#anchor = anchor;
    this.#onClose = onClose ?? null;
    this.#title.setText(content.title);
    this.#definition.setText(`${content.definition} (${content.citeLabel})`);
    this.#definition.setWordWrapWidth(PANEL_WIDTH - PAD * 2, true);

    const contentHeight =
      PAD + this.#title.height + 6 + this.#definition.height + 8 + this.#link.height + PAD + BOTTOM_RULE_HEIGHT;
    const anchorCenterX = anchor.x + anchor.width / 2;
    let panelX = anchorCenterX - PANEL_WIDTH / 2;
    panelX = Math.max(viewport.x + 4, Math.min(panelX, viewport.x + viewport.width - PANEL_WIDTH - 4));

    const spaceAbove = anchor.y - viewport.y;
    const flipBelow = spaceAbove < contentHeight + GAP_FROM_ANCHOR + ARROW_SIZE;
    const panelY = flipBelow
      ? anchor.y + anchor.height + GAP_FROM_ANCHOR + ARROW_SIZE
      : anchor.y - GAP_FROM_ANCHOR - ARROW_SIZE - contentHeight;

    this.#rect = { x: panelX, y: panelY, width: PANEL_WIDTH, height: contentHeight };
    this.#draw(this.#rect, anchorCenterX, flipBelow);

    this.#title.setPosition(panelX + PAD, panelY + PAD);
    this.#definition.setPosition(panelX + PAD, panelY + PAD + this.#title.height + 6);
    this.#link.setPosition(panelX + PAD, panelY + PAD + this.#title.height + 6 + this.#definition.height + 8);
    const linkZoneHeight = Math.max(this.#link.height, 20);
    this.#linkZone.setPosition(this.#link.x, this.#link.y).setSize(this.#link.width, linkZoneHeight);
    // `setSize`'s own default already resizes a Rectangle hit area to match (Phaser's `Zone#setSize`), but this is
    // explicit anyway: a future hit-area shape change here shouldn't silently start relying on that default.
    this.#linkZone.input?.hitArea.setSize(this.#link.width, linkZoneHeight);

    this.#linkZone.removeAllListeners();
    this.#linkZone.on("pointerup", () => {
      onOpenGlossary();
      this.hide();
    });

    this.#container.setVisible(true);
    this.#scene.children.bringToTop(this.#container);
    this.#open = true;
  }

  #draw(rect: Rect, anchorCenterX: number, flipBelow: boolean): void {
    const g = this.#panel;
    g.clear();
    g.fillStyle(surface.ink.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.fillStyle(signal.caution.hex, 1).fillRect(
      rect.x,
      rect.y + rect.height - BOTTOM_RULE_HEIGHT,
      rect.width,
      BOTTOM_RULE_HEIGHT,
    );
    g.lineStyle(border.detail, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);

    // The arrow points at the anchor's own center, clamped so its tip never draws outside the panel it's attached to.
    const tipX = Math.max(rect.x + ARROW_SIZE, Math.min(anchorCenterX, rect.x + rect.width - ARROW_SIZE));
    g.fillStyle(surface.ink.hex, 1);
    if (flipBelow) {
      g.fillTriangle(tipX - ARROW_SIZE, rect.y, tipX + ARROW_SIZE, rect.y, tipX, rect.y - ARROW_SIZE);
    } else {
      const by = rect.y + rect.height;
      g.fillTriangle(tipX - ARROW_SIZE, by, tipX + ARROW_SIZE, by, tipX, by + ARROW_SIZE);
    }
  }

  hide(): void {
    if (!this.#open) return;
    this.#open = false;
    this.#container.setVisible(false);
    this.#fireClose();
  }

  #fireClose(): void {
    const onClose = this.#onClose;
    this.#onClose = null;
    onClose?.();
  }

  /** The host scene's own Escape handling: closes the tooltip and reports whether it took the key. */
  handleEscape(): boolean {
    if (!this.#open) return false;
    this.hide();
    return true;
  }

  destroy(): void {
    this.#scene.input.off("pointerdown", this.#outsidePointerDown);
    this.#scene.input.off("pointermove", this.#trackPointer);
    this.#container.destroy(true);
  }
}
