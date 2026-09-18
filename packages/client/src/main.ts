/**
 * The app's entry point: the one place a Phaser game is created.
 *
 * The scale manager runs in resize mode, so every screen asks the layout module
 * for rectangles at the current size rather than scaling a fixed canvas
 * (PLAN.md Phase 4). Physics is not configured — the game has none.
 */

import Phaser from "phaser";
import { surface } from "./tokens.js";
import { cssOf, setTextResolution } from "./ui/theme.js";
import { appSession } from "./session.js";
import { BootScene } from "./scenes/boot.js";
import { TitleScene } from "./scenes/title.js";
import { ScenarioSelectScene } from "./scenes/scenario-select.js";
import { SeatsScene } from "./scenes/seats.js";
import { TableSetupScene } from "./scenes/table-setup.js";
import { BoardScene } from "./scenes/board.js";
import { ChoiceOverlay } from "./scenes/choice.js";
import { InspectOverlay } from "./scenes/inspect.js";
import { VillainPhaseOverlay } from "./scenes/villain-phase.js";
import { GameOverScene } from "./scenes/game-over.js";
import { DecksScene } from "./scenes/decks.js";
import { DeckBuilderScene } from "./scenes/deck-builder.js";
import { DeckCheckScene } from "./scenes/deck-check.js";
import { PauseOverlay } from "./scenes/pause.js";
import { RulesOverlay } from "./scenes/rules.js";
import { SettingsOverlay } from "./scenes/settings.js";

// The one `Settings` instance for the whole app (`appSession().settings`), not a
// second copy: `scenes/settings.ts` mutates that same object, and every text
// object this game creates from here on must read the resolution it left behind.
const settings = appSession().settings;

// Every text object the theme creates renders at the device pixel ratio, so
// text stays sharp. Phaser 4 has no game-level equivalent.
setTextResolution(settings.textResolution);

const game = new Phaser.Game({
  type: Phaser.WEBGL,
  parent: "game",
  backgroundColor: cssOf(surface.void.hex),
  // Off by default in Phaser 4; the Board's focus route is otherwise wired
  // for it already (`view/gamepad.ts`, `scenes/board/input.ts#bindGamepad`).
  input: { gamepad: true },
  scale: {
    // RESIZE makes the canvas exactly its parent's size, so game coordinates
    // are CSS pixels and every layout rectangle is drawn at its real size.
    // Centering is deliberately not set: with RESIZE there is nothing to
    // centre, and an autoCentre offset would desynchronise pointer input from
    // the interactive zones the widgets place.
    mode: Phaser.Scale.RESIZE,
  },
  // `McTextInput` (ui/widgets.ts) is a DOM-backed rexUI `InputText` — the
  // app's one DOM element (PLAN.md Phase 4). Phaser 4 only creates the DOM
  // container Phaser.GameObjects.DOMElement needs when asked to.
  dom: { createContainer: true },
  scene: [
    BootScene,
    TitleScene,
    ScenarioSelectScene,
    SeatsScene,
    TableSetupScene,
    BoardScene,
    DecksScene,
    DeckBuilderScene,
    DeckCheckScene,
    ChoiceOverlay,
    InspectOverlay,
    VillainPhaseOverlay,
    GameOverScene,
    PauseOverlay,
    RulesOverlay,
    SettingsOverlay,
  ],
});

// Right-click is the desktop Inspect gesture, so the browser's own menu has to
// stay out of the way of it. Phaser 4 has no game-config flag for this, only
// this call on the mouse manager.
game.input.mouse?.disableContextMenu();

/**
 * A canvas has no inspectable DOM, so in development the game is reachable from
 * the console — enough to read `scale.gameSize`, walk a scene's display list, or
 * fire a widget's `pointerup` when a screenshot can't be trusted. Stripped from
 * production builds.
 */
if (import.meta.env.DEV) {
  (globalThis as unknown as { __mcGame?: Phaser.Game }).__mcGame = game;
}
