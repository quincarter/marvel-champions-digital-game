/**
 * "How to win" (guided mode G6b, `docs/guided-mode.md` §4, §5.1's lesson 1): content and layout for the pre-game
 * screen between the chooser's "Learn as you play" and the tutorial board — P02 "One way to win, two ways to
 * lose". Pure data plus a pure layout, the same split as `guide-chooser-model.ts`.
 *
 * **Every number is real, never the design tile's placeholder Crossbones/12-threat matchup** (`docs/guided-mode.md`
 * §1): `howToWinContent` reads the app's own pool (`content/pool.ts`) for the tutorial matchup (§3.1) — Rhino
 * standard's own stage count, The Break-In!'s own target threat scaled for one player (the tutorial is solo), and
 * Spider-Man's own printed HP — so this screen can never drift from what the tutorial game actually plays out.
 */
import { CARDS_BY_ID, POOL_SCENARIOS, POOL_STARTER_DECKS } from "../content/pool.js";
import { formFactorFor, type FormFactor, type Rect } from "./layout.js";
import type { HeroIdentityCard, MainSchemeCard, VillainCard } from "@mc/content";

const RHINO_SCENARIO_ID = "rhino";
const SPIDER_MAN_STARTER_DECK_ID = "core-spider-man-justice";
/** The tutorial is a solo game (`docs/guided-mode.md` §3.1) — every scaled threat/HP number here is for 1 player. */
const TUTORIAL_PLAYER_COUNT = 1;

export interface HowToWinContent {
  readonly villainCardId: string;
  readonly villainName: string;
  /** Rhino standard's own stage count (`Scenario.villainStages.standard`), not a hardcoded "two". */
  readonly stageCount: number;
  readonly mainSchemeCardId: string;
  readonly mainSchemeName: string;
  /** The Break-In!'s stage 1 target threat, scaled for `TUTORIAL_PLAYER_COUNT`. */
  readonly threatTarget: number;
  readonly heroCardId: string;
  readonly heroName: string;
  readonly heroHp: number;
}

function scaled(value: { readonly base: number; readonly perPlayer: number }, playerCount: number): number {
  return value.base + value.perPlayer * playerCount;
}

/** The tutorial matchup's real numbers (§3.1), read once from the app's pool — never cached stale, since the pool itself never changes within a build. */
export function howToWinContent(): HowToWinContent {
  const scenario = POOL_SCENARIOS.find((s) => (s.id as string) === RHINO_SCENARIO_ID);
  if (!scenario) throw new Error(`how-to-win: scenario "${RHINO_SCENARIO_ID}" not in the pool`);
  const villain = CARDS_BY_ID.get(scenario.villainCardId as string) as VillainCard | undefined;
  if (!villain) throw new Error(`how-to-win: villain card ${scenario.villainCardId} not in the pool`);
  const mainScheme = CARDS_BY_ID.get(scenario.mainSchemeCardId as string) as MainSchemeCard | undefined;
  if (!mainScheme) throw new Error(`how-to-win: main scheme card ${scenario.mainSchemeCardId} not in the pool`);
  const deck = POOL_STARTER_DECKS.find((d) => (d.id as string) === SPIDER_MAN_STARTER_DECK_ID);
  if (!deck) throw new Error(`how-to-win: starter deck "${SPIDER_MAN_STARTER_DECK_ID}" not in the pool`);
  const hero = CARDS_BY_ID.get(deck.identityCardId as string) as HeroIdentityCard | undefined;
  if (!hero) throw new Error(`how-to-win: hero identity card ${deck.identityCardId} not in the pool`);

  const [firstStage, lastStage] = scenario.villainStages.standard;
  const stage = mainScheme.stages[0];

  return {
    villainCardId: villain.id as string,
    villainName: villain.name,
    stageCount: lastStage - firstStage + 1,
    mainSchemeCardId: mainScheme.id as string,
    mainSchemeName: mainScheme.name,
    threatTarget: scaled(stage.targetThreat, TUTORIAL_PLAYER_COUNT),
    heroCardId: hero.id as string,
    heroName: hero.name,
    heroHp: hero.hp,
  };
}

/** The "EVERY ROUND" strip's three beats, in order (§5.1: "you act → villain acts → draw up", reordered from the
 * tiles to stay rules-accurate — RRG has the hero draw back up to hand size at the end of their own turn, before
 * the villain phase, not after it). */
export const EVERY_ROUND_STEPS: readonly string[] = ["YOU ACT & DRAW UP", "VILLAIN ACTS"];

export interface HowToWinLayout {
  readonly formFactor: FormFactor;
  /** Tablet landscape/desktop: WIN card in a left column, the two LOSE cards stacked in a right column (T01/D01's
   * own wide split — there's no wide design tile for this screen, so this is a best-judgement two-column build
   * from the phone tile's content, order and hierarchy). Phone/tablet portrait: stacked, matching P02. */
  readonly wide: boolean;
  readonly header: Rect;
  readonly progress: Rect;
  readonly close: Rect;
  readonly title: Rect;
  readonly win: Rect;
  readonly loseScheme: Rect;
  readonly loseHero: Rect;
  readonly everyRound: Rect;
  readonly tellMeMore: Rect;
  readonly startTheFight: Rect;
}

const PAD = 24;
const NARROW_PAD = 16;
const HEADER_HEIGHT = 56;
const GAP = 14;
const TITLE_HEIGHT = 56;
const EVERY_ROUND_HEIGHT = 76;
const ACTIONS_HEIGHT = 60;
const CLOSE_WIDTH = 44;
const PROGRESS_WIDTH = 140;

function narrowLayout(width: number, height: number, formFactor: FormFactor): HowToWinLayout {
  const pad = NARROW_PAD;
  const column = width - pad * 2;
  const header: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const close: Rect = { x: pad, y: (HEADER_HEIGHT - CLOSE_WIDTH) / 2, width: CLOSE_WIDTH, height: CLOSE_WIDTH };
  const progress: Rect = {
    x: width - pad - PROGRESS_WIDTH,
    y: (HEADER_HEIGHT - 10) / 2,
    width: PROGRESS_WIDTH,
    height: 10,
  };

  let y = HEADER_HEIGHT + GAP;
  const title: Rect = { x: pad, y, width: column, height: TITLE_HEIGHT };
  y += title.height + GAP;

  const actionsY = height - PAD - ACTIONS_HEIGHT;
  const everyRoundY = actionsY - GAP - EVERY_ROUND_HEIGHT;

  const remaining = Math.max(0, everyRoundY - GAP - y);
  // Capped for the same reason as the wide layout's own `rowHeight`: a tall narrow viewport (a tablet held in
  // portrait, or simply extra room below P02's own three cards) must not stretch each card into a mostly-empty box.
  const winHeight = Math.min(180, Math.round(remaining * 0.42));
  const loseHeight = Math.min(120, Math.round((remaining - winHeight - GAP) / 2));

  const win: Rect = { x: pad, y, width: column, height: winHeight };
  y += win.height + GAP;
  const loseScheme: Rect = { x: pad, y, width: column, height: loseHeight };
  y += loseScheme.height + GAP;
  const loseHero: Rect = { x: pad, y, width: column, height: loseHeight };

  const everyRound: Rect = { x: pad, y: everyRoundY, width: column, height: EVERY_ROUND_HEIGHT };

  const tellMeMore: Rect = { x: pad, y: actionsY, width: column * 0.32, height: ACTIONS_HEIGHT };
  const startTheFight: Rect = {
    x: pad + tellMeMore.width + GAP,
    y: actionsY,
    width: column - tellMeMore.width - GAP,
    height: ACTIONS_HEIGHT,
  };

  return {
    formFactor,
    wide: false,
    header,
    progress,
    close,
    title,
    win,
    loseScheme,
    loseHero,
    everyRound,
    tellMeMore,
    startTheFight,
  };
}

/** The content column's own cap (§ this fix's own brief): a 1440-wide desktop viewport reads better as a centred
 * ~1200 column than as cards stretched edge to edge, the same judgement call `guide-chooser.ts`'s wide split makes. */
const CONTENT_MAX_WIDTH = 1200;
/** The shortest the card row is ever allowed to shrink to before falling back to pinning the strip/actions to the
 * screen bottom (a viewport too short for the row to sit naturally under the title). */
const MIN_ROW_HEIGHT = 160;

function wideLayout(width: number, height: number, formFactor: FormFactor): HowToWinLayout {
  const pad = PAD;
  const contentWidth = Math.min(CONTENT_MAX_WIDTH, width - pad * 2);
  const contentX = (width - contentWidth) / 2;
  const header: Rect = { x: 0, y: 0, width, height: HEADER_HEIGHT };
  const close: Rect = { x: pad, y: (HEADER_HEIGHT - CLOSE_WIDTH) / 2, width: CLOSE_WIDTH, height: CLOSE_WIDTH };
  const progress: Rect = {
    x: width - pad - PROGRESS_WIDTH,
    y: (HEADER_HEIGHT - 10) / 2,
    width: PROGRESS_WIDTH,
    height: 10,
  };

  let y = HEADER_HEIGHT + GAP;
  const title: Rect = { x: contentX, y, width: contentWidth, height: TITLE_HEIGHT };
  y += title.height + GAP;

  // The strip and action row sit directly under the cards, not pinned to the screen bottom, so the cards take the
  // *entire* available height instead of a small capped box floating above a dead gap (the bug this fixed: a
  // 220px-tall card row on a 900px-tall viewport). Only fall back to pinning the strip/actions to the bottom when
  // the viewport is too short for that natural placement to leave the row a sane minimum height.
  const belowRow = GAP + EVERY_ROUND_HEIGHT + GAP + ACTIONS_HEIGHT;
  const naturalRowHeight = height - pad - belowRow - y;

  let rowHeight: number;
  let everyRoundY: number;
  let actionsY: number;
  if (naturalRowHeight >= MIN_ROW_HEIGHT) {
    rowHeight = naturalRowHeight;
    everyRoundY = y + rowHeight + GAP;
    actionsY = everyRoundY + EVERY_ROUND_HEIGHT + GAP;
  } else {
    actionsY = height - pad - ACTIONS_HEIGHT;
    everyRoundY = actionsY - GAP - EVERY_ROUND_HEIGHT;
    rowHeight = Math.max(MIN_ROW_HEIGHT, everyRoundY - GAP - y);
  }

  const leftWidth = Math.round(contentWidth * 0.46);
  const rightWidth = contentWidth - leftWidth - GAP;
  const win: Rect = { x: contentX, y, width: leftWidth, height: rowHeight };
  const loseHeight = Math.round((rowHeight - GAP) / 2);
  const loseScheme: Rect = { x: contentX + leftWidth + GAP, y, width: rightWidth, height: loseHeight };
  const loseHero: Rect = {
    x: contentX + leftWidth + GAP,
    y: y + loseHeight + GAP,
    width: rightWidth,
    height: loseHeight,
  };

  const everyRound: Rect = { x: contentX, y: everyRoundY, width: contentWidth, height: EVERY_ROUND_HEIGHT };

  const tellMeMore: Rect = { x: contentX, y: actionsY, width: contentWidth * 0.28, height: ACTIONS_HEIGHT };
  const startTheFight: Rect = {
    x: contentX + tellMeMore.width + GAP,
    y: actionsY,
    width: contentWidth - tellMeMore.width - GAP,
    height: ACTIONS_HEIGHT,
  };

  return {
    formFactor,
    wide: true,
    header,
    progress,
    close,
    title,
    win,
    loseScheme,
    loseHero,
    everyRound,
    tellMeMore,
    startTheFight,
  };
}

export function howToWinLayout(width: number, height: number): HowToWinLayout {
  const formFactor = formFactorFor(width, height);
  const wide = formFactor === "desktop" || formFactor === "tabletLandscape";
  return wide ? wideLayout(width, height, formFactor) : narrowLayout(width, height, formFactor);
}

/** Every drawn content region, for a no-overlap test. */
export function howToWinLayoutRects(layout: HowToWinLayout): readonly Rect[] {
  return [
    layout.close,
    layout.progress,
    layout.title,
    layout.win,
    layout.loseScheme,
    layout.loseHero,
    layout.everyRound,
    layout.tellMeMore,
    layout.startTheFight,
  ];
}

/** Focus order: close, the two actions last (both always reachable — §3.10 "every tutorial screen has Back"). */
export const HOW_TO_WIN_FOCUS_ORDER: readonly string[] = ["close", "tell-me-more", "start-the-fight"];
