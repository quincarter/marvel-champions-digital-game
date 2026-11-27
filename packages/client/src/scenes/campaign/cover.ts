/**
 * C01 — Campaign cover: the box's own cover page. Full-bleed villain art, the box's pitch, the roster and issue
 * progress, and the one CTA that reads the next issue (or signs the roster, for a fresh volume).
 *
 * The whole screen is one Lit panel over the canvas (`dom/dom-region.ts`, `mc-sheet`) at the same rects: the picture, the
 * ink panel with its title, pitch and buttons. The scene keeps the focus route (its ring drawn in the panel layer), the
 * glyph hints and navigation.
 *
 * All status/unlock/pips/labels come from `view/campaign-cover-model.ts`; this scene lays it out and wires taps.
 */
import Phaser from "phaser";
import "@mc/ui";
import type { McSheet } from "@mc/ui";
import { campaignDefinitionIn, campaignRecordOf } from "../../campaign/pack-campaigns.js";
import { campaignCardsById } from "../../content/campaign-pool.js";
import { cardDisplayName } from "../../view/hero-names.js";
import { accent, ink, surface, typeRole } from "../../tokens.js";
import { bangers, campaignCoverPicture, campaignFrame, villainPicture } from "../../ui/campaign-chrome.js";
import { cssOf, caseOf } from "../../ui/theme.js";
import { isDesktopType } from "../../ui/desktop-type.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { campaignService } from "../../session.js";
import { coverModelOf, type CoverModel } from "../../view/campaign-cover-model.js";
import { isMarketPendingChoice } from "../../view/campaign-market-model.js";
import { wonStandardOf } from "../../view/campaign-saga-model.js";
import type { Rect } from "../../view/layout.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import { goToCampaignStart } from "./start-route.js";
import { routeUnfoldedGame } from "./unfolded-game-route.js";
import { t } from "../../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import type { PipState } from "../../ui/campaign-chrome.js";
import type { CampaignCoverData } from "./routes.js";

const cardOf = (id: string) => campaignCardsById().get(id);

const identityNameOf = (id: string): string => {
  const card = campaignCardsById().get(id);
  return card ? cardDisplayName(card) : id;
};

/** The tilted tag's angle and the stamp-yellow it is drawn in (the design canvas's own, not a token). */
const TAG_TILT = -0.04;
const TAG_FILL = 0xf2b01e;

/** A rectangle's corners turned by `angle` radians about its own center. */
function turnedCorners(cx: number, cy: number, width: number, height: number, angle: number): [number, number][] {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return (
    [
      [-width / 2, -height / 2],
      [width / 2, -height / 2],
      [width / 2, height / 2],
      [-width / 2, height / 2],
    ] as const
  ).map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
}

/** The five issue pips: paper done, red current (paper ring), outlined empty. */
function drawPips(b: SheetBuilder, rect: Rect, pips: readonly PipState[]): void {
  const gap = 5;
  const count = Math.max(1, pips.length);
  const width = (rect.width - gap * (count - 1)) / count;
  pips.forEach((state, index) => {
    const x = rect.x + index * (width + gap);
    if (state === "done") b.box({ x, y: rect.y, width, height: rect.height }, { fill: surface.paper.hex });
    else if (state === "current") {
      b.box({ x: x - 2, y: rect.y - 2, width: width + 4, height: rect.height + 4 }, { fill: surface.paper.hex });
      b.box({ x, y: rect.y, width, height: rect.height }, { fill: accent.heroRed.hex });
    } else
      b.box(
        { x: x + 1, y: rect.y + 1, width: width - 2, height: rect.height - 2 },
        { stroke: surface.paper.hex, strokeWidth: 2, alpha: 0.35 },
      );
  });
}

/**
 * A box name split into two roughly-balanced lines by word count ("The Rise of Red Skull" → "THE RISE" / "OF RED
 * SKULL") — tries every split point and keeps whichever leaves the two lines closest in length. A one-word name
 * (or an empty one) returns an empty second line.
 */
export function balancedTwoLines(name: string): readonly [string, string] {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [name, ""];
  let best = { at: 1, score: Number.POSITIVE_INFINITY };
  for (let at = 1; at < words.length; at++) {
    const a = words.slice(0, at).join(" ");
    const b = words.slice(at).join(" ");
    const score = Math.abs(a.length - b.length);
    if (score < best.score) best = { at, score };
  }
  return [words.slice(0, best.at).join(" "), words.slice(best.at).join(" ")];
}

export class CampaignCoverScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** What a hanging glyph must not cover: the buttons. */
  #obstacles: Rect[] = [];
  #region: DomRegion<McSheet> | null = null;
  readonly #leases = new PictureLeases();
  #actions = new Map<string, () => void>();
  #stops = new Map<string, FocusStop>();
  #model: CoverModel | null = null;
  #campaignId = "";
  #runId: string | null = null;
  #alive = false;
  /** A one-shot, throwaway peek at whether the runner's very next question is Market-shaped — see
   * `scenes/campaign/frozen-deck.ts`'s own doc comment for why `compose(record, [])` is safe to call here. Only
   * computed for a box `model.market` says has a Market at all; false otherwise. */
  #marketOpenNow = false;

  constructor() {
    super(SCENES.campaignCover);
  }

  create(data: CampaignCoverData): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.ink.hex));
    this.#alive = true;
    this.#region = null;
    this.scale.on("resize", this.#rebuild, this);
    this.#glyphs = new SheetGlyphs(
      this,
      () => this.#rebuild(),
      () => this.#obstacles,
    );
    // A language switch (#390) reads the model's words again; a picture that resolves later draws in place.
    const offLanguage = onLanguageChange(() => {
      if (this.sys.isActive()) void this.#load();
    });
    const offArt = onArtChange(() => {
      if (this.sys.isActive()) this.#rebuild();
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#alive = false;
      this.scale.off("resize", this.#rebuild, this);
      offLanguage();
      offArt();
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#region = null;
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => goToScreen(this, SCENES.campaignSaga),
      // Start and A with nothing focused: the cover's one big button (Sign the roster, Read issue #N).
      primary: () => "cta",
    });
    this.#campaignId = data.campaignId;
    this.#runId = data.runId ?? null;
    this.#model = null;
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const [record, summaries] = await Promise.all([
      this.#runId ? campaignService().load(this.#runId) : Promise.resolve<CampaignRecord | null>(null),
      campaignService().storage.list(),
    ]);
    if (!this.sys.isActive()) return;
    if (record && (await routeUnfoldedGame(this, record))) return;
    const content = campaignRecordOf(this.#campaignId, record ?? undefined);
    const definition = campaignDefinitionIn(this.#campaignId, record ?? undefined);
    this.#model = coverModelOf({
      campaignId: this.#campaignId,
      boxCode: content?.boxCode ?? "",
      name: content?.name ?? this.#campaignId,
      record,
      definition,
      expertUnlocked: wonStandardOf(this.#campaignId, summaries),
      identityNameOf,
    });
    this.#marketOpenNow = false;
    if (record && this.#model.market) {
      const service = campaignService();
      const current = record.attempt ? await service.discardAttempt(record) : record;
      const nextNodeId = current.attempt?.nodeId ?? current.position.nextNodeId;
      const peeked = nextNodeId ? await service.compose(current, []) : null;
      if (!this.sys.isActive()) return;
      this.#marketOpenNow = peeked?.kind === "pending" && isMarketPendingChoice(peeked.choice, cardOf);
    }
    this.#rebuild();
  }

  #rebuild(): void {
    const model = this.#model;
    if (!this.#alive || !model) return;
    this.#glyphs.reset();
    this.#leases.begin();
    this.#actions = new Map();
    this.#stops = new Map();
    this.#obstacles = [];

    const frame = campaignFrame(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    b.box({ x: 0, y: 0, width: frame.width, height: frame.height }, { fill: surface.ink.hex });
    if (frame.phone) this.#drawPhone(b, frame, model);
    else this.#drawWide(b, frame, model);

    const order = ["back", "cta", "dossier", "issues", "market", "expert"].filter((key) => this.#stops.has(key));
    this.#route?.set(order, this.#stops);
    this.#mount(frame, b);
  }

  #mount(frame: { readonly width: number; readonly height: number }, b: SheetBuilder): void {
    const rect: Rect = { x: 0, y: 0, width: frame.width, height: frame.height };
    if (!this.#region) {
      const element = document.createElement("mc-sheet") as McSheet;
      element.addEventListener("mc-activate", (event) => {
        this.#actions.get((event as CustomEvent<{ key: string }>).detail.key)?.();
      });
      this.#leases.watch(element);
      this.#region = new DomRegion(this, element, rect);
    }
    const region = this.#region;
    region.setRect(rect);
    region.element.nodes = b.nodes;
    renderNow(region.element);
    this.#leases.end();
  }

  /** The box chip, with the run's "Balanced" marker when it was signed on the house rule (issue #609). */
  #chipText(model: CoverModel): string {
    return model.balancedTag
      ? t("cover.chipBalanced", { box: model.boxCode, tag: model.balancedTag })
      : t("cover.chip", { box: model.boxCode });
  }

  #back(): void {
    goToScreen(this, SCENES.campaignSaga);
  }

  #drawBack(b: SheetBuilder, x: number, y: number): void {
    const rect: Rect = { x, y, width: 84, height: 38 };
    this.#glyphs.button(b, {
      key: "back",
      rect,
      label: t("cover.back"),
      look: "onInk",
      type: typeRole.backLabel,
      ids: ["cancel"],
      ground: "ink",
    });
    this.#actions.set("back", () => this.#back());
    this.#stops.set("back", { rect, activate: () => this.#back() });
  }

  /** The tilted yellow tag ("A story in five issues") — turned about its own center, not the world origin, so a
   * small angle reads as a local tilt in place rather than shifting the whole tag toward (0,0). */
  #drawTag(b: SheetBuilder, x: number, bottomY: number, text: string): void {
    const type = { ...typeRole.emphasis, size: 12 };
    const label = text.toLocaleUpperCase();
    const width = b.measure(label, type, { letterSpacing: 0.5 }).width + 20;
    const height = 26;
    const cx = x + width / 2;
    const cy = bottomY - height / 2;
    b.poly(turnedCorners(cx, cy, width, height, TAG_TILT), { fill: TAG_FILL });
    b.text(cx, cy, label, type, {
      color: surface.ink.hex,
      letterSpacing: 0.5,
      origin: [0.5, 0.5],
      angle: (TAG_TILT * 180) / Math.PI,
    });
  }

  /** The box chip: the code and "Campaign box" in a 1.5px paper outline. */
  #drawChip(b: SheetBuilder, x: number, y: number, text: string, alignRightTo?: number): void {
    const label = caseOf(typeRole.label, text.toLocaleUpperCase());
    const width = b.measure(label, typeRole.label, { letterSpacing: 1 }).width + 20;
    const left = alignRightTo === undefined ? x : alignRightTo - width;
    b.box({ x: left + 0.5, y: y + 0.5, width: width - 1, height: 25 }, { stroke: surface.paper.hex, strokeWidth: 1.5 });
    b.text(left + 10, y + 6, label, typeRole.label, { color: surface.paper.hex, letterSpacing: 1 });
  }

  // ---- Wide (desktop/tablet): art left, ink panel right ---------------------------------------------------------

  #drawWide(b: SheetBuilder, frame: ReturnType<typeof campaignFrame>, model: CoverModel): void {
    const artWidth = Math.round(frame.width * 0.53);
    this.#drawArt(b, { x: 0, y: 0, width: artWidth, height: frame.height }, model);
    this.#drawBack(b, 16, 16);
    this.#drawTag(b, 24, frame.height - 24, model.tagline);

    const panelRect: Rect = { x: artWidth, y: 0, width: frame.width - artWidth, height: frame.height };
    b.box(panelRect, { fill: surface.ink.hex });

    const pad = 36;
    let y = pad;
    this.#drawChip(b, panelRect.x + pad, y, this.#chipText(model));
    y += 54;

    const titleHeight = this.#drawBalancedTitle(
      b,
      panelRect.x + pad,
      y,
      panelRect.width - pad * 2,
      frame.height * 0.45,
      model.name,
    );
    y += titleHeight + 18;

    b.text(panelRect.x + pad, y, model.blurb, typeRole.body, {
      size: 13,
      color: surface.paper.hex,
      alpha: ink.secondary,
      wrapWidth: panelRect.width - pad * 2,
    });

    this.#drawBottomBlock(b, panelRect, pad, model);
  }

  // ---- Phone: art top half with title over it, panel below --------------------------------------------------

  #drawPhone(b: SheetBuilder, frame: ReturnType<typeof campaignFrame>, model: CoverModel): void {
    const artHeight = Math.round(frame.height * 0.42);
    const artRect: Rect = { x: 0, y: 0, width: frame.width, height: artHeight };
    this.#drawArt(b, artRect, model);
    b.box(
      { x: artRect.x, y: artRect.y + artRect.height - 160, width: artRect.width, height: 160 },
      { fill: surface.ink.hex, fillAlpha: 0.6 },
    );
    this.#drawBack(b, 16, 16);
    this.#drawChip(b, 0, 16, this.#chipText(model), frame.width - 16);

    const titleHeight = this.#drawBalancedTitle(b, 16, artHeight - 14, frame.width - 32, 100, model.name, "bottom");
    this.#drawTag(b, 16, artHeight - 14 - titleHeight - 8, model.tagline);

    const panelRect: Rect = { x: 0, y: artHeight, width: frame.width, height: frame.height - artHeight };
    b.box(panelRect, { fill: surface.ink.hex });

    const pad = 16;
    b.text(pad, panelRect.y + 14, model.blurb, typeRole.body, {
      size: 12,
      color: surface.paper.hex,
      alpha: ink.secondary,
      wrapWidth: frame.width - pad * 2,
    });

    this.#drawBottomBlock(b, panelRect, pad, model);
  }

  /**
   * The huge two-line Bangers title ("THE RISE / OF RED SKULL"): split the box name into two roughly-balanced
   * lines by word count, then size both to fit — big enough to nearly fill the space given it (the tile draws it
   * at ~45% of the panel's own height on desktop; over the art's bottom edge on phone), never past the given
   * width. `anchor: "bottom"` reads `y` as where the block's own bottom edge should land (the phone composition,
   * where the title sits just above the blurb rather than growing down from a fixed top). Returns the block's
   * total height.
   */
  #drawBalancedTitle(
    b: SheetBuilder,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    name: string,
    anchor: "top" | "bottom" = "top",
  ): number {
    const [line1, line2] = balancedTwoLines(name);
    const lineHeight = 0.86;
    const startSize = Math.min(96, maxHeight / (line2 ? 2 * lineHeight : lineHeight));
    const first = line1.toLocaleUpperCase();
    const second = line2.toLocaleUpperCase();
    // Both lines take the size the wider one needs (the width a Bangers line takes is linear in its size).
    let size = startSize;
    for (const line of [first, second]) {
      if (!line) continue;
      const width = b.measure(line, bangers(startSize, lineHeight)).width;
      if (width > maxWidth) size = Math.min(size, Math.floor((startSize * maxWidth) / width));
    }
    const spec = bangers(size, lineHeight);
    const firstHeight = b.measure(first, spec).height;
    const secondHeight = second ? b.measure(second, spec).height : 0;
    const total = firstHeight + secondHeight;
    const top = anchor === "bottom" ? y - total : y;
    b.text(x, top, first, spec, { color: surface.paper.hex, fitWidth: maxWidth });
    if (second) b.text(x, top + firstHeight, second, spec, { color: surface.paper.hex, fitWidth: maxWidth });
    return total;
  }

  #drawArt(b: SheetBuilder, rect: Rect, model: CoverModel): void {
    // A box's own cover art (`art/campaigns/<id>/cover.*`) is its key art, made for this exact spot; the final
    // scenario's villain picture is only ever the fallback for a box that hasn't shipped one yet.
    const picture = campaignCoverPicture(model.campaignId) ?? villainPicture(model.villainScenarioId);
    if (picture) {
      const art = this.#leases.image(picture);
      if (art.src !== null) {
        b.image(rect, {
          src: art.src,
          cover: { x: 0.5, y: 0.1 },
          fill: surface.ink.hex,
          key: "cover-art",
          ...(art.retry !== undefined ? { retry: art.retry } : {}),
        });
        return;
      }
    }
    b.box(rect, { fill: surface.ink.hex });
  }

  // ---- The bottom block: roster/issue, pips, CTA, Dossier/Issues, Expert Campaign — anchored to the panel's own bottom.

  #drawBottomBlock(b: SheetBuilder, panelRect: Rect, pad: number, model: CoverModel): void {
    const width = panelRect.width - pad * 2;
    const x = panelRect.x + pad;
    let y = panelRect.y + panelRect.height - pad;

    // Laid out bottom-up so it always sits flush with the panel's bottom edge regardless of blurb length above it.
    y -= 52;
    const expertRect: Rect = { x, y, width, height: 52 };
    const goExpert = (): void => goToCampaignStart(this, model.campaignId, true);
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
    this.#actions.set("expert", () => {
      if (model.expertUnlocked) goExpert();
    });
    this.#stops.set("expert", { rect: expertRect, activate: goExpert });
    this.#obstacles.push(expertRect);
    y -= 10;

    if (model.hasRun) {
      y -= 64;
      const halfWidth = (width - 12) / 2;
      const dossierRect: Rect = { x, y, width: halfWidth, height: 64 };
      const secondRect: Rect = { x: x + halfWidth + 12, y, width: halfWidth, height: 64 };
      const goDossier = (): void => goToScreen(this, SCENES.campaignDossier, { runId: this.#runId });
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
      this.#actions.set("dossier", () => {
        if (model.canOpenDossier) goDossier();
      });
      this.#stops.set("dossier", { rect: dossierRect, activate: goDossier });
      this.#obstacles.push(dossierRect);

      // A box with a Market (`model.market`, `walletFieldsOf`) trades the Issues button for THE MARKET — Issues is
      // still one tap away, as the Dossier's own Issues tab (`scenes/campaign/dossier.ts`'s `TABS`). A box with no
      // Market (MC10) keeps this second button as Issues, unchanged.
      if (model.market) {
        const goToMarket = (): void => {
          if (this.#marketOpenNow) goToScreen(this, SCENES.campaignMarket, { runId: this.#runId, answers: [] });
          else goToScreen(this, SCENES.campaignBriefing, { runId: this.#runId });
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
        this.#actions.set("market", () => {
          if (model.canOpenDossier) goToMarket();
        });
        this.#stops.set("market", { rect: secondRect, activate: goToMarket });
        this.#obstacles.push(secondRect);
      } else {
        const goToRun = (): void => goToScreen(this, SCENES.campaignRun, { runId: this.#runId });
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
        this.#actions.set("issues", () => {
          if (model.canOpenRun) goToRun();
        });
        this.#stops.set("issues", { rect: secondRect, activate: goToRun });
        this.#obstacles.push(secondRect);
      }
      y -= 10;
    }

    y -= 62;
    const ctaRect: Rect = { x, y, width, height: 62 };
    const cta = this.#ctaFor(model);
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
    this.#actions.set("cta", () => {
      if (cta.enabled) cta.onClick();
    });
    this.#stops.set("cta", { rect: ctaRect, activate: cta.onClick });
    this.#obstacles.push(ctaRect);
    // Start on a pad, Enter on a keyboard: the glyph sits inside the button's right end, left of the chevron, when the
    // row is wide enough.
    if (cta.enabled && ctaRect.width >= 240) {
      this.#glyphs.hint(b, {
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
      drawPips(b, { x, y, width, height: 8 }, model.pips);
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

  #ctaFor(model: CoverModel): { title: string; subtitle?: string; enabled: boolean; onClick: () => void } {
    if (!model.hasRun) {
      return {
        title: t("cover.cta.sign"),
        enabled: true,
        onClick: () => goToCampaignStart(this, model.campaignId),
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
        onClick: () => goToScreen(this, SCENES.campaignOpener, { runId: this.#runId }),
      };
    }
    if (model.finished === "won") {
      return {
        title: t("cover.cta.finale"),
        enabled: true,
        onClick: () => goToScreen(this, SCENES.campaignFinale, { runId: this.#runId }),
      };
    }
    if (model.finished === "lost") {
      return {
        title: t("cover.cta.lost"),
        ...(model.lostLine ? { subtitle: model.lostLine } : {}),
        enabled: true,
        onClick: () => goToScreen(this, SCENES.campaignRun, { runId: this.#runId }),
      };
    }
    return { title: t("cover.cta.over"), enabled: false, onClick: () => {} };
  }
}
