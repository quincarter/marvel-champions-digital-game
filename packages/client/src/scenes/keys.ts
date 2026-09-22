/**
 * Scene keys. Screens replace one another; overlays run in parallel over Board
 * (`scene.launch`), so the board stays alive underneath (PLAN.md Phase 4).
 */
export const SCENES = {
  boot: "Boot",
  title: "Title",
  // W2 (docs/phase4-screen-gaps.md §3): Scenario select → Take your seats → Table setup.
  // `setup` was already reserved for this flow; Table setup is what lands there.
  scenarioSelect: "ScenarioSelect",
  seats: "Seats",
  setup: "Setup",
  // W3 (docs/phase4-screen-gaps.md §3): the one-time setup deal & mulligan screen Table setup's
  // "Deal it out" routes into, before handing off to the Board once round 1 actually begins.
  setupDeal: "SetupDeal",
  board: "Board",
  gameOver: "GameOver",
  // PLAN.md Phase 9: precons, MarvelCDB import, and the in-app deck builder.
  decks: "Decks",
  deckBuilder: "DeckBuilder",
  // W1 (docs/phase4-screen-gaps.md §3): a deck's curve/composition/list, reached
  // from Decks today and from W2's setup flow once it lands.
  deckCheck: "DeckCheck",
  // Campaign mode (`Marvel Champions game screens/Campaign - *.dc.html`, C00b–C11); data contracts in
  // `scenes/campaign/routes.ts`.
  campaignSaga: "CampaignSaga",
  campaignCover: "CampaignCover",
  campaignRoster: "CampaignRoster",
  campaignOpener: "CampaignOpener",
  campaignBriefing: "CampaignBriefing",
  campaignAftermath: "CampaignAftermath",
  campaignRewind: "CampaignRewind",
  campaignRun: "CampaignRun",
  campaignIssue: "CampaignIssue",
  campaignDossier: "CampaignDossier",
  campaignFinale: "CampaignFinale",
  campaignDeckEdit: "CampaignDeckEdit",
  // Overlays.
  choice: "ChoiceOverlay",
  inspect: "InspectOverlay",
  villainPhase: "VillainPhaseOverlay",
  /** Launched over the Board by its own MENU/≡ chrome button or Escape (`scenes/pause.ts`). */
  pause: "PauseOverlay",
  /** Launched over Pause (`scenes/rules.ts`); docs/phase4-screen-gaps.md §3 "W4". */
  rules: "RulesOverlay",
  /**
   * Reachable from Pause and, once Title's rewrite (W2) adds a button for it, from
   * Title too (`scenes/settings.ts`'s own doc comment is that button's entry point).
   */
  settings: "SettingsOverlay",
  /** C04: a villain's stage flip told as a comic splash, launched over the Board in a campaign game. */
  campaignBeat: "CampaignBeatOverlay",
  /** Background soundtrack controller running across screen transitions. */
  music: "MusicScene",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
