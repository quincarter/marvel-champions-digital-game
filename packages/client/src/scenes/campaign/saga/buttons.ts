import { bangers } from "../../../ui/campaign-chrome.js";
import { goToScreen } from "../../../ui/transitions.js";
import { type SagaVolumeRow } from "../../../view/campaign-saga-model.js";
import { ctaOf, type SagaAlt, type SagaCta } from "../../../view/campaign-saga-copy.js";
import type { Rect } from "../../../view/layout.js";
import { goToCampaignStart } from ".././start-route.js";
import { SCENES } from "../../keys.js";
import { unlockCostOf, unlockOrAsk } from "../../unlock-confirm.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import { commandMeaning } from "../../../dom/stale-presses.js";
import { type SagaCtx } from "./context.js";

/** The featured volume's one big button. */
export function drawCta(ctx: SagaCtx, b: SheetBuilder, rect: Rect, row: SagaVolumeRow, titleSize: number): void {
  const target = { kind: "campaign", campaignId: row.volume.campaignId } as const;
  const cta: SagaCta = ctaOf(row, row.status === "sealed" && row.hasDefinition ? unlockCostOf(target) : 0);
  const press = (): void => pressCta(ctx, row, cta);
  ctx.meanings.set("cta", commandMeaning(`${row.volume.campaignId}:${cta.action}`, "primary", cta.label, cta.enabled));
  b.button({
    key: "cta",
    rect,
    label: cta.label.toLocaleUpperCase(),
    look: "primary",
    type: bangers(titleSize),
    row: true,
    chevron: false,
    ...(cta.enabled ? {} : { disabled: cta.reason ?? true }),
  });
  ctx.actions.set("cta", () => {
    if (cta.enabled) press();
  });
  ctx.stops.set("cta", { rect, activate: press });
  ctx.state.ctaEnabled = cta.enabled;
  ctx.obstacles.push(rect);
  // Start on a pad, Enter on a keyboard: the glyph sits inside the button's right end when the row is wide enough.
  if (cta.enabled && rect.width >= 240) {
    const glyphHeight = Math.min(26, Math.max(16, rect.height - 24));
    ctx.glyphs.hint(b, {
      key: "cta-forward",
      x: rect.x + rect.width - 40,
      y: rect.y + rect.height / 2,
      ids: ["pause"],
      idsNow: (set) => (set === "pad" ? ["pause"] : ["activate"]),
      height: glyphHeight,
      ground: "ink",
      alignRight: true,
    });
  }
}

export function pressCta(ctx: SagaCtx, row: SagaVolumeRow, cta: SagaCta): void {
  switch (cta.action) {
    case "continue":
      goToScreen(ctx.scene, SCENES.campaignCover, { campaignId: row.volume.campaignId, runId: row.runId });
      return;
    case "reread":
      goToScreen(ctx.scene, SCENES.campaignRun, { runId: row.runId });
      return;
    case "start":
      goToScreen(ctx.scene, SCENES.campaignCover, { campaignId: row.volume.campaignId });
      return;
    case "unlock":
      unlockOrAsk(ctx.scene, { kind: "campaign", campaignId: row.volume.campaignId }, () => ctx.reload());
      return;
    case "none":
      return;
  }
}

export function drawAlt(
  ctx: SagaCtx,
  b: SheetBuilder,
  rect: Rect,
  alt: SagaAlt,
  index: number,
  row: SagaVolumeRow,
  titleSize: number,
  stopRect: Rect | (() => Rect) = rect,
): void {
  const key = `alt-${index}`;
  const press = (): void => pressAlt(ctx, row, alt);
  ctx.meanings.set(key, commandMeaning(`${row.volume.campaignId}:${alt.action}`, "onInk", alt.label, alt.enabled));
  b.button({
    key,
    rect,
    label: alt.label.toLocaleUpperCase(),
    look: "onInk",
    type: bangers(titleSize),
    row: true,
    ...(alt.enabled ? {} : { disabled: true }),
  });
  ctx.actions.set(key, () => {
    if (alt.enabled) press();
  });
  ctx.stops.set(key, { rect: stopRect, activate: press });
  ctx.obstacles.push(rect);
}

export function pressAlt(ctx: SagaCtx, row: SagaVolumeRow, alt: SagaAlt): void {
  const runId = row.runId ?? row.lost?.runId ?? null;
  switch (alt.action) {
    case "dossier":
      goToScreen(ctx.scene, SCENES.campaignDossier, { runId: row.status === "fresh" ? row.lost?.runId : row.runId });
      return;
    case "reread":
      goToScreen(ctx.scene, SCENES.campaignRun, { runId: row.lost?.runId ?? runId });
      return;
    case "startOver":
      ctx.startOver(row);
      return;
    case "newRun":
      goToCampaignStart(ctx.scene, row.volume.campaignId);
      return;
    case "expertRun":
      goToCampaignStart(ctx.scene, row.volume.campaignId, true);
      return;
  }
}
