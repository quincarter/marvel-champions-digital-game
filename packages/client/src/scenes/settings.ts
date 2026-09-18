/**
 * Settings (docs/phase4-screen-gaps.md §3 "W4"; design canvases D13, P16, L07).
 *
 * **Composition (fidelity pass, 2026-09-17).** The canvases never draw Settings
 * as its own full screen — D13/P16/L07 show its rows inline, under a "TABLE"
 * heading, inside Pause (`scenes/pause.ts` now draws that same group directly).
 * This overlay is the *standalone* door to the identical rows for a caller with
 * no paused game to attach them to (Title, once W2 lands its entry) — same ink
 * title bar with a boxed ✕, same row shape (title, one-line detail, a toggle
 * on the right) as Pause's own "Table" column, both built from one shared,
 * tested row list (`view/settings-rows.ts`) so the wording can never drift
 * between the two places it's drawn.
 *
 * **Entry point.** `scene.launch(SCENES.settings)` from whatever scene wants it
 * — Pause still offers it too, alongside its own inline Table group, as a way to
 * reach the same rows full-screen. Title's own rewrite (W2, a parallel worktree)
 * should launch it the same way. `#back`/the ✕ always just `this.scene.stop()`s
 * this overlay, so it returns to whichever scene launched it without needing to
 * know or care which.
 *
 * Every setting here is a client-only presentation preference
 * (`settings.ts`'s own doc comment: "nothing here reaches the engine"), read
 * live off `appSession().settings` by whatever draws with it — this scene only
 * flips fields on that one shared object, it never re-implements what reading
 * them does.
 */
import Phaser from "phaser";
import { setTextResolution } from "../ui/theme.js";
import { nextSettingsAfterToggle, settingsRowInfoOf, type SettingsRowInfo } from "../view/settings-rows.js";
import { ink, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton, label } from "../ui/widgets.js";
import { settingsLayout } from "../view/settings-layout.js";
import { settingsFocusOrder } from "../view/screen-focus.js";
import type { Rect } from "../view/layout.js";
import { appSession } from "../session.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

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

  #toggle(row: SettingsRowInfo): void {
    if (row.id === "sound") return; // Drawn unavailable; nothing to toggle.
    const { settings } = appSession();
    const next = nextSettingsAfterToggle(settings, row.id, globalThis.devicePixelRatio || 1);
    if (row.id === "sharper-text") setTextResolution(next.textResolution);
    appSession().settings = next;
    this.#draw();
  }

  #draw(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const rows = settingsRowInfoOf(appSession().settings);
    const layout = settingsLayout(
      { x: 0, y: 0, width, height },
      rows.map((row) => row.unavailable ?? row.detail),
    );

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    const panel = this.add.graphics();
    panel.fillStyle(surface.ink.hex, 1).fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    panel.lineStyle(4, surface.paper.hex, 1).strokeRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);
    const rule = this.add.graphics();
    rule.fillStyle(surface.paper.hex, 0.4).fillRect(layout.header.x, layout.header.y + layout.header.height - 2, layout.header.width, 2);

    const stops = new Map<string, FocusStop>();
    const closeSize = 32;
    const closeRect: Rect = { x: layout.header.x + layout.header.width - closeSize - 16, y: layout.header.y + (layout.header.height - closeSize) / 2, width: closeSize, height: closeSize };
    this.#buttons.push(new McButton(this, { kind: "secondary", label: "✕", type: typeRole.rowTitle, rect: closeRect, onClick: () => this.scene.stop() }));
    stops.set("back", { rect: closeRect, activate: () => this.scene.stop() });
    this.add.text(layout.header.x + 16, layout.header.y + layout.header.height / 2, caseOf(typeRole.barTitle, "Settings"), { ...textStyle(typeRole.barTitle, surface.paper.hex), fontSize: "24px" }).setOrigin(0, 0.5);

    label(this, layout.tableHeading.x, layout.tableHeading.y, "Table", typeRole.label, surface.paper.hex, ink.secondary);
    rows.forEach((row, index) => this.#drawRow(layout.rows[index]!, row, stops));

    this.#route?.set(settingsFocusOrder(rows.map((row) => row.id)), stops);
  }

  #drawRow(rect: Rect, row: SettingsRowInfo, stops: Map<string, FocusStop>): void {
    label(this, rect.x, rect.y + 2, row.title, typeRole.label, surface.paper.hex, ink.secondary).setFontSize(12);
    this.add
      .text(rect.x, rect.y + 20, row.unavailable ?? row.detail, textStyle(typeRole.body, surface.paper.hex, row.unavailable ? 0.55 : 0.8))
      .setFontSize(10)
      .setWordWrapWidth(rect.width - 100);

    const toggleRect: Rect = { x: rect.x + rect.width - 84, y: rect.y + (rect.height - 32) / 2, width: 84, height: 32 };
    const activate = (): void => this.#toggle(row);
    this.#buttons.push(
      new McButton(this, {
        kind: row.on ? "secondary" : "quiet",
        label: row.unavailable ? "—" : row.on ? "ON" : "OFF",
        type: typeRole.label,
        rect: toggleRect,
        enabled: row.unavailable === undefined,
        ...(row.unavailable ? { reason: row.unavailable } : {}),
        selected: row.on,
        onClick: activate,
      }),
    );
    stops.set(`row:${row.id}`, { rect, activate });
  }
}
