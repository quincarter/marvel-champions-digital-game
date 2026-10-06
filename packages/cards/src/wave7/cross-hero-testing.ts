import { cardId, type AnyCard } from "@mc/content";
import {
  createGame,
  type CardInstance,
  type Command,
  type GameSetupConfig,
  type GameState,
  type InstanceId,
  type PlayerId,
  type PlayerSetup,
} from "@mc/engine";
import { buildCrossHeroDeck, CORE_HERO_FOR_ASPECT, type CrossHeroGame } from "../testing/cross-hero.js";
import {
  firstLegal,
  identityOf,
  moveToHand,
  P1,
  patchInstance,
  playerOf,
  settle,
  type Picker,
} from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { WAVE7_CARDS, WAVE7_DEPS, wave7Scenario } from "./index.js";

/**
 * Shared setup for the wave 7 "cards in another hero's deck" suites (`docs/custom-deck-testing.md`,
 * `docs/wave-definition-of-done.md` step 4b): a Core hero's deck with one copy of the card under test, seated against a
 * wave 7 scenario through the wave 7 deps. Pack-neutral: each pack's `cross-hero.test.ts` imports this.
 *
 * - `crossHeroGame(options)` is the `CrossHeroGame` for `playFromAnotherHerosDeck` (`../testing/cross-hero.ts`).
 * - `openedCrossHero(code, options)` is a game past setup with `code` somewhere in the Core hero's deck (move it to
 *   hand with `moveToHand`, play it with `playFromHand`).
 * - `identityTraits` edits the card pool (never the rules): the named traits are added to both faces of the Core
 *   identity, to assert the working case of a trait requirement no Core identity meets (PSIONIC, AERIAL, X-FORCE).
 */
export const SPIDER_MAN = "core-spider-man-justice";
export const CAPTAIN_MARVEL = "core-captain-marvel-leadership";
export const SHE_HULK = "core-she-hulk-aggression";
export const BLACK_PANTHER = "core-black-panther-protection";

/** The scenario every cross-hero game is played against. */
export const CROSS_HERO_SCENARIO = "morlock-siege";

export interface CrossHeroOptions {
  readonly coreHero?: string;
  readonly seed?: number;
  /** Traits added to both faces of the Core hero's identity card. */
  readonly identityTraits?: readonly string[];
  /** Further seats beside the Core hero. */
  readonly otherPlayers?: readonly PlayerSetup[];
}

/** The Core identity card of a starter deck id (`core-spider-man-justice` -> `01001a`). */
const IDENTITY_OF: Readonly<Record<string, string>> = {
  [SPIDER_MAN]: "01001a",
  [CAPTAIN_MARVEL]: "01010a",
  [SHE_HULK]: "01019a",
  [BLACK_PANTHER]: "01040a",
};

/** `WAVE7_CARDS` with `traits` added to both faces of `identityCardId`. */
export function cardsWithIdentityTraits(identityCardId: string, traits: readonly string[]): readonly AnyCard[] {
  return WAVE7_CARDS.map((card) => {
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
  const card = WAVE7_CARDS.find((c) => (c.id as string) === code);
  const aspect = card && "aspect" in card ? card.aspect : "basic";
  return aspect in CORE_HERO_FOR_ASPECT
    ? CORE_HERO_FOR_ASPECT[aspect as keyof typeof CORE_HERO_FOR_ASPECT]
    : SPIDER_MAN;
}

function poolOf(options: CrossHeroOptions): readonly AnyCard[] {
  if (!options.identityTraits) return WAVE7_CARDS;
  const identity = IDENTITY_OF[options.coreHero ?? SPIDER_MAN];
  if (!identity) throw new Error(`no identity id for ${options.coreHero}`);
  return cardsWithIdentityTraits(identity, options.identityTraits);
}

function configOf(options: CrossHeroOptions, players: readonly PlayerSetup[]): GameSetupConfig {
  const config = wave7Scenario(CROSS_HERO_SCENARIO, {
    seed: options.seed ?? 11,
    players: [...players, ...(options.otherPlayers ?? [])] as never,
  });
  return { ...config, cards: poolOf(options) };
}

/** The `CrossHeroGame` for `playFromAnotherHerosDeck`. */
export function crossHeroGame(options: CrossHeroOptions = {}): CrossHeroGame {
  return {
    deps: WAVE7_DEPS,
    cards: poolOf(options),
    buildScenario: (players) => configOf(options, players),
  };
}

/** A game past setup (every opening hand kept), `code` in `coreHero`'s deck, in the player phase. */
export function openedCrossHero(code: string, options: CrossHeroOptions = {}): GameState {
  const hero = options.coreHero ?? coreHeroFor(code);
  const resolved = { ...options, coreHero: hero };
  const deck = buildCrossHeroDeck(poolOf(resolved), hero, code);
  const created = createGame(configOf(resolved, [deck]), WAVE7_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE7_DEPS);
}

/** `openedCrossHero`, with the hero in hero form (an alter-ego starts the game). */
export const openedHero = (code: string, options: CrossHeroOptions = {}, player: PlayerId = P1): GameState =>
  withForm(openedCrossHero(code, options), { heroForm: 0 }, player);

/** The printed cost of `code` (0 for a card with none). */
export const printedCost = (code: string): number =>
  (WAVE7_CARDS.find((c) => (c.id as string) === code) as { cost?: number } | undefined)?.cost ?? 0;

const newInstance = (code: string, extra: Partial<CardInstance>): CardInstance =>
  ({
    cardId: cardId(code),
    ownerId: null,
    controllerId: null,
    home: { kind: "activeEncounterDeck" },
    faceup: true,
    exhausted: false,
    damage: 0,
    threat: 0,
    statuses: { stunned: 0, confused: 0, tough: 0 },
    counters: {},
    attachedTo: null,
    attachments: [],
    boostCards: [],
    tucked: [],
    facedownAs: null,
    engagedWith: null,
    flipped: false,
    ...extra,
  }) as unknown as CardInstance;

/** Fabricates an encounter minion engaged with `player` (surgery: no reveal, no When Revealed). Default Hydra Mercenary. */
export function spawnMinion(
  state: GameState,
  opts: {
    code?: string;
    player?: PlayerId;
    damage?: number;
    confused?: boolean;
    stunned?: boolean;
    tough?: boolean;
  } = {},
): { state: GameState; id: InstanceId } {
  const player = opts.player ?? P1;
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  const instance = newInstance(opts.code ?? "01101", {
    instanceId: id,
    damage: opts.damage ?? 0,
    statuses: { stunned: opts.stunned ? 1 : 0, confused: opts.confused ? 1 : 0, tough: opts.tough ? 1 : 0 },
    home: { kind: "playArea", playerId: player } as never,
    engagedWith: player,
  });
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) => (p.playerId === player ? { ...p, playArea: [...p.playArea, id] } : p)),
      instances: { ...state.instances, [id]: instance },
    },
  };
}

/** Fabricates an encounter side scheme with `threat` in the villain area (default Captive Hope, no crisis, no Surge). */
export function spawnSideScheme(
  state: GameState,
  threat: number,
  code = "40131",
): { state: GameState; id: InstanceId } {
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      villainArea: [...state.villainArea, id],
      instances: { ...state.instances, [id]: newInstance(code, { instanceId: id, threat }) },
    },
  };
}

/** The villain area emptied (no side scheme in play) and the main scheme set to `threat`. */
export const withoutSideSchemes = (state: GameState, threat = 6): GameState =>
  patchInstance({ ...state, villainArea: [] }, state.mainScheme.instanceId, { threat });

/**
 * Accepts every optional trigger whose id contains one of `wanted` and pays an accepted response event's cost from hand
 * (`payForCard`); a defender prompt names the identity when `defend` is set; any other prompt takes `firstLegal`.
 */
export const accepting =
  (wanted: readonly string[], opts: { defend?: boolean; defender?: InstanceId } = {}): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    if (choice?.prompt.kind === "chooseTriggers")
      return choice.options.filter((o) => wanted.some((w) => o.optionId.includes(w))).map((o) => o.optionId);
    if (choice?.prompt.kind === "payForCard")
      return choice.options
        .filter((o) => o.optionId.startsWith("hand:"))
        .slice(0, choice.prompt.cost)
        .map((o) => o.optionId);
    if (
      choice?.prompt.kind === "declareDefender" &&
      opts.defender &&
      choice.options.some((o) => o.optionId === opts.defender)
    )
      return [opts.defender];
    if (choice?.prompt.kind === "declareDefender" && opts.defend) return [identityOf(state, choice.playerId)];
    return firstLegal(state);
  };

/** `accepting`, and a `chooseTarget`/`chooseCards` prompt that offers one of `targets` takes it. */
export const acceptingAndPicking =
  (wanted: readonly string[], targets: readonly string[]): Picker =>
  (state) => {
    const choice = state.pendingChoice;
    const hit = choice?.options.find((o) => targets.includes(o.optionId));
    if (choice && choice.prompt.kind !== "chooseTriggers" && hit) return [hit.optionId];
    return accepting(wanted)(state);
  };

/** Drives `commands` answering every prompt with `pick`; `offered` is every trigger id offered on the way. */
export function drive(state: GameState, pick: Picker, ...commands: readonly Command[]) {
  const offered = new Set<string>();
  const spy: Picker = (s) => {
    if (s.pendingChoice?.prompt.kind === "chooseTriggers")
      for (const o of s.pendingChoice.options) offered.add(o.optionId);
    return pick(s);
  };
  return { ...driveEventsPicking(WAVE7_DEPS, state, spy, ...commands), offered };
}
export const wasOffered = (offered: ReadonlySet<string>, ref: string): boolean =>
  [...offered].some((o) => o.includes(ref));

export const basicAttackCmd = (state: GameState, target: InstanceId, who?: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicAttack",
  playerId: p,
  attackerInstanceId: who ?? identityOf(state, p),
  targetInstanceId: target,
});
export const basicThwartCmd = (state: GameState, scheme: InstanceId, who?: InstanceId, p: PlayerId = P1): Command => ({
  type: "basicThwart",
  playerId: p,
  thwarterInstanceId: who ?? identityOf(state, p),
  schemeInstanceId: scheme,
});

/**
 * Moves `n` cards that print a `icon` resource icon (a wild counts) into `player`'s hand, from the deck or the discard
 * pile, and returns them: the exact resources a test pays with to make a play "paid with [physical]" or not.
 */
export function iconCards(
  state: GameState,
  icon: "physical" | "mental" | "energy",
  n: number,
  opts: { player?: PlayerId; exclude?: readonly InstanceId[]; only?: boolean } = {},
): { state: GameState; ids: InstanceId[] } {
  const player = opts.player ?? P1;
  const owner = playerOf(state, player);
  const exclude = opts.exclude ?? [];
  const has = (i: InstanceId): boolean => {
    if (exclude.includes(i)) return false;
    const card = state.cardPool[state.instances[i]!.cardId]!;
    const icons =
      ("resourceIcons" in card && card.resourceIcons) || ("producesIcons" in card && card.producesIcons) || {};
    const own = (icons as Record<string, number | undefined>)[icon] ?? 0;
    if (opts.only) return own > 0 && (icons as Record<string, number | undefined>)["wild"] === undefined;
    return own > 0 || ((icons as Record<string, number | undefined>)["wild"] ?? 0) > 0;
  };
  const ids = [...owner.hand.filter(has), ...owner.deck.filter(has), ...owner.discard.filter(has)].slice(0, n);
  if (ids.length < n) throw new Error(`${player} has fewer than ${n} ${icon} cards`);
  return {
    ids,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              deck: p.deck.filter((i) => !ids.includes(i)),
              discard: p.discard.filter((i) => !ids.includes(i)),
              hand: [...p.hand.filter((i) => !ids.includes(i)), ...ids],
            }
          : p,
      ),
    },
  };
}

/** `code` moved to hand, then an exact-resource payment of the first `payment` ids; returns the ids for a `play` command. */
export function handWithCard(state: GameState, code: string, player: PlayerId = P1) {
  const given = moveToHand(state, player, code);
  return { state: given.state, id: given.ids[0]! };
}

/** Fabricates a side scheme (default Captive Hope) already in the victory display. */
export function spawnVictorySideScheme(state: GameState, code = "40131"): { state: GameState; id: InstanceId } {
  const id = `i9${300 + Object.keys(state.instances).length}` as InstanceId;
  return {
    id,
    state: {
      ...state,
      victoryDisplay: [...state.victoryDisplay, id],
      instances: {
        ...state.instances,
        [id]: newInstance(code, { instanceId: id, home: { kind: "activeEncounterDeck" } }),
      },
    },
  };
}

/** Whether `code`'s card is in the zone list. */
export const codesOf = (state: GameState, ids: readonly InstanceId[]): string[] =>
  ids.map((id) => state.instances[id]!.cardId as string);

let conjured = 9100;
export type ConjureWhere = "hand" | "deck" | "topOfDeck" | "discard" | "play";

/**
 * A copy of `code` that is in none of the deck's cards, added to `player`'s `where` by surgery: a fresh instance cloned
 * from the top of that player's deck (so ownership and home are right) with the printed number replaced. For a second
 * card a test needs beside the one `openedCrossHero` seated (a PSIONIC card to pay for with The Power of the Mind, an
 * ally already in play, a card on top of the deck for a "discard the top card" effect).
 */
export function conjure(
  state: GameState,
  code: string,
  where: ConjureWhere = "hand",
  player: PlayerId = P1,
): { state: GameState; id: InstanceId } {
  const owner = playerOf(state, player);
  const template = state.instances[owner.deck[0]!]!;
  const id = `i${conjured++}` as InstanceId;
  const instance = {
    ...template,
    instanceId: id,
    cardId: cardId(code),
    exhausted: false,
    flipped: false,
    attachments: [],
    attachedTo: null,
    damage: 0,
    counters: {},
    statuses: { stunned: 0, confused: 0, tough: 0 },
    ...(where === "play" ? { controllerId: player, faceup: true } : {}),
  };
  return {
    id,
    state: {
      ...state,
      instances: { ...state.instances, [id]: instance },
      players: state.players.map((p) => {
        if (p.playerId !== player) return p;
        if (where === "hand") return { ...p, hand: [...p.hand, id] };
        if (where === "deck") return { ...p, deck: [...p.deck, id] };
        if (where === "topOfDeck") return { ...p, deck: [id, ...p.deck] };
        if (where === "discard") return { ...p, discard: [...p.discard, id] };
        return { ...p, playArea: [...p.playArea, id] };
      }),
    },
  };
}

/** `conjure` into the hand. */
export const conjureInHand = (state: GameState, code: string, player: PlayerId = P1) =>
  conjure(state, code, "hand", player);
