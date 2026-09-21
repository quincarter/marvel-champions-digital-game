import {
  cardId,
  flat,
  type AnyCard,
  type CardId,
  type HeroIdentityCard,
  type MainSchemeCard,
  type VillainCard,
} from "@mc/content";
import type { CampaignGameInput } from "../campaign.js";
import { createGame, type GameSetupConfig } from "../setup.js";
import { applyCommand, type CommandResult } from "../engine.js";
import { DEFAULT_DEPS, type EngineDeps } from "../abilities.js";
import type { Command, Payment } from "../commands.js";
import type { GameState } from "../state.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { activeEncounterDeck, activeEncounterDeckId, mustPlayer } from "../query.js";

/** Test surgery on the active villain's encounter deck and discard pile ("the encounter deck"). */
export function withEncounterPiles(
  state: GameState,
  piles: { readonly deck?: readonly InstanceId[]; readonly discard?: readonly InstanceId[] },
): GameState {
  const current = activeEncounterDeck(state);
  return {
    ...state,
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: piles.deck ?? current.deck, discard: piles.discard ?? current.discard },
    },
  };
}
import {
  stubAlly,
  stubIdentity,
  stubMainScheme,
  stubResource,
  stubTreachery,
  stubUpgrade,
  stubVillain,
} from "./fixtures.js";

export const HERO = stubIdentity({
  id: "hero",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
});
export const ALLY = stubAlly({ id: "ally", cost: 2, atk: 2, thw: 1, hp: 3, resources: 1 });
export const UPGRADE = stubUpgrade({ id: "upgrade", cost: 1, resources: 1 });
export const RESOURCE = stubResource({ id: "res", icons: 1 });
export const VILLAIN = stubVillain({ id: "villain", stages: [{ hp: flat(20), atk: 2, sch: 1 }] });
export const MAIN_SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(20), acceleration: flat(1) }],
});
export const TREACHERY = stubTreachery({ id: "treachery", boostIcons: 1 });

export const DEFAULT_CARDS: readonly AnyCard[] = [HERO, ALLY, UPGRADE, RESOURCE, VILLAIN, MAIN_SCHEME, TREACHERY];

const repeat = (id: CardId, count: number): readonly CardId[] => Array.from({ length: count }, () => id);

export const DEFAULT_DECK: readonly CardId[] = [
  ...repeat(RESOURCE.id, 12),
  ...repeat(ALLY.id, 6),
  ...repeat(UPGRADE.id, 6),
];

export interface NewGameOptions {
  readonly players?: number;
  readonly seed?: number;
  readonly extraCards?: readonly AnyCard[];
  readonly identity?: HeroIdentityCard;
  readonly villain?: VillainCard;
  readonly mainScheme?: MainSchemeCard;
  readonly encounterDeck?: readonly CardId[];
  readonly deck?: readonly CardId[];
  readonly deps?: EngineDeps;
  /** Plays this game as one scenario of a campaign (`GameSetupConfig.campaign`); absent is a standalone game. */
  readonly campaign?: CampaignGameInput;
}

/**
 * One identity card per seat. RRG "Unique" forbids two copies of the same identity at the
 * table (`createGame` rejects it), so seats past the first get a re-titled clone of the
 * requested identity — identical stats, HP and abilities, different title and alter-ego, so
 * a multi-seat fixture stays a legal table without changing what the tests measure.
 */
export function seatIdentities(identity: HeroIdentityCard, count: number): readonly HeroIdentityCard[] {
  return Array.from({ length: count }, (_, seat) =>
    seat === 0
      ? identity
      : {
          ...identity,
          id: cardId(`${identity.id}-p${seat + 1}`),
          name: `${identity.name} p${seat + 1}`,
          hero: { ...identity.hero, faceName: `${identity.hero.faceName} p${seat + 1}` },
          alterEgo: { ...identity.alterEgo, faceName: `${identity.alterEgo.faceName} p${seat + 1}` },
        },
  );
}

/** A freshly set-up game, still parked on the setup mulligan choice. */
export function newGameAtMulligan(options: NewGameOptions = {}): GameState {
  const villain = options.villain ?? VILLAIN;
  const mainScheme = options.mainScheme ?? MAIN_SCHEME;
  const identity = options.identity ?? HERO;
  const playerCount = options.players ?? 1;
  const identities = seatIdentities(identity, playerCount);
  const config: GameSetupConfig = {
    seed: options.seed ?? 1234,
    cards: [...DEFAULT_CARDS, villain, mainScheme, ...identities, ...(options.extraCards ?? [])],
    villainCardId: villain.id,
    mainSchemeCardId: mainScheme.id,
    encounterDeck: options.encounterDeck ?? repeat(TREACHERY.id, 20),
    players: identities.map((seatIdentity) => ({
      identityCardId: seatIdentity.id,
      deck: options.deck ?? DEFAULT_DECK,
    })),
    ...(options.campaign ? { campaign: options.campaign } : {}),
  };
  const result = createGame(config, options.deps ?? DEFAULT_DEPS);
  if (!result.ok) throw new Error(`setup failed: ${result.error.message}`);
  return result.state;
}

/** A game past setup, with every player keeping their opening hand. */
export function newGame(options: NewGameOptions = {}): GameState {
  return settle(newGameAtMulligan(options), defaultPick, options.deps ?? DEFAULT_DEPS);
}

export function expectOk(result: CommandResult): GameState {
  if (!result.ok) throw new Error(`expected ok, got ${result.error.code}: ${result.error.message}`);
  return result.state;
}

/** Applies commands in order, failing loudly on the first rejection. */
export function run(state: GameState, ...commands: readonly Command[]): GameState {
  let current = state;
  for (const command of commands) current = expectOk(applyCommand(current, command));
  return current;
}

export function runWith(deps: EngineDeps, state: GameState, ...commands: readonly Command[]): GameState {
  let current = state;
  for (const command of commands) current = expectOk(applyCommand(current, command, deps));
  return current;
}

export const fromHand = (...ids: readonly InstanceId[]): readonly Payment[] =>
  ids.map((instanceId) => ({ fromHand: instanceId }));

/** Enough resource cards from `player`'s hand to cover `cost`. */
export function payFor(state: GameState, player: PlayerId, cost: number): readonly Payment[] {
  const ids = mustPlayer(state, player)
    .hand.filter((id) => state.instances[id]?.cardId === RESOURCE.id)
    .slice(0, cost);
  if (ids.length < cost) throw new Error(`${player} has fewer than ${cost} resource cards in hand`);
  return fromHand(...ids);
}

export function findInHand(state: GameState, player: PlayerId, card: string): InstanceId {
  const wanted = cardId(card);
  const found = mustPlayer(state, player).hand.find((id) => state.instances[id]?.cardId === wanted);
  if (!found) throw new Error(`${player} has no ${card} in hand`);
  return found;
}

export function handOf(state: GameState, player: PlayerId): readonly InstanceId[] {
  return mustPlayer(state, player).hand;
}

/** Resolves whatever choice is pending with the given option ids. */
export function resolvePending(
  state: GameState,
  selectedOptionIds: readonly string[],
  deps: EngineDeps = DEFAULT_DEPS,
): GameState {
  const choice = state.pendingChoice;
  if (!choice) throw new Error("no pending choice");
  return expectOk(
    applyCommand(
      state,
      {
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds,
      },
      deps,
    ),
  );
}

/** Resolves pending choices with a caller-supplied picker until the game needs a real command. */
export function settle(
  state: GameState,
  pick: (state: GameState) => readonly string[] = defaultPick,
  deps: EngineDeps = DEFAULT_DEPS,
): GameState {
  let current = state;
  let guard = 0;
  while (current.pendingChoice && !current.outcome) {
    if (guard++ > 100) throw new Error("choice loop did not settle");
    current = resolvePending(current, pick(current), deps);
  }
  return current;
}

/** Auto-answers choices until one of the given kind comes up (or the game settles). */
export function settleUntil(
  state: GameState,
  kind: NonNullable<GameState["pendingChoice"]>["prompt"]["kind"],
  deps: EngineDeps = DEFAULT_DEPS,
): GameState {
  let current = state;
  let guard = 0;
  while (current.pendingChoice && current.pendingChoice.prompt.kind !== kind && !current.outcome) {
    if (guard++ > 100) throw new Error("choice loop did not settle");
    current = resolvePending(current, defaultPick(current), deps);
  }
  return current;
}

export function defaultPick(state: GameState): readonly string[] {
  const choice = state.pendingChoice;
  if (!choice) return [];
  if (choice.prompt.kind === "declareDefender") return ["decline"];
  return choice.options.slice(0, choice.minSelections).map((o) => o.optionId);
}

/**
 * Moves the first copy of `card` from `player`'s deck (or discard) into their
 * hand. Test-only state surgery so a test doesn't depend on the shuffle.
 */
export function giveCard(
  state: GameState,
  player: PlayerId,
  card: string,
  exclude: readonly InstanceId[] = [],
): { state: GameState; id: InstanceId } {
  const wanted = cardId(card);
  const owner = mustPlayer(state, player);
  const matches = (i: InstanceId) => state.instances[i]?.cardId === wanted && !exclude.includes(i);
  // A copy already in the opening hand counts, as long as it wasn't handed out already.
  const inHand = owner.hand.find(matches);
  if (inHand) return { state, id: inHand };
  const id = owner.deck.find(matches) ?? owner.discard.find(matches);
  if (!id) throw new Error(`${player} has no ${card} in hand, deck or discard`);
  return {
    id,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              deck: p.deck.filter((i) => i !== id),
              discard: p.discard.filter((i) => i !== id),
              hand: [...p.hand, id],
            }
          : p,
      ),
    },
  };
}

/** `giveCard` for several cards; returns the new state and the ids in order. */
export function giveCards(
  state: GameState,
  player: PlayerId,
  ...cards: readonly string[]
): { state: GameState; ids: readonly InstanceId[] } {
  let current = state;
  const ids: InstanceId[] = [];
  for (const card of cards) {
    const given = giveCard(current, player, card, ids);
    current = given.state;
    ids.push(given.id);
  }
  return { state: current, ids };
}
