/**
 * Which screen family the scenes up now make, for Discord Rich Presence. Pure and worker-safe: the presence worker
 * (`workers/discord-presence.worker.ts`) keeps the set of up scenes and asks this.
 */
import { SCENES } from "../scenes/keys.js";
import type { PresenceScreen } from "./discord-presence.js";

const GAME_SCREENS: ReadonlySet<string> = new Set([SCENES.board]);
const SETUP_SCREENS: ReadonlySet<string> = new Set([
  SCENES.scenarioSelect,
  SCENES.seats,
  SCENES.setup,
  SCENES.setupDeal,
  SCENES.scenarioIntro,
  SCENES.civilWarBuilder,
]);
const DECK_SCREENS: ReadonlySet<string> = new Set([
  SCENES.decks,
  SCENES.deckBuilder,
  SCENES.deckCheck,
  SCENES.campaignDeckEdit,
  SCENES.campaignFrozenDeck,
]);
const CAMPAIGN_SCREENS: ReadonlySet<string> = new Set([
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
]);

/** True for a scene whose start data may name a campaign (`campaignId` or `runId`). */
export function namesCampaign(key: string): boolean {
  return CAMPAIGN_SCREENS.has(key) || DECK_SCREENS.has(key);
}

/** The screen family for the scenes up now, the most specific first (Game over, the table, then the rest). */
export function screenOf(active: readonly string[]): PresenceScreen {
  if (active.includes(SCENES.gameOver)) return "gameOver";
  if (active.some((key) => GAME_SCREENS.has(key))) return "game";
  if (active.some((key) => CAMPAIGN_SCREENS.has(key))) return "campaign";
  if (active.some((key) => DECK_SCREENS.has(key))) return "deck";
  if (active.some((key) => SETUP_SCREENS.has(key))) return "setup";
  return "menus";
}
