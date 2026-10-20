/**
 * The pure parts of lazy-loaded screens (`scenes/scene-loader.ts` does the Phaser side): the canonical draw order,
 * which scenes are registered up front, which sheets a screen needs registered before it starts, the order the idle
 * preload walks, and the queue that walks it. Nothing here imports Phaser or a scene module, so it is cheap to test.
 */

import { SCENES } from "./keys.js";

/**
 * Every scene in draw order, bottom to top: the order `main.ts` used to register them in. A scene added after boot is
 * slotted back into this order (`insertionIndex`), so a lazily loaded overlay still draws above the screen it opens
 * over and the chrome scenes still draw above everything (#176, #191).
 */
export const SCENE_ORDER: readonly string[] = [
  SCENES.boot,
  SCENES.title,
  SCENES.scenarioSelect,
  SCENES.seats,
  SCENES.setup,
  SCENES.setupDeal,
  SCENES.scenarioIntro,
  SCENES.board,
  SCENES.decks,
  SCENES.deckBuilder,
  SCENES.deckCheck,
  SCENES.campaignSaga,
  SCENES.campaignCover,
  SCENES.campaignRoster,
  SCENES.campaignOpener,
  SCENES.campaignBriefing,
  SCENES.campaignMarket,
  SCENES.campaignAftermath,
  SCENES.campaignRewind,
  SCENES.campaignRun,
  SCENES.campaignIssue,
  SCENES.campaignDossier,
  SCENES.campaignFinale,
  SCENES.campaignDeckEdit,
  SCENES.campaignFrozenDeck,
  SCENES.extras,
  SCENES.extrasReader,
  SCENES.trophyRoom,
  // Dev-only demo scenes: reachable only through `?screen=…` jumps (`scenes/boot-dev-jump.ts`).
  SCENES.termTextDemo,
  SCENES.guideCalloutDemo,
  SCENES.holdOnDemo,
  SCENES.guidePanelDemo,
  SCENES.guideSpotlightDemo,
  SCENES.guideChooser,
  SCENES.howToWin,
  SCENES.howToPlay,
  SCENES.newInBox,
  SCENES.civilWarBuilder,
  SCENES.aspectLesson,
  SCENES.choice,
  SCENES.setCards,
  SCENES.inspect,
  SCENES.villainPhase,
  SCENES.gameOver,
  SCENES.pause,
  SCENES.rules,
  SCENES.settings,
  SCENES.unlocks,
  SCENES.unlockConfirm,
  SCENES.nameConflict,
  SCENES.heroDecks,
  SCENES.saveData,
  SCENES.endTurnConfirm,
  SCENES.tutorialResumeConfirm,
  SCENES.holdOn,
  SCENES.roundDebrief,
  SCENES.campaignBeat,
  SCENES.teamUpSplash,
  SCENES.teamUpInfo,
  SCENES.evidence,
  SCENES.pileView,
  SCENES.extrasViewer,
  SCENES.music,
  // Above every screen and overlay, below the chrome that takes input.
  SCENES.powerSavingNotice,
  // Last, so they draw above every screen and overlay (#176, #191): the music player and its button, then the report
  // panel and the tab that opens it above that.
  SCENES.musicPlayer,
  SCENES.musicButton,
  SCENES.reportIssue,
  SCENES.reportButton,
];

/** Scenes that exist from the first frame: Boot, Title, the music controller and the chrome (`main.ts`). */
export const EAGER_SCENES: readonly string[] = [
  SCENES.boot,
  SCENES.title,
  SCENES.music,
  SCENES.powerSavingNotice,
  SCENES.musicPlayer,
  SCENES.musicButton,
  SCENES.reportIssue,
  SCENES.reportButton,
];

/** Scenes only a `?screen=` dev jump reaches; a production build has no loader for them. */
export const DEV_ONLY_SCENES: ReadonlySet<string> = new Set([
  SCENES.termTextDemo,
  SCENES.guideCalloutDemo,
  SCENES.holdOnDemo,
  SCENES.guidePanelDemo,
  SCENES.guideSpotlightDemo,
]);

const BOARD_SHEETS = [
  SCENES.choice,
  SCENES.setCards,
  SCENES.inspect,
  SCENES.villainPhase,
  SCENES.gameOver,
  SCENES.pause,
  SCENES.rules,
  SCENES.settings,
  SCENES.unlocks,
  SCENES.unlockConfirm,
  SCENES.saveData,
  SCENES.endTurnConfirm,
  SCENES.holdOn,
  SCENES.roundDebrief,
  SCENES.campaignBeat,
  SCENES.teamUpSplash,
  SCENES.teamUpInfo,
  SCENES.evidence,
  SCENES.pileView,
];

/**
 * Scenes that must be registered before a screen starts, because the screen (or a sheet it opens) reads them with
 * `scene.get(key)` straight after launching them (`settings.ts` waits on the Unlocks sheet's shutdown, the Board on the
 * villain phase's create), or lays them out against each other. Everything a screen only launches or brings to the top
 * is deferred by the loader on its own and needs no entry here.
 */
export const COMPANIONS: Readonly<Record<string, readonly string[]>> = {
  [SCENES.board]: BOARD_SHEETS,
  [SCENES.pause]: [SCENES.settings, SCENES.rules, SCENES.unlocks, SCENES.saveData, SCENES.unlockConfirm],
  [SCENES.settings]: [SCENES.unlocks, SCENES.saveData, SCENES.rules, SCENES.unlockConfirm],
  [SCENES.setupDeal]: [SCENES.choice, SCENES.inspect],
  [SCENES.setup]: [SCENES.setCards, SCENES.inspect, SCENES.nameConflict],
  [SCENES.seats]: [SCENES.setCards, SCENES.inspect, SCENES.nameConflict, SCENES.heroDecks],
  [SCENES.nameConflict]: [SCENES.inspect],
  [SCENES.villainPhase]: [SCENES.choice, SCENES.inspect, SCENES.pause],
  [SCENES.choice]: [SCENES.inspect],
};

/** The scenes (the key and its companions) that have to be registered before `key` can start. */
export function needed(key: string): readonly string[] {
  return [key, ...(COMPANIONS[key] ?? [])];
}

/**
 * Where a scene added at the end of the manager's list should go to sit in canonical order: just below the first
 * scene that is meant to draw above it. `current` is the manager's scene keys, bottom to top, without `key`.
 */
export function insertionIndex(
  current: readonly string[],
  key: string,
  order: readonly string[] = SCENE_ORDER,
): number {
  const rank = order.indexOf(key);
  if (rank === -1) return current.length;
  const above = current.findIndex((other) => {
    const otherRank = order.indexOf(other);
    return otherRank > rank;
  });
  return above === -1 ? current.length : above;
}

/**
 * The idle preload walks the screens a player is likely to open next first (the New game flow, Decks, Campaign,
 * Extras), then everything else in draw order.
 */
export const PRELOAD_FIRST: readonly string[] = [
  SCENES.scenarioSelect,
  SCENES.guideChooser,
  SCENES.decks,
  SCENES.campaignSaga,
  SCENES.extras,
  SCENES.seats,
  SCENES.setup,
  SCENES.settings,
  SCENES.howToPlay,
  SCENES.board,
];

export function preloadOrder(loadable: Iterable<string>, order: readonly string[] = SCENE_ORDER): string[] {
  const wanted = new Set(loadable);
  const first = PRELOAD_FIRST.filter((key) => wanted.has(key));
  const firstSet = new Set(first);
  return [...first, ...order.filter((key) => wanted.has(key) && !firstSet.has(key))];
}

/**
 * Walks `keys` one at a time, each in its own idle slot: `load` runs, and only when it settles is the next slot asked
 * for, so two chunks never evaluate back to back in one task. A key `done` already reports true for is skipped
 * without waiting for a slot (a tap loaded it first).
 */
export class IdlePreloader {
  readonly #queue: string[];
  readonly #load: (key: string) => Promise<unknown>;
  readonly #schedule: (run: () => void) => void;
  readonly #done: (key: string) => boolean;
  #started = false;

  constructor(options: {
    readonly keys: readonly string[];
    readonly load: (key: string) => Promise<unknown>;
    readonly schedule: (run: () => void) => void;
    readonly done: (key: string) => boolean;
  }) {
    this.#queue = [...options.keys];
    this.#load = options.load;
    this.#schedule = options.schedule;
    this.#done = options.done;
  }

  get remaining(): number {
    return this.#queue.length;
  }

  start(): void {
    if (this.#started) return;
    this.#started = true;
    this.#next();
  }

  #next(): void {
    while (this.#queue.length > 0 && this.#done(this.#queue[0]!)) this.#queue.shift();
    if (this.#queue.length === 0) return;
    this.#schedule(() => {
      const key = this.#queue.shift();
      if (key === undefined) return;
      const settled = (): void => this.#next();
      if (this.#done(key)) settled();
      else this.#load(key).then(settled, settled);
    });
  }
}

/** `requestIdleCallback` where there is one; WebKit lacks it, so a short timer stands in. */
export function idleSlot(run: () => void): void {
  const w = globalThis as unknown as {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(run, { timeout: 4000 });
  else setTimeout(run, 250);
}
