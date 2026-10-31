/**
 * A payment asked as a choice (Team-Building Exercise's `spendResources`, a window's `payForCard`/`payForAbility`), as
 * the choice sheet draws it.
 *
 * The engine lists one option per way of spending a card, and a hand card spent through its own "When you spend this
 * card, exhaust up to 3 …" ability is one option per set of cards exhausted, all with the same face: Organizational
 * Support with four cards to exhaust was fifteen identical tiles (issue #569; the pay bar's answer is #326,
 * `exhaustPickTiles`). So the sheet shows one tile per card to exhaust, beside the hand card that exhausts it, and keeps
 * picks in its own terms: the hand card's option plus an `exhaust:` tile per card. `spendAnswerOf` turns those picks
 * back into the engine's option ids, the only thing ever sent. A hand card can be spent only once, so picking one way
 * of spending it drops any other (issue #279 again: the engine refuses both, and here that silently played nothing).
 */
import type { ChoiceOption, InstanceId, PendingChoice } from "@mc/engine";

const EXHAUST_TILE = "exhaust:";
const SPEND_PROMPTS: ReadonlySet<string> = new Set(["spendResources", "payForCard", "payForAbility"]);

export const isSpendChoice = (choice: Pick<PendingChoice, "prompt">): boolean => SPEND_PROMPTS.has(choice.prompt.kind);

/** The hand card an option id spends ("hand:<id>" or "hand:<id>:<abilityId>@…"), or null for any other option. */
export function spentHandCardOf(optionId: string): InstanceId | null {
  if (!optionId.startsWith("hand:")) return null;
  return optionId.slice("hand:".length).split(/[:@]/)[0] as InstanceId;
}

/** The cards a way of spending exhausts: its option id's one "@<slot>=<id>,<id>" part; none with an amount to choose. */
function picksOf(optionId: string): readonly InstanceId[] {
  const at = optionId.indexOf("@");
  if (at < 0 || !optionId.startsWith("hand:")) return [];
  const parts = optionId.slice(at + 1).split(";");
  const [part] = parts;
  if (parts.length !== 1 || !part || part.startsWith("#")) return [];
  return part.slice(part.indexOf("=") + 1).split(",") as InstanceId[];
}

/** The hand cards with ways that pick cards, in the engine's order. The tiles are drawn once, under the first. */
function exhaustersOf(choice: Pick<PendingChoice, "options">): readonly InstanceId[] {
  const ways = choice.options.filter((option) => picksOf(option.optionId).length > 0);
  return [...new Set(ways.map((way) => spentHandCardOf(way.optionId)!))];
}

const waysOf = (choice: Pick<PendingChoice, "options">, card: InstanceId): readonly ChoiceOption[] =>
  choice.options.filter((option) => spentHandCardOf(option.optionId) === card && picksOf(option.optionId).length > 0);

const setKey = (ids: readonly InstanceId[]): string => [...ids].sort().join(",");
const exhaustTileId = (card: InstanceId, candidate: InstanceId): string => `${EXHAUST_TILE}${card}:${candidate}`;
const candidateOf = (tileId: string): InstanceId => tileId.slice(tileId.lastIndexOf(":") + 1) as InstanceId;
const isExhaustTile = (id: string): boolean => id.startsWith(EXHAUST_TILE);

/** What the engine's label says a way of spending takes, in its brackets: "Agent 13, The Iliad", "take 2 damage". */
export function spendOptionNote(label: string): string | null {
  return label.match(/\((.+)\)$/)?.[1] ?? null;
}

/**
 * Which hand card exhausts which of the picked cards: the first copy as many as it can, the next copy the rest (two
 * copies may each exhaust their own, `mostFromEachHandCard`; a card pays once). Null when no copies can take them all.
 */
function assignedTiles(
  choice: PendingChoice,
  picks: readonly string[],
  tiles: readonly string[] = picks.filter(isExhaustTile),
): ReadonlyMap<InstanceId, readonly InstanceId[]> | null {
  const assigned = new Map<InstanceId, readonly InstanceId[]>();
  let rest = tiles.map(candidateOf);
  // A copy the player already spends goes first, so a press never spends a card they did not pick when theirs can do it.
  const copies = exhaustersOf(choice);
  const picked = (card: InstanceId): boolean => picks.includes(`hand:${card}`);
  for (const card of [...copies.filter(picked), ...copies.filter((copy) => !picked(copy))]) {
    if (rest.length === 0) break;
    const ways = waysOf(choice, card);
    // As many as this copy has a way for: a card it can't exhaust is left to the next copy.
    const taken: InstanceId[] = [];
    for (const candidate of rest) {
      const next = setKey([...taken, candidate]);
      if (ways.some((way) => setKey(picksOf(way.optionId)) === next)) taken.push(candidate);
    }
    if (taken.length === 0) continue;
    assigned.set(card, taken);
    rest = rest.filter((candidate) => !taken.includes(candidate));
  }
  return rest.length === 0 ? assigned : null;
}

/**
 * The choice the sheet draws: the engine's options, with the exhausting cards' sets replaced by one tile per card they
 * could exhaust, right after the first one's plain option. Every other option, and every other choice, is left as it is.
 */
export function shownSpendChoice(choice: PendingChoice): PendingChoice {
  if (!isSpendChoice(choice)) return choice;
  const [card] = exhaustersOf(choice);
  if (!card) return choice;
  const ways = choice.options.filter((option) => picksOf(option.optionId).length > 0);
  const named = new Map<InstanceId, string>();
  for (const way of ways) {
    const [only, ...more] = picksOf(way.optionId);
    if (only && more.length === 0 && !named.has(only)) named.set(only, spendOptionNote(way.label) ?? "this card");
  }
  const tiles = [...new Set(ways.flatMap((way) => picksOf(way.optionId)))].map((candidate): ChoiceOption => ({
    optionId: exhaustTileId(card, candidate),
    label: `Exhaust ${named.get(candidate) ?? "this card"}`,
    ref: { kind: "card", instanceId: candidate },
  }));
  const options = choice.options.flatMap((option) => {
    if (option.optionId === `hand:${card}`) return [option, ...tiles];
    return picksOf(option.optionId).length > 0 ? [] : [option];
  });
  return { ...choice, options, maxSelections: options.length };
}

/**
 * One press on the sheet: the picks after it. A card to exhaust brings a hand card with it (a second copy once the first
 * can exhaust no more), and a card past what the copies allow changes nothing. Taking an exhausting hand card back takes
 * the cards back too, and a second way of spending a hand card replaces the first.
 */
export function toggleSpendPick(choice: PendingChoice, picks: readonly string[], id: string): readonly string[] {
  if (isExhaustTile(id)) {
    if (picks.includes(id)) return picks.filter((pick) => pick !== id);
    const assigned = assignedTiles(choice, picks, [...picks.filter(isExhaustTile), id]);
    if (!assigned) return picks;
    const spenders = [...assigned.keys()];
    const others = picks.filter((pick) => !spenders.includes(spentHandCardOf(pick) as InstanceId));
    return [...others, ...spenders.map((card) => `hand:${card}`), id];
  }
  const card = spentHandCardOf(id);
  const exhausts = card !== null && exhaustersOf(choice).includes(card);
  const ofCard = (pick: string): boolean => card !== null && spentHandCardOf(pick) === card;
  if (picks.includes(id))
    return picks.filter((pick) => pick !== id && !ofCard(pick) && !(exhausts && isExhaustTile(pick)));
  return [...picks.filter((pick) => !ofCard(pick)), id];
}

/** The engine's option ids for the sheet's picks: a hand card's plain option becomes the way that exhausts its tiles. */
export function spendAnswerOf(choice: PendingChoice, picks: readonly string[]): readonly string[] {
  const assigned = assignedTiles(choice, picks);
  const wayOf = (pick: string): string => {
    const card = spentHandCardOf(pick);
    const set = card !== null && pick === `hand:${card}` ? assigned?.get(card) : undefined;
    if (!card || !set) return pick;
    const way = waysOf(choice, card).find((option) => setKey(picksOf(option.optionId)) === setKey(set));
    return way?.optionId ?? pick;
  };
  return picks.filter((pick) => !isExhaustTile(pick)).map(wayOf);
}

/** For a tile, the option ids priced to read what exhausting that one card adds: the way alone, and its plain spending. */
export function exhaustTileOptionsOf(
  choice: PendingChoice,
  tileId: string,
): { readonly alone: string; readonly plain: string } | null {
  if (!isExhaustTile(tileId)) return null;
  const candidate = candidateOf(tileId);
  const way = choice.options.find((option) => setKey(picksOf(option.optionId)) === candidate);
  return way ? { alone: way.optionId, plain: `hand:${spentHandCardOf(way.optionId)}` } : null;
}
