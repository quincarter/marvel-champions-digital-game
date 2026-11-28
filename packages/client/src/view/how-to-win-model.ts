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
import { message, type MessageKey } from "../i18n/translate.js";
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

/** The "EVERY ROUND" strip's beats, in order, as app-text keys (§5.1: "you act → villain acts → draw up", reordered
 * from the tiles to stay rules-accurate — RRG has the hero draw back up to hand size at the end of their own turn,
 * before the villain phase, not after it). */
export const EVERY_ROUND_STEP_KEYS: readonly MessageKey[] = ["howToWin.step.act", "howToWin.step.villain"];

/** The same beats in English (the catalog's own words). */
export const EVERY_ROUND_STEPS: readonly string[] = EVERY_ROUND_STEP_KEYS.map((key) => message(key, "en"));
