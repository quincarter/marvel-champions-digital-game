/**
 * Title, then setup: pick a scenario, a difficulty, and 1–4 seats.
 *
 * The mocks split this across Scenario → Heroes → Deck screens; this is one
 * screen carrying the same three decisions. **Seats are "any legal deck"**
 * (PLAN.md Phase 9): the Heroes section offers every precon plus every saved
 * or imported deck (`view/deck-list-model.ts`'s `deckOptionsOf`), each dimmed
 * in place when it can't be seated — illegal, missing scripts, or its
 * identity already at the table — with the engine's own reason, the same
 * "dim, don't hide" pattern the precon-only picker always used. Precons stay
 * first and are still the default seat, so the fastest path to a game (just
 * press Start) is no slower than it was before decks existed. One red per
 * screen, so "Start game" is the only red fill here.
 *
 * Every seat is played by the same human (PLAN.md Phase 4, hero seats): the
 * board's perspective follows whoever must act, and each command is still
 * issued as the player the engine names.
 */

import Phaser from "phaser";
import { CORE_DEPS } from "@mc/cards";
import { CORE_CARDS, CORE_POOL_VERSION, CORE_SCENARIOS, CORE_STARTER_DECKS, type AnyCard, type CardId, type Deck } from "@mc/content";
import { accent, dotGrid, hit, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { CAPTION_FLOOR, CAPTION_HEIGHT, McButton, McCardTile, McTextInput, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { artFor } from "../art/art-source.js";
import { deckOptionsOf, preconDecks, type DeckOption } from "../view/deck-list-model.js";
import { corePlayerFromDeck } from "../view/deck-seat.js";
import { seatOptions } from "../view/seats.js";
import { cardArt, drawArt } from "../art/card-art.js";
import type { Rect } from "../view/layout.js";
import { formFactorFor } from "../view/layout.js";
import { parseSeed, rollSeed } from "../view/seed.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { titleFocusOrder } from "../view/screen-focus.js";
import { appSession, deckStorage } from "../session.js";
import type { DecksSceneData } from "./decks.js";
import { FocusRoute, type FocusStop } from "./focus-route.js";
import { SCENES } from "./keys.js";

/** The default seat: the first Core precon, as a `Deck` id — unchanged from before decks existed, so "just press Start" still seats the same hero. */
const DEFAULT_SEAT_DECK_ID = preconDecks(CORE_POOL_VERSION)[0]!.id as string;

export class TitleScene extends Phaser.Scene {
  #scenarioId = CORE_SCENARIOS[0]!.id as string;
  #difficulty: "standard" | "expert" = "standard";
  /** Deck ids (`Deck.id`, e.g. `precon:core-spider-man-justice` or a saved deck's own id) — a single namespace covering every seat option. */
  #seats: string[] = [DEFAULT_SEAT_DECK_ID];
  /**
   * Saved and imported decks, loaded once per visit (`deckStorage().list()`),
   * refreshed on return from the Decks screen since Phaser reruns `create()`
   * on every visit to this scene instance (PLAN.md Phase 4, "reset per-visit
   * state in `create()`"). Precons are never stored here — `preconDecks()`
   * derives them fresh every time, the same as `deckOptionsOf` always does.
   */
  #savedDecks: readonly Deck[] = [];
  /**
   * A fresh seed per visit. The engine shuffles every deck from `config.seed`
   * at setup, so a constant default meant every new game dealt the same opening
   * hand — the shuffle was real, the randomness wasn't. "New seed" re-rolls it,
   * and the number stays on screen so a game can be replayed deliberately.
   */
  #seed = rollSeed();
  /** The seed field's raw text, which can be empty or mid-edit even when `#seed` — the last legal value — isn't. */
  #seedText = String(this.#seed);
  #buttons: McButton[] = [];
  #tiles: McCardTile[] = [];
  /**
   * The seed field itself: kept across rebuilds rather than recreated with
   * everything else, because it is a DOM `<input>` (`McTextInput`) and this
   * screen rebuilds on every resize and every art scan arriving. Destroying
   * and recreating it on each of those would blur it and drop the cursor out
   * from under a player mid-keystroke.
   */
  #seedInput: McTextInput | null = null;
  /** What choosing each row does, by row id, so the Inspect sheet can trigger it. */
  #rowHandlers = new Map<string, () => void>();
  #status: Phaser.GameObjects.Text | null = null;
  #starting = false;
  /**
   * The game in progress when this screen opened, if any. Games are saved as
   * they're played, so a refresh lands here with the game still there to pick
   * back up. Looked up asynchronously; the screen draws without it first.
   */
  #continuable: SaveMeta | null = null;
  /** Keyboard and pad, over `titleFocusOrder`. Each rebuild hands it the controls it drew. */
  #route: FocusRoute | null = null;
  #stops = new Map<string, FocusStop>();

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    // `this.scale` is the game's own emitter, so it outlives every scene
    // restart. Title is a singleton instance Phaser reuses across every
    // "play again" round trip through Board/GameOver (`create()` runs again
    // on the same object), so a listener added here and never removed isn't
    // the dead-scene leak the other four scenes had — it's the same live
    // scene registered N times, calling `#rebuild` N times per resize after N
    // restarts. Still a real, growing leak on the one emitter every other
    // scene was already audited for, so it's removed the same way.
    this.scale.on("resize", this.#rebuild, this);
    // Thumbnails arrive after the first frame, same as on the table.
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    // The Inspect sheet reports its answer back rather than deciding: it names
    // the row, and the row's own handler applies whatever choosing it means.
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#rebuild, this);
      artOff();
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
      this.#seedInput?.destroy();
      this.#seedInput = null;
    });
    this.#route = new FocusRoute(this, {
      // Inspect owns input while it is open over this screen, and the seed
      // field while the player is typing in it — or "i" would open a card.
      blocked: () => this.scene.isActive(SCENES.inspect) || (this.#seedInput?.focused ?? false),
    });
    this.#continuable = null;
    this.#savedDecks = [];
    // Phaser reuses this instance, and a successful Start or Continue leaves
    // `#starting` set as the scene hands off to the Board — so coming back from
    // Game Over's "Back to title" found Start stuck on "Starting…" and Continue
    // disabled, with no way to begin another game.
    this.#starting = false;
    this.#rebuild();
    void appSession()
      .store.latestSave()
      .then((save) => {
        // The scene may have moved on while storage answered.
        if (!save || !this.sys.isActive()) return;
        this.#continuable = save;
        this.#rebuild();
      });
    // Saved/imported decks, re-read on every visit: coming back from the Decks
    // screen (a new deck saved, one deleted, an illegal one fixed) must not
    // show what this scene last saw before that trip.
    void deckStorage()
      .list()
      .then((decks) => {
        if (!this.sys.isActive()) return;
        this.#savedDecks = decks;
        this.#rebuild();
      });
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    for (const tile of this.#tiles) tile.destroy();
    this.#buttons = [];
    this.#tiles = [];
    this.#rowHandlers.clear();
    this.#stops = new Map();

    // The seed field survives the sweep below: detach it first so
    // `removeAll(true)` — which destroys every child it holds — doesn't take
    // the DOM `<input>` with it, then hand it back so it still draws.
    const seedNode = this.#seedInput?.gameObject ?? null;
    if (seedNode) this.children.remove(seedNode);
    this.children.removeAll(true);
    if (seedNode) this.children.add(seedNode);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    // A short window gives the margins back first: every seat a saved deck adds
    // is another row, and "Start game" has to stay on screen, since a canvas
    // doesn't scroll.
    const pad = phone ? 16 : height < 820 ? 24 : 40;
    const column = Math.min(width - pad * 2, 640);
    const left = (width - column) / 2;

    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    // Scaled by height as well as width: at a wide, short window the two-line
    // wordmark alone took a quarter of the screen.
    const titleSize = phone ? 38 : Math.min(92, Math.round(width / 10), Math.round(height * 0.085));
    this.add
      .text(left, pad + 8, "MARVEL\nCHAMPIONS", {
        ...textStyle(typeRole.screenTitle, surface.ink.hex),
        fontSize: `${titleSize}px`,
        lineSpacing: -Math.round(titleSize * 0.16),
      })
      .setLetterSpacing(2);

    // How many cells fit across is decided by the longest name in the group,
    // not by a fixed number: at three across on a phone "Captain Marvel
    // (Leadership)" is wider than its own cell, and the label then runs over
    // its neighbour. Measuring is the only way to know, since the answer
    // depends on the font the browser actually loaded.
    // Every seat option: every precon, then every saved/imported deck
    // (PLAN.md Phase 9, "seats become any legal deck") — computed once per
    // rebuild rather than per row, since `deckOptionsOf` asks the engine for
    // each deck's legality and playability.
    const deckOptions = this.#deckOptions();
    // A seat naming a deck that no longer exists (deleted at the Decks screen
    // since this scene was last built) falls back to the default rather than
    // silently seating nothing.
    this.#seats = this.#seats.filter((id) => deckOptions.some((option) => (option.deck.id as string) === id));
    if (this.#seats.length === 0) this.#seats = [DEFAULT_SEAT_DECK_ID];

    const scenarioNames = CORE_SCENARIOS.map((scenario) => scenario.name);
    const heroNames = deckOptions.map((option) => option.deck.name.split(" — ")[0]!);
    const scenarioCols = this.#columnsFor(scenarioNames, column, true);
    const heroCols = this.#columnsFor(heroNames, column, true);
    const difficultyCols = 2;

    // How tall the thumbnails can be is then a question of what is left after
    // everything that must fit does, split across the lines that show cards.
    // If that leaves less than a legible thumbnail, the screen drops to text
    // rows rather than shipping a card nobody can see.
    const titleBlock = titleSize * 2.05;
    const scenarioLines = Math.ceil(scenarioNames.length / scenarioCols);
    const heroLines = Math.ceil(heroNames.length / heroCols);
    const difficultyLines = Math.ceil(2 / difficultyCols);
    const artLines = scenarioLines + heroLines;
    const gapAfterSection = phone ? 12 : 18;
    const fixed =
      pad * 2 +
      titleBlock +
      // Three section headings, their rails' own padding, and the gap after each.
      3 * (16 + 12 + gapAfterSection) +
      // Every line's own height: a caption strip under the cards, a full touch
      // target for the plain rows, plus the gap under each.
      (scenarioLines + heroLines) * (CAPTION_HEIGHT + 6) +
      difficultyLines * (hit.target + 6) +
      // Seed row and the primary CTA.
      hit.target + 16 + hit.primary +
      // "Continue", when there is a game to continue.
      (this.#continuable ? hit.target + gapAfterSection : 0) +
      // "Manage decks": a row of its own only on a phone; wider, it shares the seed row.
      (phone ? hit.target + gapAfterSection : 0);
    const artHeight = Math.max(0, Math.min(phone ? 96 : 128, Math.floor((height - fixed) / Math.max(1, artLines))));
    const showArt = artHeight >= 44;

    let y = pad + titleBlock;
    if (this.#continuable) {
      // Above setup, because picking up the game you were playing is the thing
      // someone who just refreshed came back for. Not red: the one red on this
      // screen stays "Start game".
      const save = this.#continuable;
      const rect: Rect = { x: left, y, width: column, height: hit.target };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: continueLabel(save),
          type: typeRole.rowTitle,
          rect,
          enabled: !this.#starting,
          onClick: () => void this.#resume(save.id),
        }),
      );
      this.#stops.set("continue", { rect, activate: () => void this.#resume(save.id) });
      y += hit.target + gapAfterSection;
    }
    y = this.#section(left, y, column, "Scenario", CORE_SCENARIOS.map((scenario) => ({
      id: scenario.id as string,
      text: scenario.name,
      // The villain, so the choice is made on the card rather than the word.
      ...(showArt ? { cardId: scenario.villainCardId } : {}),
      chooseLabel: "Play this villain",
      selected: this.#scenarioId === (scenario.id as string),
      onClick: () => {
        this.#scenarioId = scenario.id as string;
        this.#rebuild();
      },
    })), phone, artHeight, scenarioCols, "scenario");

    y = this.#section(left, y, column, "Difficulty", (["standard", "expert"] as const).map((difficulty) => ({
      id: difficulty,
      text: difficulty,
      selected: this.#difficulty === difficulty,
      onClick: () => {
        this.#difficulty = difficulty;
        this.#rebuild();
      },
    })), phone, 0, difficultyCols, "difficulty");

    // A hero already at the table cannot sit twice: the Rules Reference limits
    // a unique card to one copy in play across all players, by title. Both
    // Captain Marvel starter decks name the same identity, so offering them
    // together was offering an illegal game. A deck that can't be seated at
    // all (illegal, or using cards this build can't play yet) is blocked the
    // same way, with the engine's own reason (see view/seats.ts).
    const seating = new Map(seatOptions(deckOptions, this.#seats, CARDS_BY_ID).map((o) => [o.deckId, o]));

    y = this.#section(left, y, column, `Heroes — ${this.#seats.length} seat${this.#seats.length === 1 ? "" : "s"}, all played by you`, deckOptions.map((option) => {
      const deckId = option.deck.id as string;
      const seated = this.#seats.includes(deckId);
      const blockedBy = seating.get(deckId)?.blockedBy ?? null;
      return {
        id: deckId,
        // "Spider-Man (Justice) — Core Set starter deck" and the tutorial
        // deck's own suffix both trim to the part that identifies the hero;
        // an imported/built deck's own name (no " — " in it) is unaffected.
        text: option.deck.name.split(" — ")[0]!,
        ...(showArt ? { cardId: option.deck.identityCardId } : {}),
        chooseLabel: seated ? "Remove this seat" : "Take this seat",
        selected: seated,
        ...(blockedBy ? { blockedBy } : {}),
        onClick: () => {
          if (seated) {
            // A game needs at least one seat.
            if (this.#seats.length > 1) this.#seats = this.#seats.filter((id) => id !== deckId);
          } else if (!blockedBy) {
            this.#seats = [...this.#seats, deckId];
          }
          this.#rebuild();
        },
      };
    }), phone, artHeight, heroCols, "hero");

    // The way to the Decks screen: build, import, or manage a deck. Always
    // shown, not only once a custom deck exists — it's how the first one gets
    // made. Never red: the one red on this screen stays "Start game".
    //
    // On a phone it gets a row of its own; wider, it shares the seed row. A row
    // of its own pushed "Start game" below the bottom of an 800×600 window,
    // where a canvas can't scroll to it.
    const openDecks = (): void => {
      this.scale.off("resize", this.#rebuild, this);
      this.scene.start(SCENES.decks);
    };
    const addManageDecks = (rect: Rect): void => {
      this.#buttons.push(new McButton(this, { kind: "secondary", label: "Manage decks…", type: typeRole.rowTitle, rect, onClick: openDecks }));
      this.#stops.set("manage-decks", { rect, activate: openDecks });
    };
    if (phone) {
      addManageDecks({ x: left, y, width: column, height: hit.target });
      y += hit.target + gapAfterSection;
    }

    // Seed: a typed value, not just a rolled one — the engine's shuffle is
    // only replayable if a specific seed can be entered back in (PLAN.md
    // Phase 1, `GameLog`/`replay()`). "New seed" stays for the common case of
    // just wanting a fresh game.
    label(this, left, y, "seed", typeRole.label, surface.ink.hex, ink.label);
    const newSeedWidth = 110;
    const manageDecksWidth = phone ? 0 : 150;
    const seedFieldWidth = column - newSeedWidth - 10 - (phone ? 0 : manageDecksWidth + 10);
    const seedRect: Rect = { x: left, y: y + 16, width: seedFieldWidth, height: hit.target };
    if (this.#seedInput) this.#seedInput.layout(seedRect);
    else {
      this.#seedInput = new McTextInput(this, {
        rect: seedRect,
        value: this.#seedText,
        type: typeRole.mono,
        numeric: true,
        maxLength: 9,
        placeholder: "seed",
        onChange: (value) => {
          this.#seedText = value;
          const parsed = parseSeed(value);
          if (parsed !== null) this.#seed = parsed;
          this.#status?.setText(value.length > 0 && parsed === null ? "seed must be a whole number" : "");
        },
      });
    }
    this.#stops.set("seed", { rect: seedRect, activate: () => this.#seedInput?.focus() });
    const newSeedRect: Rect = { x: left + seedFieldWidth + 10, y: y + 16, width: newSeedWidth, height: hit.target };
    const newSeed = (): void => {
      this.#seed = rollSeed();
      this.#seedText = String(this.#seed);
      this.#seedInput?.setValue(this.#seedText);
      this.#status?.setText("");
    };
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "New seed",
        type: typeRole.label,
        rect: newSeedRect,
        onClick: newSeed,
      }),
    );
    this.#stops.set("new-seed", { rect: newSeedRect, activate: newSeed });
    if (!phone) addManageDecks({ x: newSeedRect.x + newSeedWidth + 10, y: y + 16, width: manageDecksWidth, height: hit.target });
    y += 16 + hit.target + 16;

    // The one red on this screen: the single forward action.
    const start: Rect = { x: left, y, width: column, height: hit.primary };
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Starting…" : "Start game",
        type: typeRole.barTitle,
        rect: start,
        enabled: !this.#starting,
        onClick: () => void this.#start(),
      }),
    );
    this.#stops.set("start", { rect: start, activate: () => void this.#start() });

    this.#status = this.add
      .text(left, y + hit.primary + 10, "", textStyle(typeRole.body, accent.redDeep.hex))
      .setWordWrapWidth(column);

    // Last, so the focus ring sits over the control it frames.
    this.#route?.set(
      titleFocusOrder({
        continuable: this.#continuable !== null,
        scenarioIds: CORE_SCENARIOS.map((scenario) => scenario.id as string),
        difficulties: ["standard", "expert"],
        deckIds: deckOptions.map((option) => option.deck.id as string),
        manageDecks: true,
      }),
      this.#stops,
    );
  }

  #onInspectChoose(rowId: string): void {
    this.#rowHandlers.get(rowId)?.();
  }

  /** One labeled group of choose-one/choose-many rows. Returns the next y. */
  #section(
    x: number,
    y: number,
    width: number,
    heading: string,
    rows: readonly {
      id: string;
      text: string;
      selected: boolean;
      onClick: () => void;
      cardId?: CardId;
      /** What choosing this row does, in the words the blown-up sheet shows. */
      chooseLabel?: string;
      /** Why this row cannot be chosen right now. Absent when it can. */
      blockedBy?: string;
    }[],
    phone: boolean,
    artHeight: number,
    columns: number,
    /** The section's prefix in `titleFocusOrder`'s keys. */
    focusPrefix: "scenario" | "difficulty" | "hero",
  ): number {
    label(this, x, y, heading, typeRole.label, surface.ink.hex, ink.label);
    let top = y + 16;

    // A recessed parchment rail behind the group, per the design's grouping rule.
    // A group whose rows name a card shows the card: picking a villain or a
    // hero by its art is the whole reason the images are here.
    const withArt = rows.some((row) => row.cardId !== undefined);
    const art = withArt ? artHeight : 0;
    const rowHeight = art > 0 ? art + CAPTION_HEIGHT : hit.target;
    const perRow = columns;
    const rowsNeeded = Math.ceil(rows.length / perRow);
    const railHeight = rowsNeeded * (rowHeight + 6) + 6;
    const rail = this.add.graphics();
    paintPanel(rail, { x, y: top, width, height: railHeight }, "rail", "rest");

    const cellWidth = (width - 12 - (perRow - 1) * 6) / perRow;
    rows.forEach((row, index) => {
      this.#rowHandlers.set(row.id, row.onClick);
      const col = index % perRow;
      const line = Math.floor(index / perRow);
      const cell: Rect = {
        x: x + 6 + col * (cellWidth + 6),
        y: top + 6 + line * (rowHeight + 6),
        width: cellWidth,
        height: rowHeight,
      };
      const cardIdForInspect = row.cardId;
      this.#stops.set(`${focusPrefix}:${row.id}`, {
        rect: cell,
        // Enter means what a tap means: a hero already at the table refuses it.
        activate: () => (row.blockedBy ? undefined : row.onClick()),
        // `I` reads the card even when the art has dropped out for lack of room.
        ...(cardIdForInspect
          ? { inspect: () => this.#inspect(cardIdForInspect, row.id, row.blockedBy ?? row.chooseLabel ?? "Select", !row.blockedBy) }
          : {}),
      });
      if (row.cardId && art > 0) {
        const cardId = row.cardId;
        this.#tiles.push(
          new McCardTile(this, {
            rect: cell,
            label: row.text,
            artHeight: art,
            selected: row.selected,
            enabled: !row.blockedBy,
            onClick: row.onClick,
            // Readable even when it cannot be chosen: reading the card is how
            // the player finds out what is already at the table.
            onInspect: () => this.#inspect(cardId, row.id, row.blockedBy ?? row.chooseLabel ?? "Select", !row.blockedBy),
            paintArt: (slot) => this.#paintCard(slot, cardId),
          }),
        );
        return;
      }
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: row.text,
          type: typeRole.rowTitle,
          rect: cell,
          selected: row.selected,
          onClick: row.onClick,
        }),
      );
    });

    top += railHeight + (phone ? 12 : 18);
    return top;
  }

  /**
   * The most cells that fit across without a name overrunning its own cell.
   * Three at most, because past that a card thumbnail stops being a picture.
   */
  #columnsFor(names: readonly string[], width: number, canShrink: boolean): number {
    // A card tile shrinks its caption to fit, so it is measured at the size it
    // would actually end up using; a plain button cannot, so it is measured as
    // it will be drawn. Measuring both the same way is what put the screen in
    // one column on a phone and dropped the card art entirely.
    const probe = this.add.text(-10000, -10000, "", textStyle(typeRole.rowTitle, surface.ink.hex));
    if (canShrink) probe.setFontSize(CAPTION_FLOOR);
    let widest = 0;
    for (const name of names) {
      probe.setText(name);
      widest = Math.max(widest, probe.width);
    }
    probe.destroy();

    for (const columns of [3, 2] as const) {
      if (columns > names.length) continue;
      const cellWidth = (width - 12 - (columns - 1) * 6) / columns;
      // 12px of breathing room, matching what `McCardTile` reserves.
      if (cellWidth - 12 >= widest) return columns;
    }
    return 1;
  }

  /**
   * Paints one card into a tile's art slot. True when a scan was drawn.
   *
   * A villain's picture lives on its first stage and a hero's on its hero face,
   * so this asks for the face rather than for "the front" — asking for a front
   * gets nothing at all for exactly these cards.
   */
  /**
   * Blows a picker's card up. The sheet offers the same choice the tile does —
   * a thumbnail this small is not something you can read a villain's text off,
   * and the villain's text is half of what picking a scenario means.
   */
  #inspect(cardId: CardId, rowId: string, chooseLabel: string, choosable = true): void {
    const card = CARDS_BY_ID.get(cardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    this.scene.launch(SCENES.inspect, {
      card: { cardId, face },
      // A blocked row opens read-only, with the reason where the button was.
      ...(choosable ? { choice: { optionId: rowId, label: chooseLabel } } : { note: chooseLabel }),
    });
  }

  #paintCard(slot: Rect, cardId: CardId): boolean {
    const card = CARDS_BY_ID.get(cardId as string);
    const face = card?.type === "villain" ? ({ kind: "villainStage", sideIndex: 0, stageIndex: 0 } as const) : ({ kind: "hero" } as const);
    const key = cardArt(this).request(this, artFor(card, face));
    return drawArt(this, key, slot) !== null;
  }

  async #resume(gameId: string): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild();
    const { store } = appSession();
    await store.resume(gameId);
    if (store.state.status === "failed") {
      // A save that no longer replays has been retired by the host; say why, and drop the button.
      this.#starting = false;
      this.#continuable = null;
      this.#rebuild();
      this.#status?.setText(store.state.error ?? "that game could not be resumed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.board);
  }

  async #start(): Promise<void> {
    if (this.#starting) return;
    // The seed is the engine's shuffle key: a field the player has typed a
    // non-number into (or emptied) must never fall back to some other value
    // and quietly start a game that can't be reproduced from what's on screen.
    if (parseSeed(this.#seedText) === null) {
      this.#status?.setText("seed must be a whole number");
      return;
    }
    this.#starting = true;
    this.#rebuild();

    const deckOptions = this.#deckOptions();
    const seatedDecks = this.#seats.map((deckId) => deckOptions.find((option) => (option.deck.id as string) === deckId)!);
    const { store } = appSession();
    await store.start({
      scenarioId: this.#scenarioId,
      difficulty: this.#difficulty,
      // A precon seat still goes through `{ starterDeckId }` — the same shape
      // every existing save and test already uses — rather than re-deriving
      // its card list from `Deck.cards`, which would be a second way to say
      // the same seat (`view/deck-seat.ts`).
      players: seatedDecks.map((option) =>
        option.deck.source.kind === "precon" ? { starterDeckId: option.deck.source.starterDeckId as string } : corePlayerFromDeck(option.deck),
      ),
      seed: this.#seed,
    });

    if (store.state.status === "failed") {
      this.#starting = false;
      this.#rebuild();
      // `Setup` only ever offers seatable decks, dimming the rest — but the
      // engine is still the one enforcing `requireLegalDecks` (PLAN.md Phase
      // 9: "no opt-out"), so a refusal is still possible (a pool update
      // landing between this screen loading and Start being pressed). Route
      // straight to fixing the named deck rather than only showing the
      // engine's message here.
      const setupError = store.state.setupError;
      if (setupError?.code === "illegal_deck") {
        const seat = setupError.illegalDecks[0];
        const deckId = seat ? this.#seats[seat.seatIndex] : undefined;
        this.scale.off("resize", this.#rebuild, this);
        this.scene.start(SCENES.decks, {
          focusDeckId: deckId ?? null,
          message: seat?.problems[0]?.message ?? store.state.error ?? "This deck is not legal.",
        } satisfies DecksSceneData);
        return;
      }
      // The engine's own message: nothing here rephrases a setup failure.
      this.#status?.setText(store.state.error ?? "setup failed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.board);
  }

  /** Every seat option, precons then saved/imported decks — the same computation `#rebuild` uses for the Heroes section. */
  #deckOptions(): readonly DeckOption[] {
    return deckOptionsOf(this.#savedDecks, CORE_CARDS, CORE_POOL_VERSION, CORE_DEPS);
  }
}


/** Every Core card by id, so a scenario or a deck can show the card it names. */
const CARDS_BY_ID = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id as string, card]));

/** "Continue — Rhino · Spider-Man · round 4". Names from content, never from the save's own text. */
function continueLabel(save: SaveMeta): string {
  const scenario = CORE_SCENARIOS.find((candidate) => (candidate.id as string) === save.config.scenarioId)?.name ?? save.config.scenarioId;
  const heroes = save.config.players
    .map((player) => {
      // A seat is a starter deck or a custom deck; a custom one is named by its identity card.
      if (!("starterDeckId" in player)) {
        return CORE_CARDS.find((card) => (card.id as string) === player.identityCardId)?.name ?? player.identityCardId;
      }
      return CORE_STARTER_DECKS.find((deck) => (deck.id as string) === player.starterDeckId)?.name.split(" — ")[0] ?? player.starterDeckId;
    })
    .join(", ");
  return `Continue — ${scenario} · ${heroes} · round ${save.round}`;
}
