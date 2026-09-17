/**
 * Settings (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13, P16, L07).
 *
 * **Entry point.** `scene.launch(SCENES.settings)` from whatever scene wants it
 * — Pause launches it this way already (`scenes/pause.ts`). Title's own rewrite
 * (W2, a parallel worktree) should do the same from its menu: this file and
 * `SCENES.settings` are registered and ready; nothing in `scenes/title.ts`
 * needed to change for that. `#back` always just `this.scene.stop()`s this
 * overlay, so it returns to whichever scene launched it — Board-under-Pause or
 * Title, without this scene needing to know or care which.
 *
 * Every setting here is a client-only presentation preference
 * (`settings.ts`'s own doc comment: "nothing here reaches the engine"), read
 * live off `appSession().settings` by whatever draws with it — this scene only
 * flips fields on that one shared object, it never re-implements what reading
 * them does.
 */
import Phaser from "phaser";
import { SHARP_TEXT_RESOLUTION_CEILING } from "../settings.js";
import { ink, surface, typeRole } from "../tokens.js";
import { caseOf, setTextResolution, textStyle } from "../ui/theme.js";
import { McButton, label } from "../ui/widgets.js";
import { settingsLayout } from "../view/settings-layout.js";
import { settingsFocusOrder } from "../view/screen-focus.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

interface ToggleRow {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
  readonly unavailable?: string;
  readonly toggle: () => void;
}

export class SettingsOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.settings);
  }

  create(): void {
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, { onCancel: () => this.scene.stop() });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #rows(): readonly ToggleRow[] {
    const { settings } = appSession();
    const sharpResolution = Math.min(SHARP_TEXT_RESOLUTION_CEILING, Math.max(1, globalThis.devicePixelRatio || 1));
    return [
      {
        id: "reduced-motion",
        title: "Reduced motion",
        detail: "Skip travel animation and auto-advancing reveals; beats and state changes still appear, just without the motion.",
        on: settings.reducedMotion,
        toggle: () => {
          appSession().settings = { ...settings, reducedMotion: !settings.reducedMotion };
          this.#draw();
        },
      },
      {
        id: "sharper-text",
        title: "Sharper text",
        detail: "Renders text at the screen's own pixel density. Off trades a little crispness for less texture memory.",
        on: settings.textResolution > 1,
        toggle: () => {
          const next = settings.textResolution > 1 ? 1 : sharpResolution;
          setTextResolution(next);
          appSession().settings = { ...settings, textResolution: next };
          this.#draw();
        },
      },
      {
        id: "large-card-text",
        title: "Large card text",
        detail: "Reads a card's full rules text larger in the Inspect sheet — the screen whose whole job is reading a card closely.",
        on: settings.largeCardText,
        toggle: () => {
          appSession().settings = { ...settings, largeCardText: !settings.largeCardText };
          this.#draw();
        },
      },
      {
        id: "sound",
        title: "Sound",
        detail: "Not built yet.",
        on: false,
        unavailable: "Sound isn't built yet (PLAN.md Phase 8).",
        toggle: () => undefined,
      },
    ];
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const rows = this.#rows();
    const layout = settingsLayout({ x: 0, y: 0, width, height }, rows.length);

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.55).fillRect(0, 0, width, height);
    const panel = this.add.graphics();
    panel.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel.lineStyle(4, surface.paper.hex, 1).strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

    const stops = new Map<string, FocusStop>();
    const backRect: Rect = { x: layout.header.x + 12, y: layout.header.y + 10, width: 90, height: 32 };
    this.#buttons.push(new McButton(this, { kind: "quiet", label: "◂ Back", type: typeRole.label, rect: backRect, onClick: () => this.scene.stop() }));
    stops.set("back", { rect: backRect, activate: () => this.scene.stop() });
    this.add.text(backRect.x + backRect.width + 12, layout.header.y + 12, caseOf(typeRole.barTitle, "Settings"), { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "22px" });

    rows.forEach((row, index) => this.#drawRow(layout.rows[index]!, row, stops));

    this.#route?.set(settingsFocusOrder(rows.map((row) => row.id)), stops);
  }

  #drawRow(rect: Rect, row: ToggleRow, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, row.unavailable ?? row.detail, textStyle(typeRole.body, surface.paper.hex, row.unavailable ? 0.55 : 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);

    const toggleRect: Rect = { x: rect.x + rect.width - 84, y: rect.y, width: 84, height: 32 };
    this.#buttons.push(
      new McButton(this, {
        kind: row.on ? "secondary" : "quiet",
        label: row.unavailable ? "—" : row.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: toggleRect,
        enabled: row.unavailable === undefined,
        ...(row.unavailable ? { reason: row.unavailable } : {}),
        selected: row.on,
        onClick: row.toggle,
      }),
    );
    stops.set(`row:${row.id}`, { rect, activate: row.toggle });
  }
}
