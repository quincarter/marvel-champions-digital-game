/**
 * The Board's side of Guided mode and game tips: decides, each frame, whether the coach card shows a guide step, a
 * tip, or nothing, and hands that to `presentCoach` (`scenes/coach.ts`). The words come from `view/guide/`; this
 * only picks which to show and wires the buttons.
 *
 * Guide first: while Guided mode is on and the round walk has a step for this moment, tips wait. The walk's
 * progress belongs to this game only (`reset` on every new game), so each game with Guided mode on walks round 1
 * again. Escape closes the guide for the rest of the game without switching Guided mode off; "Turn off" does that.
 */
import type Phaser from "phaser";
import { POOL_DEPS } from "../../content/pool.js";
import { appSession, commitSettings } from "../../session.js";
import type { SessionState } from "../../store/session-store.js";
import { markTipSeen, teachingPrefs } from "../../teaching/teaching-prefs.js";
import type { CoachCard } from "../../ui/coach-state.js";
import type { BoardModel } from "../../view/board-model.js";
import { tipsFor, type Tip } from "../../view/guide/game-tips.js";
import { currentRoundGuideStep, type BoardAnchor, type GuideStepAt } from "../../view/guide/round-guide.js";
import type { PhoneTab, Rect } from "../../view/layout.js";
import { rulesGlossaryOf } from "../../view/rules-reference.js";
import { presentCoach } from "../coach.js";

export interface BoardGuideHooks {
  model(): BoardModel | null;
  /** Where an anchor is on the table right now, or null when it isn't drawn (a phone tab not showing). */
  anchorRect(anchor: BoardAnchor): Rect | null;
  /** Phone board only: bring the tab an anchor lives on into view. */
  showTab(tab: PhoneTab): void;
  tabbed(): boolean;
}

const TAB_OF: Partial<Record<BoardAnchor, PhoneTab>> = {
  threat: "threat",
  enemies: "enemies",
  me: "me",
  playArea: "me",
};

export class BoardGuide {
  readonly #scene: Phaser.Scene;
  readonly #hooks: BoardGuideHooks;
  #done = new Set<string>();
  #closed = false;
  #tips: readonly Tip[] = [];
  #presentedKey: string | null = null;
  /** The step whose tab was last brought into view, so a player who taps away isn't dragged back every frame. */
  #tabShownFor: string | null = null;

  constructor(scene: Phaser.Scene, hooks: BoardGuideHooks) {
    this.#scene = scene;
    this.#hooks = hooks;
  }

  /** A new game: the round walk starts over and the guide opens again. */
  reset(): void {
    this.#done = new Set();
    this.#closed = false;
    this.#tips = [];
    this.#presentedKey = null;
    this.#tabShownFor = null;
  }

  /** Re-reads which tips the table calls for. Once per state, not per frame: the glossary walks the whole table. */
  onState(state: SessionState): void {
    const model = this.#hooks.model();
    if (!state.game || !model || !appSession().settings.gameTips) {
      this.#tips = [];
      return;
    }
    this.#tips = tipsFor(model, rulesGlossaryOf(state.game, POOL_DEPS), new Set(teachingPrefs().seenTips));
  }

  /** Called every frame. Cheap unless the card to show has changed. */
  sync(): void {
    const card = this.#card();
    const key = card?.key ?? null;
    if (key === this.#presentedKey) return;
    this.#presentedKey = key;
    presentCoach(this.#scene, card);
  }

  #card(): CoachCard | null {
    const model = this.#hooks.model();
    if (!model || model.outcome) return null;
    const { settings } = appSession();
    if (settings.guidedMode && !this.#closed) {
      const at = currentRoundGuideStep(model, this.#done);
      if (at) return this.#guideCard(at);
    }
    if (settings.gameTips) {
      const seen = new Set(teachingPrefs().seenTips);
      const tip = this.#tips.find((candidate) => !seen.has(candidate.id));
      if (tip) return this.#tipCard(tip);
    }
    return null;
  }

  #guideCard(at: GuideStepAt): CoachCard {
    const { step } = at;
    const tab = step.anchor ? TAB_OF[step.anchor] : undefined;
    if (tab && this.#hooks.tabbed() && this.#tabShownFor !== step.id) {
      this.#tabShownFor = step.id;
      this.#hooks.showTab(tab);
    }
    const anchor = step.anchor ? this.#hooks.anchorRect(step.anchor) : null;
    const last = at.index === at.total;
    const rectKey = anchor ? `${anchor.x},${anchor.y},${anchor.width},${anchor.height}` : "-";
    return {
      key: `guide:${step.id}:${step.body}:${rectKey}`,
      eyebrow: `Guided mode · step ${at.index} of ${at.total}`,
      title: step.title,
      body: step.body,
      anchor,
      corner: "topRight",
      actions: [
        ...(at.previousId
          ? [{ id: "back", label: "◂ Back", onClick: () => this.#back(at.previousId!) }]
          : []),
        { id: "turnOff", label: "Turn off", onClick: () => this.#turnOffGuide() },
        { id: "next", label: last ? "Done" : "Next ▸", forward: true, onClick: () => this.#next(step.id) },
      ],
      onEscape: () => this.#close(),
      hint: "Esc closes the guide for this game · N for next",
    };
  }

  #tipCard(tip: Tip): CoachCard {
    return {
      key: `tip:${tip.id}`,
      eyebrow: "Tip",
      title: tip.title,
      body: tip.body,
      cite: tip.cite,
      corner: "topRight",
      actions: [
        { id: "tipsOff", label: "Turn off tips", onClick: () => this.#turnOffTips() },
        { id: "gotIt", label: "Got it", forward: true, onClick: () => this.#dismissTip(tip.id) },
      ],
      onEscape: () => this.#dismissTip(tip.id),
      hint: "Esc or N to dismiss",
    };
  }

  #next(id: string): void {
    this.#done.add(id);
    this.sync();
  }

  #back(previousId: string): void {
    this.#done.delete(previousId);
    this.#tabShownFor = null;
    this.sync();
  }

  #close(): void {
    this.#closed = true;
    this.sync();
  }

  #turnOffGuide(): void {
    commitSettings({ ...appSession().settings, guidedMode: false });
    this.sync();
  }

  #turnOffTips(): void {
    commitSettings({ ...appSession().settings, gameTips: false });
    this.sync();
  }

  #dismissTip(id: string): void {
    markTipSeen(id);
    this.sync();
  }
}
