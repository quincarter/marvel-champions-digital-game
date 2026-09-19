/**
 * Boot: load the fonts before any text is drawn, then hand off to Title.
 *
 * The design system's type rules are load-bearing — Bangers carries every
 * number the player reads at a glance — so drawing a screen in a fallback face
 * and swapping later would reflow the table. Phaser 4 can load a web font
 * directly, so the wait happens here and nowhere else.
 */

import Phaser from "phaser";
import { surface, typeRole, WEB_FONTS } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { POOL_CARDS, POOL_DEPS, POOL_SCENARIOS, POOL_VERSION } from "../content/pool.js";
import { deckOptionsOf, preconDecks } from "../view/deck-list-model.js";
import { corePlayerForSeat } from "../view/deck-seat.js";
import { initialSetupDraft, toSessionConfig } from "../view/setup-draft.js";
import { rollSeed } from "../view/seed.js";
import { appSession } from "../session.js";
import { SCENES } from "./keys.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import type { DecksSceneData } from "./decks.js";
import type { RulesSceneData } from "./rules.js";
import type { RulesTab } from "../view/rules-layout.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { SeatsData } from "./seats.js";
import type { TableSetupData } from "./table-setup.js";

/**
 * Dev-only screenshot entry point: `?screen=…` jumps straight past Title, for
 * visual QA against the design canvases (docs/design-reference.md) without
 * scripting a click-through of the whole app. Never reachable in a normal
 * session — Title's own menu is still the only in-game way to reach any of
 * these scenes — and harmless if left in a production build (an unrecognized
 * or absent `screen` param falls through to Title as usual).
 *
 * `scenario-select` / `seats` / `table-setup` jump with a fresh default
 * `SetupDraft` (no live game). `deck-check` / `deck-builder` load the first
 * precon deck straight into the scene (no live game either). `decks` (D14)
 * jumps with no data — it builds its own deck list from storage. `board` /
 * `pause` / `rules` / `settings` need one, since D13/P16/L07's status line and
 * glossary/card-list content only mean anything against a real table — those
 * four start a real one-seat Rhino/Spider-Man game through the same
 * `store.start`/`toSessionConfig` path Table setup uses, then jump: `board`
 * alone, `pause` launches the Pause overlay over it, `rules`/`settings` skip
 * straight past Pause to the overlay itself (`initialTab`/`initialQuery` via
 * `?tab=`/`?q=`, mirroring `RulesSceneData`). `setup-deal` (W3,
 * docs/phase4-screen-gaps.md §3) starts a real **four**-seat Rhino game
 * instead — one seat alone can't show the checklist's "other seats" section
 * or the tablet-landscape all-seats-at-once layout — and jumps straight to
 * `TableSetupScene`'s own hand-off target, `SCENES.setupDeal`, mid-mulligan.
 */
async function devScreenJump(): Promise<{ readonly key: string; readonly data?: object } | null> {
  const params = new URLSearchParams(location.search);
  const screen = params.get("screen");
  if (!screen) return null;

  if (screen === "scenario-select" || screen === "seats" || screen === "table-setup") {
    const draft = initialSetupDraft({
      scenarioId: POOL_SCENARIOS[0]!.id as string,
      seatDeckId: preconDecks(POOL_VERSION)[0]!.id as string,
      seed: rollSeed(),
    });
    if (screen === "scenario-select") return { key: SCENES.scenarioSelect, data: { draft } satisfies ScenarioSelectData };
    if (screen === "seats") return { key: SCENES.seats, data: { draft } satisfies SeatsData };
    return { key: SCENES.setup, data: { draft } satisfies TableSetupData };
  }

  if (screen === "deck-check" || screen === "deck-builder") {
    const deck = preconDecks(POOL_VERSION)[0]!;
    if (screen === "deck-check") return { key: SCENES.deckCheck, data: { deck } satisfies DeckCheckSceneData };
    return { key: SCENES.deckBuilder, data: { deck } satisfies DeckBuilderSceneData };
  }

  if (screen === "decks") return { key: SCENES.decks, data: {} satisfies DecksSceneData };

  if (screen === "board" || screen === "pause" || screen === "rules" || screen === "settings") {
    await startDevGame();
    if (screen === "settings") return { key: SCENES.settings, data: {} };
    if (screen === "rules") {
      const tab = params.get("tab");
      const query = params.get("q");
      const data: RulesSceneData = {
        ...(tab ? { initialTab: tab as RulesTab } : {}),
        ...(query ? { initialQuery: query } : {}),
      };
      return { key: SCENES.rules, data };
    }
    return { key: SCENES.board, data: {} };
  }

  if (screen === "setup-deal") {
    await startDevSetupGame();
    return { key: SCENES.setupDeal, data: {} };
  }

  return null;
}

/**
 * A real one-seat game (Rhino, standard, Spider-Man's own precon) started
 * through the exact same `store.start(toSessionConfig(...))` call Table setup
 * makes — so Pause's status line, the glossary's "N terms on the table" and
 * the scenario card list all show real numbers rather than the "No game in
 * progress" placeholder. A no-op if a game is somehow already running (this
 * only ever runs once, straight out of Boot).
 */
async function startDevGame(): Promise<void> {
  const { store } = appSession();
  if (store.state.game) return;
  const scenario = POOL_SCENARIOS[0]!;
  const seat = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS)[0]!;
  const draft = initialSetupDraft({ scenarioId: scenario.id as string, seatDeckId: seat.deck.id as string, seed: rollSeed() });
  await store.start(toSessionConfig(draft, [corePlayerForSeat(seat)]));
}

/**
 * A real four-seat Rhino game (four distinct precon identities, so `createGame`'s "one copy of each unique card"
 * rule doesn't reject the seating), left exactly where `store.start` stops on its own: the first seat's mulligan
 * `PendingChoice` (`view/setup-walkthrough.ts`'s own doc comment covers why the flow always pauses there).
 */
async function startDevSetupGame(): Promise<void> {
  const { store } = appSession();
  if (store.state.game) return;
  const scenario = POOL_SCENARIOS[0]!;
  const options = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
  const seats = options.filter((option, index, all) => all.findIndex((other) => other.identityName === option.identityName) === index).slice(0, 4);
  const draft = initialSetupDraft({ scenarioId: scenario.id as string, seatDeckId: seats[0]!.deck.id as string, seed: rollSeed() });
  await store.start(toSessionConfig(draft, seats.map(corePlayerForSeat)));
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    const { width, height } = this.scale.gameSize;
    this.add
      .text(width / 2, height / 2, "LOADING", textStyle(typeRole.label, surface.paper.hex, 0.6))
      .setOrigin(0.5)
      .setLetterSpacing(typeRole.label.letterSpacing);

    void this.#awaitFonts()
      .then(() => devScreenJump())
      .then((jump) => {
        if (!jump) {
          this.scene.start(SCENES.title);
          return;
        }
        // `pause`'s own screenshot needs the Board running underneath it,
        // exactly like a real pause — `scene.launch`, never `scene.start`,
        // so Board keeps drawing (`scenes/pause.ts`'s own doc comment: "the
        // board keeps running underneath, exactly like every other overlay").
        if (jump.key === SCENES.rules || jump.key === SCENES.settings) {
          this.scene.start(SCENES.board);
          this.scene.launch(jump.key, jump.data);
        } else {
          this.scene.start(jump.key, jump.data);
        }
        const params = new URLSearchParams(location.search);
        if (params.get("screen") === "pause") this.scene.launch(SCENES.pause);
      });
  }

  /**
   * Waits for the three families, but never blocks the game on the network: a
   * font that fails to arrive falls back rather than leaving a dead screen.
   */
  async #awaitFonts(): Promise<void> {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (!fonts) return;
    try {
      await Promise.race([
        Promise.all(WEB_FONTS.map((face) => fonts.load(face))),
        new Promise((resolve) => setTimeout(resolve, 3000)),
      ]);
    } catch {
      // A missing face is a cosmetic problem, not a reason not to start.
    }
  }
}
