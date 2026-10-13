/**
 * "The Gift cards you control" on the board (Hercules, docs/phase7-wave10-client.md 5.3; docs/phase7-wave10-hero-packs.md
 * H3.9). The Gift Of Battle and Wisdom of Athena cost 1 less for each, Olympus generates a wild resource for each, Son
 * of Zeus checks 1, 2 and 3 of them. While Appeal to Athena is in his play area the count reads 0.
 *
 * The number is the engine's: the count is the card's own printed value (a `ValueSpec` in the ability registry, the one
 * the Gift-scaling cards share), resolved by the engine's `resolveValue` for the seat, so Appeal to Athena's "considered
 * to control none" is already in it. This module only finds that value in the registry, asks, and words the answer. The
 * "3 in play, counted as 0" reason compares it with the Gift upgrades the seat controls, which is a plain read of state.
 */
import {
  cardOf,
  cardsInPlay,
  controllerOf,
  resolveValue,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
  type ValueSpec,
} from "@mc/engine";

/** A node of an ability definition reading the Gift count: a count of upgrades with the GIFT trait, whatever wraps it. */
const isGiftCount = (node: unknown): boolean => {
  if (typeof node !== "object" || node === null) return false;
  const value = node as { kind?: unknown; query?: { trait?: unknown } };
  return value.kind === "count" && value.query?.trait === "GIFT";
};

/** The outermost value that counts Gift upgrades (so a "conditional ... else count" is returned whole), or null. */
function findGiftValue(node: unknown): ValueSpec | null {
  if (typeof node !== "object" || node === null) return null;
  if (Array.isArray(node)) {
    for (const entry of node) {
      const found = findGiftValue(entry);
      if (found) return found;
    }
    return null;
  }
  const record = node as Record<string, unknown>;
  // A conditional whose branch counts Gift cards is the whole answer (the Appeal to Athena clause is its condition).
  if (record.kind === "conditional" && (isGiftCount(record.else) || isGiftCount(record.then))) {
    return record as unknown as ValueSpec;
  }
  if (isGiftCount(record)) return record as unknown as ValueSpec;
  for (const key of Object.keys(record)) {
    const found = findGiftValue(record[key]);
    if (found) return found;
  }
  return null;
}

const specs = new WeakMap<EngineDeps, ValueSpec | null>();
const readers = new WeakMap<EngineDeps, Map<string, boolean>>();

/** The registry's Gift-count value: the first ability that carries one. Null for a game with no such card. */
function giftSpec(deps: EngineDeps): ValueSpec | null {
  if (specs.has(deps)) return specs.get(deps) ?? null;
  let found: ValueSpec | null = null;
  for (const definition of Object.values(deps.abilities)) {
    found = findGiftValue(definition);
    if (found) break;
  }
  specs.set(deps, found);
  return found;
}

/** Whether one of the card's printed abilities reads the Gift count. */
function readsGiftCount(state: GameState, instanceId: InstanceId, deps: EngineDeps): boolean {
  const card = cardOf(state, instanceId);
  if (!card || !("abilities" in card)) return false;
  let cache = readers.get(deps);
  if (!cache) readers.set(deps, (cache = new Map()));
  const key = card.id as string;
  const known = cache.get(key);
  if (known !== undefined) return known;
  const reads = (card.abilities as readonly { id: string }[]).some(
    (ref) => findGiftValue(deps.abilities[ref.id as keyof typeof deps.abilities]) !== null,
  );
  cache.set(key, reads);
  return reads;
}

/** The count as the engine reads it for `playerId` now (0 under Appeal to Athena); null when the game has no Gift card. */
export function giftCountOf(state: GameState, playerId: PlayerId, deps: EngineDeps): number | null {
  const spec = giftSpec(deps);
  if (!spec) return null;
  return resolveValue(
    state,
    spec,
    { selfInstanceId: null, controllerId: playerId, event: null, bindings: {}, deps },
    deps,
  );
}

/** The Gift upgrades the seat controls, whatever the count says. */
function giftCardsControlled(state: GameState, playerId: PlayerId): number {
  return cardsInPlay(state).filter((id) => {
    const card = cardOf(state, id);
    return (
      card?.type === "upgrade" &&
      controllerOf(state, id) === playerId &&
      "traits" in card &&
      (card.traits as readonly string[]).some((trait) => trait.toUpperCase() === "GIFT")
    );
  }).length;
}

/** The card in the seat's play area whose text takes Gift cards out of the count (Appeal to Athena), or null. */
function countReducer(state: GameState, playerId: PlayerId): string | null {
  const seat = state.players.find((entry) => entry.playerId === playerId);
  for (const id of seat?.playArea ?? []) {
    const card = cardOf(state, id);
    if (card && "text" in card && /Gift cards you control/i.test(card.text.current)) return card.name;
  }
  return null;
}

/**
 * The seat's note on its identity: "Gift cards counted: 2", and when something takes them out of the count, why:
 * "Gift cards counted: 0 (2 in play; Appeal to Athena counts them as none)". Null for a seat with no Gift deck.
 */
export function giftSeatNote(state: GameState, playerId: PlayerId, deps: EngineDeps): string | null {
  const seat = state.players.find((entry) => entry.playerId === playerId);
  if (!seat?.separateDecks?.["Gift"]) return null;
  const counted = giftCountOf(state, playerId, deps);
  if (counted === null) return null;
  const inPlay = giftCardsControlled(state, playerId);
  if (inPlay === counted) return `Gift cards counted: ${counted}`;
  const by = countReducer(state, playerId);
  return `Gift cards counted: ${counted} (${inPlay} in play${by ? `; ${by} counts them as none` : ""})`;
}

/**
 * The line on a card that reads the count, where it can be understood: "Costs 1 less per Gift card: 2 counted" is the
 * hand's price chip's reason; here it is the plain count, "Counts Gift cards you control: 2". Null for any other card.
 */
export function giftReaderNote(
  state: GameState,
  instanceId: InstanceId,
  playerId: PlayerId,
  deps: EngineDeps,
): string | null {
  if (!readsGiftCount(state, instanceId, deps)) return null;
  const counted = giftCountOf(state, playerId, deps);
  return counted === null ? null : `Counts Gift cards you control: ${counted}`;
}

/** The hand card's chip for a count note: "Counts Gift cards you control: 2" reads "Gift cards: 2" in the space a chip has. */
export function countChipText(note: string): string {
  return note.replace(/^Counts /, "").replace(/ you control/, "");
}
