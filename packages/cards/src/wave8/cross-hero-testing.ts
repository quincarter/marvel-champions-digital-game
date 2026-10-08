import { cardId, PLAYABLE_CARDS, type AnyCard } from "@mc/content";
import {
  applyCommand,
  createGame,
  legalActions,
  replay,
  sessionApply,
  startSession,
  type Command,
  type GameEvent,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
  type PlayerSetup,
} from "@mc/engine";
import { buildCrossHeroDeck, CORE_HERO_FOR_ASPECT } from "../testing/cross-hero.js";
import { firstLegal, identityOf, moveToHand, P1, settle, type Picker } from "../testing/harness.js";
import { withForm } from "../testing/staging.js";
import { WAVE8_DEPS, wave8Scenario } from "./index.js";

/**
 * Shared setup for the wave 8 "cards in another hero's deck" suites (`docs/custom-deck-testing.md`,
 * `docs/wave-definition-of-done.md` step 4b): a Core hero's deck with one copy of the card under test, seated against a
 * wave 8 scenario through the wave 8 deps. The sibling of `../wave7/cross-hero-testing.ts` (which is bound to the wave 7
 * deps and scenarios); pack-neutral, each pack's `cross-hero.test.ts` imports this.
 *
 * - `openedCrossHero(code, options)`: a game past setup with `code` somewhere in the Core hero's deck, the hero in hero form.
 * - `castFromCoreDeck(code, options)`: moves `code` to hand and plays it the way the engine offers it
 *   (`legalActions`' example command: the first legal host or payment), settling every prompt, with the session log
 *   replayed to the identical state.
 * - `identityTraits` edits the card pool (never the rules): the named traits are added to both faces of the Core
 *   identity, to assert the working case of a trait requirement no Core identity meets (X-MEN, X-FORCE, MUTANT, MYSTIC).
 *
 * The game's card pool is `PLAYABLE_CARDS` (the wave 8 pool is Core plus the five packs only; a conjured earlier card
 * must be a known card), as `rulings.qa.test.ts` does.
 */
export const SPIDER_MAN = "core-spider-man-justice";
export const CAPTAIN_MARVEL = "core-captain-marvel-leadership";
export const SHE_HULK = "core-she-hulk-aggression";
export const BLACK_PANTHER = "core-black-panther-protection";

/** The scenario every cross-hero game is played against: Unus the Untouched, standard, one player. */
export const CROSS_HERO_SCENARIO = "unus";

export interface CrossHeroOptions {
  readonly coreHero?: string;
  readonly seed?: number;
  /** Traits added to both faces of the Core hero's identity card. */
  readonly identityTraits?: readonly string[];
  /** A deck to seat instead of the Core hero's precon plus the card (a Team-Up card needs a deck of its own hero). */
  readonly deck?: PlayerSetup;
}

/** The Core identity card of a starter deck id (`core-spider-man-justice` -> `01001a`). */
const IDENTITY_OF: Readonly<Record<string, string>> = {
  [SPIDER_MAN]: "01001a",
  [CAPTAIN_MARVEL]: "01010a",
  [SHE_HULK]: "01019a",
  [BLACK_PANTHER]: "01040a",
};

/** `PLAYABLE_CARDS` with `traits` added to both faces of `identityCardId`. */
export function cardsWithIdentityTraits(identityCardId: string, traits: readonly string[]): readonly AnyCard[] {
  return PLAYABLE_CARDS.map((card) => {
    if ((card.id as string) !== identityCardId || card.type !== "hero_identity") return card;
    const add = <T extends { traits: readonly unknown[] }>(face: T): T => ({
      ...face,
      traits: [...face.traits, ...traits],
    });
    return { ...card, hero: add(card.hero), alterEgo: add(card.alterEgo) } as AnyCard;
  });
}

/** The Core hero whose own aspect is the card's (a basic card: Spider-Man), as `playFromAnotherHerosDeck` picks. */
export function coreHeroFor(code: string): string {
  const card = PLAYABLE_CARDS.find((c) => (c.id as string) === code);
  const aspect = card && "aspect" in card ? card.aspect : "basic";
  return aspect in CORE_HERO_FOR_ASPECT
    ? CORE_HERO_FOR_ASPECT[aspect as keyof typeof CORE_HERO_FOR_ASPECT]
    : SPIDER_MAN;
}

function poolOf(options: CrossHeroOptions & { coreHero: string }): readonly AnyCard[] {
  if (!options.identityTraits) return PLAYABLE_CARDS;
  const identity = IDENTITY_OF[options.coreHero];
  if (!identity) throw new Error(`no identity id for ${options.coreHero}`);
  return cardsWithIdentityTraits(identity, options.identityTraits);
}

/** A game past setup (every opening hand kept), `code` in `coreHero`'s deck, in the player phase, hero form showing. */
export function openedCrossHero(code: string, options: CrossHeroOptions = {}): GameState {
  const coreHero = options.coreHero ?? coreHeroFor(code);
  const cards = poolOf({ ...options, coreHero });
  const deck = options.deck ?? buildCrossHeroDeck(cards, coreHero, code);
  const base = wave8Scenario(CROSS_HERO_SCENARIO, { seed: options.seed ?? 11, players: [deck] as never });
  const config: GameSetupConfig = { ...base, cards };
  const created = createGame(config, WAVE8_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.code}: ${created.error.message}`);
  const opened = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE8_DEPS);
  // Unus has Toughness (45059: "Toughness."), whose status card would swallow the first damage a card deals to him.
  // The card under test is what is being proved here, so the villain starts without the status card (surgery only).
  const villain = opened.instances[opened.activeVillainId!]!;
  const bare: GameState = {
    ...opened,
    instances: {
      ...opened.instances,
      [villain.instanceId]: { ...villain, statuses: { ...villain.statuses, tough: 0 } },
    },
  };
  return withForm(bare, { heroForm: 0 }, P1);
}

/** Whether `instanceId` is offered as a play right now (`legalActions`), for `player`. */
export function isPlayable(state: GameState, instanceId: InstanceId, player: PlayerId = P1): boolean {
  const actions = legalActions(state, player, WAVE8_DEPS);
  return (
    actions.kind === "turn" &&
    actions.legal.some((a) => a.action.kind === "playCard" && a.action.instanceId === instanceId)
  );
}

/** The engine's own example command for playing `instanceId`, or null when it is not offered. */
export function exampleCommand(state: GameState, instanceId: InstanceId, player: PlayerId = P1): Command | null {
  const actions = legalActions(state, player, WAVE8_DEPS);
  if (actions.kind !== "turn") return null;
  const hit = actions.legal.find((a) => a.action.kind === "playCard" && a.action.instanceId === instanceId);
  return hit ? hit.example : null;
}

/**
 * Drives `commands` answering every prompt with `pick`, through a session: every event is collected, a rejected command
 * throws, and the log must replay to the identical state (the determinism contract).
 */
export function drive(
  start: GameState,
  pick: Picker,
  ...commands: readonly Command[]
): { state: GameState; events: GameEvent[]; offered: Set<string> } {
  let session = startSession(start);
  const events: GameEvent[] = [];
  const offered = new Set<string>();
  const apply = (command: Command): void => {
    const result = sessionApply(session, command, WAVE8_DEPS);
    if (!result.ok) throw new Error(`${command.type} rejected: ${result.error.code}: ${result.error.message}`);
    session = result.session;
    events.push(...result.events);
  };
  const settleAll = (): void => {
    for (let guard = 0; session.state.pendingChoice && !session.state.outcome; guard++) {
      if (guard > 300) throw new Error(`stuck on ${session.state.pendingChoice.prompt.kind}`);
      const choice = session.state.pendingChoice;
      if (choice.prompt.kind === "chooseTriggers") for (const o of choice.options) offered.add(o.optionId);
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: pick(session.state),
      });
    }
  };
  settleAll();
  for (const command of commands) {
    apply(command);
    settleAll();
  }
  const replayed = replay(session.log, WAVE8_DEPS);
  if (!replayed.ok) throw new Error(`replay failed: ${JSON.stringify(replayed)}`);
  if (JSON.stringify(replayed.state) !== JSON.stringify(session.state)) throw new Error("replay diverged");
  return { state: session.state, events, offered };
}

/** The resource icons a hand card prints (a `wild` counts for any type). */
const iconsOf = (state: GameState, optionId: string): Record<string, number> => {
  const instance = state.instances[optionId.replace(/^hand:/, "") as InstanceId];
  const card = instance && (state.cardPool[instance.cardId] as unknown as Record<string, unknown> | undefined);
  return ((card?.["resourceIcons"] ?? card?.["producesIcons"]) as Record<string, number> | undefined) ?? {};
};

/** The cards that pay a `spendResources` prompt: one that prints each required icon first, then any for the generic part. */
function spendFor(state: GameState): string[] {
  const choice = state.pendingChoice!;
  const requirement = (choice.prompt as unknown as { requirement: Record<string, number> }).requirement;
  const picked: string[] = [];
  for (const type of ["physical", "mental", "energy"] as const) {
    let need = requirement[type] ?? 0;
    for (const option of choice.options) {
      if (need <= 0) break;
      if (picked.includes(option.optionId)) continue;
      const icons = iconsOf(state, option.optionId);
      if ((icons[type] ?? 0) > 0 || (icons["wild"] ?? 0) > 0) {
        picked.push(option.optionId);
        need -= Math.max(icons[type] ?? 0, icons["wild"] ?? 0);
      }
    }
  }
  let generic = requirement["generic"] ?? 0;
  for (const option of choice.options) {
    if (generic <= 0) break;
    if (picked.includes(option.optionId)) continue;
    const icons = iconsOf(state, option.optionId);
    picked.push(option.optionId);
    generic -= Object.values(icons).reduce((n, v) => n + v, 0) || 1;
  }
  return picked;
}

/**
 * Accepts every optional trigger whose id contains one of `wanted` and pays an accepted response event's cost from hand
 * (`payForCard`); a defender prompt names `defender` when set; any other prompt takes `firstLegal`.
 */
export const accepting =
  (wanted: readonly string[], opts: { defender?: InstanceId } = {}): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    if (choice?.prompt.kind === "payForCard")
      return choice.options
        .filter((o) => o.optionId.startsWith("hand:"))
        .slice(0, choice.prompt.cost)
        .map((o) => o.optionId);
    if (choice?.prompt.kind === "spendResources") return spendFor(state);
    if (
      choice?.prompt.kind === "declareDefender" &&
      opts.defender &&
      choice.options.some((o) => o.optionId === opts.defender)
    )
      return [opts.defender];
    return firstLegal(state);
  };

export interface CastResult {
  readonly before: GameState;
  readonly after: GameState;
  readonly id: InstanceId;
  readonly events: readonly GameEvent[];
  readonly offered: ReadonlySet<string>;
}

/**
 * `code` moved to hand in `state` (an `openedCrossHero` game) and played with the engine's own example command,
 * answering prompts with `pick`. `before` is the state with the card in hand and nothing played yet.
 */
export function cast(state: GameState, code: string, pick: Picker = firstLegal): CastResult {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  const command = exampleCommand(given.state, id);
  if (!command) throw new Error(`${code} is not offered as a play`);
  const run = drive(given.state, pick, command);
  return { before: given.state, after: run.state, id, events: run.events, offered: run.offered };
}

/** Whether applying the engine's example play for `code` (in hand) is rejected. */
export function playIsRefused(state: GameState, code: string): boolean {
  const given = moveToHand(state, P1, code);
  const id = given.ids[0]!;
  if (isPlayable(given.state, id)) return false;
  // Any command the engine would build for it is refused too: a bare play with no payment.
  const bare: Command = {
    type: "playCard",
    playerId: P1,
    cardInstanceId: id,
    payment: [],
    attachToInstanceId: null,
  } as Command;
  return !applyCommand(given.state, bare, WAVE8_DEPS).ok;
}

export const me = (state: GameState, player: PlayerId = P1): InstanceId => identityOf(state, player);
export const printedCost = (code: string): number =>
  (PLAYABLE_CARDS.find((c) => (c.id as string) === code) as { cost?: number } | undefined)?.cost ?? 0;
export { cardId };

// ---------------------------------------------------------------------------------------------------------------------
// Observation and staging helpers shared by the pack suites
// ---------------------------------------------------------------------------------------------------------------------
export {
  attached,
  attachedCodes,
  codes,
  conjure,
  inPlayArea,
  withMinion,
  withScheme,
  withoutSideSchemes,
} from "../wave7/rulings-2026-10-06-harness.js";
export { endTurn, inst, mainThreat, playerOf, play, use } from "../testing/harness.js";
export {
  firstLegal,
  moveToHand,
  P1,
  patchInstance,
  payWith,
  resourceAbility,
  stackEncounterDeck,
} from "../testing/harness.js";
export { withDamage, withForm } from "../testing/staging.js";

/** The villain's instance id. */
export const villainOf = (state: GameState): InstanceId => state.activeVillainId!;
/** Damage on an instance. */
export const dmg = (state: GameState, id: InstanceId): number => state.instances[id]!.damage;
/** The ids in P1's hand. */
export const handIds = (state: GameState): readonly InstanceId[] => state.players.find((p) => p.playerId === P1)!.hand;
/** Whether the card is in P1's play area. */
export const inPlay = (state: GameState, id: InstanceId): boolean =>
  state.players.find((p) => p.playerId === P1)!.playArea.includes(id);
/** Whether the card is in P1's discard pile. */
export const inDiscard = (state: GameState, id: InstanceId): boolean =>
  state.players.find((p) => p.playerId === P1)!.discard.includes(id);
/** A status count (stunned, confused, tough) on an instance. */
export const status = (state: GameState, id: InstanceId, name: "stunned" | "confused" | "tough"): number =>
  state.instances[id]!.statuses[name] ?? 0;
/** Printed card data for `code`. */
export const cardData = (code: string): AnyCard => PLAYABLE_CARDS.find((c) => (c.id as string) === code)!;

export const BASIC_ATTACK = (state: GameState, who: InstanceId, target: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: who,
  targetInstanceId: target,
});
export const BASIC_THWART = (state: GameState, who: InstanceId, scheme: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: who,
  schemeInstanceId: scheme,
});
