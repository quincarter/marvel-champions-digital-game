/**
 * An independent check of the villain side's procedure over a recorded game.
 *
 * `auditVillainPhases` replays a `GameLog` and follows every villain phase
 * through its events, keeping its own shadow of the few facts the procedure
 * depends on (forms, engaged minions, side schemes in play, acceleration
 * tokens, the first player). It does not reuse the engine's villain-phase code,
 * so a regression there shows up as a violation instead of agreeing with
 * itself. The per-phase records are also a readable trace of what the villain
 * side did and which decisions it handed to players — the "why did the villain
 * do that?" view for rules QA and the client's log.
 */

import type { AnyCard } from "@mc/content";
import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import type { DecisionAuthority } from "../choices.js";
import { applyCommand, type GameLog } from "../engine.js";
import type { GameEvent } from "../events.js";
import type { ChoiceId, InstanceId, PlayerId } from "../ids.js";
import { isMinion, scale } from "../query.js";
import type { Form, GameState, GameStep } from "../state.js";

export interface VillainActivationRecord {
  readonly enemyInstanceId: InstanceId;
  readonly playerId: PlayerId;
  readonly activation: "attack" | "scheme";
}

export interface VillainDecisionRecord {
  readonly choiceId: ChoiceId;
  readonly playerId: PlayerId;
  readonly prompt: string;
  readonly authority: DecisionAuthority;
}

export interface VillainPhaseRecord {
  readonly round: number;
  readonly firstPlayerId: PlayerId;
  /** Live players in player order when the phase began. */
  readonly playerOrder: readonly PlayerId[];
  /** Step one's threat: what was placed and what the acceleration rules call for. */
  readonly accelerationThreat: { readonly placed: number; readonly expected: number } | null;
  readonly activations: readonly VillainActivationRecord[];
  readonly boostCards: readonly { readonly enemyInstanceId: InstanceId; readonly instanceId: InstanceId; readonly boostIcons: number | null }[];
  readonly dealt: readonly { readonly playerId: PlayerId; readonly instanceId: InstanceId }[];
  readonly revealed: readonly { readonly playerId: PlayerId; readonly instanceId: InstanceId }[];
  readonly nextFirstPlayerId: PlayerId | null;
  /** Every choice the phase parked, with who made it and on whose behalf. */
  readonly decisions: readonly VillainDecisionRecord[];
  /** False when the game ended (or the log stopped) partway through the phase. */
  readonly completed: boolean;
}

export interface AuditViolation {
  readonly round: number;
  readonly rule: string;
  readonly message: string;
}

export interface VillainAudit {
  readonly phases: readonly VillainPhaseRecord[];
  readonly violations: readonly AuditViolation[];
}

/** What the villain procedure depends on, tracked from state at each command start and then event by event. */
interface Shadow {
  round: number;
  step: GameStep;
  firstPlayerId: PlayerId;
  readonly forms: Map<PlayerId, Form>;
  readonly engaged: Map<PlayerId, Set<InstanceId>>;
  readonly sideSchemes: Set<InstanceId>;
  readonly eliminated: Set<PlayerId>;
  tokens: number;
  mainStage: number;
}

function shadowOf(state: GameState): Shadow {
  return {
    round: state.round,
    step: state.step,
    firstPlayerId: state.firstPlayerId,
    forms: new Map(state.players.map((p) => [p.playerId, p.identity.form])),
    engaged: new Map(state.players.map((p) => [p.playerId, new Set(p.playArea.filter((id) => isMinion(state, id)))])),
    sideSchemes: new Set(state.villainArea.filter((id) => state.cardPool[state.instances[id]?.cardId ?? ""]?.type === "side_scheme")),
    eliminated: new Set(state.players.filter((p) => p.eliminated).map((p) => p.playerId)),
    tokens: state.mainScheme.accelerationTokens,
    mainStage: state.mainScheme.stageIndex,
  };
}

function observeShadow(shadow: Shadow, state: GameState, event: GameEvent): void {
  switch (event.type) {
    case "stepChanged":
      shadow.step = event.to;
      return;
    case "roundStarted":
      shadow.round = event.round;
      return;
    case "firstPlayerChanged":
      shadow.firstPlayerId = event.playerId;
      return;
    case "formChanged":
      shadow.forms.set(event.playerId, event.to);
      return;
    case "playerEliminated":
      shadow.eliminated.add(event.playerId);
      return;
    case "accelerationTokenAdded":
      shadow.tokens = event.total;
      return;
    case "mainSchemeAdvanced":
      shadow.mainStage = event.stageIndex;
      return;
    case "cardPutIntoPlayFacedown":
      shadow.engaged.get(event.playerId)?.add(event.instanceId);
      return;
    case "cardMoved": {
      const type = state.cardPool[event.cardId]?.type;
      if (event.from.kind === "playArea") shadow.engaged.get(event.from.playerId)?.delete(event.instanceId);
      if (event.to.kind === "playArea" && type === "minion") shadow.engaged.get(event.to.playerId)?.add(event.instanceId);
      if (event.from.kind === "villainArea") shadow.sideSchemes.delete(event.instanceId);
      if (event.to.kind === "villainArea" && type === "side_scheme") shadow.sideSchemes.add(event.instanceId);
      return;
    }
    default:
      return;
  }
}

const schemeIcons = (state: GameState, shadow: Shadow, icon: "acceleration" | "hazard"): number => {
  const main = state.cardPool[state.mainScheme.cardId];
  let total = main?.type === "main_scheme" ? (main.stages[shadow.mainStage]?.icons.filter((i) => i === icon).length ?? 0) : 0;
  for (const id of shadow.sideSchemes) {
    const card = state.cardPool[state.instances[id]?.cardId ?? ""];
    if (card?.type === "side_scheme") total += card.icons.filter((i) => i === icon).length;
  }
  return total;
};

function nextClockwise(seats: readonly PlayerId[], from: PlayerId, eliminated: ReadonlySet<PlayerId>): PlayerId | null {
  const start = seats.indexOf(from);
  for (let i = 1; i <= seats.length; i++) {
    const candidate = seats[(start + i) % seats.length] as PlayerId;
    if (!eliminated.has(candidate)) return candidate;
  }
  return null;
}

const isVillainous = (card: AnyCard | undefined): boolean =>
  card?.type === "minion" && card.keywords.some((k) => k.name === "villainous");

const VILLAIN_STEPS: readonly GameStep["kind"][] = [
  "placeThreat",
  "enemyActivations",
  "dealEncounterCards",
  "revealEncounterCards",
  "passFirstPlayer",
  "endOfRound",
];

class PhaseTracker {
  readonly round: number;
  readonly firstPlayerId: PlayerId;
  readonly order: readonly PlayerId[];
  private readonly engagedAtStart: ReadonlyMap<PlayerId, ReadonlySet<InstanceId>>;
  private readonly steps: GameStep["kind"][] = [];
  private accelerationThreat: { placed: number; expected: number } | null = null;
  private readonly activations: VillainActivationRecord[] = [];
  private readonly boostCards: { enemyInstanceId: InstanceId; instanceId: InstanceId; boostIcons: number | null }[] = [];
  private readonly dealt: { playerId: PlayerId; instanceId: InstanceId }[] = [];
  private readonly revealed: { playerId: PlayerId; instanceId: InstanceId }[] = [];
  private readonly decisions: VillainDecisionRecord[] = [];
  private nextFirstPlayerId: PlayerId | null = null;
  /** Index into `order` of the next villain activation. */
  private activationCursor = 0;
  private activatingFor: PlayerId | null = null;
  private readonly minionsActivated = new Map<PlayerId, Set<InstanceId>>();
  private villainAttacksAndSchemes = 0;
  private villainBoosts = 0;
  private readonly unflippedBoosts = new Set<InstanceId>();
  private dealAtStep: { readonly players: readonly PlayerId[]; readonly hazards: number } | null = null;
  private lastRevealIndex = 0;

  constructor(
    private readonly state: GameState,
    private readonly seats: readonly PlayerId[],
    shadow: Shadow,
    private readonly violations: AuditViolation[],
  ) {
    this.round = shadow.round;
    this.firstPlayerId = shadow.firstPlayerId;
    this.order = this.playerOrder(shadow);
    this.engagedAtStart = new Map([...shadow.engaged].map(([p, ids]) => [p, new Set(ids)]));
  }

  private playerOrder(shadow: Shadow): readonly PlayerId[] {
    const start = Math.max(0, this.seats.indexOf(shadow.firstPlayerId));
    const ordered: PlayerId[] = [];
    for (let i = 0; i < this.seats.length; i++) {
      const id = this.seats[(start + i) % this.seats.length] as PlayerId;
      if (!shadow.eliminated.has(id)) ordered.push(id);
    }
    return ordered;
  }

  private violate(rule: string, message: string): void {
    this.violations.push({ round: this.round, rule, message });
  }

  private get step(): GameStep["kind"] | undefined {
    return this.steps[this.steps.length - 1];
  }

  /** Called with the shadow as it was just before `event`. */
  observe(event: GameEvent, shadow: Shadow): void {
    switch (event.type) {
      case "stepChanged": {
        if (event.to.kind !== this.step) this.steps.push(event.to.kind);
        // A step cut short by the game ending isn't expected to finish.
        const finished = event.to.phase !== "gameOver";
        if (finished && event.from.kind === "enemyActivations" && event.to.kind !== "enemyActivations") this.checkActivations(shadow);
        if (event.to.kind === "dealEncounterCards") {
          this.dealAtStep = { players: this.order.filter((p) => !shadow.eliminated.has(p)), hazards: schemeIcons(this.state, shadow, "hazard") };
        }
        if (finished && event.from.kind === "dealEncounterCards" && event.to.kind !== "dealEncounterCards") this.checkDealt();
        if (finished && event.from.kind === "revealEncounterCards" && event.to.kind !== "revealEncounterCards") this.checkRevealed(shadow);
        return;
      }
      case "triggerEvent": {
        const trigger = event.event;
        const villainActs =
          (trigger.kind === "enemyAttack" || trigger.kind === "enemyScheme") &&
          trigger.enemyInstanceId === this.state.villain.instanceId &&
          !(trigger.kind === "enemyAttack" && trigger.additionalResolution);
        // An attack or scheme canceled at its interrupt window never happened, so it deals no boost card.
        if (event.phase === "cancelled" && villainActs) this.villainAttacksAndSchemes--;
        if (event.phase !== "initiated") return;
        if (
          trigger.kind === "placeThreat" &&
          this.step === "placeThreat" &&
          this.accelerationThreat === null &&
          trigger.sourceInstanceId === null &&
          trigger.schemeInstanceId === this.state.mainScheme.instanceId
        ) {
          const main = this.state.cardPool[this.state.mainScheme.cardId];
          const acceleration = main?.type === "main_scheme" ? main.stages[shadow.mainStage]?.acceleration : undefined;
          const expected =
            (acceleration ? scale(acceleration, this.state.startingPlayerCount) : 0) + shadow.tokens + schemeIcons(this.state, shadow, "acceleration");
          this.accelerationThreat = { placed: trigger.amount, expected };
          if (trigger.amount !== expected) {
            this.violate("step1.acceleration", `step one placed ${trigger.amount} threat; acceleration calls for ${expected}`);
          }
        }
        if (villainActs) this.villainAttacksAndSchemes++;
        return;
      }
      case "enemyActivated":
        return this.onActivation(event, shadow);
      case "boostCardDealt": {
        this.boostCards.push({ enemyInstanceId: event.enemyInstanceId, instanceId: event.instanceId, boostIcons: null });
        this.unflippedBoosts.add(event.instanceId);
        if (event.enemyInstanceId === this.state.villain.instanceId) {
          this.villainBoosts++;
        } else if (!isVillainous(this.state.cardPool[this.state.instances[event.enemyInstanceId]?.cardId ?? ""])) {
          this.violate("boost.recipient", `${event.enemyInstanceId} got a boost card but is neither the villain nor villainous`);
        }
        return;
      }
      case "boostCardFlipped": {
        this.unflippedBoosts.delete(event.instanceId);
        const record = this.boostCards.find((b) => b.instanceId === event.instanceId && b.boostIcons === null);
        if (record) record.boostIcons = event.boostIcons;
        return;
      }
      case "cardMoved":
        if (this.step === "dealEncounterCards" && event.to.kind === "dealtEncounter") {
          this.dealt.push({ playerId: event.to.playerId, instanceId: event.instanceId });
        }
        return;
      case "encounterCardRevealed": {
        this.revealed.push({ playerId: event.playerId, instanceId: event.instanceId });
        // Only step three's cards follow player order: a surge card, or one an
        // effect reveals, belongs to whoever is resolving the card that caused it
        // (an obligation's owner, for one).
        if (this.step !== "revealEncounterCards") return;
        if (!this.dealt.some((d) => d.instanceId === event.instanceId && d.playerId === event.playerId)) return;
        const index = this.order.indexOf(event.playerId);
        if (index < this.lastRevealIndex) {
          this.violate("step4.order", `${event.playerId} revealed after a later player in player order had started revealing`);
        }
        this.lastRevealIndex = Math.max(this.lastRevealIndex, index);
        return;
      }
      case "firstPlayerChanged": {
        // Outside step five this is the token moving on because its holder was eliminated.
        if (this.step !== "passFirstPlayer") return;
        this.nextFirstPlayerId = event.playerId;
        const expected = nextClockwise(this.seats, shadow.firstPlayerId, shadow.eliminated);
        if (event.playerId !== expected) {
          this.violate("step5.firstPlayer", `the first player token went to ${event.playerId}; ${expected ?? "nobody"} is next clockwise from ${shadow.firstPlayerId}`);
        }
        return;
      }
      case "choiceRequested": {
        const { choice } = event;
        this.decisions.push({ choiceId: choice.choiceId, playerId: choice.playerId, prompt: choice.prompt.kind, authority: choice.authority });
        if (choice.authority !== "player" && choice.playerId !== shadow.firstPlayerId) {
          this.violate("authority.firstPlayer", `${choice.prompt.kind} (${choice.authority}) went to ${choice.playerId}, not the first player ${shadow.firstPlayerId}`);
        }
        if (choice.prompt.kind === "chooseMinionToActivate" && choice.playerId !== this.activatingFor) {
          this.violate("step2.minionOrder", `minion order asked of ${choice.playerId} during ${this.activatingFor ?? "no"} player's activations`);
        }
        return;
      }
      default:
        return;
    }
  }

  private onActivation(event: Extract<GameEvent, { type: "enemyActivated" }>, shadow: Shadow): void {
    this.activations.push({ enemyInstanceId: event.enemyInstanceId, playerId: event.playerId, activation: event.activation });
    if (this.step !== "enemyActivations") {
      this.violate("step2.timing", `${event.enemyInstanceId} activated outside step two`);
      return;
    }
    const expected = shadow.forms.get(event.playerId) === "hero" ? "attack" : "scheme";
    if (event.activation !== expected) {
      this.violate("step2.form", `${event.enemyInstanceId} ${event.activation}ed against ${event.playerId}, who is in ${shadow.forms.get(event.playerId)} form`);
    }
    if (event.enemyInstanceId === this.state.villain.instanceId) {
      while (this.activationCursor < this.order.length && shadow.eliminated.has(this.order[this.activationCursor] as PlayerId)) this.activationCursor++;
      const due = this.order[this.activationCursor];
      if (event.playerId !== due) this.violate("step2.villainOrder", `the villain activated against ${event.playerId}; ${due ?? "nobody"} was next`);
      this.activationCursor++;
      this.activatingFor = event.playerId;
      this.minionsActivated.set(event.playerId, new Set());
      return;
    }
    if (event.playerId !== this.activatingFor) {
      this.violate("step2.minionTiming", `${event.enemyInstanceId} activated against ${event.playerId} during ${this.activatingFor ?? "no"} player's activations`);
    }
    if (!shadow.engaged.get(event.playerId)?.has(event.enemyInstanceId)) {
      this.violate("step2.engagement", `${event.enemyInstanceId} activated against ${event.playerId} but isn't engaged with them`);
    }
    const done = this.minionsActivated.get(event.playerId) ?? new Set<InstanceId>();
    if (done.has(event.enemyInstanceId)) this.violate("step2.once", `${event.enemyInstanceId} activated twice against ${event.playerId}`);
    done.add(event.enemyInstanceId);
    this.minionsActivated.set(event.playerId, done);
  }

  private checkActivations(shadow: Shadow): void {
    for (const pending of this.order.slice(this.activationCursor)) {
      if (!shadow.eliminated.has(pending)) this.violate("step2.villainOnce", `the villain never activated against ${pending}`);
    }
    for (const [playerId, activated] of this.minionsActivated) {
      if (shadow.eliminated.has(playerId)) continue;
      for (const minion of this.engagedAtStart.get(playerId) ?? []) {
        // A minion engaged all phase long must have activated; one defeated or moved meanwhile may not have.
        if (shadow.engaged.get(playerId)?.has(minion) && !activated.has(minion)) {
          this.violate("step2.minions", `${minion}, engaged with ${playerId}, never activated`);
        }
      }
    }
  }

  private checkDealt(): void {
    if (!this.dealAtStep) return;
    const { players, hazards } = this.dealAtStep;
    const expected = new Map(players.map((p) => [p, 1]));
    for (let i = 0; i < hazards && players.length > 0; i++) {
      const p = players[i % players.length] as PlayerId;
      expected.set(p, (expected.get(p) ?? 0) + 1);
    }
    for (const [playerId, count] of expected) {
      const got = this.dealt.filter((d) => d.playerId === playerId).length;
      if (got !== count) this.violate("step3.deal", `${playerId} was dealt ${got} encounter card(s); expected ${count} (${hazards} hazard icon(s))`);
    }
  }

  private checkRevealed(shadow: Shadow): void {
    for (const card of this.dealt) {
      // An eliminated player's dealt cards go with them (RRG "Player Elimination").
      if (shadow.eliminated.has(card.playerId)) continue;
      if (!this.revealed.some((r) => r.instanceId === card.instanceId && r.playerId === card.playerId)) {
        this.violate("step4.reveal", `${card.instanceId}, dealt to ${card.playerId}, was never revealed by them`);
      }
    }
  }

  close(completed: boolean, shadow: Shadow, finalState: GameState): VillainPhaseRecord {
    if (completed) {
      let cursor = 0;
      for (const step of this.steps) if (step === VILLAIN_STEPS[cursor]) cursor++;
      if (cursor < VILLAIN_STEPS.length) this.violate("steps", `villain phase steps ran as ${this.steps.join(" → ")}`);
      if (this.accelerationThreat === null) this.violate("step1.acceleration", "no step-one threat was placed");
      const encounterCardsLeft = finalState.encounterDeck.length + finalState.encounterDiscard.length > 0;
      if (encounterCardsLeft && this.villainBoosts < this.villainAttacksAndSchemes) {
        this.violate("boost.villain", `the villain attacked or schemed ${this.villainAttacksAndSchemes} time(s) but got ${this.villainBoosts} boost card(s)`);
      }
      for (const id of this.unflippedBoosts) this.violate("boost.flipped", `boost card ${id} was dealt but never flipped`);
      if (this.nextFirstPlayerId === null) this.violate("step5.firstPlayer", "the first player token was never passed");
    }
    return {
      round: this.round,
      firstPlayerId: this.firstPlayerId,
      playerOrder: this.order,
      accelerationThreat: this.accelerationThreat,
      activations: this.activations,
      boostCards: this.boostCards,
      dealt: this.dealt,
      revealed: this.revealed,
      nextFirstPlayerId: this.nextFirstPlayerId,
      decisions: this.decisions,
      completed,
    };
  }
}

/**
 * Replays `log` and audits every villain phase in it. A command the engine
 * rejects is reported as a `replay` violation and ends the audit there.
 */
export function auditVillainPhases(log: GameLog, deps: EngineDeps = DEFAULT_DEPS): VillainAudit {
  const phases: VillainPhaseRecord[] = [];
  const violations: AuditViolation[] = [];
  const seats = [...log.initialState.players].sort((a, b) => a.seatIndex - b.seatIndex).map((p) => p.playerId);
  let state = log.initialState;
  let open: PhaseTracker | null = null;
  let shadow = shadowOf(state);

  for (const [index, command] of log.commands.entries()) {
    const result = applyCommand(state, command, deps);
    if (!result.ok) {
      violations.push({ round: state.round, rule: "replay", message: `command ${index} (${command.type}) was rejected: ${result.error.message}` });
      break;
    }
    // Exact state at the start of every command; events carry it forward within the command.
    shadow = shadowOf(state);
    for (const event of result.events) {
      if (event.type === "stepChanged" && event.to.kind === "placeThreat" && !event.to.placed) {
        open = new PhaseTracker(state, seats, shadow, violations);
      }
      open?.observe(event, shadow);
      observeShadow(shadow, state, event);
      if (open && (event.type === "roundStarted" || event.type === "gameEnded")) {
        phases.push(open.close(event.type === "roundStarted", shadow, result.state));
        open = null;
      }
    }
    state = result.state;
  }
  if (open) phases.push(open.close(false, shadow, state));
  return { phases, violations };
}
