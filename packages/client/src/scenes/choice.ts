/**
 * The pending-choice overlay.
 *
 * It runs in parallel over Board (`scene.launch`), so the table stays visible
 * underneath while a decision is open — the design's overlay sheet: an ink
 * title bar with a boxed ✕, a 70%-ink scrim, and one red commit plus quiet
 * alternatives.
 *
 * The engine's `PendingChoice.options` already lists every legal answer, so
 * this screen only has to present them and send the ids back. It labels *why*
 * this player is deciding from `PendingChoice.authority`, which is what makes
 * an encounter-side decision legible as one (docs/phase3-encounter-ai.md).
 */

import Phaser from "phaser";
import { accent, hit, ink, signal, surface, typeRole } from "../tokens.js";
import { cssOf, textStyle } from "../ui/theme.js";
import { McButton, label, paintPanel } from "../ui/widgets.js";
import type { Rect } from "../view/layout.js";
import { formFactorFor } from "../view/layout.js";
import { decisionLabel } from "../view/villain-walkthrough.js";
import { appSession } from "../session.js";
import { SCENES } from "./keys.js";

export class ChoiceOverlay extends Phaser.Scene {
  #selected: string[] = [];
  #buttons: McButton[] = [];
  #unsubscribe: (() => void) | null = null;
  #choiceId: string | null = null;

  constructor() {
    super({ key: SCENES.choice });
  }

  create(): void {
    const { store } = appSession();
    this.#unsubscribe = store.subscribe(() => this.#rebuild());
    this.scale.on("resize", () => this.#rebuild(), this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#unsubscribe?.();
      this.#unsubscribe = null;
    });
  }

  #rebuild(): void {
    const { store } = appSession();
    const state = store.state;
    const choice = state.game?.pendingChoice;
    if (!choice || !state.game) return;

    // A new choice clears the previous selection.
    if (choice.choiceId !== this.#choiceId) {
      this.#choiceId = choice.choiceId;
      this.#selected = [];
    }

    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.children.removeAll(true);

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";

    // The 70%-ink scrim.
    const scrim = this.add.graphics();
    scrim.fillStyle(surface.ink.hex, 0.7).fillRect(0, 0, width, height);

    const sheetWidth = Math.min(width - (phone ? 16 : 80), 560);
    const sheetHeight = Math.min(height - (phone ? 16 : 80), 560);
    const sheet: Rect = {
      x: (width - sheetWidth) / 2,
      y: (height - sheetHeight) / 2,
      width: sheetWidth,
      height: sheetHeight,
    };
    const g = this.add.graphics();
    paintPanel(g, sheet, "card", "rest");

    // Ink title bar.
    const bar: Rect = { x: sheet.x, y: sheet.y, width: sheet.width, height: 38 };
    const barG = this.add.graphics();
    barG.fillStyle(surface.ink.hex, 1).fillRect(bar.x, bar.y, bar.width, bar.height);
    this.add
      .text(bar.x + 10, bar.y + bar.height / 2, promptTitle(choice.prompt.kind), textStyle(typeRole.barTitle, surface.paper.hex))
      .setOrigin(0, 0.5)
      .setLetterSpacing(2);

    // Why this player is the one deciding. The villain-phase screen's
    // "auto-advance paused" wording belongs to that screen, not here.
    const reason = decisionLabel(choice, state.game, state.perspectiveId);
    const advisory = this.add
      .text(
        sheet.x + 12,
        bar.y + bar.height + 10,
        choice.soleDecider ? `${reason} · Peril — nobody else may act` : reason,
        textStyle(typeRole.body, surface.ink.hex, ink.secondary),
      )
      .setWordWrapWidth(sheet.width - 24);
    label(
      this,
      sheet.x + 12,
      advisory.y + advisory.height + 6,
      `select ${choice.minSelections === choice.maxSelections ? choice.minSelections : `${choice.minSelections}–${choice.maxSelections}`}${choice.ordered ? " · order matters" : ""}`,
      typeRole.label,
      surface.ink.hex,
      ink.label,
    );

    // The options: every legal answer the engine listed.
    const listTop = advisory.y + advisory.height + 26;
    const commitTop = sheet.y + sheet.height - hit.primary - 12;
    const rowHeight = hit.target;
    const capacity = Math.max(1, Math.floor((commitTop - listTop - 8) / (rowHeight + 4)));
    const shown = choice.options.slice(0, capacity);

    shown.forEach((option, index) => {
      const order = this.#selected.indexOf(option.optionId);
      const rowLabel = choice.ordered && order >= 0 ? `${order + 1}. ${option.label}` : option.label;
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: rowLabel,
          type: typeRole.rowTitle,
          rect: { x: sheet.x + 12, y: listTop + index * (rowHeight + 4), width: sheet.width - 24, height: rowHeight },
          selected: order >= 0,
          onClick: () => this.#toggle(option.optionId, choice.maxSelections),
        }),
      );
    });
    if (choice.options.length > capacity) {
      label(
        this,
        sheet.x + 12,
        commitTop - 16,
        `+${choice.options.length - capacity} more options — resize to see them`,
        typeRole.label,
        signal.caution.hex,
        ink.body,
      );
    }

    const canCommit =
      this.#selected.length >= choice.minSelections && this.#selected.length <= choice.maxSelections;
    const commitWidth = choice.minSelections === 0 ? (sheet.width - 32) / 2 : sheet.width - 24;

    // One red commit, plus a quiet alternative when declining is legal.
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: "Confirm",
        type: typeRole.barTitle,
        rect: { x: sheet.x + 12, y: commitTop, width: commitWidth, height: hit.primary },
        enabled: canCommit,
        reason: `choose ${choice.minSelections} to continue`,
        onClick: () => void this.#confirm(),
      }),
    );
    if (choice.minSelections === 0) {
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Decline",
          type: typeRole.label,
          rect: { x: sheet.x + 20 + commitWidth, y: commitTop, width: commitWidth, height: hit.primary },
          onClick: () => {
            this.#selected = [];
            void this.#confirm();
          },
        }),
      );
    }

    this.cameras.main.setBackgroundColor(cssOf(accent.heroRed.hex, 0));
  }

  #toggle(optionId: string, max: number): void {
    const at = this.#selected.indexOf(optionId);
    if (at >= 0) this.#selected = this.#selected.filter((id) => id !== optionId);
    else if (max === 1) this.#selected = [optionId];
    else if (this.#selected.length < max) this.#selected = [...this.#selected, optionId];
    this.#rebuild();
  }

  async #confirm(): Promise<void> {
    // The store issues this as the player the engine named, not as "the human".
    await appSession().store.resolveChoice(this.#selected);
  }
}

/** The design's overlay titles for the engine's prompt kinds. */
function promptTitle(kind: string): string {
  const titles: Record<string, string> = {
    declareDefender: "Declare a defender",
    discardDownToHandSize: "Discard to hand size",
    mulligan: "Mulligan",
    chooseMinionToActivate: "Choose a minion to activate",
    orderEnemies: "Order the enemies",
    orderTriggers: "Order these effects",
    chooseTriggers: "Trigger an ability?",
    chooseTarget: "Choose a target",
    chooseAttachmentTarget: "Choose a host",
    chooseCards: "Choose cards",
    chooseOption: "Choose one",
    choosePlayer: "Choose a player",
    orderSpecials: "Order the special abilities",
    payForCard: "Pay for this card?",
    payForAbility: "Pay for this ability?",
    spendResources: "Spend resources?",
    discardOverAllyLimit: "Discard to your ally limit",
    discardRestricted: "Discard to two restricted cards",
  };
  return titles[kind] ?? "Choose";
}
