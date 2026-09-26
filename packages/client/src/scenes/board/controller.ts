/**
 * The Board's interaction controller: target-select mode, payment mode, and
 * the one route every command takes to the store.
 *
 * It decides nothing the engine owns — every target, price and legality check
 * it acts on came from `legalActions` or `paymentFor` — and it draws nothing:
 * whenever the selection changes it asks the scene to redraw.
 */

import { POOL_DEPS } from "../../content/pool.js";
import type { AbilityId } from "@mc/content";
import type { Command, CostSelection, GameState, InstanceId, LegalAction, PlayerId } from "@mc/engine";
import { tryPayment } from "@mc/engine";
import { appSession } from "../../session.js";
import { abilityLabelOf, abilityShortLabelOf } from "../../view/ability-label.js";
import { powerEntries, powerSources, type PowerKind, type PowerSource } from "../../view/attacker-choice.js";
import { formEntries, formSources, needsFormChoice, type FormSource } from "../../view/change-form-choice.js";
import type { BoardModel } from "../../view/board-model.js";
import { characterPanel } from "../../view/board-model.js";
import { costChoicePromptFor, type CostChoicePrompt } from "../../view/cost-choice-model.js";
import type { CostReductionOption } from "../../view/cost-reduction-model.js";
import {
  beginDiscardChoice,
  discardChoiceView as buildDiscardChoiceView,
  toggleDiscardChoice,
  type DiscardChoiceView,
} from "../../view/discard-choice-model.js";
import { endTurnConfirmOf } from "../../view/end-turn-confirm.js";
import { focusOrder, type FocusTarget } from "../../view/focus.js";
import {
  abilityActionsFor,
  type BasicAction,
  type Highlights,
  type UsableAbilityAction,
} from "../../view/highlights.js";
import { cardName, seatIdentityName } from "../../view/names.js";
import {
  allianceHelpersOf,
  beginPayment,
  paymentView,
  toggleCostReduction,
  togglePayment,
  type PaymentView,
} from "../../view/payment-model.js";
import { targetingPanelOf, type TargetingPanel, type TargetingSource } from "../../view/targeting-panel.js";
import { BASIC_TO_KIND, basicKindOf, retarget, type Selection } from "./selection.js";

/** What the controller reads from, and asks of, the scene that owns it. */
export interface BoardControllerHost {
  model(): BoardModel | null;
  marks(): Highlights | null;
  /** Whether the last draw laid the board out as phone tabs. */
  tabbed(): boolean;
  redraw(): void;
  inspect(id: InstanceId): void;
  /**
   * Asks "End your turn? You can still: …" (Settings ▸ "Confirm before ending turn",
   * `view/end-turn-confirm.ts`), and calls `onConfirm` only if the player says End turn.
   */
  confirmEndTurn(sentence: string, onConfirm: () => void): void;
}

/** What the controller picker bar shows: the card, and each seat it may be played under. */
export interface ControllerChoiceView {
  readonly subject: string;
  readonly options: readonly { readonly playerId: PlayerId; readonly label: string }[];
}

/** What the "Who attacks?" bar shows: every character that could make the power, in the engine's order. */
export interface SourceChoiceView {
  readonly power: PowerKind;
  readonly sources: readonly PowerSource[];
}

/** What the "Which form?" bar shows: Spectrum's energy/density/mass, Ant-Man/Wasp's Giant form (`view/change-form-choice.js`). */
export interface FormChoiceView {
  readonly sources: readonly FormSource[];
}

/** What the "Play it / Decline" bar shows: the free card waiting on a yes. */
export interface PlayConfirmationView {
  readonly subject: string;
}

/**
 * What the alliance-help bar shows (docs/phase7-wave4.md §4 Q10): one helper, asked in turn, to approve the
 * cards of theirs the current payment would spend. `remaining`/`total` are the bar's own "1 of 2" counter.
 */
export interface AllianceHelpView {
  readonly playerId: PlayerId;
  readonly heroName: string;
  readonly cardNames: readonly string[];
  readonly remaining: number;
  readonly total: number;
}

/**
 * The engine's example `playCard`, sent to `controllerId` instead of whichever
 * seat the example picked. The payer's own seat is spelled as no controller,
 * the way `legalActions` builds it.
 */
function withController(command: Command, controllerId: PlayerId | null): Command {
  if (command.type !== "playCard" || controllerId === null) return command;
  const { controllerId: _example, ...rest } = command;
  return controllerId === command.playerId ? rest : { ...rest, controllerId };
}

/**
 * The targeting panel's source (docs/phase4-screen-gaps.md §3 "W5"): "Photon Blast — deal 5 damage to an enemy" for
 * an ability, or the same shape for a basic action — who's doing it, and its printed stat — plus the card the
 * tablet inspector rail (L06) shows beside the target list. `abilityLabelOf` already carries a card's own name plus
 * its printed cost/label (`view/ability-label.ts`); a basic action has no card of its own, so this reads the
 * attacker's or thwarter's printed ATK/THW off the same `characterPanel` the board's own panels read, and the rail
 * shows that character's own card instead of a card that doesn't exist.
 *
 * Every `ActionRef` kind `BoardController` ever opens target-select mode for — `basicAttack`, `basicThwart`,
 * `useAbility` — names an instance, so this never falls back to a sourceless label in practice; the fallback exists
 * only so this stays total over `ActionRef` without a runtime throw if that ever changes.
 */
function sourceOf(state: GameState, action: LegalAction): TargetingSource {
  const { action: ref } = action;
  if (ref.kind === "basicAttack") {
    return {
      label: `${cardName(state, ref.instanceId)} — Attack${statSuffix(state, ref.instanceId, "ATK")}`,
      name: cardName(state, ref.instanceId),
      instanceId: ref.instanceId,
    };
  }
  if (ref.kind === "basicThwart") {
    return {
      label: `${cardName(state, ref.instanceId)} — Thwart${statSuffix(state, ref.instanceId, "THW")}`,
      name: cardName(state, ref.instanceId),
      instanceId: ref.instanceId,
    };
  }
  if (ref.kind === "useAbility") {
    return {
      label: abilityLabelOf(state, ref.instanceId, ref.abilityId, POOL_DEPS),
      name: cardName(state, ref.instanceId),
      instanceId: ref.instanceId,
    };
  }
  const instanceId = "instanceId" in ref ? ref.instanceId : action.targets[0]!;
  return { label: "Choose a target", name: cardName(state, instanceId), instanceId };
}

function statSuffix(state: GameState, instanceId: InstanceId, label: "ATK" | "THW"): string {
  const value = characterPanel(state, instanceId, POOL_DEPS).stats.find((stat) => stat.label === label)?.value;
  return value && value !== "—" ? ` ${value}` : "";
}

export class BoardController {
  readonly #host: BoardControllerHost;
  #selection: Selection = { kind: "idle" };
  /**
   * Set when the board is showing a replayed state rather than the live
   * session — the minimal safe seam S7 leaves for W4's "jump to a moment"
   * and W8's "watch the replay" (docs/phase4-screen-gaps.md §2), landed ahead
   * of either because wiring a replayed `GameState` through the rest of the
   * board (which reads the live session via `appSession()` in a dozen more
   * places — `hand.ts`, `action-bar.ts`, `motion.ts`, this file) turned out to
   * be a scene-sized job, not a seam; see the doc for what's still open.
   *
   * Every method here that would enter a target/payment/discard/controller-
   * choice mode, or dispatch a command, becomes a no-op while this is set —
   * regardless of what the live session's own `legalActions` say — so a
   * replay screen built on this controller can never act on, or even *look
   * like it could act on*, the game actually being played. `#dispatch` is
   * also guarded on its own, as the one choke point every mutating path
   * already funnels through, so the guarantee holds even if a future caller
   * reaches one of the other guards incorrectly.
   */
  #readOnly: boolean;

  constructor(host: BoardControllerHost, options: { readonly readOnly?: boolean } = {}) {
    this.#host = host;
    this.#readOnly = options.readOnly ?? false;
  }

  get selection(): Selection {
    return this.#selection;
  }

  get readOnly(): boolean {
    return this.#readOnly;
  }

  /** Flips read-only mode. A scene switching between a live board and a replayed one calls this rather than rebuilding the controller. */
  setReadOnly(readOnly: boolean): void {
    if (this.#readOnly === readOnly) return;
    this.#readOnly = readOnly;
    this.#selection = { kind: "idle" };
    this.#host.redraw();
  }

  /**
   * Drops any half-made selection without redrawing. For a new state, which
   * redraws anyway: the engine may have changed what is legal, and a stale
   * target would just be rejected.
   */
  reset(): void {
    this.#selection = { kind: "idle" };
  }

  /** Backs out of whatever mode is open, and redraws. */
  cancel(): void {
    this.#selection = { kind: "idle" };
    this.#host.redraw();
  }

  /** The focus route for whatever the board is currently asking for. */
  focusOrder(): readonly FocusTarget[] {
    const model = this.#host.model();
    if (!model) return [];
    const marks = this.#host.marks();
    if (this.#selection.kind === "targeting") {
      return focusOrder({ kind: "targeting", targets: this.#selection.action.targets }, marks);
    }
    if (this.#selection.kind === "paying") {
      return focusOrder(
        { kind: "paying", sources: this.#selection.payment.query.sources.map((source) => source.instanceId) },
        marks,
      );
    }
    if (this.#selection.kind === "choosingDiscard") {
      // Same route shape as "paying": only the candidates are worth stepping through.
      return focusOrder({ kind: "paying", sources: this.#selection.choice.candidates }, marks);
    }
    if (this.#selection.kind === "choosingSource") {
      return focusOrder({ kind: "targeting", targets: this.#selection.sources.map((s) => s.instanceId) }, marks);
    }
    if (this.#selection.kind === "confirmingPlay") {
      // The card itself (Enter on it is "Play it") and the way out, the same two stops targeting offers.
      const { action } = this.#selection.action;
      return focusOrder({ kind: "targeting", targets: action.kind === "playCard" ? [action.instanceId] : [] }, marks);
    }
    return focusOrder({ kind: "idle", hand: model.hand.map((card) => card.instanceId) }, marks);
  }

  /**
   * The targeting panel (docs/phase4-screen-gaps.md §3 "W5"): each legal target's outcome and why every other card
   * in play isn't one, or null outside target-select mode. Built fresh on every call rather than cached on the
   * selection, since a preview must always reflect the state as it is right now (`preview()`'s own doc comment) —
   * cheap enough to do so, at well under a millisecond per candidate target.
   */
  targetingPanel(): TargetingPanel | null {
    if (this.#selection.kind !== "targeting") return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const { action } = this.#selection;
    return targetingPanelOf(
      game,
      action,
      sourceOf(game, action),
      (target) => retarget(action.example, target),
      POOL_DEPS,
    );
  }

  /** Acts on the focused target, meaning whatever a tap or a press on it would mean right now. */
  activate(focus: FocusTarget): void {
    if (this.#readOnly) return;
    // The targeting panel's own "Cancel · Esc" control, reached by tab as well as by Escape.
    if (focus.kind === "cancel") {
      this.cancel();
      return;
    }
    if (focus.kind === "basic") {
      if (focus.action === "endTurn") void this.dispatchExample("endTurn");
      else this.chooseBasic(focus.action);
      return;
    }
    // Enter on the card a free play is asking about is the keyboard's "Play it": the bar's buttons are not on the
    // focus route, and the route's other stop is the way out. A *tap* on the card deselects it (`tapInMode`).
    if (this.#selection.kind === "confirmingPlay") {
      const { action } = this.#selection.action;
      if (action.kind === "playCard" && action.instanceId === focus.instanceId) void this.confirmPlay();
      return;
    }
    if (this.tapInMode(focus.instanceId)) return;
    // A card in play with a usable ability, not a hand card: `playCard` only
    // ever looks for a `playCard` entry, so a card that's on the focus route
    // solely because of `usableAbilities` opens the card, whose sheet offers the ability.
    if (this.#host.marks()?.usableAbilities.has(focus.instanceId)) this.onCharacterTap(focus.instanceId);
    else void this.playCard(focus.instanceId, { confirmFree: true });
  }

  /**
   * A tap on a card while a mode is open answers that mode: it spends the card
   * during payment, or aims at it during targeting. Returns false when idle, so
   * the card's own tap behaviour can run instead.
   */
  tapInMode(id: InstanceId): boolean {
    if (this.#readOnly) return false;
    if (this.#selection.kind === "paying") {
      this.#spendByInstance(id);
      return true;
    }
    if (this.#selection.kind === "choosingDiscard") {
      this.toggleDiscardPick(id);
      return true;
    }
    if (this.#selection.kind === "targeting") {
      void this.#commitTarget(id);
      return true;
    }
    if (this.#selection.kind === "choosingSource") {
      // Tapping one of the offered characters on the table picks it, the same as its button in the bar.
      this.chooseSource(id);
      return true;
    }
    if (this.#selection.kind === "confirmingPlay") {
      // A second tap on the card being asked about puts it back — a tap selects, a tap deselects, and only the
      // bar's own "Play it" plays. A tap anywhere else changes nothing.
      const { action } = this.#selection.action;
      if (action.kind === "playCard" && action.instanceId === id) this.cancel();
      return true;
    }
    return false;
  }

  /**
   * Enters target-select mode, or dispatches immediately when the action needs
   * no target. The engine decided both: `targets` came from `legalActions`.
   */
  chooseBasic(action: BasicAction): void {
    if (this.#readOnly) return;
    if (action === "attack" || action === "thwart") {
      // More than one character could go — the hero and an ally, say — so who goes (and so in what order their
      // effects land) is the player's pick, not whichever the engine happened to list first.
      const sources = this.powerSourcesFor(action);
      if (sources.length > 1) {
        this.#selection = { kind: "choosingSource", power: action, sources };
        this.#host.redraw();
        return;
      }
    }
    if (action === "changeForm") {
      // A three-or-more-sided identity (Spectrum's energy/density/mass forms, Ant-Man/Wasp's Giant form) offers a
      // distinct `changeForm` entry per destination — which one is the player's call (`view/change-form-choice.ts`).
      const sources = this.formSourcesFor();
      if (needsFormChoice(sources.map((source) => source.entry))) {
        this.#selection = { kind: "choosingForm", sources };
        this.#host.redraw();
        return;
      }
    }
    const entry = this.#legalFor(action);
    if (!entry) return;
    this.#aim(entry, action);
  }

  /** The "Who attacks?" bar's answer (or a tap on that character): that character's attack, aimed next. */
  chooseSource(id: InstanceId): void {
    if (this.#readOnly || this.#selection.kind !== "choosingSource") return;
    const source = this.#selection.sources.find((candidate) => candidate.instanceId === id);
    if (!source) return;
    this.#selection = { kind: "idle" };
    this.#aim(source.entry, basicKindOf(source.entry));
  }

  /** The "Which form?" bar's answer: that destination form's `changeForm`, dispatched straight away (it needs no target). */
  chooseForm(source: FormSource): void {
    if (this.#readOnly || this.#selection.kind !== "choosingForm") return;
    this.#selection = { kind: "idle" };
    this.#aim(source.entry, "changeForm");
  }

  /** The characters the "Who attacks?" bar offers, or null when it isn't open. */
  sourceChoice(): SourceChoiceView | null {
    if (this.#selection.kind !== "choosingSource") return null;
    return { power: this.#selection.power, sources: this.#selection.sources };
  }

  /** The forms the "Which form?" bar offers, or null when it isn't open. */
  formChoice(): FormChoiceView | null {
    return this.#selection.kind === "choosingForm" ? { sources: this.#selection.sources } : null;
  }

  /** Every character that could make this basic power right now, with what going costs it. */
  powerSourcesFor(power: PowerKind): readonly PowerSource[] {
    const { game, legal } = appSession().store.state;
    if (!game) return [];
    return powerSources(game, powerEntries(legal?.actions, power), power, POOL_DEPS);
  }

  /** Every legal `changeForm` destination right now, labeled. */
  formSourcesFor(): readonly FormSource[] {
    const { game, legal } = appSession().store.state;
    if (!game) return [];
    return formSources(game, formEntries(legal?.actions), POOL_DEPS);
  }

  /**
   * Dispatches a basic action straight away when it needs no target or has only one, and otherwise enters
   * target-select mode. The prompt names who is acting, since with allies in play "attack" alone doesn't say.
   */
  #aim(entry: LegalAction, action: BasicAction | null): void {
    if (entry.targets.length <= 1) {
      // No target, or one legal target: not a decision; aim and go.
      void this.#dispatch(entry.example);
      return;
    }
    const { game } = appSession().store.state;
    const ref = entry.action;
    const who = game && "instanceId" in ref ? cardName(game, ref.instanceId) : null;
    const prompt = who && action ? `Choose a target for ${who}'s ${action}` : `Choose a target to ${action ?? "act"}`;
    this.#selection = { kind: "targeting", action: entry, prompt };
    this.#host.redraw();
  }

  async #commitTarget(id: InstanceId): Promise<void> {
    if (this.#selection.kind !== "targeting") return;
    const { action } = this.#selection;
    if (!action.targets.includes(id)) return;
    this.#selection = { kind: "idle" };
    // An aimed action that also costs something still owes the player the
    // payment decision; only a free one goes straight to the engine.
    if (action.needsPayment && this.#openPayment(action, id)) return;
    await this.#dispatch(retarget(action.example, id));
  }

  /**
   * What tapping a hand card does.
   *
   * On a tall layout the hand is a row of thumbnails a centimetre wide — too
   * small to read, and far too small to commit a turn on. So a tap there opens
   * the card first and the sheet offers to play it, which is the second step
   * the phone needs and the desktop does not: at desk widths the card is
   * already legible, and a hold still opens the sheet.
   */
  tapHandCard(instanceId: InstanceId): void {
    // Read-only: a tap can still open the card to read it, same as the
    // tabbed layout's own idle behaviour below, but never offers to play it.
    if (this.#readOnly || (this.#host.tabbed() && this.#selection.kind === "idle")) {
      this.#host.inspect(instanceId);
      return;
    }
    void this.playCard(instanceId, { confirmFree: true });
  }

  /**
   * Plays a hand card. A card that costs something opens the payment mode
   * rather than spending whatever the engine found first: what you spend is a
   * real decision, and the engine's `example` payment is only a proof that
   * *some* payment works.
   *
   * `confirmFree`: the gesture was a bare tap (or Enter) on the card, so a card with nothing to pay and nothing
   * else to decide asks "Play it / Decline" first rather than resolving under the player's thumb. Inspect's own
   * "Play it" button is already an explicit yes and passes nothing.
   */
  async playCard(instanceId: InstanceId, options: { readonly confirmFree?: boolean } = {}): Promise<void> {
    if (this.#readOnly) return;
    const entry = this.#host.marks()?.playable.has(instanceId)
      ? this.#legalEntries().find(
          (candidate) => candidate.action.kind === "playCard" && candidate.action.instanceId === instanceId,
        )
      : undefined;
    if (!entry) return;
    // "Discard X cards from your hand" (Shield Toss, `03006`) is a real
    // decision the engine's `example` only guessed the minimum answer to —
    // see `#tryOpenDiscardChoice`. Checked before the controller picker below
    // since a card could in principle need both; nothing in the pool does yet.
    if (this.#tryOpenDiscardChoice(entry)) return;
    // "Play under any player's control" makes whose card it becomes a real
    // decision, and the engine's `example` had quietly made it for the player
    // (the first seat that could take it). So a choice of seats opens the picker.
    if (entry.controllers && entry.controllers.length > 1) {
      this.#selection = { kind: "choosingController", action: entry, controllers: entry.controllers };
      this.#host.redraw();
      return;
    }
    await this.#playAs(entry, entry.controllers?.[0] ?? null, options.confirmFree ?? false);
  }

  /** "Play it": the free card the board was asking about. */
  async confirmPlay(): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "confirmingPlay") return;
    const { action, controllerId } = this.#selection;
    this.#selection = { kind: "idle" };
    await this.#dispatch(withController(action.example, controllerId));
  }

  /** The card a free play is waiting on a yes for, or null when nothing is. */
  playConfirmation(): PlayConfirmationView | null {
    if (this.#selection.kind !== "confirmingPlay") return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const { action } = this.#selection.action;
    return { subject: action.kind === "playCard" ? cardName(game, action.instanceId) : "This card" };
  }

  /** The controller picker's answer: play the card under that seat's control. */
  async chooseController(controllerId: PlayerId): Promise<void> {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "choosingController") return;
    const { action } = this.#selection;
    if (!action.controllers?.includes(controllerId)) return;
    this.#selection = { kind: "idle" };
    await this.#playAs(action, controllerId);
  }

  /** The seats the picker offers, named by both faces, or null when it isn't open. */
  controllerChoice(): ControllerChoiceView | null {
    if (this.#selection.kind !== "choosingController") return null;
    const { game, perspectiveId } = appSession().store.state;
    if (!game) return null;
    const { action, controllers } = this.#selection;
    return {
      subject: action.action.kind === "playCard" ? cardName(game, action.action.instanceId) : "This card",
      options: controllers.map((playerId) => ({
        playerId,
        label: `${seatIdentityName(game, playerId)}${playerId === perspectiveId ? " (you)" : ""}`,
      })),
    };
  }

  async #playAs(entry: LegalAction, controllerId: PlayerId | null, confirmFree = false): Promise<void> {
    if (this.#tryOpenCostChoice(entry, null, controllerId)) return;
    if (entry.needsPayment && this.#openPayment(entry, null, controllerId)) return;
    if (confirmFree) {
      this.#selection = { kind: "confirmingPlay", action: entry, controllerId };
      this.#host.redraw();
      return;
    }
    await this.#dispatch(withController(entry.example, controllerId));
  }

  /** Every `useAbility` entry `legalActions` currently lists for one card, in order. */
  usableAbilitiesFor(instanceId: InstanceId): readonly UsableAbilityAction[] {
    const actions = appSession().store.state.legal?.actions;
    return actions ? abilityActionsFor(actions, instanceId) : [];
  }

  /**
   * A tap on a card in play, while idle: opens it in Inspect, and never uses it. A tap used to fire a card's one
   * usable ability on the spot, and since most of those cost "exhaust this card", a stray tap on the hero or an
   * ally exhausted it with no way back — reported from play, more than once. Inspect shows the card's full text
   * and one button per usable ability (`inspectModel.abilities`, `scenes/inspect.ts`), so using one is a
   * deliberate second tap on a button that names it, the same two steps a free hand card already takes.
   */
  onCharacterTap(instanceId: InstanceId): void {
    this.#host.inspect(instanceId);
  }

  /** The Inspect sheet's ability picker reports its pick here; it never dispatches itself. */
  useAbilityById(instanceId: InstanceId, abilityId: AbilityId): void {
    if (this.#readOnly) return;
    const entry = this.usableAbilitiesFor(instanceId).find((candidate) => candidate.action.abilityId === abilityId);
    if (entry) this.#useAbility(entry);
  }

  /**
   * Triggers one action ability, the same three-step machinery `chooseBasic`
   * / `#commitTarget` already use for basic actions: enter target-select mode
   * when the engine lists more than one legal target, open payment when the
   * engine says it costs something, otherwise dispatch its `example` command
   * straight away. Nothing here decides a target, a price, or legality —
   * `legalActions` and `paymentFor` already did.
   */
  #useAbility(entry: UsableAbilityAction): void {
    if (this.#tryOpenDiscardChoice(entry)) return;
    if (entry.targets.length > 1) {
      const { game } = appSession().store.state;
      const name = game
        ? abilityLabelOf(game, entry.action.instanceId, entry.action.abilityId, POOL_DEPS)
        : "this ability";
      this.#selection = { kind: "targeting", action: entry, prompt: `Choose a target for ${name}` };
      this.#host.redraw();
      return;
    }
    const target = entry.targets[0] ?? null;
    if (this.#tryOpenCostChoice(entry, target, null)) return;
    if (entry.needsPayment && this.#openPayment(entry, target)) return;
    void this.#dispatch(entry.example);
  }

  /**
   * The small "you can do something here" line on a card in play — the one
   * control PLAN.md's Phase 4 open item said the board was missing entirely.
   * Reuses `signal.heal`, the token the palette already spends on "this is a
   * good, legal state" (recover, HP gain, deck-legal), rather than inventing
   * a new one; the leading glyph keeps the affordance readable without color
   * (PLAN.md Phase 4 accessibility, "never color alone"). Hidden mid-decision
   * — while targeting or paying for a *different* action, tapping this card
   * would be intercepted for that instead, and a line promising otherwise
   * would be wrong.
   */
  abilityLine(instanceId: InstanceId): string | null {
    if (this.#readOnly) return null;
    if (this.#selection.kind !== "idle" || !this.#host.marks()?.usableAbilities.has(instanceId)) return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    const abilities = this.usableAbilitiesFor(instanceId);
    if (abilities.length === 0) return null;
    // The card's own name is already on the card, so the line carries the cost —
    // see `abilityShortLabelOf`. "Use" is the fallback for an ability the engine
    // prices at nothing, which is still worth a tap target.
    const text =
      abilities.length === 1
        ? (abilityShortLabelOf(game, instanceId, abilities[0]!.action.abilityId, POOL_DEPS) ?? "use")
        : `${abilities.length} abilities — tap to see`;
    return `▶ ${text}`;
  }

  /**
   * Enters discard-choice mode for an action whose cost has a real "discard
   * from your hand" decision in it (`view/discard-choice-model.ts`). Returns
   * false when there is nothing to decide — no such cost, or so few hand
   * cards that `legalActions`'s own default is the only legal answer — so
   * the caller falls through to its usual targeting/payment/dispatch path.
   */
  #tryOpenDiscardChoice(entry: LegalAction): boolean {
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return false;
    const choice = beginDiscardChoice(game, perspectiveId, entry, POOL_DEPS);
    if (!choice) return false;
    this.#selection = { kind: "choosingDiscard", choice };
    this.#host.redraw();
    return true;
  }

  /** Adds or removes one hand card from the discard choice. A card not offered, or past its cap, is a no-op. */
  toggleDiscardPick(id: InstanceId): void {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "choosingDiscard") return;
    this.#selection = { kind: "choosingDiscard", choice: toggleDiscardChoice(this.#selection.choice, id) };
    this.#host.redraw();
  }

  /** The discard choice as the engine currently sees it, or null outside that mode. */
  discardChoiceView(): DiscardChoiceView | null {
    if (this.#selection.kind !== "choosingDiscard") return null;
    const { game } = appSession().store.state;
    if (!game) return null;
    return buildDiscardChoiceView(game, this.#selection.choice, POOL_DEPS);
  }

  /**
   * Confirms the discard choice: dispatches the exact command the engine
   * just accepted (`discardChoiceView().command`) — the ability's cost paid
   * with the player's own picks and, in the same command, its effects
   * (Shield Toss's "deal 4 damage to X enemies") begin resolving. A "choose
   * X enemies" decision, if the ability needs one, opens as an ordinary
   * `PendingChoice` afterward — the same generic overlay every other card's
   * `chooseTarget` already uses, nothing new here.
   */
  async commitDiscardChoice(): Promise<void> {
    if (this.#readOnly) return;
    const view = this.discardChoiceView();
    if (!view?.command) return;
    this.#selection = { kind: "idle" };
    await this.#dispatch(view.command);
  }

  /**
   * Enters payment mode for an action. Returns false when the engine says the
   * action needs no payment after all, so the caller can just dispatch it.
   */
  #openPayment(
    entry: LegalAction,
    target: InstanceId | null,
    controllerId: PlayerId | null = null,
    costSelection?: CostSelection,
  ): boolean {
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return false;
    const payment = beginPayment(game, perspectiveId, entry.action, target, POOL_DEPS, controllerId, costSelection);
    if (!payment) return false;
    this.#selection = { kind: "paying", payment };
    this.#host.redraw();
    return true;
  }

  /**
   * Opens the either/or branch or "up to N" counter picker for an action whose cost has one
   * (docs/phase7-wave3.md §3.32, §3.36; `view/cost-choice-model.ts`). Returns false when there is nothing to ask —
   * no such cost, or only one legal answer — so the caller falls through to its usual payment/dispatch path.
   */
  #tryOpenCostChoice(entry: LegalAction, target: InstanceId | null, controllerId: PlayerId | null): boolean {
    const { game } = appSession().store.state;
    if (!game) return false;
    const prompt = costChoicePromptFor(game, POOL_DEPS, entry);
    if (!prompt) return false;
    this.#selection = { kind: "choosingCostSelection", action: entry, target, controllerId, prompt };
    this.#host.redraw();
    return true;
  }

  /** The branch/counter prompt open right now, or null outside that mode. */
  costChoiceView(): CostChoicePrompt | null {
    return this.#selection.kind === "choosingCostSelection" ? this.#selection.prompt : null;
  }

  /** Picks an either/or cost's branch, then continues exactly as an ordinary play/ability use would. */
  async chooseCostBranch(branch: number): Promise<void> {
    if (this.#readOnly) return;
    await this.#continueWithCostSelection({ branch });
  }

  /** Picks how many counters an "up to N" cost removes, then continues as usual. */
  async chooseCostCounters(counters: number): Promise<void> {
    if (this.#readOnly) return;
    await this.#continueWithCostSelection({ counters });
  }

  async #continueWithCostSelection(costSelection: CostSelection): Promise<void> {
    if (this.#selection.kind !== "choosingCostSelection") return;
    const { action, target, controllerId } = this.#selection;
    this.#selection = { kind: "idle" };
    if (this.#openPayment(action, target, controllerId, costSelection)) return;
    // Nothing to pay (a free branch, or a fixed cost the engine already sizes) — build the command directly, the
    // same way a free card's own confirm path does, rather than opening a payment mode with nothing to spend.
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return;
    const attempt = tryPayment(
      game,
      perspectiveId,
      action.action,
      [],
      { target, ...(controllerId ? { controllerId } : {}), costSelection },
      POOL_DEPS,
    );
    if (attempt.ok) await this.#dispatch(attempt.command);
  }

  /** Tapping a card during payment spends it, if the engine listed it as spendable. */
  #spendByInstance(id: InstanceId): void {
    if (this.#selection.kind !== "paying") return;
    const source = this.#selection.payment.query.sources.find((candidate) => candidate.instanceId === id);
    if (source) this.#togglePayment(source.optionId);
  }

  /**
   * The Inspect overlay's "Use as resource"/"Pay with" button (docs/phase4-screen-gaps.md §3 "W8"): spends a card
   * for the payment currently open, exactly as tapping it on the board during payment mode would. Returns whether
   * a payment was open and this card was one of its sources — Inspect uses that to decide whether the button did
   * anything, since it closes itself either way and has no other way to report failure. No-op, and returns false,
   * outside payment mode or read-only mode: never opens a payment of its own (that's the Board's own tap-to-play
   * path, `playCard`) and never spends a card the engine hasn't already listed as spendable.
   */
  payWithCard(id: InstanceId): boolean {
    if (this.#readOnly || this.#selection.kind !== "paying") return false;
    const source = this.#selection.payment.query.sources.find((candidate) => candidate.instanceId === id);
    if (!source) return false;
    this.#togglePayment(source.optionId);
    return true;
  }

  /**
   * Spends or un-spends one source by its option id. The engine re-judges the
   * whole selection. Public for the payment strip, where a card offering two
   * resource abilities is two tiles and a tap must mean one of them.
   */
  togglePaymentOption(optionId: string): void {
    if (this.#readOnly) return;
    this.#togglePayment(optionId);
  }

  /** Spends or un-spends one source. The engine re-judges the whole selection. */
  #togglePayment(optionId: string): void {
    if (this.#selection.kind !== "paying") return;
    this.#selection = { kind: "paying", payment: togglePayment(this.#selection.payment, optionId) };
    this.#host.redraw();
  }

  /** Names or un-names one `playCostReduction` ability on the play (docs/phase7-wave3.md §3.20). */
  toggleCostReduction(option: CostReductionOption): void {
    if (this.#readOnly || this.#selection.kind !== "paying") return;
    this.#selection = { kind: "paying", payment: toggleCostReduction(this.#selection.payment, option) };
    this.#host.redraw();
  }

  /** The payment as the engine currently sees it, or null outside payment mode. */
  paymentView(): PaymentView | null {
    if (this.#selection.kind !== "paying") return null;
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return null;
    const { payment } = this.#selection;
    const subject =
      payment.action.kind === "playCard" || payment.action.kind === "useAbility" ? payment.action.instanceId : null;
    const headline = [
      subject ? cardName(game, subject) : "This action",
      payment.target ? `→ ${cardName(game, payment.target)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return paymentView(game, perspectiveId, payment, headline, POOL_DEPS);
  }

  async commitPayment(): Promise<void> {
    if (this.#readOnly) return;
    if (this.#selection.kind !== "paying") return;
    const payment = this.paymentView();
    if (!payment?.command) return;
    // An alliance payment that spends another seat's card (RRG 1.8 "Alliance", p. 6): each of those players
    // approves their own contribution before the command goes anywhere (docs/phase7-wave4.md §4 Q10). Hot-seat —
    // `allianceHelpersOf`'s own doc comment on why this is a same-device prompt, not a network request.
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (game && perspectiveId !== null) {
      const helpers = allianceHelpersOf(game, perspectiveId, this.#selection.payment);
      if (helpers.length > 0) {
        this.#selection = {
          kind: "confirmingAllianceHelp",
          payment: this.#selection.payment,
          helpers: helpers.map((helper) => helper.playerId),
          approved: [],
        };
        this.#host.redraw();
        return;
      }
    }
    this.#selection = { kind: "idle" };
    await this.#dispatch(payment.command);
  }

  /** The helper currently being asked, or null outside that mode — `#drawAllianceHelpBar`'s own input. */
  allianceHelpView(): AllianceHelpView | null {
    if (this.#selection.kind !== "confirmingAllianceHelp") return null;
    const { game, perspectiveId } = appSession().store.state;
    if (!game || perspectiveId === null) return null;
    const { payment, helpers, approved } = this.#selection;
    const playerId = helpers[approved.length];
    if (playerId === undefined) return null;
    const contributions = allianceHelpersOf(game, perspectiveId, payment).find((h) => h.playerId === playerId);
    return {
      playerId,
      heroName: seatIdentityName(game, playerId),
      cardNames: (contributions?.instanceIds ?? []).map((id) => cardName(game, id)),
      remaining: helpers.length - approved.length,
      total: helpers.length,
    };
  }

  /** The current helper hands the controller back: their contribution is approved. Sends the command once every helper has approved. */
  async approveAllianceHelp(): Promise<void> {
    if (this.#readOnly || this.#selection.kind !== "confirmingAllianceHelp") return;
    const { payment, helpers, approved } = this.#selection;
    const playerId = helpers[approved.length];
    if (playerId === undefined) return;
    const nextApproved = [...approved, playerId];
    if (nextApproved.length < helpers.length) {
      this.#selection = { kind: "confirmingAllianceHelp", payment, helpers, approved: nextApproved };
      this.#host.redraw();
      return;
    }
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) {
      this.#selection = { kind: "idle" };
      this.#host.redraw();
      return;
    }
    const view = paymentView(game, perspectiveId, payment, "", POOL_DEPS);
    this.#selection = { kind: "idle" };
    if (view.command) await this.#dispatch(view.command);
    else this.#host.redraw();
  }

  /**
   * The current helper says no. RRG 1.8 "Alliance" (p. 6) makes each contribution that player's own choice, so
   * declining doesn't end the play — it returns the payer to payment selection with the same picks, so they can
   * choose different cards to spend instead (docs/phase7-wave4.md §4 Q10).
   */
  declineAllianceHelp(): void {
    if (this.#readOnly || this.#selection.kind !== "confirmingAllianceHelp") return;
    this.#selection = { kind: "paying", payment: this.#selection.payment };
    this.#host.redraw();
  }

  async dispatchExample(kind: BasicAction): Promise<void> {
    if (this.#readOnly) return;
    const entry = this.#legalFor(kind);
    if (!entry) return;
    if (kind === "endTurn" && appSession().settings.confirmBeforeEndTurn) {
      const { game, legal } = appSession().store.state;
      const confirm = game && legal ? endTurnConfirmOf(game, legal.actions, legal.playerId) : null;
      if (confirm) {
        this.#host.confirmEndTurn(confirm.sentence, () => void this.#dispatch(entry.example));
        return;
      }
    }
    await this.#dispatch(entry.example);
  }

  /**
   * The one choke point every mutating path above funnels through — guarded
   * on its own, not only at each of those call sites, so read-only mode holds
   * even if a future caller reaches this some other way.
   */
  async #dispatch(command: Command): Promise<void> {
    if (this.#readOnly) return;
    const { store } = appSession();
    const before = store.state.version;
    await store.dispatch(command);
    // A rejection doesn't change the version, so redraw to show the message.
    if (store.state.version === before) this.#host.redraw();
  }

  #legalEntries(): readonly LegalAction[] {
    const { store } = appSession();
    const actions = store.state.legal?.actions;
    return actions?.kind === "turn" ? actions.legal : [];
  }

  #legalFor(action: BasicAction): LegalAction | undefined {
    const kind = BASIC_TO_KIND[action];
    return this.#legalEntries().find((entry) => entry.action.kind === kind);
  }
}
