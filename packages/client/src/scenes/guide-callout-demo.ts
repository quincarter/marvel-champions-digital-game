/**
 * Dev-only screenshot/click-through entry point for `McGuideCallout` (guided mode G4a,
 * `docs/guided-mode.md` §4), reached with `?screen=guidecallout` (`scenes/boot.ts`'s dev-jump list) —
 * there is no in-game way to reach this screen. It exists so the callout can be exercised by hand and by
 * a headless click-through before any real guide surface (G5c) wires it to a lesson.
 *
 * A fake anchor box is drawn over a plain board-colored ground, placeable at the top, middle or bottom of
 * the viewport with the 1/2/3 keys (or the on-screen chips) — enough to check the callout below an
 * anchor, above one, and the flip near an edge, matching P03 (below, `SKIP LESSON`) and P04 (above, close
 * ×) from `artifacts/design-screenshots/individual/guided-phone.dc/`. The `[[threat]]` term in the P03
 * copy exercises the shared tooltip.
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McGuideCallout, type McGuideCalloutContent } from "../ui/guide-callout.js";
import type { Rect } from "../view/layout.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

type AnchorPlacement = "top" | "middle" | "bottom" | "none";

const P03_CONTENT: McGuideCalloutContent = {
  stepLabel: "Step 1 of 3",
  title: "This is Crossbones' plan",
  body: "Every villain phase he adds [[threat]] to it. If it reaches 12, you lose — no matter how hurt he is. You're at 4, so you have time.",
  skipLabel: "Skip lesson",
  secondaryLabel: "How do I stop it?",
  primaryLabel: "Got it ▸",
  preferredSide: "below",
};

const P04_CONTENT: McGuideCalloutContent = {
  stepLabel: "Step 2 of 4",
  title: "Pay with other cards",
  body: "Venom Blast costs 2. Discard cards from your hand to pay — each one gives the [[resource|resources]] printed at its bottom. Tap Energy: it's worth 2 by itself.",
  showClose: true,
  preferredSide: "above",
  continueHint: "Tap a card to spend it",
};

const CONTINUE_HINT_CONTENT: McGuideCalloutContent = {
  stepLabel: "Step 3 of 5",
  title: "Flip to alter-ego to continue",
  body: "You're done acting this turn. [[flip|Flip]] back to Peter Parker to end your turn.",
  preferredSide: "below",
};

export class GuideCalloutDemoScene extends Phaser.Scene {
  #callout!: McGuideCallout;
  #anchorGraphics!: Phaser.GameObjects.Graphics;
  #placement: AnchorPlacement = "top";
  #contentIndex = 0;
  readonly #contents: readonly McGuideCalloutContent[] = [P03_CONTENT, P04_CONTENT, CONTINUE_HINT_CONTENT];
  #chips: Phaser.GameObjects.Text[] = [];
  #status!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.guideCalloutDemo);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(surface.parchment.css);
    this.add.text(24, 12, "MCGUIDECALLOUT DEV DEMO", textStyle(typeRole.label, surface.ink.hex));
    this.add.text(
      24,
      28,
      "1/2/3/0: anchor top/middle/bottom/none  ·  a/b/c: P03/P04/continue-hint copy  ·  Tab: focus  ·  Enter: primary  ·  Esc: close",
      { ...textStyle(typeRole.mono, surface.ink.hex, 0.6), fontSize: "10px" },
    );

    this.#anchorGraphics = this.add.graphics();
    this.#status = this.add.text(24, this.scale.height - 24, "", textStyle(typeRole.mono, surface.ink.hex, 0.7));

    this.#callout = new McGuideCallout(this, {
      onPrimary: () => this.#log("primary"),
      onSecondary: () => this.#log("secondary"),
      onSkip: () => this.#log("skip"),
      onClose: () => this.#log("close"),
      onOpenGlossary: (query) => {
        this.scene.launch(SCENES.rules, { initialTab: "glossary", initialQuery: query } satisfies RulesSceneData);
      },
    });

    this.#drawChips();
    this.#redraw();

    // Headless click-through hook only (never referenced by product code): canvas-drawn widgets have no
    // DOM selector, so a test driving real pointer events reads their rects from here (`scenes/term-text-demo.ts`'s
    // own `__mcTermTextDebug` is the pattern this follows).
    if (import.meta.env.DEV) {
      (window as unknown as { __mcGuideCalloutDebug?: unknown }).__mcGuideCalloutDebug = {
        setPlacement: (placement: AnchorPlacement) => {
          this.#placement = placement;
          this.#redraw();
        },
        setContentIndex: (index: number) => {
          this.#contentIndex = index;
          this.#redraw();
        },
        debugRects: () => this.#callout.debugRects(),
        debugTermRects: () => this.#callout.debugTermRects(),
      };
    }

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (this.#callout.handleEscape()) event.preventDefault();
        return;
      }
      if (event.key === "1") this.#setPlacement("top");
      else if (event.key === "2") this.#setPlacement("middle");
      else if (event.key === "3") this.#setPlacement("bottom");
      else if (event.key === "0") this.#setPlacement("none");
      else if (event.key === "a") this.#setContent(0);
      else if (event.key === "b") this.#setContent(1);
      else if (event.key === "c") this.#setContent(2);
      else if (event.key === "Tab") {
        event.preventDefault();
        this.#callout.focusNext(event.shiftKey ? -1 : 1);
      } else if (event.key === "Enter") {
        this.#callout.activatePrimary();
      } else if (event.key === " ") {
        this.#callout.activateFocused();
      }
    });

    this.scale.on("resize", () => this.#redraw());
  }

  #setPlacement(placement: AnchorPlacement): void {
    this.#placement = placement;
    this.#redraw();
  }

  #setContent(index: number): void {
    this.#contentIndex = index;
    this.#redraw();
  }

  #anchorRect(): Rect | null {
    const width = this.scale.width;
    const height = this.scale.height;
    if (this.#placement === "none") return null;
    const w = Math.min(320, width - 32);
    const x = (width - w) / 2;
    if (this.#placement === "top") return { x, y: 90, width: w, height: 70 };
    if (this.#placement === "middle") return { x, y: height / 2 - 35, width: w, height: 70 };
    return { x, y: height - 130, width: w, height: 70 };
  }

  #redraw(): void {
    const viewport: Rect = { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    const anchor = this.#anchorRect();
    this.#anchorGraphics.clear();
    if (anchor) {
      this.#anchorGraphics
        .fillStyle(surface.card.hex, 1)
        .fillRect(anchor.x, anchor.y, anchor.width, anchor.height)
        .lineStyle(2, surface.ink.hex, 1)
        .strokeRect(anchor.x, anchor.y, anchor.width, anchor.height);
    }
    this.#callout.update(this.#contents[this.#contentIndex]!, anchor, viewport);
  }

  #drawChips(): void {
    const labels = ["top", "middle", "bottom", "none"];
    labels.forEach((text, i) => {
      const chip = this.add
        .text(24 + i * 70, 44, text, textStyle(typeRole.label, surface.ink.hex, 0.7))
        .setInteractive({ useHandCursor: true });
      chip.on("pointerup", () => this.#setPlacement(text as AnchorPlacement));
      this.#chips.push(chip);
    });
  }

  #log(action: string): void {
    this.#status.setText(`last action: ${action}`).setPosition(24, this.scale.height - 24);
  }
}
