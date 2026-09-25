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
import type { SessionStore } from "../store/session-store.js";
import { SCENES } from "./keys.js";
import { boardModel } from "../view/board-model.js";
import type { DeckBuilderSceneData } from "./deck-builder.js";
import type { InspectData } from "./inspect.js";
import type { DeckCheckSceneData } from "./deck-check.js";
import type { DecksSceneData } from "./decks.js";
import type { RulesSceneData } from "./rules.js";
import type { RulesTab } from "../view/rules-layout.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { SeatsData } from "./seats.js";
import type { TableSetupData } from "./table-setup.js";
import { goToScreen } from "../ui/transitions.js";
import { refreshUnlocks } from "../progression/progression.js";
import type { ExtrasTab } from "../progression/extras.js";

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
 * `store.start`/`toSessionConfig` path Table setup uses (`board` alone also takes `&scenario=`/`&deck=`/`&seed=`
 * to pick which one, `startDevGame`'s own doc comment), then jump: `board`
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
    if (screen === "scenario-select")
      return { key: SCENES.scenarioSelect, data: { draft } satisfies ScenarioSelectData };
    if (screen === "seats") return { key: SCENES.seats, data: { draft } satisfies SeatsData };
    return { key: SCENES.setup, data: { draft } satisfies TableSetupData };
  }

  if (screen === "deck-check" || screen === "deck-builder") {
    const deck = preconDecks(POOL_VERSION)[0]!;
    if (screen === "deck-check") return { key: SCENES.deckCheck, data: { deck } satisfies DeckCheckSceneData };
    return { key: SCENES.deckBuilder, data: { deck } satisfies DeckBuilderSceneData };
  }

  if (screen === "decks") return { key: SCENES.decks, data: {} satisfies DecksSceneData };
  // `?screen=extras[&tab=music]`: the Extras shelf; pair with `&unlock=all` to see every tile open.
  if (screen === "extras") {
    const tab = params.get("tab");
    return { key: SCENES.extras, data: tab ? { tab: tab as ExtrasTab } : {} };
  }
  // `?screen=extras-reader&book=book:rrg`: one rulebook in the Extras reader.
  if (screen === "extras-reader")
    return { key: SCENES.extrasReader, data: { bookId: params.get("book") ?? "book:rrg" } };

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

  // `?screen=scenario-intro[&scenario=rhino]`: a one-off scenario's intro artboard over a started dev game.
  if (screen === "scenario-intro") {
    await startDevGame();
    return { key: SCENES.scenarioIntro, data: { scenarioId: params.get("scenario") ?? "rhino" } };
  }

  if (screen === "setup-deal") {
    await startDevSetupGame();
    return { key: SCENES.setupDeal, data: {} };
  }

  // `?screen=inspect[&card=N]`: the Inspect sheet over a live board, open on
  // the Nth card of the opening hand (default the first), for checking the
  // sheet against D08/P14/T06 at every size without clicking through a game.
  // The mulligan is kept as dealt, so the sheet reads a hand card during the
  // player's own turn — the state D08 draws — rather than a mulligan option.
  if (screen === "inspect") {
    await startDevGame();
    const { store } = appSession();
    if (store.state.game?.pendingChoice) await store.resolveChoice([]);
    const state = store.state;
    if (!state.game || state.perspectiveId === null) return { key: SCENES.board, data: {} };
    const hand = boardModel(state.game, state.perspectiveId, POOL_DEPS).hand.map((card) => card.instanceId);
    const index = Number(params.get("card") ?? "0");
    const instanceId = hand[Number.isInteger(index) && index >= 0 ? index : 0];
    if (!instanceId) return { key: SCENES.board, data: {} };
    return { key: SCENES.inspect, data: { instanceId, siblings: hand } satisfies InspectData };
  }

  // `?screen=choice`: the pending-choice overlay, open on a real `chooseTarget` with a real source card — Doctor
  // Strange's Spell Mastery, resolving Crimson Bands of Cyttorak's own "Special: Stun an enemy and deal 7 damage to
  // it." (the same scenario `view/choice-source.test.ts` and `view/choice-source-panel.test.ts` pin down), so the
  // source-card rail/strip (`view/choice-source-panel.ts`) has a real card and ability line to draw. Board is
  // started and left running underneath: `#syncChoiceOverlay` opens the sheet itself the moment it sees the state
  // already carries a `pendingChoice`, same as a real game reaching this choice mid-session.
  if (screen === "choice") {
    await startDevChoiceGame();
    return { key: SCENES.board, data: {} };
  }

  // `?screen=villain-interrupt`: a real villain phase, paused on Spider-Man's own optional Hero Interrupt
  // ("Spider-Sense", `01001a.spider-sense` — "When the villain attacks you, you may draw 1 card") — a real
  // `chooseTriggers` the viewer can answer, for the villain-phase inline interrupt's own source-card strip
  // (`scenes/villain-phase.ts`'s `#drawInterrupt`, which shows *what's attacking*, not just the candidate card).
  // Both Board and the villain-phase overlay are started already running, same as `screen=choice` above: Board's
  // subscription sees the state as it already stands, `lastEvents` included, so `#openVillainWalkthrough` and
  // `#syncChoiceOverlay` both fire exactly as they would mid-session.
  if (screen === "villain-interrupt") {
    await startDevVillainInterruptGame();
    return { key: SCENES.board, data: {} };
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
/** Whether a game is already running, from behind a function boundary (see `startDevVillainInterruptGame`'s own comment on why). */
function gameRunning(store: SessionStore): boolean {
  return store.state.game !== null;
}

/**
 * `?screen=board&scenario=<id>&deck=<starterDeckId>[&seed=<n>]`: any pool scenario against any pool precon, for
 * screenshotting a specific mechanic (Tower Defense's two schemes, Spectrum's energy forms, …) without clicking
 * through Title/Seats/Table setup by hand. Falls back to the original fixed Rhino/first-precon game when either
 * param is absent or names something the pool doesn't have, so every existing `?screen=board` caller is unchanged.
 */
async function startDevGame(): Promise<void> {
  const { store } = appSession();
  if (store.state.game) return;
  const params = new URLSearchParams(location.search);
  const scenario = POOL_SCENARIOS.find((s) => s.id === params.get("scenario")) ?? POOL_SCENARIOS[0]!;
  const options = deckOptionsOf([], POOL_CARDS, POOL_VERSION, POOL_DEPS);
  const wantedDeck = params.get("deck");
  const seat =
    options.find((o) => o.deck.source.kind === "precon" && (o.deck.source.starterDeckId as string) === wantedDeck) ??
    options[0]!;
  const seed = Number(params.get("seed"));
  const draft = initialSetupDraft({
    scenarioId: scenario.id as string,
    seatDeckId: seat.deck.id as string,
    seed: Number.isFinite(seed) && params.get("seed") ? seed : rollSeed(),
  });
  await store.start(toSessionConfig(draft, [corePlayerForSeat(seat)]));
}

/**
 * A real Doctor Strange (Protection) solo Rhino game, paused on a real `chooseTarget` with a real source card:
 * Spell Mastery resolving Crimson Bands of Cyttorak's own "Special: Stun an enemy and deal 7 damage to it." Seed 439
 * deals Crimson Bands to the top of the Invocation deck — the same deterministic scenario
 * `view/choice-source.test.ts` and `view/choice-source-panel.test.ts` already pin down, reused here rather than a
 * fresh one so a passing test is also proof this dev jump reaches the state it claims to.
 */
async function startDevChoiceGame(): Promise<void> {
  const { store } = appSession();
  if (store.state.game) return;
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "drs-protection" }],
    seed: 439,
  });
  for (let step = 0; step < 12 && store.state.legal?.actions.kind === "choice"; step++) {
    const { choice } = store.state.legal.actions as {
      choice: { options: readonly { optionId: string }[]; minSelections: number };
    };
    await store.resolveChoice(choice.options.slice(0, choice.minSelections).map((o) => o.optionId));
  }
  let legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((e) => e.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  legal = store.state.legal?.actions;
  if (legal?.kind !== "turn") return;
  const spellMastery = legal.legal.find(
    (entry) => entry.action.kind === "useAbility" && entry.action.abilityId === "09001a.spell-mastery",
  );
  if (spellMastery) await store.dispatch(spellMastery.example);
}

/**
 * A real solo Rhino/Spider-Man game, seeded (like `startDevChoiceGame`) rather than `startDevGame`'s random
 * `rollSeed()` — reaching this pause depends on Rhino's very first activation landing as an attack (true once
 * flipped to hero form, RRG "Activation" p. 6) *and* on the exact command that starts the villain phase being the
 * same one this function stops on, which only a fixed, traced seed can promise: a random deal can just as easily
 * reach the same `chooseTriggers` one `resolveChoice` later (an earlier optional trigger answered first, e.g. Great
 * Responsibility's own "take threat as damage instead" at step one), and Board — mounted only *after* every command
 * below has already run — only ever sees the *last* command's events, so `#openVillainWalkthrough` misses a phase
 * that started an earlier command than the one this jump happens to stop on. (Not a client bug: a real session has
 * Board mounted the whole time, accumulating every command's beats — see `scenes/villain-phase.ts`'s own doc
 * comment.) Seed 12345 was traced with a scripted game to reach Spider-Man's own optional Hero Interrupt
 * ("Spider-Sense", `01001a.spider-sense`, "When the villain attacks you, you may draw 1 card") as a real
 * `chooseTriggers`, in the very command that starts round one's villain phase, with no earlier pause in between.
 */
async function startDevVillainInterruptGame(): Promise<void> {
  const { store } = appSession();
  // `gameRunning(store)`, not `if (store.state.game) return` inline: TS's control-flow narrowing carries "this
  // exact property access is null" across the `await` below when the check is written inline, and every later read
  // of `store.state.game` in this function (its own `game.stack` in the loop) then typechecks against `never`
  // instead of `GameState | null`. Narrowing is per-function, so hiding the check behind a call sidesteps it.
  if (gameRunning(store)) return;
  await store.start({
    scenarioId: "rhino",
    difficulty: "standard",
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 12345,
  });
  if (store.state.game?.pendingChoice) await store.resolveChoice([]);
  let legal = store.state.legal?.actions;
  if (legal?.kind === "turn") {
    const flip = legal.legal.find((entry) => entry.action.kind === "changeForm");
    if (flip) await store.dispatch(flip.example);
  }
  for (let step = 0; step < 40; step++) {
    const game = store.state.game;
    if (!game || game.outcome) break;
    const actions = store.state.legal?.actions;
    if (!actions) break;
    if (actions.kind === "choice") {
      const duringAttack = game.stack.some(
        (frame) => frame.kind === "enemyAttack" || (frame.kind === "event" && frame.event.kind === "enemyAttack"),
      );
      if (actions.choice.prompt.kind === "chooseTriggers" && duringAttack) break;
      await store.resolveChoice(actions.choice.options.slice(0, actions.choice.minSelections).map((o) => o.optionId));
      continue;
    }
    if (actions.kind !== "turn") break;
    const end = actions.legal.find((entry) => entry.action.kind === "endTurn");
    if (!end) break;
    await store.dispatch(end.example);
  }
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
  const seats = options
    .filter((option, index, all) => all.findIndex((other) => other.identityName === option.identityName) === index)
    .slice(0, 4);
  const draft = initialSetupDraft({
    scenarioId: scenario.id as string,
    seatDeckId: seats[0]!.deck.id as string,
    seed: rollSeed(),
  });
  await store.start(toSessionConfig(draft, seats.map(corePlayerForSeat)));
}

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENES.boot);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.void.hex));
    const { width, height } = this.scale.gameSize;
    this.add.text(width / 2, height / 2, "LOADING", textStyle(typeRole.label, surface.paper.hex, 0.6)).setOrigin(0.5);

    this.scene.launch(SCENES.music);

    // Progress is read before Title so no screen draws a hero or scenario locked that the player has earned.
    void Promise.all([this.#awaitFonts(), refreshUnlocks().catch(() => false)])
      .then(() => devScreenJump())
      .then((jump) => {
        if (!jump) {
          // Boot's own normal hand-off (no `?screen=` dev jump): a plain fade, same as every other
          // screen-to-screen move. The dev jumps below stay hard cuts — they're QA/screenshot entry
          // points (`scripts/shoot-app.mjs`), where landing on the target screen instantly matters
          // more than a fade "reads as a page turning".
          goToScreen(this, SCENES.title);
          return;
        }
        // `pause`'s own screenshot needs the Board running underneath it,
        // exactly like a real pause — `scene.launch`, never `scene.start`,
        // so Board keeps drawing (`scenes/pause.ts`'s own doc comment: "the
        // board keeps running underneath, exactly like every other overlay").
        if (jump.key === SCENES.rules || jump.key === SCENES.settings || jump.key === SCENES.inspect) {
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
