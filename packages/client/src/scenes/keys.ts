/**
 * Scene keys. Screens replace one another; overlays run in parallel over Board
 * (`scene.launch`), so the board stays alive underneath (PLAN.md Phase 4).
 */
export const SCENES = {
  boot: "Boot",
  title: "Title",
  setup: "Setup",
  board: "Board",
  gameOver: "GameOver",
  // PLAN.md Phase 9: precons, MarvelCDB import, and the in-app deck builder.
  decks: "Decks",
  deckBuilder: "DeckBuilder",
  // W1 (docs/phase4-screen-gaps.md §3): a deck's curve/composition/list, reached
  // from Decks today and from W2's setup flow once it lands.
  deckCheck: "DeckCheck",
  // Overlays.
  choice: "ChoiceOverlay",
  inspect: "InspectOverlay",
  villainPhase: "VillainPhaseOverlay",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
