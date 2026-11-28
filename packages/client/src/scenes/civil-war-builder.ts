/**
 * The Civil War scenario builder (docs/phase7-wave10-client.md section 2): five steps (side, leader, main scheme, modular
 * sets, review and play) over one draft. A thin view: `view/civil-war-builder-model.ts` decides every row, tile, reason and
 * action string, and `@mc/cards`' offer (through the model) every refusal. This scene hands the model's view to the page,
 * sends the action string a tap or key names to `applyBuilderAction`, and carries out the navigation effects it returns. It
 * counts nothing and checks no side or stage itself.
 *
 * **The screen is one custom element**, `mc-civil-war-page` (`views/civil-war/`), composing the sections in
 * `components/civil-war/` (the step rail, sides, leaders, main scheme, modular sets, review, summary, foot and the
 * cards-in-this-set sheet) under an `mc-top-bar`. Every card picture is an `mc-card-art`, so a mouse over it opens the card
 * hover popover and a hold reads it in Inspect. Every control is a focus stop keyed by its action string.
 *
 * Start hands the draft to Take your seats (docs 2.10), the way Scenario select's "Choose heroes" does. While the Civil War
 * scenarios are not in the client pool (`content/pool.ts`; task C10) the hand-off is `blocked` and says so on the status
 * line rather than starting a game the seats screen cannot build (`view/civil-war-entry.ts#handoffOf`).
 */
import Phaser from "phaser";
import "@mc/ui";
import type { PictureSource } from "@mc/ui";
import { WAVE10_SCENARIOS, type CardId, type Deck } from "@mc/content";
import "../views/civil-war/mc-civil-war-page/mc-civil-war-page.js";
import type { CivilPageModel, CivilPictures, CivilWarEventDetail } from "../components/civil-war/civil-war.types.js";
import { CARDS_BY_ID, POOL_ENCOUNTER_SETS, POOL_SCENARIOS } from "../content/pool.js";
import { artFor, defaultFaceFor, type ArtSource, type CardFace } from "../art/art-source.js";
import { ART_CATALOG, villainArtFor } from "../art/scenario-art.js";
import { CardEvents } from "../dom/card-events.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { PictureLeases } from "../dom/picture-leases.js";
import { surface } from "../tokens.js";
import { cssOf } from "../ui/theme.js";
import { HoverPreview, resetHoverCards, screenHoverArea } from "../ui/card-hover-preview.js";
import { fadeScreenIn, goToScreen } from "../ui/transitions.js";
import { appSession } from "../session.js";
import { cardSizeFactor } from "../settings.js";
import {
  applyBuilderAction,
  builderViewOf,
  defaultStatusOf,
  refusalOf,
  setSheetFor,
  type BuilderContext,
  type BuilderView,
  type RandomPins,
} from "../view/civil-war-builder-model.js";
import type { BuilderStep } from "../view/civil-war-builder-layout.js";
import type { FaceRef } from "../view/civil-war-builder-art.js";
import { cardsRandomizer } from "../view/civil-war-random.js";
import { handoffOf, lastBuilderOrigin, rememberBuild, type BuilderHandoff } from "../view/civil-war-entry.js";
import { offerOf } from "../view/setup-options.js";
import { heroSharingLeaderTitle, sealedScenarioOf, sealingFor, stopSealing } from "../view/competitive-seal.js";
import { formFactorFor } from "../view/layout.js";
import { roomState, submitScenario } from "../platform/room.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange, onArtChange } from "../language-change.js";
import type { SetupDraft } from "../view/setup-draft.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { InspectData } from "./inspect.js";
import type { SeatsData } from "./seats.js";
import type { ScenarioSelectData } from "./scenario-select.js";

export interface CivilWarBuilderData {
  readonly draft: SetupDraft;
  /** The step to open on: the review for "Customize", the side step for "Build your own". */
  readonly step?: BuilderStep;
  /** Seated decks Take your seats must know before its own list loads, carried through to it and back (#958). */
  readonly seedDecks?: readonly Deck[];
}

const LEADER_FOCUS = { x: 0.5, y: 0.12 } as const;

export class CivilWarBuilderScene extends Phaser.Scene {
  #draft!: SetupDraft;
  #seedDecks: readonly Deck[] = [];
  #step: BuilderStep = 5;
  #status: string | null = null;
  #otherSideExpanded = false;
  #pins: RandomPins = {};
  #view: BuilderView | null = null;
  #model: CivilPageModel | null = null;
  #handoff: BuilderHandoff | null = null;
  #stops = new Map<string, FocusStop>();
  #route: FocusRoute | null = null;
  /** The open "cards in this set" sheet, by set id; null when closed. */
  #sheet: string | null = null;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-civil-war-page"]> | null = null;
  #glyphs!: ControlGlyphs;
  #cards: CardEvents | null = null;
  #hover: HoverPreview | null = null;
  readonly #leases = new PictureLeases();
  #stamp = 0;
  #statusShown = "";

  constructor() {
    super(SCENES.civilWarBuilder);
  }

  init(data: CivilWarBuilderData): void {
    this.#draft = data.draft;
    this.#seedDecks = data.seedDecks ?? [];
    this.#step = data.step ?? 5;
    this.#status = null;
    this.#otherSideExpanded = false;
    this.#pins = {};
    const sealing = sealingFor();
    if (sealing) this.#status = t("comp.builder.note", { side: t(`comp.side.${sealing}` as const) });
    this.#handoff = null;
    this.#sheet = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    const { width, height } = this.scale.gameSize;
    const mounted = mountElement(this, "mc-civil-war-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    const { region, element } = mounted;
    element.addEventListener("mc-civil-war", (event) => this.#heard(event.detail));
    const unbind = bindStopFocus(element, (key) => this.#route?.focusKey(key), { visibleOnly: true });
    this.#leases.watch(element);
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    // Every card picture raises the hover events and Inspect (`watchCard`): the scene makes the one popover.
    this.#cards = new CardEvents(region);
    this.#cards.onInspect = (cardId, face) => {
      const card = CARDS_BY_ID.get(cardId);
      if (card) this.#inspect({ cardId, face: (face ?? defaultFaceFor(card)) as CardFace });
    };
    this.#hover = new HoverPreview(this, {
      cardIds: () => this.#cards?.hovered() ?? new Map(),
      area: (pointer) => screenHoverArea(this, pointer),
    });
    region.forwardMouseMoves(() => this.#hover?.suppress());
    region.setHoles(() => {
      const popover = this.#hover?.shownRect;
      return popover ? [popover] : [];
    });
    this.scale.on("resize", this.#draw, this);
    const offLanguage = onLanguageChange(() => this.#draw());
    const offArt = onArtChange(() => this.#draw());
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbind();
      offLanguage();
      offArt();
      this.scale.off("resize", this.#draw, this);
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
      this.#hover?.destroy();
      this.#hover = null;
      this.#cards?.destroy();
      this.#cards = null;
      this.#glyphs.dispose();
      this.#leases.dispose();
      this.#mounted = null;
    });
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      // Inspect opens over this screen and owns Escape and the arrows while it is up.
      blocked: () => this.scene.isActive(SCENES.inspect),
      onCancel: () => (this.#sheet !== null ? this.#setSheet(null) : this.#act("civil:back")),
      onScroll: (_dx, dy) => this.#mounted?.element.scroller?.scrollBy({ top: dy }),
      // A keyboard or pad user reads a disabled tile's reason by moving onto it.
      onFocusChange: (key) => {
        const reason = key && this.#view ? refusalOf(this.#view, key) : null;
        if (reason !== null) this.#showNotice(reason);
      },
    });
    if (import.meta.env.DEV) this.#publishDebug();
    this.#draw();
    fadeScreenIn(this);
  }

  // ---- state ----

  #context(): BuilderContext {
    return {
      cards: CARDS_BY_ID,
      scenarios: WAVE10_SCENARIOS,
      encounterSets: POOL_ENCOUNTER_SETS,
      offer: offerOf(this.#draft),
      step: this.#step,
      otherSideExpanded: this.#otherSideExpanded,
      status: this.#status,
      extraSets: 0,
      pins: sealingFor() ? { ...this.#pins, side: true } : this.#pins,
      random: cardsRandomizer,
      ...(sealingFor() ? { sealSide: sealingFor()! } : {}),
    };
  }

  #heard(detail: CivilWarEventDetail): void {
    switch (detail.type) {
      case "act":
        return this.#act(detail.action);
      case "inspect":
        return this.#inspect(detail);
      case "sheet":
        return this.#setSheet(detail.id);
    }
  }

  /** Sends one action string through the model and carries out what it asks of the scene. */
  #act(action: string): void {
    const ctx = this.#context();
    const refusal = this.#view ? refusalOf(this.#view, action) : null;
    const result = applyBuilderAction(this.#draft, action, ctx);
    this.#draft = result.draft;
    this.#status = result.status ?? refusal;
    const effect = result.effect;
    if (effect?.kind === "step") {
      this.#step = effect.step;
      this.#mounted?.element.scroller?.scrollTo({ top: 0 });
    } else if (effect?.kind === "toggleOtherSide") {
      this.#otherSideExpanded = !this.#otherSideExpanded;
    } else if (effect?.kind === "back") {
      this.#leave();
      return;
    } else if (effect?.kind === "start") {
      if (this.#start()) return;
    } else if (effect?.kind === "pins") {
      this.#pins = effect.pins;
    } else if (effect?.kind === "random" && !result.status) {
      // The roll is an ordinary set of picks: show it on the review, where the player can read it and still edit.
      this.#step = 5;
      this.#mounted?.element.scroller?.scrollTo({ top: 0 });
    }
    this.#draw();
  }

  /** True when the scene navigated away. */
  #start(): boolean {
    const view = builderViewOf(this.#draft, this.#context());
    if (!view?.canStart) {
      this.#status = view?.startProblem ?? null;
      return false;
    }
    if (sealingFor()) return this.#seal();
    rememberBuild(this.#draft);
    const handoff = handoffOf(this.#draft, new Set(POOL_SCENARIOS.map((s) => s.id as string)));
    this.#handoff = handoff;
    if (handoff.kind === "blocked") {
      this.#status = handoff.message;
      return false;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.seats, {
      draft: handoff.draft,
      backTo: "civil-war-builder",
      ...(this.#seedDecks.length > 0 ? { seedDecks: this.#seedDecks } : {}),
    } satisfies SeatsData);
    return true;
  }

  /** Competitive: sends this side's scenario to the room, sealed, and goes back to the lobby. Never kept anywhere else. */
  #seal(): boolean {
    const team = sealingFor();
    const sealed = team ? sealedScenarioOf(this.#draft, offerOf(this.#draft)) : null;
    if (!team || !sealed) return false;
    // A team cannot field a hero that shares a title with its own leader (MC56 pp. 14, 16): say so before sealing.
    const room = roomState();
    const mine = room.competitive?.teams[team].seats ?? [];
    const heroes = room.seats.filter((seat) => mine.includes(seat.id)).map((seat) => seat.deck?.hero ?? null);
    const leaderCard = builderViewOf(this.#draft, this.#context())?.summaryArt.leader.cardId ?? "";
    const leader = CARDS_BY_ID.get(leaderCard)?.name ?? "";
    const clash = heroSharingLeaderTitle(heroes, leader, CARDS_BY_ID);
    if (clash) {
      this.#status = t("comp.builder.clash", { hero: clash, leader });
      this.#draw();
      return false;
    }
    submitScenario(sealed, team);
    stopSealing();
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.roomLobby);
    return true;
  }

  #leave(): void {
    if (sealingFor()) {
      stopSealing();
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.roomLobby);
      return;
    }
    rememberBuild(this.#draft);
    this.scale.off("resize", this.#draw, this);
    if (lastBuilderOrigin() === "title") {
      goToScreen(this, SCENES.title);
      return;
    }
    goToScreen(this, SCENES.scenarioSelect, {
      draft: this.#draft,
      ...(this.#seedDecks.length > 0 ? { seedDecks: this.#seedDecks } : {}),
    } satisfies ScenarioSelectData);
  }

  /** Says a refusal on the status line without drawing the page again (the ring just moved onto a disabled tile). */
  #showNotice(text: string): void {
    this.#status = text;
    this.#statusShown = text;
    if (this.#mounted && this.#model) this.#mounted.element.model = { ...this.#model, status: text };
  }

  #setSheet(id: string | null): void {
    this.#sheet = id;
    this.#draw();
    if (id === null) return;
    this.#mounted?.element.scroller?.scrollTo({ top: 0 });
  }

  #inspect(card: {
    readonly cardId: string;
    readonly face: FaceRef["face"];
    readonly choice?: InspectData["choice"];
  }): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: card.cardId as CardId, face: card.face },
      ...(card.choice ? { choice: card.choice } : {}),
    } satisfies InspectData);
    this.scene.bringToTop(SCENES.inspect);
  }

  /** Inspect's "Choose this ..." button: the same action string a tap on the choice sends. */
  #onInspectChoose(optionId: string): void {
    if (optionId.startsWith("civil:")) this.#act(optionId);
  }

  // ---- pictures ----

  /** What a picture hands its tile: the leased URL, the words it says while it has none, and how it fills the box. */
  #picture(source: ArtSource | null, missing: string, cover?: PictureSource["cover"]): PictureSource {
    const held = this.#leases.image(source);
    return {
      src: held.src,
      fill: "var(--mc-fill-parchment)",
      ...(missing ? { missing } : {}),
      ...(cover ? { cover } : {}),
      ...(held.retry !== undefined ? { retry: held.retry } : {}),
    };
  }

  #picturesOf(): CivilPictures {
    return {
      leader: (scenarioId, cardId) => {
        const picture = villainArtFor(ART_CATALOG, scenarioId);
        const card = CARDS_BY_ID.get(cardId);
        const source: ArtSource | null = picture
          ? { key: picture.url, url: picture.url }
          : card
            ? artFor(card, { kind: "villainStage", sideIndex: 0, stageIndex: 0 })
            : null;
        return this.#picture(source, card?.name ?? "", LEADER_FOCUS);
      },
      face: (face) => this.#picture(face ? artFor(CARDS_BY_ID.get(face.cardId), face.face) : null, face?.name ?? ""),
      back: this.#picture(artFor(undefined, { kind: "back", back: "encounter" }), ""),
    };
  }

  // ---- drawing ----

  #draw(): void {
    const mounted = this.#mounted;
    if (!mounted) return;
    const { region, element } = mounted;
    const stamp = ++this.#stamp;
    const view = builderViewOf(this.#draft, this.#context());
    if (!view) {
      this.#leave();
      return;
    }
    this.#view = view;
    resetHoverCards(this);
    const { width, height } = this.scale.gameSize;
    const form = formFactorFor(width, height);
    const mode = form === "phone" || form === "phoneLandscape" ? "phone" : form === "desktop" ? "wide" : "tablet";
    this.#glyphs.reset();
    const backGlyph = this.#glyphs.glyph("back", ["cancel"], "ink", 44);
    this.#glyphs.settled();
    this.#leases.begin();
    this.#statusShown = view.statusLine ?? defaultStatusOf(view);
    const sheetId = this.#sheet;
    let sheet: CivilPageModel["sheet"] = null;
    if (sheetId !== null) {
      const tile = view.modular.sections.flatMap((s) => s.tiles).find((tileView) => tileView.id === sheetId);
      sheet = {
        view: setSheetFor(this.#context(), sheetId),
        picked: tile?.selected ?? false,
        enabled: tile?.enabled ?? false,
        reason: tile && !tile.enabled ? (tile.disabledReason ?? null) : null,
      };
    }
    this.#model = {
      mode,
      view,
      pictures: this.#picturesOf(),
      bar: { backLabel: mode === "phone" ? "◂" : "◂ " + t("guide.back"), backGlyph: hintGlyphOf(backGlyph) },
      status: this.#statusShown,
      sheet,
    };
    region.setRect({ x: 0, y: 0, width, height });
    element.model = this.#model;
    void renderDeep(element).then(() => {
      if (stamp !== this.#stamp || !this.#mounted) return;
      this.#leases.end();
      this.#syncStops(view);
      this.#hover?.onDraw();
    });
  }

  /** The route's stops: the page's `data-stop` parts, in the model's own order, or the sheet's alone while it is open. */
  #syncStops(view: BuilderView): void {
    const mounted = this.#mounted;
    if (!mounted || !this.#route) return;
    const { region, element } = mounted;
    this.#stops = focusStopsOf(element, (target) => region.rectOf(target));
    let order: readonly string[] = view.focusOrder;
    if (this.#sheet !== null) {
      const keys = [...this.#stops.keys()];
      order = [...keys.filter((key) => key.startsWith("civil:sheet:card:")), "civil:sheet:action", "civil:sheet:close"];
    }
    this.#route.set(
      order.filter((key) => this.#stops.has(key)),
      this.#stops,
    );
  }

  // ---- dev hook ----

  /** Dev e2e hook (never referenced by product code): the view, the draft, and `act` to send an action string. */
  #publishDebug(): void {
    const pictures = (selector: string): { drawn: number; waiting: number } => {
      const found: { picture?: PictureSource | null }[] = [];
      const visit = (node: ParentNode): void => {
        for (const child of node.querySelectorAll<HTMLElement & { picture?: PictureSource | null }>("*")) {
          if (child.matches(selector)) found.push(child);
          if (child.shadowRoot) visit(child.shadowRoot);
        }
      };
      if (this.#mounted) visit(this.#mounted.element);
      const drawn = found.filter((one) => (one.picture?.src ?? null) !== null).length;
      return { drawn, waiting: found.length - drawn };
    };
    (window as unknown as { __mcBuilderDebug?: unknown }).__mcBuilderDebug = {
      view: () => this.#view,
      draft: () => this.#draft,
      act: (action: string) => this.#act(action),
      status: () => this.#statusShown,
      thumbs: () => ({
        leader: pictures("mc-picture-tile:not(.back):not(.set)"),
        card: pictures("mc-card-art"),
        back: pictures("mc-picture-tile.back, mc-picture-tile.set"),
        sheet: this.#sheet,
      }),
      focused: () => this.#route?.focused ?? null,
      handoff: () => this.#handoff,
      cardSize: () => cardSizeFactor(appSession().settings.cardSize),
      stops: () =>
        [...this.#stops].map(([key, stop]) => ({
          key,
          ...(typeof stop.rect === "function" ? stop.rect() : stop.rect),
        })),
    };
  }
}
