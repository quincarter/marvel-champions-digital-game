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
  scenarioIntro: "ScenarioIntro",
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
  /** A Market-shaped pending choice mid-Briefing (`scenes/campaign/market.ts`'s own doc comment on the bounce). */
  campaignMarket: "CampaignMarket",
  campaignAftermath: "CampaignAftermath",
  campaignRewind: "CampaignRewind",
  campaignRun: "CampaignRun",
  campaignIssue: "CampaignIssue",
  campaignDossier: "CampaignDossier",
  campaignFinale: "CampaignFinale",
  campaignDeckEdit: "CampaignDeckEdit",
  /** MC16 p. 5's Expert deck freeze (`scenes/campaign/deck-edit.ts` routes here in place of `deckBuilder`). */
  campaignFrozenDeck: "CampaignFrozenDeck",
  /** Extras (`scenes/extras.ts`): the comics, artwork, hero and villain files and the soundtrack, opened by play. */
  extras: "Extras",
  /** One rulebook as plain text (`scenes/extras-reader.ts`), reached from Extras' Rulebooks tab. */
  extrasReader: "ExtrasReader",
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
  /** Settings ▸ Unlocks (`scenes/unlocks.ts`): unlock everything, or one hero at a time. Launched over Settings. */
  unlocks: "UnlocksOverlay",
  /** "Unlock this by hand?" (`scenes/unlock-confirm.ts`), over whichever screen is spending champion points. */
  unlockConfirm: "UnlockConfirmOverlay",
  /** "End your turn? You can still: …" (`scenes/end-turn-confirm.ts`), over the Board. */
  endTurnConfirm: "EndTurnConfirmOverlay",
  /** One Extras file or picture (`scenes/extras-viewer.ts`), launched over Extras. */
  extrasViewer: "ExtrasViewerOverlay",
  /** C04: a villain's stage flip told as a comic splash, launched over the Board in a campaign game. */
  campaignBeat: "CampaignBeatOverlay",
  /** Background soundtrack controller running across screen transitions. */
  music: "MusicScene",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
