/**
 * The scheme fan (Stack schemes, Quin 2026-11-18): every scheme in play spread out from the table's scheme stack. On a
 * desktop or a tablet held sideways two to four schemes fan out in one tilted row, like a hand of cards; otherwise they
 * go in rows that scroll, one full-width card a row on a phone (`view/scheme-fan-layout.ts`). The cards fly out of the
 * stack when it opens (reduced motion places them).
 *
 * Read only: it sends no command. A tap on a card brings that scheme to the front of the stack and closes the fan; a
 * hold or right-click opens Inspect on it. Escape, B, Close and a tap off the panel close it. The pad and keyboard
 * move over Close and the cards; A picks, Y / I inspects.
 */
import Phaser from "phaser";
import type { InstanceId } from "@mc/engine";
import { cardArt, drawArt } from "../art/card-art.js";
import { appSession } from "../session.js";
import { schemeFanBackgroundAlpha } from "../settings.js";
import { ink, surface, typeRole } from "../tokens.js";
import { GlyphHints } from "../ui/glyph-hints.js";
import { HoverPreview, isMousePointer, resetHoverCards } from "../ui/card-hover-preview.js";
import { destroyChildren } from "../ui/destroy-children.js";
import { bindHoldTarget } from "../ui/hold-target.js";
import { addPressShield } from "../ui/press-shield.js";
import { McScrollRegion } from "../ui/scroll-region.js";
import { onTap } from "../ui/tap.js";
import { textStyle } from "../ui/theme.js";
import { OverlayMotion } from "../ui/transitions.js";
import { McButton, fitText, label, paintPanel, paintThreatMeter } from "../ui/widgets.js";
import type { SchemePanel } from "../view/board-model.js";
import { villainHoverArea } from "../view/card-hover.js";
import { formFactorFor, type Rect } from "../view/layout.js";
import { schemeFanLayout, schemeFanTitle, type SchemeFanLayout } from "../view/scheme-fan-layout.js";
import { VariableListScroll } from "../view/variable-list-scroll.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

export interface SchemeFanData {
  /** The scene that asked: its pointer and keys are off while this is up. */
  readonly from?: string;
  /** The schemes, front of the stack first. */
  readonly schemes: readonly SchemePanel[];
  /** The stack's front card on the table, where the cards fly out of; null places them. */
  readonly origin: Rect | null;
  /** Told the scheme the player picks, to bring it to the front of the stack. */
  readonly onPick: (id: InstanceId) => void;
}

/** Milliseconds a card takes to fly out of the stack, and how far apart the cards set off. */
const FLY_MS = 360;
const STAGGER_MS = 70;

export class SchemeFanOverlay extends Phaser.Scene {
  #data: SchemeFanData = { schemes: [], origin: null, onPick: () => {} };
  #buttons: McButton[] = [];
  #region: McScrollRegion | null = null;
  #scroll = new VariableListScroll();
  #route: FocusRoute | null = null;
  #motion = new OverlayMotion();
  #hover: HoverPreview | null = null;
  #artOff: (() => void) | null = null;
  #layout: SchemeFanLayout | null = null;
  #hints!: GlyphHints;
  /** The cards have flown out once: a redraw (art arriving, a resize) places them. */
  #flown = false;
  /** The fly-out tweens, stopped by a redraw that lands mid-flight (it rebuilds the cards they move). */
  #flights: Phaser.Tweens.Tween[] = [];

  constructor() {
    super(SCENES.schemeFan);
  }

  create(data: SchemeFanData): void {
    this.#data = data;
    this.#scroll = new VariableListScroll();
    this.#motion = new OverlayMotion();
    this.#flown = false;
    const from = this.scene.get(data.from ?? SCENES.board);
    if (from) {
      from.input.enabled = false;
      if (from.input.keyboard) from.input.keyboard.enabled = false;
    }
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    this.#hints = new GlyphHints(this, () => [...this.#visibleCards().values()]);
    this.#route = new FocusRoute(this, {
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => this.#close(),
      reachAcross: true,
      onScroll: (_dx, dy) => this.#region?.scrollByPx(dy),
    });
    this.#artOff = cardArt(this).onArrived(() => this.#draw());
    // The fan is a look at the schemes, never a place to act from: an ability used or a card played from the Inspect
    // sheet it opened, or any change to the game, puts the board back in front at once, so the prompt that follows is
    // never left under the fan (and the fan never shows schemes as they were).
    const leave = (): void => {
      if (this.scene.isActive()) this.scene.stop();
    };
    const actions = ["mc-use-ability", "mc-play-card"] as const;
    for (const action of actions) this.game.events.on(action, leave);
    const startGame = appSession().store.state.game;
    const unsubscribe = appSession().store.subscribe((state) => {
      if (state.game !== startGame) leave();
    });
    resetHoverCards(this);
    this.#hover = new HoverPreview(this, {
      cards: () => this.#visibleCards(),
      area: (pointer) => {
        const { width, height } = this.scale.gameSize;
        return villainHoverArea({
          formFactor: formFactorFor(width, height),
          mouse: isMousePointer(pointer),
          scale: appSession().settings.cardHoverScale,
          overlays: this.scene.isActive(SCENES.inspect) ? [SCENES.inspect] : [],
          viewport: { x: 0, y: 0, width, height },
        });
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", onResize, this);
      this.#artOff?.();
      for (const action of actions) this.game.events.off(action, leave);
      unsubscribe();
      this.#artOff = null;
      this.#hints.dispose();
      this.#hover?.destroy();
      this.#hover = null;
      this.#region?.destroy();
      this.#region = null;
      for (const button of this.#buttons) button.destroy();
      this.#buttons = [];
      if (from) {
        from.input.enabled = true;
        if (from.input.keyboard) from.input.keyboard.enabled = true;
      }
    });
    this.#draw();
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #pick(id: InstanceId): void {
    this.#data.onPick(id);
    this.#close();
  }

  #inspect(id: InstanceId): void {
    const siblings = this.#data.schemes.map((scheme) => scheme.instanceId);
    this.scene.launch(SCENES.inspect, { instanceId: id, siblings });
    this.scene.bringToTop(SCENES.inspect);
  }

  /** Each card's rect on screen right now, scroll applied; one scrolled out of the window has no hover. */
  #visibleCards(): ReadonlyMap<InstanceId, Rect> {
    const shown = new Map<InstanceId, Rect>();
    const layout = this.#layout;
    if (!layout) return shown;
    const offset = this.#scroll.offsetPx;
    const view = layout.list;
    this.#data.schemes.forEach((scheme, index) => {
      const card = layout.slots[index]!.card;
      const rect = { ...card, y: card.y - offset };
      if (rect.y + rect.height > view.y && rect.y < view.y + view.height) shown.set(scheme.instanceId, rect);
    });
    return shown;
  }

  #draw(): void {
    for (const flight of this.#flights) flight.stop();
    this.#flights = [];
    this.#region?.destroy();
    this.#region = null;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    destroyChildren(this);
    this.#hints.reset();
    const { width, height } = this.scale.gameSize;
    const { schemes } = this.#data;
    const layout = schemeFanLayout(width, height, schemes.length);
    this.#layout = layout;
    const { panel, bar, close, title, list } = layout;

    const shield = addPressShield(this, { x: 0, y: 0, width, height });
    onTap(shield, () => this.#close());
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.void.hex, 0.82).fillRect(0, 0, width, height);
    // The paper behind the cards is the player's choice, from none (the cards over the dimmed table) to solid.
    const paper = schemeFanBackgroundAlpha(appSession().settings.schemeFanBackground);
    const ground = this.add.graphics();
    if (paper > 0) {
      ground.fillStyle(surface.paper.hex, paper).fillRect(panel.x, panel.y, panel.width, panel.height);
      ground.lineStyle(4, surface.ink.hex, paper).strokeRect(panel.x, panel.y, panel.width, panel.height);
    }
    ground.fillStyle(surface.ink.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);
    // A paper sheet takes a press that lands on it; with none, a tap anywhere off a card closes the fan.
    if (paper > 0) this.add.zone(panel.x, panel.y, panel.width, panel.height).setOrigin(0, 0).setInteractive();
    const heading = this.add
      .text(
        title.x,
        title.y + title.height / 2,
        schemeFanTitle(schemes.length),
        textStyle(typeRole.barTitle, surface.paper.hex),
      )
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);
    fitText(heading, title.width, 12);

    const stops = new Map<string, FocusStop>();
    const order: string[] = [];
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: "Close",
        type: { ...typeRole.label, size: 13 },
        rect: close,
        onClick: () => this.#close(),
      }),
    );
    this.#hints.button(this.#buttons.at(-1)!, ["cancel"], "paper");
    stops.set("close", { rect: close, activate: () => this.#close() });
    order.push("close");

    const region = new McScrollRegion(this, {
      rect: list,
      heights: layout.rowHeights,
      scroll: this.#scroll,
      clipInteractive: true,
      onScroll: () => this.#hover?.onDraw(),
    });
    this.#region = region;
    const before = this.children.list.length;
    const cards: Phaser.GameObjects.Container[] = [];
    schemes.forEach((scheme, index) => {
      const slot = layout.slots[index]!;
      cards.push(this.#drawCard(scheme, slot.card, slot.angle, slot.lift));
      // Under the card: its threat meter.
      const meterRect: Rect = { x: slot.caption.x, y: slot.caption.y + 4, width: slot.caption.width, height: 20 };
      const mg = this.add.graphics();
      const meterText = this.add
        .text(meterRect.x + meterRect.width / 2, meterRect.y + meterRect.height / 2 - 1, "", {
          ...textStyle(typeRole.statSmall, surface.ink.hex),
        })
        .setOrigin(0.5)
        .setFontSize(13);
      paintThreatMeter(mg, meterText, meterRect, scheme, scheme.threat);
      const note = label(
        this,
        slot.caption.x,
        meterRect.y + meterRect.height + 3,
        scheme.subtitle,
        typeRole.label,
        // Over little or no paper the caption sits on the dark scrim, so it reads light there.
        paper >= 0.5 ? surface.ink.hex : surface.paper.hex,
        paper >= 0.5 ? ink.label : 0.9,
      );
      fitText(note, slot.caption.width, typeRole.label.size);
      // The tap target is the upright card, so a tilted corner is never a dead spot that closes the fan.
      const zone = this.add
        .zone(slot.card.x, slot.card.y, slot.card.width, slot.card.height)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      bindHoldTarget(this, zone, {
        key: `scheme-fan:${scheme.instanceId as string}`,
        onTap: () => this.#pick(scheme.instanceId),
        onInspect: () => this.#inspect(scheme.instanceId),
      });
      const key = `card:${index}`;
      const row = Math.floor(index / layout.columns);
      stops.set(key, {
        rect: () => ({ ...slot.card, y: slot.card.y - this.#scroll.offsetPx }),
        view: list,
        activate: () => this.#pick(scheme.instanceId),
        inspect: () => this.#inspect(scheme.instanceId),
        ensureVisible: () => region.scrollIntoView(row),
      });
      order.push(key);
    });
    region.content.add(this.children.list.slice(before));
    region.syncInteractivity();
    this.#route?.set(order, stops);
    this.#hover?.onDraw();
    this.#motion.enter(this, { scrim: [scrim], panels: [ground, heading] });
    this.#flyOut(cards, layout);
    if (import.meta.env.DEV) {
      (window as unknown as { __mcSchemeFanDebug?: unknown }).__mcSchemeFanDebug = {
        list: () => list,
        // Each card's rect on screen now, in stack order; null for one scrolled out of the window.
        cards: () => schemes.map((scheme) => this.#visibleCards().get(scheme.instanceId) ?? null),
        scrollY: () => this.#scroll.offsetPx,
      };
    }
  }

  /** A card drawn turned by `angle` degrees and raised by `lift`, as a container centred on its upright rect. */
  #drawCard(scheme: SchemePanel, rect: Rect, angle: number, lift: number): Phaser.GameObjects.Container {
    const card = this.add.container(rect.x + rect.width / 2, rect.y + rect.height / 2 - lift);
    const local: Rect = { x: -rect.width / 2, y: -rect.height / 2, width: rect.width, height: rect.height };
    const frame = this.add.graphics();
    paintPanel(
      frame,
      { x: local.x - 4, y: local.y - 4, width: local.width + 8, height: local.height + 8 },
      "card",
      "rest",
    );
    frame.fillStyle(surface.parchment.hex, 1).fillRect(local.x, local.y, local.width, local.height);
    card.add(frame);
    const art = drawArt(this, cardArt(this).request(this, scheme.art), local);
    if (art) card.add(art);
    else card.add(label(this, 0, 0, scheme.name, typeRole.rowTitle, surface.ink.hex, ink.body).setOrigin(0.5));
    card.setAngle(angle);
    return card;
  }

  /** The cards set off from the stack on the table one after another; once only, and placed under reduced motion. */
  #flyOut(cards: readonly Phaser.GameObjects.Container[], layout: SchemeFanLayout): void {
    const origin = this.#data.origin;
    if (this.#flown || !origin || appSession().settings.reducedMotion) {
      this.#flown = true;
      return;
    }
    this.#flown = true;
    const ox = origin.x + origin.width / 2;
    const oy = origin.y + origin.height / 2;
    cards.forEach((card, index) => {
      const slot = layout.slots[index]!;
      const scale = Math.min(1, origin.width / Math.max(1, slot.card.width));
      const to = { x: card.x, y: card.y, angle: card.angle };
      card.setPosition(ox, oy).setScale(scale).setAngle(0).setAlpha(0);
      const flight = this.tweens.add({
        targets: card,
        x: to.x,
        y: to.y,
        angle: to.angle,
        scale: 1,
        alpha: 1,
        delay: index * STAGGER_MS,
        duration: FLY_MS,
        ease: "Back.easeOut",
      });
      this.#flights.push(flight);
    });
  }
}
