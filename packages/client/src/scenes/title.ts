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
import { CORE_SCENARIOS, CORE_STARTER_DECKS } from "@mc/content";
import { accent, dotGrid, hit, ink, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintDotGrid, paintPanel } from "../ui/widgets.js";
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
  #status: Phaser.GameObjects.Text | null = null;
  #starting = false;

  constructor() {
    super(SCENES.title);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#rebuild, this);
    this.#rebuild();
  }

  #rebuild(): void {
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    const pad = phone ? 16 : 40;
    const column = Math.min(width - pad * 2, 640);
    const left = (width - column) / 2;

    paintDotGrid(this, { x: 0, y: 0, width, height }, "paper", dotGrid.onPaper);

    const titleSize = phone ? 44 : Math.min(92, Math.round(width / 10));
    this.add
      .text(left, pad + 8, "MARVEL\nCHAMPIONS", {
        ...textStyle(typeRole.screenTitle, surface.ink.hex),
        fontSize: `${titleSize}px`,
        lineSpacing: -Math.round(titleSize * 0.16),
      })
      .setLetterSpacing(2);

    let y = pad + titleSize * 2.1;
    y = this.#section(left, y, column, "Scenario", CORE_SCENARIOS.map((scenario) => ({
      id: scenario.id as string,
      text: scenario.name,
      selected: this.#scenarioId === (scenario.id as string),
      onClick: () => {
        this.#scenarioId = scenario.id as string;
        this.#rebuild();
      },
    })), phone);

    y = this.#section(left, y, column, "Difficulty", (["standard", "expert"] as const).map((difficulty) => ({
      id: difficulty,
      text: difficulty,
      selected: this.#difficulty === difficulty,
      onClick: () => {
        this.#difficulty = difficulty;
        this.#rebuild();
      },
    })), phone);

    y = this.#section(left, y, column, `Heroes — ${this.#seats.length} seat${this.#seats.length === 1 ? "" : "s"}, all played by you`, CORE_STARTER_DECKS.map((deck) => {
      const seated = this.#seats.includes(deck.id as string);
      return {
        id: deck.id as string,
        // "Spider-Man (Justice) — Core Set starter deck" and the tutorial
        // deck's own suffix both trim to the part that identifies the hero.
        text: deck.name.split(" — ")[0]!,
        selected: seated,
        onClick: () => {
          if (seated) {
            // A game needs at least one seat.
            if (this.#seats.length > 1) this.#seats = this.#seats.filter((id) => id !== (deck.id as string));
          } else if (this.#seats.length < 4) {
            this.#seats = [...this.#seats, deck.id as string];
          }
          this.#rebuild();
        },
      };
    }), phone);

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

  /** One labeled group of choose-one/choose-many rows. Returns the next y. */
  #section(
    x: number,
    y: number,
    width: number,
    heading: string,
    rows: readonly { id: string; text: string; selected: boolean; onClick: () => void }[],
    phone: boolean,
  ): number {
    label(this, x, y, heading, typeRole.label, surface.ink.hex, ink.label);
    let top = y + 16;

    // A recessed parchment rail behind the group, per the design's grouping rule.
    const rowHeight = hit.target;
    const perRow = phone ? 1 : Math.min(rows.length, 3);
    const rowsNeeded = Math.ceil(rows.length / perRow);
    const railHeight = rowsNeeded * (rowHeight + 6) + 6;
    const rail = this.add.graphics();
    paintPanel(rail, { x, y: top, width, height: railHeight }, "rail", "rest");

    const cellWidth = (width - 12 - (perRow - 1) * 6) / perRow;
    rows.forEach((row, index) => {
      const col = index % perRow;
      const line = Math.floor(index / perRow);
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: row.text,
          type: typeRole.rowTitle,
          rect: {
            x: x + 6 + col * (cellWidth + 6),
            y: top + 6 + line * (rowHeight + 6),
            width: cellWidth,
            height: rowHeight,
          },
          selected: row.selected,
          onClick: row.onClick,
        }),
      );
    });

    top += railHeight + 18;
    return top;
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
