/**
 * Shared scaffolding for the Flight, Super Strength and Telepathy tests (flight.test.ts, super-strength.test.ts,
 * telepathy.test.ts): a Juggernaut or Stryfe game with a SUPERPOWER set chosen as a modular set (its attachment enters
 * play attached to the villain through its setup keyword), a driver that answers prompts from a plan, and villain-phase
 * rounds with a stacked encounter deck. Not a test file.
 */
import {
  activeVillain,
  playCostOf,
  applyCommand,
  createGame,
  handSize,
  type Command,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  moveToHand,
  patchInstance,
  payWith,
  play,
  playerOf,
  settle,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE7_DEPS, wave7Scenario } from "../index.js";
import { wave7StarterDeckSetup } from "../setup.js";

export const SPIDER_MAN = { starterDeckId: "core-spider-man-justice" } as const;
export const CAPTAIN_MARVEL = { starterDeckId: "core-captain-marvel-leadership" } as const;
export const ONE = [SPIDER_MAN] as const;
export const TWO = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
export const ANGEL = { starterDeckId: "angel-protection" } as const;
export const BLACK_PANTHER = { starterDeckId: "core-black-panther-protection" } as const;
export type Seats = NonNullable<Parameters<typeof wave7Scenario>[1]["players"]>;

/** Standard-set boost cards that print no boost icon and no Boost ability, so an activation adds exactly its stat. */
export const BLANK_BOOSTS = ["01186", "01187", "01186", "01187", "01186", "01187"] as const;

export interface GameOpts {
  readonly scenario?: "juggernaut" | "stryfe";
  readonly players?: Seats;
  /** The modular sets chosen (each one's SUPERPOWER attachment is attached to the villain at setup). */
  readonly sets: readonly string[];
}

/** The scenario past setup, in the first player's turn. */
export function game(opts: GameOpts): GameState {
  const config = wave7Scenario(opts.scenario ?? "juggernaut", {
    players: opts.players ?? ONE,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [...opts.sets],
  });
  const created = createGame(config, WAVE7_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

export const nameOf = (s: GameState, id: InstanceId) => s.cardPool[s.instances[id]!.cardId]!.name;
export const cardOf = (s: GameState, id: InstanceId) => s.instances[id]!.cardId as string;
export const villainId = (s: GameState) => activeVillain(s).instanceId;
export const mainOf = (s: GameState) => s.mainScheme.instanceId;
export const piles = (s: GameState) => Object.values(s.encounterDecks)[0]!;
export const deckNames = (s: GameState) => piles(s).deck.map((id) => nameOf(s, id));
export const discardNames = (s: GameState) => piles(s).discard.map((id) => nameOf(s, id));
export const attachmentsOf = (s: GameState, id: InstanceId) => inst(s, id).attachments.map((a) => nameOf(s, a));
export const attachmentOf = (s: GameState, host: InstanceId, name: string) =>
  inst(s, host).attachments.find((a) => nameOf(s, a) === name)!;
export const handOf = (s: GameState, player: PlayerId = P1) => playerOf(s, player).hand;
export const handNames = (s: GameState, player: PlayerId = P1) => handOf(s, player).map((id) => nameOf(s, id));
export const inPlayNames = (s: GameState, player: PlayerId) => playerOf(s, player).playArea.map((id) => nameOf(s, id));
export const playerDiscardNames = (s: GameState, player: PlayerId = P1) =>
  playerOf(s, player).discard.map((id) => nameOf(s, id));
export const exhaustedOf = (s: GameState, id: InstanceId) => inst(s, id).exhausted;
export const ready = (s: GameState, id: InstanceId): GameState => patchInstance(s, id, { exhausted: false });
export const damageOn = (s: GameState, id: InstanceId) => inst(s, id).damage;
export const events = <T extends GameEvent["type"]>(
  run: readonly GameEvent[],
  type: T,
): Extract<GameEvent, { type: T }>[] => run.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
export const accepted = (state: GameState, command: Command) => applyCommand(state, command, WAVE7_DEPS).ok;

/** Every player in hero form (surgery), so the villain attacks and nothing is discarded at turn end. */
export const heroed = (s: GameState): GameState =>
  s.players.reduce((acc, p) => withForm(acc, { heroForm: 0 }, p.playerId), s);

/** The player's hand is exactly these cards (the rest of it goes to the top of their deck). */
export function setHand(state: GameState, player: PlayerId, codes: readonly string[]): GameState {
  const owner = playerOf(state, player);
  const cleared: GameState = {
    ...state,
    players: state.players.map((p) =>
      p.playerId === player ? { ...p, hand: [], deck: [...owner.hand, ...owner.deck] } : p,
    ),
  };
  const size = handSize(cleared, player, WAVE7_DEPS);
  return moveToHand(cleared, player, ...codes.slice(0, size)).state;
}

export interface Plan {
  /** The label (start) of the option to take at a `chooseOption` prompt; the first one otherwise. */
  readonly choose?: string;
  /** Labels (start) to pick at card or target prompts, in order; the fewest selections otherwise. */
  readonly pick?: readonly string[];
  /** Labels (start) of the optional abilities to trigger at a `chooseTriggers` prompt; none are otherwise. */
  readonly accept?: readonly string[];
  /** Hand cards (by name) to spend at a `spendResources` prompt. */
  readonly pay?: readonly string[];
  /** Labels (start) of the defender to declare; nobody otherwise. */
  readonly defend?: string;
}
export interface Run {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly prompts: readonly { readonly kind: string; readonly player: PlayerId; readonly labels: readonly string[] }[];
}
export function drive(state: GameState, plan: Plan, ...commands: Command[]): Run {
  const prompts: { kind: string; player: PlayerId; labels: readonly string[] }[] = [];
  const picks = [...(plan.pick ?? [])];
  const pick = (s: GameState): readonly string[] => {
    const choice = s.pendingChoice!;
    prompts.push({ kind: choice.prompt.kind, player: choice.playerId, labels: choice.options.map((o) => o.label) });
    switch (choice.prompt.kind) {
      case "chooseOption": {
        const hit = choice.options.find((o) => (plan.choose ? o.label.startsWith(plan.choose) : true));
        return [(hit ?? choice.options[0]!).optionId];
      }
      case "chooseTriggers":
        return choice.options
          .filter((o) => plan.accept?.some((label) => o.label.startsWith(label)))
          .map((o) => o.optionId);
      case "payForAbility":
      case "spendResources": {
        const ids: string[] = [];
        for (const name of plan.pay ?? []) {
          const hit = choice.options.find((o) => o.label === name && !ids.includes(o.optionId));
          if (hit) ids.push(hit.optionId);
        }
        return ids.length > 0 ? ids : firstLegal(s);
      }
      case "discardDownToHandSize":
        return firstLegal(s);
      case "declareDefender": {
        const hit = plan.defend ? choice.options.find((o) => o.label.startsWith(plan.defend!)) : undefined;
        return hit ? [hit.optionId] : ["decline"];
      }
      default: {
        const name = picks[0];
        const hit = name ? choice.options.find((o) => o.label.startsWith(name)) : undefined;
        if (hit) {
          picks.shift();
          return [hit.optionId];
        }
        return firstLegal(s);
      }
    }
  };
  const { state: after, events: log } = driveEventsPicking(WAVE7_DEPS, state, pick, ...commands);
  return { state: after, events: log, prompts };
}

/**
 * Every player ends their turn (to hero form first when `hero`), and the villain phase runs. The encounter deck is
 * stacked: `boosts` blank boost cards (the villain draws one per activation), then `reveals`, the cards the players are
 * dealt in player order. An alter-ego player is schemed against, a hero attacked.
 */
export function round(
  state: GameState,
  opts: {
    readonly boosts?: number;
    readonly boostCards?: readonly string[];
    readonly reveals?: readonly string[];
    readonly hero?: boolean;
    readonly plan?: Plan;
  } = {},
): Run {
  const stacked = stackEncounterDeck(
    state,
    ...(opts.boostCards ?? BLANK_BOOSTS.slice(0, opts.boosts ?? state.players.length)),
    ...(opts.reveals ?? BLANK_BOOSTS.slice(0, 0)),
  );
  const order =
    state.step.phase === "player" && state.step.kind === "turn"
      ? [state.step.activePlayerId, ...state.step.remainingPlayerIds]
      : state.players.map((p) => p.playerId);
  const commands = order.flatMap((id) => [
    ...(opts.hero && stacked.players.find((p) => p.playerId === id)!.identity.form !== "hero" ? [toHero(id)] : []),
    endTurn(id),
  ]);
  return drive(stacked, opts.plan ?? {}, ...commands);
}

/** The villain attacks (in hero form) the first player, whose hand is `hand` first: the attack event of that round. */
export const attackRound = (state: GameState, boostCards: readonly string[] = BLANK_BOOSTS, plan: Plan = {}): Run =>
  round(heroed(state), { boostCards: boostCards.slice(0, state.players.length), plan });

export const attacksBy = (run: readonly GameEvent[], enemy: InstanceId) =>
  events(run, "attackResolved").filter((e) => e.enemyInstanceId === enemy);

/** A basic attack by the player's hero on `target` (their hero readied, in hero form by surgery, and statuses cleared). */
export function attackFor(state: GameState, target: InstanceId, plan: Plan = {}, player: PlayerId = P1): Run {
  const clear = { stunned: 0, confused: 0, tough: 0 };
  const armed = patchInstance(withForm(state, { heroForm: 0 }, player), identityOf(state, player), {
    statuses: clear,
    exhausted: false,
  });
  const active = armed.step.phase === "player" && armed.step.kind === "turn" ? armed.step.activePlayerId : player;
  return drive(
    armed,
    plan,
    ...(active !== player ? [endTurn(active)] : []),
    basicAttackBy(armed, identityOf(armed, player), target, player),
  );
}

/** The command: `attacker` (the player's hero or an ally) makes a basic attack on `target`. */
export const basicAttackBy = (
  state: GameState,
  attacker: InstanceId,
  target: InstanceId,
  player: PlayerId = P1,
): Command => ({ type: "basicAttack", playerId: player, attackerInstanceId: attacker, targetInstanceId: target });

export { P1, P2 };

/** The status cards a character holds, by surgery. */
export const withStatuses = (
  s: GameState,
  id: InstanceId,
  statuses: Partial<{ stunned: number; confused: number; tough: number }>,
): GameState => patchInstance(s, id, { statuses: { ...inst(s, id).statuses, ...statuses } });

/** A player card the player controls in play (surgery, ready), taken from their hand, deck or discard. */
export function inPlayFromDeck(state: GameState, player: PlayerId, code: string): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const id = [...owner.hand, ...owner.deck, ...owner.discard].find((i) => cardOf(state, i) === code);
  if (!id) throw new Error(`${player} has no ${code}`);
  const strip = (zone: readonly InstanceId[]) => zone.filter((i) => i !== id);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? { ...p, hand: strip(p.hand), deck: strip(p.deck), discard: strip(p.discard), playArea: [...p.playArea, id] }
          : p,
      ),
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, exhausted: false, controllerId: player },
      },
    },
  };
}

/** A starter deck with its last card replaced by `code` (a card the deck's aspect can play): a seat for a hand or ally test. */
export function seatWithCard(starterDeckId: string, code: string): Seats[number] {
  const setup = wave7StarterDeckSetup(starterDeckId);
  return { ...setup, deck: [...setup.deck.slice(0, -1), code as (typeof setup.deck)[number]] } as Seats[number];
}

const activePlayer = (s: GameState): PlayerId =>
  s.step.phase === "player" && s.step.kind === "turn" ? s.step.activePlayerId : P1;
/** Resource cards (1 each) a player can pay with, kept beside the card played. */
const RESOURCES = (player: PlayerId) => [player === P1 ? "01062" : "01072", "01088", "01089", "01090"];

/**
 * The player plays `code` from a hand of it and four resource cards, paying its current cost with them (an upgrade
 * attaches to `host`). Returns the state afterwards and the played card's instance.
 */
export function playFromHand(
  state: GameState,
  player: PlayerId,
  code: string,
  opts: { readonly host?: InstanceId; readonly plan?: Plan } = {},
): { state: GameState; id: InstanceId } {
  const stocked = setHand(state, player, [code, ...RESOURCES(player)]);
  const id = handOf(stocked, player).find((i) => cardOf(stocked, i) === code)!;
  const cost = playCostOf(stocked, player, id, WAVE7_DEPS)?.current ?? 0;
  const form = stocked.players.find((p) => p.playerId === player)!.identity.form;
  const run = drive(
    stocked,
    opts.plan ?? {},
    ...(activePlayer(stocked) !== player ? [endTurn(activePlayer(stocked))] : []),
    ...(form === "hero" ? [] : [toHero(player)]),
    play(player, id, payWith(stocked, player, cost, [id]), opts.host ? { attachToInstanceId: opts.host } : {}),
  );
  return { state: run.state, id };
}
