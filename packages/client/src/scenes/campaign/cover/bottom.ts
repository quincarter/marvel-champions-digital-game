import { ink, surface, typeRole } from "../../../tokens.js";
import { bangers } from "../../../ui/campaign-chrome.js";
import { caseOf } from "../../../ui/theme.js";
import { goToScreen } from "../../../ui/transitions.js";
import { type CoverModel } from "../../../view/campaign-cover-model.js";
import type { Rect } from "../../../view/layout.js";
import { SCENES } from "../../keys.js";
import { goToCampaignStart } from ".././start-route.js";
import { t } from "../../../i18n/translate.js";
import { SheetBuilder } from "../../../dom/sheet-builder.js";
import { drawIssuePips } from "../../../dom/issue-pips.js";
import type { CoverCtx } from "./context.js";

export function drawBottomBlock(ctx: CoverCtx, b: SheetBuilder, panelRect: Rect, pad: number, model: CoverModel): void {
  const width = panelRect.width - pad * 2;
  const x = panelRect.x + pad;
  let y = panelRect.y + panelRect.height - pad;

  // Laid out bottom-up so it always sits flush with the panel's bottom edge regardless of blurb length above it.
  y -= 52;
  const expertRect: Rect = { x, y, width, height: 52 };
  const goExpert = (): void => goToCampaignStart(ctx.scene, model.campaignId, true);
  b.button({
    key: "expert",
    rect: expertRect,
    label: t("cover.expert.title").toLocaleUpperCase(),
    look: "secondary",
    type: bangers(15),
    row: true,
    subtitle: model.expertUnlocked ? t("cover.expert.ready") : t("cover.expert.locked"),
    chevron: model.expertUnlocked,
    ...(model.expertUnlocked ? {} : { disabled: true }),
  });
  ctx.actions.set("expert", () => {
    if (model.expertUnlocked) goExpert();
  });
  ctx.stops.set("expert", { rect: expertRect, activate: goExpert });
  ctx.obstacles.push(expertRect);
  y -= 10;

  if (model.hasRun) {
    y -= 64;
    const halfWidth = (width - 12) / 2;
    const dossierRect: Rect = { x, y, width: halfWidth, height: 64 };
    const secondRect: Rect = { x: x + halfWidth + 12, y, width: halfWidth, height: 64 };
    const goDossier = (): void => goToScreen(ctx.scene, SCENES.campaignDossier, { runId: ctx.state.runId });
    b.button({
      key: "dossier",
      rect: dossierRect,
      label: t("cover.dossier").toLocaleUpperCase(),
      look: "onInk",
      type: bangers(20),
      row: true,
      subtitle: model.dossierSubtitle.toLocaleUpperCase(),
      subtitleLabel: true,
      ...(model.canOpenDossier ? {} : { disabled: true }),
    });
    ctx.actions.set("dossier", () => {
      if (model.canOpenDossier) goDossier();
    });
    ctx.stops.set("dossier", { rect: dossierRect, activate: goDossier });
    ctx.obstacles.push(dossierRect);

    // A box with a Market (`model.market`, `walletFieldsOf`) trades the Issues button for THE MARKET — Issues is
    // still one tap away, as the Dossier's own Issues tab (`scenes/campaign/dossier.ts`'s `TABS`). A box with no
    // Market (MC10) keeps this second button as Issues, unchanged.
    if (model.market) {
      const goToMarket = (): void => {
        if (ctx.state.marketOpenNow)
          goToScreen(ctx.scene, SCENES.campaignMarket, { runId: ctx.state.runId, answers: [] });
        else goToScreen(ctx.scene, SCENES.campaignBriefing, { runId: ctx.state.runId });
      };
      // First word only ("Rocket Raccoon" → "Rocket") — design tile 16's own compact form for this tight
      // two-column row; `model.market.seats[].heroName` stays the full name for anything else that reads it.
      const walletLine = model.market.seats
        .map((seat) => `${seat.heroName.split(" ")[0]} ${seat.balanceLabel}`)
        .join(" · ");
      b.button({
        key: "market",
        rect: secondRect,
        label: t("cover.market").toLocaleUpperCase(),
        look: "onInk",
        type: bangers(20),
        row: true,
        subtitle: walletLine.toLocaleUpperCase(),
        subtitleLabel: true,
        ...(model.canOpenDossier ? {} : { disabled: true }),
      });
      ctx.actions.set("market", () => {
        if (model.canOpenDossier) goToMarket();
      });
      ctx.stops.set("market", { rect: secondRect, activate: goToMarket });
      ctx.obstacles.push(secondRect);
    } else {
      const goToRun = (): void => goToScreen(ctx.scene, SCENES.campaignRun, { runId: ctx.state.runId });
      b.button({
        key: "issues",
        rect: secondRect,
        label: t("cover.issues").toLocaleUpperCase(),
        look: "onInk",
        type: bangers(20),
        row: true,
        subtitle: t("cover.issues.reread", { count: model.totalIssues }).toLocaleUpperCase(),
        subtitleLabel: true,
        ...(model.canOpenRun ? {} : { disabled: true }),
      });
      ctx.actions.set("issues", () => {
        if (model.canOpenRun) goToRun();
      });
      ctx.stops.set("issues", { rect: secondRect, activate: goToRun });
      ctx.obstacles.push(secondRect);
    }
    y -= 10;
  }

  y -= 62;
  const ctaRect: Rect = { x, y, width, height: 62 };
  const cta = ctaFor(ctx, model);
  b.button({
    key: "cta",
    rect: ctaRect,
    label: cta.title.toLocaleUpperCase(),
    look: "primary",
    type: bangers(18),
    row: true,
    ...(cta.subtitle !== undefined ? { subtitle: cta.subtitle } : {}),
    chevron: cta.enabled,
    ...(cta.enabled ? {} : { disabled: true }),
  });
  ctx.actions.set("cta", () => {
    if (cta.enabled) cta.onClick();
  });
  ctx.stops.set("cta", { rect: ctaRect, activate: cta.onClick });
  ctx.obstacles.push(ctaRect);
  // Start on a pad, Enter on a keyboard: the glyph sits inside the button's right end, left of the chevron, when the
  // row is wide enough.
  if (cta.enabled && ctaRect.width >= 240) {
    ctx.glyphs.hint(b, {
      key: "cta-forward",
      x: ctaRect.x + ctaRect.width - 40,
      y: ctaRect.y + ctaRect.height / 2,
      ids: ["pause"],
      idsNow: (set) => (set === "pad" ? ["pause"] : ["activate"]),
      height: Math.min(26, Math.max(16, ctaRect.height - 24)),
      ground: "ink",
      alignRight: true,
    });
  }
  y -= 14;

  if (model.hasRun && model.pips.length > 0) {
    y -= 8;
    drawIssuePips(b, { x, y, width, height: 8 }, model.pips);
    y -= 8;

    b.text(x, y - 16, model.rosterNames.join(" · "), typeRole.emphasis, {
      color: surface.paper.hex,
      alpha: ink.secondary,
    });
    if (model.issueNumber !== null) {
      b.text(
        x + width,
        y - 16,
        caseOf(
          typeRole.label,
          t("campaign.issueOf", { number: model.issueNumber, total: model.totalIssues }).toLocaleUpperCase(),
        ),
        typeRole.label,
        { color: surface.paper.hex, alpha: ink.meta, origin: [1, 0], letterSpacing: 1 },
      );
    }
  }
}

export function ctaFor(
  ctx: CoverCtx,
  model: CoverModel,
): { title: string; subtitle?: string; enabled: boolean; onClick: () => void } {
  if (!model.hasRun) {
    return {
      title: t("cover.cta.sign"),
      enabled: true,
      onClick: () => goToCampaignStart(ctx.scene, model.campaignId),
    };
  }
  if (model.canReadIssue && model.issueNumber !== null) {
    const subtitle =
      model.nextIssueVillain && model.nextIssueTitle
        ? `${model.nextIssueVillain} · "${model.nextIssueTitle}"`
        : undefined;
    return {
      title: t("cover.cta.read", { number: model.issueNumber }),
      ...(subtitle !== undefined ? { subtitle } : {}),
      enabled: true,
      onClick: () => goToScreen(ctx.scene, SCENES.campaignOpener, { runId: ctx.state.runId }),
    };
  }
  if (model.finished === "won") {
    return {
      title: t("cover.cta.finale"),
      enabled: true,
      onClick: () => goToScreen(ctx.scene, SCENES.campaignFinale, { runId: ctx.state.runId }),
    };
  }
  if (model.finished === "lost") {
    return {
      title: t("cover.cta.lost"),
      ...(model.lostLine ? { subtitle: model.lostLine } : {}),
      enabled: true,
      onClick: () => goToScreen(ctx.scene, SCENES.campaignRun, { runId: ctx.state.runId }),
    };
  }
  return { title: t("cover.cta.over"), enabled: false, onClick: () => {} };
}
