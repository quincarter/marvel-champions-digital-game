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
import { ink, surface, typeRole } from "../../tokens.js";
import { campaignCoverPicture, campaignFrame, villainPicture } from "../../ui/campaign-chrome.js";
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
import { routeUnfoldedGame } from "./unfolded-game-route.js";
import { t } from "../../i18n/translate.js";
import { onArtChange, onLanguageChange } from "../../language-change.js";
import { DomRegion, renderNow } from "../../dom/dom-region.js";
import { domFocusRing } from "../../dom/dom-ring.js";
import { PictureLeases } from "../../dom/picture-leases.js";
import { SheetBuilder } from "../../dom/sheet-builder.js";
import { SheetGlyphs } from "../../dom/sheet-glyphs.js";
import { drawBottomBlock } from "./cover/bottom.js";
import type { CoverCtx, CoverState } from "./cover/context.js";
import { drawBalancedTitle, drawChip, drawTag } from "./cover/pieces.js";
import type { CampaignCoverData } from "./routes.js";

const cardOf = (id: string) => campaignCardsById().get(id);

const identityNameOf = (id: string): string => {
  const card = campaignCardsById().get(id);
  return card ? cardDisplayName(card) : id;
};

export class CampaignCoverScene extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #glyphs!: SheetGlyphs;
  /** What a hanging glyph must not cover: the buttons. */
  readonly #obstacles: Rect[] = [];
  #region: DomRegion<McSheet> | null = null;
  readonly #leases = new PictureLeases();
  readonly #actions = new Map<string, () => void>();
  readonly #stops = new Map<string, FocusStop>();
  readonly #state: CoverState = { runId: null, marketOpenNow: false };
  #ctx!: CoverCtx;
  #model: CoverModel | null = null;
  #campaignId = "";
  #alive = false;

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
    this.#ctx = {
      scene: this,
      glyphs: this.#glyphs,
      actions: this.#actions,
      stops: this.#stops,
      obstacles: this.#obstacles,
      state: this.#state,
    };
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      onCancel: () => goToScreen(this, SCENES.campaignSaga),
      // Start and A with nothing focused: the cover's one big button (Sign the roster, Read issue #N).
      primary: () => "cta",
    });
    this.#campaignId = data.campaignId;
    this.#state.runId = data.runId ?? null;
    this.#model = null;
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const [record, summaries] = await Promise.all([
      this.#state.runId ? campaignService().load(this.#state.runId) : Promise.resolve<CampaignRecord | null>(null),
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
    this.#state.marketOpenNow = false;
    if (record && this.#model.market) {
      const service = campaignService();
      const current = record.attempt ? await service.discardAttempt(record) : record;
      const nextNodeId = current.attempt?.nodeId ?? current.position.nextNodeId;
      const peeked = nextNodeId ? await service.compose(current, []) : null;
      if (!this.sys.isActive()) return;
      this.#state.marketOpenNow = peeked?.kind === "pending" && isMarketPendingChoice(peeked.choice, cardOf);
    }
    this.#rebuild();
  }

  #rebuild(): void {
    const model = this.#model;
    if (!this.#alive || !model) return;
    this.#glyphs.reset();
    this.#leases.begin();
    this.#actions.clear();
    this.#stops.clear();
    this.#obstacles.length = 0;

    const frame = campaignFrame(this);
    const b = new SheetBuilder(this.game, { x: 0, y: 0 }, isDesktopType);
    b.box({ x: 0, y: 0, width: frame.width, height: frame.height }, { fill: surface.ink.hex });
    if (frame.phone) this.#drawPhone(b, frame, model);
    else this.#drawWide(b, frame, model);

    const order = ["back", "cta", "dossier", "issues", "market", "expert"].filter((key) => this.#stops.has(key));
    this.#route?.set(order, new Map(this.#stops));
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

  // ---- Wide (desktop/tablet): art left, ink panel right ---------------------------------------------------------

  #drawWide(b: SheetBuilder, frame: ReturnType<typeof campaignFrame>, model: CoverModel): void {
    const artWidth = Math.round(frame.width * 0.53);
    this.#drawArt(b, { x: 0, y: 0, width: artWidth, height: frame.height }, model);
    this.#drawBack(b, 16, 16);
    drawTag(b, 24, frame.height - 24, model.tagline);

    const panelRect: Rect = { x: artWidth, y: 0, width: frame.width - artWidth, height: frame.height };
    b.box(panelRect, { fill: surface.ink.hex });

    const pad = 36;
    let y = pad;
    drawChip(b, panelRect.x + pad, y, this.#chipText(model));
    y += 54;

    const titleHeight = drawBalancedTitle(
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

    drawBottomBlock(this.#ctx, b, panelRect, pad, model);
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
    // The dark mode toggle hangs at the top centre with a press area cut out of the panel: a chip that would reach under
    // it (the Spanish "CAJA DE CAMPAÑA") gives way to the box code alone.
    const chipFull = this.#chipText(model);
    const chipRoom = frame.width - 16 - 215;
    const chipWide =
      b.measure(caseOf(typeRole.label, chipFull.toLocaleUpperCase()), typeRole.label, { letterSpacing: 1 }).width + 20;
    drawChip(b, 0, 16, chipWide <= chipRoom ? chipFull : model.boxCode, frame.width - 16);

    const titleHeight = drawBalancedTitle(b, 16, artHeight - 14, frame.width - 32, 100, model.name, "bottom");
    drawTag(b, 16, artHeight - 14 - titleHeight - 8, model.tagline);

    const panelRect: Rect = { x: 0, y: artHeight, width: frame.width, height: frame.height - artHeight };
    b.box(panelRect, { fill: surface.ink.hex });

    const pad = 16;
    b.text(pad, panelRect.y + 14, model.blurb, typeRole.body, {
      size: 12,
      color: surface.paper.hex,
      alpha: ink.secondary,
      wrapWidth: frame.width - pad * 2,
    });

    drawBottomBlock(this.#ctx, b, panelRect, pad, model);
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
}
