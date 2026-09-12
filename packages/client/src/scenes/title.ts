/**
 * Title, then setup: pick a scenario, a difficulty, and 1–4 seats.
 *
 * The mocks split this across Scenario → Heroes → Deck screens; this is one
 * screen carrying the same three decisions, with the preconstructed Core decks
 * as the only deck choice (deckbuilding is out of scope for Phase 4). One red
 * per screen, so "Start game" is the only red fill here.
 *
 * Every seat is played by the same human (PLAN.md Phase 4, hero seats): the
 * board's perspective follows whoever must act, and each command is still
 * issued as the player the engine names.
 */

import Phaser from "phaser";
import { CORE_CARDS, CORE_SCENARIOS, CORE_STARTER_DECKS, type AnyCard, type CardId } from "@mc/content";
import { accent, dotGrid, hit, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { CAPTION_FLOOR, CAPTION_HEIGHT, McButton, McCardTile, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
import { artFor } from "../art/art-source.js";
import { seatOptions } from "../view/seats.js";
import { cardArt, drawArt } from "../art/card-art.js";
import type { Rect } from "../view/layout.js";
import { formFactorFor } from "../view/layout.js";
import { appSession } from "../session.js";
import { SCENES } from "./keys.js";

export class TitleScene extends Phaser.Scene {
  #scenarioId = CORE_SCENARIOS[0]!.id as string;
  #difficulty: "standard" | "expert" = "standard";
  #seats: string[] = [CORE_STARTER_DECKS[0]!.id as string];
  /**
   * A fresh seed per visit. The engine shuffles every deck from `config.seed`
   * at setup, so a constant default meant every new game dealt the same opening
   * hand — the shuffle was real, the randomness wasn't. "New seed" re-rolls it,
   * and the number stays on screen so a game can be replayed deliberately.
   */
  #seed = rollSeed();
  #buttons: McButton[] = [];
  #tiles: McCardTile[] = [];
  /** What choosing each row does, by row id, so the Inspect sheet can trigger it. */
  #rowHandlers = new Map<string, () => void>();
  #status: Phaser.GameObjects.Text | null = null;
  #starting = false;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    // Thumbnails arrive after the first frame, same as on the table.
    const artOff = cardArt(this).onArrived(() => this.#rebuild());
    // The Inspect sheet reports its answer back rather than deciding: it names
    // the row, and the row's own handler applies whatever choosing it means.
    this.game.events.on("mc-choice-toggle", this.#onInspectChoose, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      artOff();
      this.game.events.off("mc-choice-toggle", this.#onInspectChoose, this);
    });
    this.#rebuild();
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    for (const tile of this.#tiles) tile.destroy();
    this.#buttons = [];
    this.#tiles = [];
    this.#rowHandlers.clear();
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const pad = phone ? 16 : 40;
    const column = Math.min(width - pad * 2, 640);
    const left = (width - column) / 2;

    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    const titleSize = phone ? 38 : Math.min(92, Math.round(width / 10));
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
    const scenarioNames = CORE_SCENARIOS.map((scenario) => scenario.name);
    const heroNames = CORE_STARTER_DECKS.map((deck) => deck.name.split(" — ")[0]!);
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
      hit.target + 16 + hit.primary;
    const artHeight = Math.max(0, Math.min(phone ? 96 : 128, Math.floor((height - fixed) / Math.max(1, artLines))));
    const showArt = artHeight >= 44;

    let y = pad + titleBlock;
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
    })), phone, artHeight, scenarioCols);

    y = this.#section(left, y, column, "Difficulty", (["standard", "expert"] as const).map((difficulty) => ({
      id: difficulty,
      text: difficulty,
      selected: this.#difficulty === difficulty,
      onClick: () => {
        this.#difficulty = difficulty;
        this.#rebuild();
      },
    })), phone, 0, difficultyCols);

    // A hero already at the table cannot sit twice: the Rules Reference limits
    // a unique card to one copy in play across all players, by title. Both
    // Captain Marvel starter decks name the same identity, so offering them
    // together was offering an illegal game (see view/seats.ts).
    const seating = new Map(seatOptions(CORE_STARTER_DECKS, this.#seats, CARDS_BY_ID).map((o) => [o.deckId, o]));

    y = this.#section(left, y, column, `Heroes — ${this.#seats.length} seat${this.#seats.length === 1 ? "" : "s"}, all played by you`, CORE_STARTER_DECKS.map((deck) => {
      const seated = this.#seats.includes(deck.id as string);
      const blockedBy = seating.get(deck.id as string)?.blockedBy ?? null;
      return {
        id: deck.id as string,
        // "Spider-Man (Justice) — Core Set starter deck" and the tutorial
        // deck's own suffix both trim to the part that identifies the hero.
        text: deck.name.split(" — ")[0]!,
        ...(showArt ? { cardId: deck.identityCardId } : {}),
        chooseLabel: seated ? "Remove this seat" : "Take this seat",
        selected: seated,
        ...(blockedBy ? { blockedBy } : {}),
        onClick: () => {
          if (seated) {
            // A game needs at least one seat.
            if (this.#seats.length > 1) this.#seats = this.#seats.filter((id) => id !== (deck.id as string));
          } else if (!blockedBy) {
            this.#seats = [...this.#seats, deck.id as string];
          }
          this.#rebuild();
        },
      };
    }), phone, artHeight, heroCols);

    // Seed: the design's spec-and-version voice, so it reads as a token.
    label(this, left, y, `seed ${this.#seed}`, typeRole.mono, surface.ink.hex, ink.meta);
    this.#buttons.push(
      new McButton(this, {
        kind: "quiet",
        label: "New seed",
        type: typeRole.label,
        rect: { x: left + column - 110, y: y - 12, width: 110, height: hit.target },
        onClick: () => {
          this.#seed = rollSeed();
          this.#rebuild();
        },
      }),
    );
    y += hit.target + 16;

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

    this.#status = this.add
      .text(left, y + hit.primary + 10, "", textStyle(typeRole.body, accent.redDeep.hex))
      .setWordWrapWidth(column);
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

  async #start(): Promise<void> {
    if (this.#starting) return;
    this.#starting = true;
    this.#rebuild();

    const { store } = appSession();
    await store.start({
      scenarioId: this.#scenarioId,
      difficulty: this.#difficulty,
      players: this.#seats.map((starterDeckId) => ({ starterDeckId })),
      seed: this.#seed,
    });

    if (store.state.status === "failed") {
      this.#starting = false;
      this.#rebuild();
      // The engine's own message: nothing here rephrases a setup failure.
      this.#status?.setText(store.state.error ?? "setup failed");
      return;
    }
    this.scale.off("resize", this.#rebuild, this);
    this.scene.start(SCENES.board);
  }
}

/** Five digits: long enough not to collide, short enough to read back out loud. */
const rollSeed = (): number => Math.floor(Math.random() * 100000);

/** Every Core card by id, so a scenario or a deck can show the card it names. */
const CARDS_BY_ID = new Map<string, AnyCard>(CORE_CARDS.map((card) => [card.id as string, card]));
