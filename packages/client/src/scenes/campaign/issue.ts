/**
 * C07b — Issue detail: one finished node's attempts and everything the winning attempt wrote to the log.
 *
 * Wide (Campaign - Desktop #09): the villain in colour with a WON stamp and a recap caption on the left, a paper
 * panel on the right with the ATTEMPTS and WROTE TO THE LOG lists, a prev/next switcher and REREAD at the bottom.
 * Phone composition stacks the same pieces.
 *
 * All data from `campaignIssueModel` (`view/campaign-issue-model.ts`).
 */
import Phaser from "phaser";
import { CARDS_BY_ID } from "../../content/pool.js";
import { storyFor } from "../../campaign/story.js";
import { campaignService } from "../../session.js";
import { accent, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import {
  bangers,
  campaignFrame,
  drawActionBar,
  drawPicture,
  drawTopBar,
  ruleHeading,
  stamp,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { McButton } from "../../ui/widgets.js";
import { McVariableList } from "../../ui/variable-list.js";
import type { VirtualListRow } from "../../ui/virtual-list.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignIssueModel, type CampaignIssueModel } from "../../view/campaign-issue-model.js";
import { logWriteRowHeight, type Rect } from "../../view/layout.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignIssueData } from "./routes.js";

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;

export class CampaignIssueScene extends Phaser.Scene {
  #data: CampaignIssueData | null = null;
  #model: CampaignIssueModel | null = null;
  #campaignId = "";
  #status = "";
  #route: FocusRoute | null = null;
  #buttons: McButton[] = [];
  #writesList: McVariableList | null = null;
  #writesScroll = new VariableListScroll();

  constructor() {
    super(SCENES.campaignIssue);
  }

  create(data: CampaignIssueData): void {
    this.#data = data;
    this.#model = null;
    this.#status = "";
    this.#writesScroll.reset();
    this.#route = new FocusRoute(this, { onCancel: () => this.#back() });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      this.#writesList?.destroy();
      this.#writesList = null;
    });
    void this.#load(data);
    this.#draw();
    fadeScreenIn(this);
  }

  async #load(data: CampaignIssueData): Promise<void> {
    const service = campaignService();
    const record = await service.load(data.runId);
    if (!record || !this.sys.isActive()) {
      this.#status = record ? "" : "this run could not be found";
      this.#draw();
      return;
    }
    const definition = service.definitionFor(record);
    this.#campaignId = record.campaignId as string;
    this.#model = campaignIssueModel(record, definition, storyFor(this.#campaignId), data.nodeId, cardName);
    if (!this.#model) this.#status = "this issue hasn't been played yet";
    this.#draw();
  }

  #back(): void {
    if (!this.#data) return;
    goToScreen(this, SCENES.campaignRun, { runId: this.#data.runId });
  }

  #openNode(nodeId: string): void {
    if (!this.#data) return;
    goToScreen(this, SCENES.campaignIssue, { runId: this.#data.runId, nodeId });
  }

  #draw(): void {
    // Destroyed before `destroyChildren` (not swept by it): `McVariableList` also owns a scene-level wheel
    // listener (`ui/variable-list.ts`), which only its own `destroy()` removes.
    this.#writesList?.destroy();
    this.#writesList = null;
    destroyChildren(this);
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    const frame = campaignFrame(this);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));

    const model = this.#model;
    const stops = new Map<string, FocusStop>();
    const order: string[] = [];

    const top = drawTopBar(this, {
      backLabel: "◂ The run",
      onBack: () => this.#back(),
      title: model ? `Issue #${model.number}` : "Issue",
      right: model ? "FINISHED" : "",
    });
    if (top.back && top.backRect) {
      stops.set("back", { rect: top.backRect, activate: () => this.#back() });
      order.push("back");
    }

    if (!model) {
      this.add
        .text(frame.width / 2, frame.height / 2, this.#status || "Loading…", textStyle(typeRole.body, surface.ink.hex))
        .setOrigin(0.5);
      this.#route?.set(order, stops);
      return;
    }

    const bar = drawActionBar(this);
    if (frame.phone) this.#drawPhone(model, frame, top.height, bar.y);
    else this.#drawWide(model, frame, top.height, bar.y);

    // Bottom bar: the prev/next switcher and REREAD.
    const pad = frame.gutter;
    const switcherWidth = frame.phone ? 140 : 180;
    const switcherRect: Rect = { x: pad, y: bar.y + (bar.height - 44) / 2, width: switcherWidth, height: 44 };
    this.#switcher(model, switcherRect, stops, order);
    const ctaWidth = frame.phone ? bar.width - pad * 2 - switcherWidth - 12 : 260;
    const ctaRect: Rect = {
      x: frame.phone ? switcherRect.x + switcherWidth + 12 : bar.x + bar.width - pad - ctaWidth,
      y: bar.y + (bar.height - 62) / 2,
      width: ctaWidth,
      height: 62,
    };
    stops.set("reread", { rect: ctaRect, activate: () => this.#reread(model) });
    order.push("reread");
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: `REREAD ISSUE #${model.number} ▸`,
        type: typeRole.barTitle,
        rect: ctaRect,
        onClick: () => this.#reread(model),
      }),
    );

    this.#route?.set(order, stops);
  }

  #reread(model: CampaignIssueModel): void {
    if (!this.#data) return;
    goToScreen(this, SCENES.campaignOpener, {
      runId: this.#data.runId,
      nodeId: model.nodeId,
      returnTo: { key: SCENES.campaignIssue, data: { runId: this.#data.runId, nodeId: model.nodeId } },
    });
  }

  /** The "◂ #1 · #3 ▸" prev/next switcher: one paper-on-ink boxed button (design tile 9), not a filled ink block. */
  #switcher(model: CampaignIssueModel, rect: Rect, stops: Map<string, FocusStop>, order: string[]): void {
    const g = this.add.graphics();
    g.fillStyle(surface.paper.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, rect.y, rect.width, rect.height);
    const prevLabel = model.prevNodeId ? `◂ #${prevNumber(model)}` : "◂";
    const nextLabel = model.nextFinishedNodeId ? `#${nextNumber(model)} ▸` : "▸";
    const half = rect.width / 2;
    const prevRect: Rect = { x: rect.x, y: rect.y, width: half, height: rect.height };
    const nextRect: Rect = { x: rect.x + half, y: rect.y, width: half, height: rect.height };
    g.lineStyle(1, surface.ink.hex, 0.3).lineBetween(rect.x + half, rect.y, rect.x + half, rect.y + rect.height);
    this.add
      .text(prevRect.x + prevRect.width / 2, prevRect.y + prevRect.height / 2, prevLabel, {
        ...textStyle(typeRole.rowTitle, surface.ink.hex, model.prevNodeId ? 1 : 0.3),
        fontSize: "14px",
      })
      .setOrigin(0.5);
    this.add
      .text(nextRect.x + nextRect.width / 2, nextRect.y + nextRect.height / 2, nextLabel, {
        ...textStyle(typeRole.rowTitle, surface.ink.hex, model.nextFinishedNodeId ? 1 : 0.3),
        fontSize: "14px",
      })
      .setOrigin(0.5);
    if (model.prevNodeId) {
      const nodeId = model.prevNodeId;
      const activate = (): void => this.#openNode(nodeId);
      this.add
        .zone(prevRect.x, prevRect.y, prevRect.width, prevRect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", activate);
      stops.set("prev", { rect: prevRect, activate });
      order.unshift("prev");
    }
    if (model.nextFinishedNodeId) {
      const nodeId = model.nextFinishedNodeId;
      const activate = (): void => this.#openNode(nodeId);
      this.add
        .zone(nextRect.x, nextRect.y, nextRect.width, nextRect.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true })
        .on("pointerup", activate);
      stops.set("next", { rect: nextRect, activate });
      order.push("next");
    }
  }

  #drawWide(model: CampaignIssueModel, frame: ReturnType<typeof campaignFrame>, top: number, bottom: number): void {
    const pad = frame.gutter;
    const leftWidth = Math.min(700, (frame.width - pad * 2) * 0.46);
    const rightX = pad + leftWidth + 24;
    const rightWidth = frame.width - rightX - pad;
    const artRect: Rect = { x: pad, y: top + pad, width: leftWidth, height: bottom - top - pad * 2 };
    this.#villainPanel(model, artRect);
    this.#detailPanel(model, { x: rightX, y: top + pad, width: rightWidth, height: bottom - top - pad * 2 });
  }

  #drawPhone(model: CampaignIssueModel, frame: ReturnType<typeof campaignFrame>, top: number, bottom: number): void {
    const pad = frame.gutter;
    const artRect: Rect = { x: pad, y: top + pad, width: frame.width - pad * 2, height: 220 };
    this.#villainPanel(model, artRect);
    this.#detailPanel(model, {
      x: pad,
      y: artRect.y + artRect.height + 12,
      width: frame.width - pad * 2,
      height: Math.max(100, bottom - (artRect.y + artRect.height + 12) - 8),
    });
  }

  #villainPanel(model: CampaignIssueModel, rect: Rect): void {
    const g = this.add.graphics();
    g.fillStyle(0x1c1a17, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const captionHeight = 40;
    const artRect: Rect = { ...rect, height: rect.height - captionHeight };
    drawPicture(this, villainPicture(model.nodeId), artRect, () => this.#draw(), { focusY: 0.12 });
    stamp(this, rect.x + 10, rect.y + 10, model.won ? "WON" : "LOST", {
      ground: model.won ? signal.heal.hex : accent.heroRed.hex,
    });
    if (model.recap) {
      const captionRect: Rect = { x: rect.x, y: artRect.y + artRect.height, width: rect.width, height: captionHeight };
      const g2 = this.add.graphics();
      g2.fillStyle(signal.caution.hex, 1).fillRect(captionRect.x, captionRect.y, captionRect.width, captionRect.height);
      g2.lineStyle(2, surface.ink.hex, 1).strokeRect(
        captionRect.x,
        captionRect.y,
        captionRect.width,
        captionRect.height,
      );
      this.add
        .text(captionRect.x + 12, captionRect.y + captionRect.height / 2, model.recap.toUpperCase(), {
          fontFamily: '"Public Sans", sans-serif',
          fontSize: "12px",
          fontStyle: "italic 800",
          color: cssOf(surface.ink.hex),
          wordWrap: { width: captionRect.width - 24, useAdvancedWrap: true },
        })
        .setOrigin(0, 0.5);
    }
  }

  #detailPanel(model: CampaignIssueModel, rect: Rect): void {
    this.add
      .text(
        rect.x,
        rect.y,
        `#${model.number} · ${model.villain.toUpperCase()}`,
        textStyle(typeRole.label, surface.ink.hex, 0.7),
      )
      .setFontSize(12);
    const title = this.add
      .text(rect.x, rect.y + 18, model.title, textStyle(bangers(30), surface.ink.hex))
      .setWordWrapWidth(rect.width);
    let y = title.y + title.height + 20;
    y = ruleHeading(this, rect.x, y, rect.width, "Attempts");
    if (model.attempts.length > 0) {
      const boxTop = y;
      const rowHeight = 46;
      model.attempts.forEach((attempt, index) => {
        this.add.text(rect.x + 12, y + 10, String(attempt.index), textStyle(bangers(18), surface.ink.hex, 0.5));
        this.add.text(rect.x + 40, y + 6, attempt.headline, textStyle(typeRole.emphasis, surface.ink.hex));
        this.add
          .text(rect.x + 40, y + 24, attempt.detail, textStyle(typeRole.body, surface.ink.hex, 0.7))
          .setFontSize(11)
          .setWordWrapWidth(rect.width - 150);
        this.add
          .text(rect.x + rect.width - 12, y + rowHeight / 2, attempt.tag, {
            ...textStyle(typeRole.label, attempt.tag === "KEPT" ? signal.heal.hex : accent.heroRed.hex, 1),
            fontStyle: "700",
          })
          .setOrigin(1, 0.5)
          .setFontSize(11);
        y += rowHeight;
        if (index < model.attempts.length - 1) {
          this.add.rectangle(rect.x, y, rect.width, 1, surface.ink.hex, 0.15).setOrigin(0, 0.5);
        }
      });
      this.add
        .graphics()
        .lineStyle(2, surface.ink.hex, 1)
        .strokeRect(rect.x, boxTop, rect.width, y - boxTop);
    }
    y += 26;
    y = ruleHeading(this, rect.x, y, rect.width, "Wrote to the log");
    if (model.writes.length > 0) {
      // A finished issue's write list can run past the panel's own bottom (GMW's own setup-then-victory shape
      // writes several rows to the same field) — scrolled inside its own box, `McVariableList`, rather than left
      // to spill past the frame and behind the action bar the way a plain `forEach` draw once did.
      const listRect: Rect = { x: rect.x, y, width: rect.width, height: Math.max(60, rect.y + rect.height - y) };
      const heights = model.writes.map((write) => logWriteRowHeight(write.headline, write.detail, rect.width));
      const writes = model.writes;
      const renderRow = (index: number, rowRect: Rect): VirtualListRow => this.#renderWriteRow(writes[index]!, rowRect);
      this.#writesList = new McVariableList(this, {
        rect: listRect,
        heights,
        renderRow,
        scroll: this.#writesScroll,
        background: false,
      });
      this.add
        .graphics()
        .lineStyle(2, surface.ink.hex, 1)
        .strokeRect(listRect.x, listRect.y, listRect.width, listRect.height);
    }
  }

  /** One "Wrote to the log" row, drawn at `rowRect` (the row's own position at zero scroll — `McVariableList`
   * reparents these objects into its masked, scrolling layer and handles the offset itself). */
  #renderWriteRow(write: CampaignIssueModel["writes"][number], rowRect: Rect): VirtualListRow {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const headline = this.add
      .text(rowRect.x + 26, rowRect.y + 8, write.headline, textStyle(typeRole.emphasis, surface.ink.hex))
      .setFontSize(13)
      .setWordWrapWidth(rowRect.width - 150);
    objects.push(headline);
    // A collapsed cardList delta ("+ Brainstorm, By Any Means, Contingency Plan → Groot") can wrap to two lines
    // at this width — the detail line starts below the headline's own measured height, never a fixed offset that
    // assumed one line (matches `logWriteRowHeight`'s own estimate, which sized this row for exactly this).
    const detailTop = Math.max(26, 8 + headline.height + 4);
    objects.push(
      this.add
        .text(rowRect.x + 26, rowRect.y + detailTop, write.detail, textStyle(typeRole.body, surface.ink.hex, 0.65))
        .setFontSize(11)
        .setWordWrapWidth(rowRect.width - 150),
    );
    objects.push(
      this.add
        .text(
          rowRect.x + rowRect.width - 10,
          rowRect.y + 8,
          write.citation,
          textStyle(typeRole.label, surface.ink.hex, 0.5),
        )
        .setOrigin(1, 0)
        .setFontSize(10),
    );
    objects.push(this.add.rectangle(rowRect.x + 12, rowRect.y + rowRect.height / 2, 8, 8, writeKindColor(write.kind)));
    objects.push(
      this.add
        .rectangle(rowRect.x, rowRect.y + rowRect.height, rowRect.width, 1, surface.ink.hex, 0.15)
        .setOrigin(0, 0.5),
    );
    return { objects };
  }
}

/** Green for a grant, blue for a number, red for a removal, caution for a flag — the issue detail's colour code. */
function writeKindColor(kind: CampaignIssueModel["writes"][number]["kind"]): number {
  switch (kind) {
    case "grant":
      return signal.heal.hex;
    case "removed":
      return accent.heroRed.hex;
    case "flag":
      return signal.caution.hex;
    default:
      return signal.cost.hex;
  }
}

function prevNumber(model: CampaignIssueModel): number {
  return model.number - 1;
}

function nextNumber(model: CampaignIssueModel): number {
  return model.number + 1;
}
