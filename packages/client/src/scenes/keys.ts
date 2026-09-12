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
  // Overlays.
  choice: "ChoiceOverlay",
  inspect: "InspectOverlay",
  villainPhase: "VillainPhaseOverlay",
} as const;

export type SceneKey = (typeof SCENES)[keyof typeof SCENES];
