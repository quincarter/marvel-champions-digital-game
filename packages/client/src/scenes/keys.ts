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
  /** `McTermText`/`McTooltip` dev demo (guided mode G3b, `docs/guided-mode.md` §4): `?screen=termtext` only, never reached in-game. */
  termTextDemo: "TermTextDemo",
  /** `McGuideCallout` dev demo (guided mode G4a, `docs/guided-mode.md` §4): `?screen=guidecallout` only, never reached in-game. */
  guideCalloutDemo: "GuideCalloutDemo",
  /** `McGuidePanel` dev demo (guided mode G4b, `docs/guided-mode.md` §4): `?screen=guidepanel` only, never reached in-game. */
  guidePanelDemo: "GuidePanelDemo",
  /** `McGuideSpotlight`/`McGuideTag` dev demo (guided mode G4c, `docs/guided-mode.md` §4): `?screen=board&guidedemo=1` only, never reached in-game. Launched over a live Board, not standalone — see `scenes/boot.ts`. */
  guideSpotlightDemo: "GuideSpotlightDemo",
  /** The first-run "New to the fight?" chooser (guided mode G6a, `docs/guided-mode.md` §4): `BootScene` on first launch (`isFirstLaunch(guidePrefs())`), or `?screen=chooser`. */
  guideChooser: "GuideChooser",
  /** "How to win" (guided mode G6b, `docs/guided-mode.md` §4): the tutorial's lesson 1, shown as its own screen
   * before the game starts. Reached from the chooser's "Learn as you play", Settings' "Play the tutorial", or
   * `?screen=howtowin`. */
  howToWin: "HowToWin",
  /** The round debrief (guided mode G8, `docs/guided-mode.md` §4): lesson checklist, "Worth remembering", "New
   * on your board", the guide-level control, Replay a lesson and Round N+1 ▸. Launched over the Board (`scenes/
   * round-debrief.ts`'s own `showRoundDebrief`); wiring it to fire at the end of a tutorial round is a separate
   * follow-up. `?screen=debrief` for QA. */
  roundDebrief: "RoundDebriefOverlay",
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
  /** Guided mode's "Hold on!" safety net (`scenes/hold-on.ts`, docs/guided-mode.md §4 G9b), over the Board. */
  holdOn: "HoldOnOverlay",
  /** Dev-only click-through entry point for the "Hold on!" overlay (`scenes/hold-on-demo.ts`). */
  holdOnDemo: "HoldOnDemoScene",
  /** One Extras file or picture (`scenes/extras-viewer.ts`), launched over Extras. */
  extrasViewer: "ExtrasViewerOverlay",
  /** C04: a villain's stage flip told as a comic splash, launched over the Board in a campaign game. */
  campaignBeat: "CampaignBeatOverlay",
  /** Background soundtrack controller running across screen transitions. */
  music: "MusicScene",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
