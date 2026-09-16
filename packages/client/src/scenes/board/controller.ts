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
import type { Command, InstanceId, LegalAction, PlayerId } from "@mc/engine";
import { appSession } from "../../session.js";
import { abilityLabelOf, abilityShortLabelOf } from "../../view/ability-label.js";
import type { BoardModel } from "../../view/board-model.js";
import { focusOrder, type FocusTarget } from "../../view/focus.js";
import { abilityActionsFor, type BasicAction, type Highlights, type UsableAbilityAction } from "../../view/highlights.js";
import { cardName, seatIdentityName } from "../../view/names.js";
import { beginPayment, paymentView, togglePayment, type PaymentView } from "../../view/payment-model.js";
import { BASIC_TO_KIND, retarget, type Selection } from "./selection.js";

/** What the controller reads from, and asks of, the scene that owns it. */
export interface BoardControllerHost {
  model(): BoardModel | null;
  marks(): Highlights | null;
  /** Whether the last draw laid the board out as phone tabs. */
  tabbed(): boolean;
  redraw(): void;
  inspect(id: InstanceId): void;
}

/** What the controller picker bar shows: the card, and each seat it may be played under. */
export interface ControllerChoiceView {
  readonly subject: string;
  readonly options: readonly { readonly playerId: PlayerId; readonly label: string }[];
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

export class BoardController {
  readonly #host: BoardControllerHost;
  #selection: Selection = { kind: "idle" };

  constructor(host: BoardControllerHost) {
    this.#host = host;
  }

  get selection(): Selection {
    return this.#selection;
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
    return focusOrder({ kind: "idle", hand: model.hand.map((card) => card.instanceId) }, marks);
  }

  /** Acts on the focused target, meaning whatever a tap or a press on it would mean right now. */
  activate(focus: FocusTarget): void {
    if (focus.kind === "basic") {
      if (focus.action === "endTurn") void this.dispatchExample("endTurn");
      else this.chooseBasic(focus.action);
      return;
    }
    if (this.tapInMode(focus.instanceId)) return;
    // A card in play with a usable ability, not a hand card: `playCard` only
    // ever looks for a `playCard` entry, so a card that's on the focus route
    // solely because of `usableAbilities` needs the ability path instead.
    if (this.#host.marks()?.usableAbilities.has(focus.instanceId)) this.onCharacterTap(focus.instanceId);
    else void this.playCard(focus.instanceId);
  }

  /**
   * A tap on a card while a mode is open answers that mode: it spends the card
   * during payment, or aims at it during targeting. Returns false when idle, so
   * the card's own tap behaviour can run instead.
   */
  tapInMode(id: InstanceId): boolean {
    if (this.#selection.kind === "paying") {
      this.#spendByInstance(id);
      return true;
    }
    if (this.#selection.kind === "targeting") {
      void this.#commitTarget(id);
      return true;
    }
    return false;
  }

  /**
   * Enters target-select mode, or dispatches immediately when the action needs
   * no target. The engine decided both: `targets` came from `legalActions`.
   */
  chooseBasic(action: BasicAction): void {
    const entry = this.#legalFor(action);
    if (!entry) return;
    if (entry.targets.length === 0) {
      void this.#dispatch(entry.example);
      return;
    }
    if (entry.targets.length === 1) {
      // One legal target is not a decision; aim and go.
      void this.#dispatch(entry.example);
      return;
    }
    this.#selection = { kind: "targeting", action: entry, prompt: `Choose a target to ${action}` };
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
    if (this.#host.tabbed() && this.#selection.kind === "idle") {
      this.#host.inspect(instanceId);
      return;
    }
    void this.playCard(instanceId);
  }

  /**
   * Plays a hand card. A card that costs something opens the payment mode
   * rather than spending whatever the engine found first: what you spend is a
   * real decision, and the engine's `example` payment is only a proof that
   * *some* payment works.
   */
  async playCard(instanceId: InstanceId): Promise<void> {
    const entry = this.#host.marks()?.playable.has(instanceId)
      ? this.#legalEntries().find((candidate) => candidate.action.kind === "playCard" && candidate.action.instanceId === instanceId)
      : undefined;
    if (!entry) return;
    // "Play under any player's control" makes whose card it becomes a real
    // decision, and the engine's `example` had quietly made it for the player
    // (the first seat that could take it). So a choice of seats opens the picker.
    if (entry.controllers && entry.controllers.length > 1) {
      this.#selection = { kind: "choosingController", action: entry, controllers: entry.controllers };
      this.#host.redraw();
      return;
    }
    await this.#playAs(entry, entry.controllers?.[0] ?? null);
  }

  /** The controller picker's answer: play the card under that seat's control. */
  async chooseController(controllerId: PlayerId): Promise<void> {
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

  async #playAs(entry: LegalAction, controllerId: PlayerId | null): Promise<void> {
    if (entry.needsPayment && this.#openPayment(entry, null, controllerId)) return;
    await this.#dispatch(withController(entry.example, controllerId));
  }

  /** Every `useAbility` entry `legalActions` currently lists for one card, in order. */
  usableAbilitiesFor(instanceId: InstanceId): readonly UsableAbilityAction[] {
    const actions = appSession().store.state.legal?.actions;
    return actions ? abilityActionsFor(actions, instanceId) : [];
  }

  /**
   * A tap on a card in play, while idle: nothing when it has no usable
   * ability (the common case, for most cards, most of the time); the ability
   * itself when it has exactly one, the same "a decisive gesture just acts"
   * rule the hand already follows for playing a card; the Inspect sheet when
   * it has more than one, because a real choice between two abilities needs
   * a real picker — Inspect already shows the card's full rules text, so the
   * player can read what each one does before committing to one
   * (`inspectModel.abilities`, `scenes/inspect.ts`). No Core card reaches the
   * second case today (checked by replaying three full games through
   * `legalActions`), but the ability DSL doesn't rule it out.
   */
  onCharacterTap(instanceId: InstanceId): void {
    const abilities = this.usableAbilitiesFor(instanceId);
    if (abilities.length === 0) return;
    if (abilities.length === 1) {
      this.#useAbility(abilities[0]!);
      return;
    }
    this.#host.inspect(instanceId);
  }

  /** The Inspect sheet's ability picker reports its pick here; it never dispatches itself. */
  useAbilityById(instanceId: InstanceId, abilityId: AbilityId): void {
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
    if (entry.targets.length > 1) {
      const { game } = appSession().store.state;
      const name = game ? abilityLabelOf(game, entry.action.instanceId, entry.action.abilityId, POOL_DEPS) : "this ability";
      this.#selection = { kind: "targeting", action: entry, prompt: `Choose a target for ${name}` };
      this.#host.redraw();
      return;
    }
    const target = entry.targets[0] ?? null;
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
        : `${abilities.length} abilities — tap to choose`;
    return `▶ ${text}`;
  }

  /**
   * Enters payment mode for an action. Returns false when the engine says the
   * action needs no payment after all, so the caller can just dispatch it.
   */
  #openPayment(entry: LegalAction, target: InstanceId | null, controllerId: PlayerId | null = null): boolean {
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return false;
    const payment = beginPayment(game, perspectiveId, entry.action, target, POOL_DEPS, controllerId);
    if (!payment) return false;
    this.#selection = { kind: "paying", payment };
    this.#host.redraw();
    return true;
  }

  /** Tapping a card during payment spends it, if the engine listed it as spendable. */
  #spendByInstance(id: InstanceId): void {
    if (this.#selection.kind !== "paying") return;
    const source = this.#selection.payment.query.sources.find((candidate) => candidate.instanceId === id);
    if (source) this.#togglePayment(source.optionId);
  }

  /**
   * Spends or un-spends one source by its option id. The engine re-judges the
   * whole selection. Public for the payment strip, where a card offering two
   * resource abilities is two tiles and a tap must mean one of them.
   */
  togglePaymentOption(optionId: string): void {
    this.#togglePayment(optionId);
  }

  /** Spends or un-spends one source. The engine re-judges the whole selection. */
  #togglePayment(optionId: string): void {
    if (this.#selection.kind !== "paying") return;
    this.#selection = { kind: "paying", payment: togglePayment(this.#selection.payment, optionId) };
    this.#host.redraw();
  }

  /** The payment as the engine currently sees it, or null outside payment mode. */
  paymentView(): PaymentView | null {
    if (this.#selection.kind !== "paying") return null;
    const { store } = appSession();
    const { game, perspectiveId } = store.state;
    if (!game || perspectiveId === null) return null;
    const { payment } = this.#selection;
    const subject = payment.action.kind === "playCard" || payment.action.kind === "useAbility" ? payment.action.instanceId : null;
    const headline = [
      subject ? cardName(game, subject) : "This action",
      payment.target ? `→ ${cardName(game, payment.target)}` : null,
    ]
      .filter(Boolean)
      .join(" ");
    return paymentView(game, perspectiveId, payment, headline, POOL_DEPS);
  }

  async commitPayment(): Promise<void> {
    const payment = this.paymentView();
    if (!payment?.command) return;
    this.#selection = { kind: "idle" };
    await this.#dispatch(payment.command);
  }

  async dispatchExample(kind: BasicAction): Promise<void> {
    const entry = this.#legalFor(kind);
    if (entry) await this.#dispatch(entry.example);
  }

  async #dispatch(command: Command): Promise<void> {
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
