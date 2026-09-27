/**
 * "What's on the table": the Board's ? button. A plain-English read of the table as it is right now
 * (`view/guide/table-help.ts`): where the round is, how this game is won and lost, you, the minions, your team, and
 * every keyword and status in play, with a door to the full Rules reference.
 *
 * Same panel shape as Pause, Rules and Settings (`view/overlay-layout.ts`). It reads the store itself, the way
 * every overlay over the Board does; it never reaches into the Board scene.
 */
import Phaser from "phaser";
import { POOL_DEPS } from "../content/pool.js";
import { appSession } from "../session.js";
import { ink, surface, typeRole } from "../tokens.js";
import { caseOf, textStyle } from "../ui/theme.js";
import { McButton } from "../ui/widgets.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { OverlayMotion } from "../ui/transitions.js";
import { boardModel } from "../view/board-model.js";
import { tableHelpOf, type TableHelpSection } from "../view/guide/table-help.js";
import { overlayPanelLayout } from "../view/overlay-layout.js";
import { rulesGlossaryOf } from "../view/rules-reference.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import type { Rect } from "../view/layout.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { RulesSceneData } from "./rules.js";

const HEADER_HEIGHT = 60;
const FOOTER_HEIGHT = 60;

export class TableHelpOverlay extends Phaser.Scene {
  #buttons: McButton[] = [];
  #region: McScrollRegion | null = null;
  #scroll = new VariableListScroll();
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();

  constructor() {
    super(SCENES.tableHelp);
  }

  create(): void {
    this.#motion = new OverlayMotion();
    this.#scroll = new VariableListScroll();
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.rules),
      onCancel: () => this.#close(),
      onPage: (direction) => this.#region?.scrollByPx(direction * 240),
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#region?.destroy();
      this.#region = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #openRules(): void {
    if (this.scene.isActive(SCENES.rules)) return;
    this.scene.launch(SCENES.rules, { initialTab: "glossary" } satisfies RulesSceneData);
  }

  #sections(): readonly TableHelpSection[] {
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return [];
    return tableHelpOf(boardModel(game, perspectiveId, POOL_DEPS), rulesGlossaryOf(game, POOL_DEPS));
  }

  #draw(): void {
    if (this.#motion.leaving) return;
    this.#region?.destroy();
    this.#region = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);

    const { width, height } = this.scale.gameSize;
    const { panel, header, body, footer } = overlayPanelLayout(
      { x: 0, y: 0, width, height },
      HEADER_HEIGHT,
      FOOTER_HEIGHT,
    );

    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.7).fillRect(0, 0, width, height);
    // A tap on the scrim closes, like every other panel; the panel itself swallows its own taps.
    scrim.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
    scrim.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      const inPanel =
        pointer.x >= panel.x && pointer.x <= panel.x + panel.width && pointer.y >= panel.y && pointer.y <= panel.y + panel.height;
      if (!inPanel) this.#close();
    });
    const panelsFrom = this.children.list.length;
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(panel.x, panel.y, panel.width, panel.height);
    g.lineStyle(4, surface.ink.hex, 1).strokeRect(panel.x, panel.y, panel.width, panel.height);
    g.fillStyle(surface.ink.hex, 1).fillRect(header.x, header.y, header.width, header.height);
    g.fillStyle(surface.ink.hex, 0.15).fillRect(footer.x, footer.y, footer.width, 2);

    const stops = new Map<string, FocusStop>();
    const closeRect: Rect = {
      x: header.x + header.width - 32 - 16,
      y: header.y + (header.height - 32) / 2,
      width: 32,
      height: 32,
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "onInk",
        label: "✕",
        type: typeRole.rowTitle,
        rect: closeRect,
        onClick: () => this.#close(),
      }),
    );
    stops.set("close", { rect: closeRect, activate: () => this.#close() });
    this.add
      .text(header.x + 16, header.y + header.height / 2, caseOf(typeRole.barTitle, "What's on the table"), {
        ...textStyle(typeRole.barTitle, surface.paper.hex),
        fontSize: "24px",
      })
      .setOrigin(0, 0.5);

    this.#drawSections(body);

    const rulesRect: Rect = { x: footer.x + footer.width - 16 - 200, y: footer.y + 14, width: 200, height: 34 };
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Full rules reference ▸",
        type: typeRole.label,
        rect: rulesRect,
        onClick: () => this.#openRules(),
      }),
    );
    stops.set("rules", { rect: rulesRect, activate: () => this.#openRules() });
    this.add
      .text(footer.x + 16, footer.y + footer.height / 2, "Hold or right-click any card to read it.", {
        ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      })
      .setOrigin(0, 0.5)
      .setWordWrapWidth(footer.width - 250);

    this.#route?.set(["rules", "close"], stops);
    this.#motion.enter(this, { scrim: [scrim], panels: this.children.list.slice(panelsFrom) });
  }

  #drawSections(body: Rect): void {
    const inset = 18;
    const textWidth = body.width - inset * 2 - 8;
    const x = body.x + inset;
    const objects: Phaser.GameObjects.Text[] = [];
    const heights: number[] = [];
    let y = body.y + 12;
    for (const section of this.#sections()) {
      const heading = this.add
        .text(x, y, caseOf(typeRole.sectionHeader, section.heading), textStyle(typeRole.sectionHeader, surface.ink.hex))
        .setWordWrapWidth(textWidth);
      objects.push(heading);
      heights.push(heading.height + 6);
      y += heading.height + 6;
      for (const line of section.lines) {
        const text = this.add
          .text(x, y, line, { ...textStyle(typeRole.body, surface.ink.hex), fontSize: "12px" })
          .setWordWrapWidth(textWidth)
          .setLineSpacing(3);
        objects.push(text);
        heights.push(text.height + 8);
        y += text.height + 8;
      }
      heights[heights.length - 1]! += 10;
      y += 10;
    }
    this.#region = new McScrollRegion(this, { rect: body, heights, scroll: this.#scroll });
    this.#region.content.add(objects);
  }
}
