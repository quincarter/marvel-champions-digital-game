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
  board: "Board",
  gameOver: "GameOver",
  // PLAN.md Phase 9: precons, MarvelCDB import, and the in-app deck builder.
  decks: "Decks",
  deckBuilder: "DeckBuilder",
  // Overlays.
  choice: "ChoiceOverlay",
  inspect: "InspectOverlay",
  villainPhase: "VillainPhaseOverlay",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
