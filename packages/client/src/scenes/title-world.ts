/**
 * What redraws the Title from outside it, and how the pad and keyboard walk it. `watchTitleWorld` subscribes the
 * redraws (a resize, a language switch, power saving, a sync, mod pack updates, the network) and returns the one function
 * that takes them all down; `titleRouteOptions` is the focus route's wiring.
 */
import Phaser from "phaser";
import { onLanguageChange } from "../language-change.js";
import { CHECK_INTERVAL_MS, checkPackUpdates, onPackUpdateCount } from "../packs/pack-updates.js";
import { onPowerSavingChange } from "../platform/power-saving.js";
import { onSyncApplied } from "../sync/sync-events.js";
import { domFocusRing } from "../dom/dom-ring.js";
import type { FocusRouteOptions } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** Everything that redraws the page. `savesChanged` is a sync that may have brought in saves from another device (#276). */
export function watchTitleWorld(scene: Phaser.Scene, redraw: () => void, savesChanged: () => void): () => void {
  const live = (): void => {
    if (scene.sys.isActive()) redraw();
  };
  scene.scale.on("resize", live);
  const off = [
    onPowerSavingChange(live),
    // A language switch (#390): the menu reads again in the new language.
    onLanguageChange(live),
    onSyncApplied(() => {
      if (scene.sys.isActive()) savesChanged();
    }),
    // Installed mod packs with a newer version in the store: the Mod Store button and icon wear the count.
    onPackUpdateCount(live),
  ];
  // Checked again while the Title stays open (the checker fetches at most once an interval) and when the network comes
  // back, so an update published meanwhile, or a check that failed offline, still reaches the badge.
  void checkPackUpdates();
  const timer = scene.time.addEvent({ delay: CHECK_INTERVAL_MS, loop: true, callback: () => void checkPackUpdates() });
  // The "Play online" panel reads as unavailable while offline, and again as available once the network is back.
  const recheck = (): void => {
    void checkPackUpdates();
    live();
  };
  globalThis.addEventListener?.("online", recheck);
  globalThis.addEventListener?.("offline", live);
  return () => {
    timer.remove();
    scene.scale.off("resize", live);
    globalThis.removeEventListener?.("online", recheck);
    globalThis.removeEventListener?.("offline", live);
    for (const unsubscribe of off) unsubscribe();
  };
}

export interface TitleRouteHooks {
  readonly scroller: () => HTMLElement | null;
  readonly focusChanged: () => void;
  readonly starting: () => boolean;
  /** The key of the first stop that opens the games list (a game's Resume, the games row, the remove question). */
  readonly gamesStop: () => string | undefined;
  readonly focusKey: (key: string) => void;
  readonly trophies: () => void;
}

export function titleRouteOptions(scene: Phaser.Scene, hooks: TitleRouteHooks): FocusRouteOptions {
  return {
    // The icon row ends over the "Play online" panel on a wide screen: Down from it still goes to the menu column.
    notBelowChrome: ["play-online-host", "play-online-join"],
    // Up from the menu's first row reaches the icon row, then the notice bar above it.
    barAboveChrome: "release-notice",
    // The page is a DOM layer over the canvas, so the ring is drawn there too.
    ring: domFocusRing,
    // The right stick scrolls a menu that is too tall for the window.
    onScroll: (_dx, dy) => hooks.scroller()?.scrollBy({ top: dy }),
    // The press glyphs on the focused control are the page's words: redraw them.
    onFocusChange: hooks.focusChanged,
    blocked: () =>
      scene.scene.isActive(SCENES.inspect) ||
      scene.scene.isActive(SCENES.settings) ||
      scene.scene.isActive(SCENES.steamUpdate) ||
      scene.scene.isActive(SCENES.gamesList),
    // R3 (and the Expand key, F / ;) snaps focus to the in-progress games, ready to scroll.
    onExpand: () => {
      if (hooks.starting()) return;
      const stop = hooks.gamesStop();
      if (stop) hooks.focusKey(stop);
    },
    // X (G / H) closes the Building your stats toast while it shows; its ✕ wears the glyph.
    onToggle: () => {
      if (scene.scene.isActive(SCENES.backfillToast))
        (scene.scene.get(SCENES.backfillToast) as unknown as { dismiss(): void }).dismiss();
    },
    // View / Back (and the Peek key) is the Trophy Room, the same as its button.
    onView: () => {
      if (!hooks.starting()) hooks.trophies();
    },
  };
}
