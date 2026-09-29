/**
 * Dev-only screenshot/click-through entry point for `McGuidePanel` (guided mode G4b,
 * `docs/guided-mode.md` §4), reached with `?screen=guidepanel` (`scenes/boot.ts`'s dev-jump list) —
 * there is no in-game way to reach this screen yet (G5c mounts it on the Board). Mirrors
 * `scenes/guide-callout-demo.ts`'s own shape: a board-coloured area stands in for the table so the rail's
 * own contrast against it is checkable, and number keys switch between the three tile-shaped contents.
 */
import Phaser from "phaser";
import { surface, typeRole } from "../tokens.js";
import { textStyle } from "../ui/theme.js";
import { McGuidePanel, type McGuidePanelContent } from "../ui/guide-panel.js";
import { guideRailWidthFor } from "../view/guide-panel-model.js";
import { boardLayout, formFactorFor, type Rect } from "../view/layout.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

/** D01: lesson list open, a tip box, a dashed "do this to continue" slot. */
const D01_CONTENT: McGuidePanelContent = {
  contextLabel: "First game",
  lessons: [
    { id: "how-to-win", label: "How to win", status: "done" },
    { id: "threat-thwarting", label: "Threat & thwarting", status: "current", progress: "2 / 3" },
    { id: "paying-for-cards", label: "Paying for cards", status: "upcoming" },
    { id: "villain-phase", label: "The villain phase", status: "upcoming" },
    { id: "hero-alter-ego", label: "Hero vs alter-ego", status: "upcoming" },
  ],
  title: "Knock threat off with thwart",
  body: "Your hero's THW stat is how much [[threat]] you remove. Spider-Woman has 1 — [[thwart|thwarting]] now takes the plan from 4 down to 3. Thwarting uses your hero's action for the turn, just like attacking. Pick one.",
  tip: "A good habit: if threat is more than halfway, thwart. Otherwise, attack.",
  backLabel: "Back",
  continueHint: "Click Thwart to continue",
};

/** T02: no lesson list, a resource-icon legend as the extra block, a progress tick row. */
const T02_CONTENT: McGuidePanelContent = {
  contextLabel: "Lesson 3 of 5",
  stepLabel: "Step 2 of 4",
  title: "Pay with other cards",
  body: "Venom Blast costs 2. Discard cards from your hand to pay — each one gives the [[resource|resources]] printed at its bottom. Tap Energy — it's worth 2 by itself.",
  extraHeading: "Resource icons",
  extra: [
    { label: "Energy", swatch: 0x1f5fa8 },
    { label: "Mental", swatch: 0x1f7a4c },
    { label: "Physical", swatch: 0xc4302b },
    { label: "Wild — counts as any", swatch: 0xf4efe3 },
  ],
  progressTicks: 4,
  progressCurrent: 1,
  backLabel: "Back",
  continueHint: "Tap Energy to continue",
};

/** D02: no lesson list, the villain-phase 3-step list as the extra block, no tip. */
const D02_CONTENT: McGuidePanelContent = {
  contextLabel: "Lesson 4 of 5",
  title: "Now it's his turn",
  body: "After you end your turn, the villain always does the same three things, in order. You'll make one choice: who takes his hit.",
  extra: [
    { label: "Plan advances · 4 → 6", done: true },
    { label: "He attacks you", current: true },
    { label: "Encounter card" },
  ],
  backLabel: null,
  continueHint: "Hover any dotted word for its rule",
};

type ContentKey = "d01" | "t02" | "d02";
const CONTENTS: Record<ContentKey, McGuidePanelContent> = { d01: D01_CONTENT, t02: T02_CONTENT, d02: D02_CONTENT };

export class GuidePanelDemoScene extends Phaser.Scene {
  #panel!: McGuidePanel;
  #boardGraphics!: Phaser.GameObjects.Graphics;
  #contentKey: ContentKey = "d01";
  #status!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENES.guidePanelDemo);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(surface.void.css);
    this.add.text(24, 12, "MCGUIDEPANEL DEV DEMO", textStyle(typeRole.label, surface.paper.hex));
    this.add.text(
      24,
      28,
      "1/2/3: D01/T02/D02 content  ·  c: collapse/expand  ·  Tab: focus  ·  Enter: primary  ·  Esc: skip",
      { ...textStyle(typeRole.mono, surface.paper.hex, 0.6), fontSize: "10px" },
    );

    this.#boardGraphics = this.add.graphics();
    this.#status = this.add.text(24, this.scale.height - 24, "", textStyle(typeRole.mono, surface.paper.hex, 0.7));

    this.#panel = new McGuidePanel(this, {
      side: "left",
      onBack: () => this.#log("back"),
      onPrimary: () => this.#log("primary"),
      onSkip: () => this.#log("skip"),
      onCollapse: () => this.#log("collapse"),
      onExpand: () => this.#log("expand"),
      onLessonSelect: (id) => this.#log(`lesson:${id}`),
      onOpenGlossary: (query) => {
        this.scene.launch(SCENES.rules, { initialTab: "glossary", initialQuery: query } satisfies RulesSceneData);
      },
    });

    this.#redraw();

    // Headless click-through hook only (never referenced by product code) — mirrors
    // `scenes/guide-callout-demo.ts`'s own `__mcGuideCalloutDebug`.
    if (import.meta.env.DEV) {
      (window as unknown as { __mcGuidePanelDebug?: unknown }).__mcGuidePanelDebug = {
        setContent: (key: ContentKey) => {
          this.#contentKey = key;
          this.#redraw();
        },
        toggleCollapse: () => {
          if (this.#panel.collapsed) this.#panel.expand();
          else this.#panel.collapse();
        },
        debugRects: () => this.#panel.debugRects(),
        debugTermRects: () => this.#panel.debugTermRects(),
        isCollapsed: () => this.#panel.collapsed,
      };
    }

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (this.#panel.handleEscape()) event.preventDefault();
        return;
      }
      if (event.key === "1") this.#setContent("d01");
      else if (event.key === "2") this.#setContent("t02");
      else if (event.key === "3") this.#setContent("d02");
      else if (event.key === "c") {
        if (this.#panel.collapsed) this.#panel.expand();
        else this.#panel.collapse();
      } else if (event.key === "Tab") {
        event.preventDefault();
        this.#panel.focusNext(event.shiftKey ? -1 : 1);
      } else if (event.key === "Enter") {
        this.#panel.activatePrimary();
      } else if (event.key === " ") {
        this.#panel.activateFocused();
      }
    });

    this.scale.on("resize", () => this.#redraw());
  }

  #setContent(key: ContentKey): void {
    this.#contentKey = key;
    this.#redraw();
  }

  #redraw(): void {
    const viewport: Rect = { x: 0, y: 0, width: this.scale.width, height: this.scale.height };
    const formFactor = formFactorFor(viewport.width, viewport.height);
    const railWidth = guideRailWidthFor(viewport.width, formFactor);
    const layout = boardLayout(viewport, { playerCount: 1, guideRail: { side: "left", width: railWidth } });

    this.#boardGraphics.clear();
    this.#boardGraphics
      .fillStyle(0x3a362f, 1)
      .fillRect(
        layout.zones.chrome!.x,
        layout.zones.chrome!.y + layout.zones.chrome!.height,
        viewport.width,
        viewport.height - layout.zones.chrome!.height,
      );
    this.#boardGraphics
      .fillStyle(0x1a1712, 1)
      .fillRect(
        layout.zones.chrome!.x,
        layout.zones.chrome!.y,
        layout.zones.chrome!.width,
        layout.zones.chrome!.height,
      );

    const railRect: Rect = {
      x: viewport.x,
      y: layout.zones.chrome!.y + layout.zones.chrome!.height,
      width: railWidth,
      height: viewport.height - layout.zones.chrome!.height,
    };
    this.#panel.update(CONTENTS[this.#contentKey], railRect);
  }

  #log(action: string): void {
    this.#status.setText(`last action: ${action}`).setPosition(24, this.scale.height - 24);
  }
}
