/**
 * Settings ▸ Unlocks: the way around the unlock path (`progression/unlocks.ts`) for a player who doesn't want to
 * play through the campaigns. Champion points up top, one "Unlock everything" switch, then a scrolling list of the
 * campaigns and of every wave (with what opens it) and every hero in it, each campaign and hero with its own switch.
 *
 * Anything that costs points asks first (`scenes/unlock-confirm.ts`, shared with every screen that unlocks), saying what it costs, that it
 * isn't refunded, and how to earn the same thing by play. Switching something off never asks.
 *
 * Launched over Settings (`scenes/settings.ts`); Back or Escape stops only this overlay, back to Settings. Rows and
 * wording come from `view/unlocks-model.ts`; this scene hands them to the page and saves a choice through
 * `setUnlockPrefs`, which every picker reads the next time it draws.
 *
 * **The screen is one custom element**, `mc-unlocks-page` (`views/unlocks/`), composing the sections in
 * `components/unlocks/` (points, switches, list, guide) under an `mc-top-bar`. The scene keeps the press shield, the
 * entrance and exit motion, the focus route (ring in the panel layer, `dom/dom-ring.ts`) and the choices.
 */
import Phaser from "phaser";
import "@mc/ui";
import "../views/unlocks/mc-unlocks-page/mc-unlocks-page.js";
import { ControlGlyphs } from "../dom/control-glyphs.js";
import { domFocusRing } from "../dom/dom-ring.js";
import { mountElement, type MountedElement } from "../dom/element-region.js";
import { renderDeep } from "../dom/element-render.js";
import { bindStopFocus, focusStopsOf } from "../dom/element-stops.js";
import { hintGlyphOf } from "../dom/hint-glyph.js";
import { t } from "../i18n/translate.js";
import { onLanguageChange } from "../language-change.js";
import { addPressShield } from "../ui/press-shield.js";
import { OverlayMotion } from "../ui/transitions.js";
import { formFactorFor } from "../view/layout.js";
import { progressionGuideOf } from "../view/progression-guide.js";
import {
  pointsRowOf,
  printAndPlayRowOf,
  printAndPlayTapOf,
  rowTapOf,
  switchLabel,
  switchToggleable,
  tapOf,
  unlockAllRowOf,
  unlockListRowsOf,
  type UnlockAllRow,
  type UnlockListRow,
  type UnlockTap,
} from "../view/unlocks-model.js";
import type { UnlocksEventDetail, UnlocksListRow, UnlocksSwitchInput } from "../components/unlocks/unlocks.types.js";
import { setUnlockPrefs, unlocks } from "../progression/progression.js";
import { FocusRoute } from "./focus-route.js";
import { SCENES } from "./keys.js";
import { askToUnlock } from "./unlock-confirm.js";

/** Launch data, for a Settings search result: a row to show, or a section of "How it works" to open on. */
export interface UnlocksSceneData {
  readonly row?: string;
  readonly guideSection?: number;
}

const switchOf = (row: UnlockAllRow): UnlocksSwitchInput => ({
  title: row.title,
  detail: row.detail,
  state: row.on ? t("settings.toggleOn") : t("settings.toggleOff"),
  on: row.on,
});

const rowOf = (row: UnlockListRow): UnlocksListRow =>
  row.kind === "section" || row.kind === "wave"
    ? row
    : {
        kind: "switch",
        id: row.id,
        title: row.title,
        detail: row.detail,
        state: switchLabel(row.state),
        on: row.state === "on",
        stop: row.kind === "hero" || row.kind === "campaign",
        unavailable: !switchToggleable(row.state),
      };

export class UnlocksOverlay extends Phaser.Scene {
  #route: FocusRoute | null = null;
  #mounted: MountedElement<HTMLElementTagNameMap["mc-unlocks-page"]> | null = null;
  #glyphs!: ControlGlyphs;
  #motion = new OverlayMotion();
  #anchor: Phaser.GameObjects.Graphics | null = null;
  /** Showing "How it works" (`view/progression-guide.ts`) in place of the switches. */
  #guide = false;
  #cameForGuide = false;
  #stamp = 0;
  /** The list's rows by id, to answer a tap. */
  #rows = new Map<string, UnlockListRow>();

  constructor() {
    super(SCENES.unlocks);
  }

  create(data: UnlocksSceneData = {}): void {
    // Phaser hands a later launch with no data this same object again: take the row or section once.
    this.sys.settings.data = {};
    this.#motion = new OverlayMotion();
    // A search result that opened on the guide backs out to the search, as it came.
    this.#cameForGuide = data.guideSection !== undefined;
    this.#guide = this.#cameForGuide;
    const { width, height } = this.scale.gameSize;
    // Swallows every press that lands on no control of this overlay's own, so none reaches Settings, Pause or the Board.
    addPressShield(this, { x: 0, y: 0, width, height });
    // Nothing drawn: the entrance and exit tween this, and the panel rises and fades with it (`DomRegion.follow`).
    this.#anchor = this.add.graphics();
    const mounted = mountElement(this, "mc-unlocks-page", { x: 0, y: 0, width, height });
    this.#mounted = mounted;
    mounted.region.follow(this.#anchor);
    mounted.element.addEventListener("mc-unlocks", (event) => this.#heard(event.detail));
    const unbind = bindStopFocus(mounted.element, (key) => this.#route?.focusKey(key));
    this.#glyphs = new ControlGlyphs(this, () => this.#draw());
    this.#route = new FocusRoute(this, {
      ring: domFocusRing,
      blocked: () => this.scene.isActive(SCENES.unlockConfirm),
      // LB / RB switch between the switches and "How it works"; PageUp / PageDown page the list or the text.
      onTab: (direction) => {
        if (this.#guide !== (direction === 1)) this.#showGuide(direction === 1);
      },
      onHomeEnd: (edge) => this.#scroller()?.scrollTo({ top: edge === "home" ? 0 : 1e6 }),
      onCancel: () => (this.#guide && !this.#cameForGuide ? this.#showGuide(false) : this.#close()),
      onPage: (direction) =>
        this.#scroller()?.scrollBy({ top: direction * Math.max(120, (this.#scroller()?.clientHeight ?? 0) - 60) }),
      onScroll: (_dx, dy) => this.#scroller()?.scrollBy({ top: dy }),
    });
    const onResize = (): void => this.#draw();
    this.scale.on("resize", onResize, this);
    const offLanguage = onLanguageChange(onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbind();
      this.#glyphs.dispose();
      this.scale.off("resize", onResize, this);
      offLanguage();
      this.#mounted = null;
    });
    this.#draw(() => {
      const page = this.#mounted?.element;
      if (data.guideSection !== undefined) page?.showGuideSection(data.guideSection);
      if (data.row !== undefined) this.#showRow(data.row);
    });
  }

  #scroller(): HTMLElement | null {
    return this.#mounted?.element.scroller ?? null;
  }

  /** Brings a row into view and puts the ring on it (a Settings search result). A scenario row has no stop: in view only. */
  #showRow(id: string): void {
    this.#mounted?.element.showRow(id);
    this.#route?.focusKey(`row:${id}`);
  }

  #close(): void {
    this.#motion.exit(this, () => this.scene.stop());
  }

  #heard(detail: UnlocksEventDetail): void {
    if (this.#motion.leaving) return;
    switch (detail.type) {
      case "back":
        return this.#close();
      case "guide":
        return this.#showGuide(!this.#guide);
      case "all": {
        const current = unlocks();
        return this.#apply(tapOf(current, { kind: "everything" }, current.prefs.unlockAll));
      }
      case "pnp":
        setUnlockPrefs(printAndPlayTapOf(unlocks()));
        return this.#draw();
      case "row": {
        const row = this.#rows.get(detail.id);
        if (row) this.#apply(rowTapOf(unlocks(), row));
      }
    }
  }

  #apply(tap: UnlockTap): void {
    if (!tap) return;
    if (tap.kind === "apply") setUnlockPrefs(tap.prefs);
    else askToUnlock(this, tap.confirm.target, () => this.#draw());
    this.#draw();
  }

  #showGuide(on: boolean): void {
    this.#guide = on;
    this.#draw();
  }

  #draw(after?: () => void): void {
    const mounted = this.#mounted;
    if (this.#motion.leaving || !mounted) return;
    const { region, element } = mounted;
    const { width, height } = this.scale.gameSize;
    const stamp = ++this.#stamp;
    const form = formFactorFor(width, height);
    const phone = form === "phone" || form === "phoneLandscape";
    this.#glyphs.reset();
    const current = unlocks();
    const list = unlockListRowsOf(current);
    this.#rows = new Map(list.map((row) => [row.id, row]));
    const backLabel = phone ? "◂" : "◂ " + t("guide.back");
    const title = this.#guide ? t("unlocks.guideTitle") : t("settings.unlocks.title");
    const door = this.#guide ? "◂ " + t("settings.unlocks.title") : t("unlocks.guideTitle");
    const backGlyph = this.#glyphs.glyph("back", ["cancel"], "ink", 44);
    const doorGlyph = this.#glyphs.glyph("guide", [this.#guide ? "zonePrevious" : "zoneNext"], "ink", 44);
    this.#glyphs.settled();
    region.setRect({ x: 0, y: 0, width, height });
    element.model = {
      phone,
      bar: {
        title,
        backLabel,
        backGlyph: hintGlyphOf(backGlyph),
      },
      door: { label: door, glyph: hintGlyphOf(doorGlyph) },
      guide: this.#guide,
      points: pointsRowOf(current),
      all: switchOf(unlockAllRowOf(current)),
      printAndPlay: switchOf(printAndPlayRowOf(current)),
      rows: list.map(rowOf),
      sections: this.#guide ? progressionGuideOf() : [],
    };
    this.#motion.enter(this, { scrim: [], panels: this.#anchor ? [this.#anchor] : [] });
    void renderDeep(element).then(() => {
      if (stamp !== this.#stamp || !this.#mounted) return;
      const stops = focusStopsOf(element, (target) => region.rectOf(target));
      const order = ["back", "guide"];
      if (!this.#guide) {
        order.push("row:all", "row:pnp");
        for (const row of list) if (row.kind === "hero" || row.kind === "campaign") order.push(`row:${row.id}`);
      }
      this.#route?.set(
        order.filter((key) => stops.has(key)),
        stops,
      );
      after?.();
    });
  }
}
