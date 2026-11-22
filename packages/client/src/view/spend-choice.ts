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
 *
 * A resource ability (not a hand card) whose cost exhausts any number of cards, one engine option per subset (Enhanced
 * Combat Sense and its Weapon/Tech upgrades, issue #966), gets the same: a `pick:` tile per card, toggled one by one, and
 * `spendAnswerOf` sends the one option exhausting exactly the tiles picked (none picked, none sent).
 */
import type { ChoiceOption, InstanceId, PendingChoice } from "@mc/engine";
import { nextPickSet } from "./pick-sets.js";

const EXHAUST_TILE = "exhaust:";
const PICK_TILE = "pick:";
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

/** The option id without the cards its own cost picks ("@<slot>=<id>,..."): what is common to one ability's options. */
const baseOf = (optionId: string): string => optionId.split("@")[0]!;

/** The cards a resource ability's option exhausts: its one "@<slot>=<id>,<id>" part; none with an amount to choose. */
function abilityPicksOf(optionId: string): readonly InstanceId[] {
  const at = optionId.indexOf("@");
  if (at < 0 || !optionId.startsWith("ability:")) return [];
  const parts = optionId.slice(at + 1).split(";");
  const [part] = parts;
  if (parts.length !== 1 || !part || part.startsWith("#")) return [];
  return part
    .slice(part.indexOf("=") + 1)
    .split(",")
    .filter(Boolean) as InstanceId[];
}

const groupWays = (choice: Pick<PendingChoice, "options">, base: string): readonly ChoiceOption[] =>
  choice.options.filter((option) => baseOf(option.optionId) === base && abilityPicksOf(option.optionId).length > 0);

/**
 * The bases of resource abilities whose options pick any number of cards (one option picks two or more) where each card
 * can be exhausted alone. A fixed-set cost (`exhaustEachCost`) has no one-card option, so a tile per card could never
 * build a payable set: it keeps its option tiles. Same test as the pay bar's `pickGroupBases`.
 */
function pickGroupBasesOf(choice: Pick<PendingChoice, "options">): readonly string[] {
  return [
    ...new Set(
      choice.options
        .filter((option) => option.picksMany === true && abilityPicksOf(option.optionId).length > 0)
        .map((option) => baseOf(option.optionId)),
    ),
  ];
}

const pickTileId = (base: string, candidate: InstanceId): string => `${PICK_TILE}${candidate}@${base}`;
function parsePickTile(id: string): { readonly base: string; readonly candidate: InstanceId } | null {
  if (!id.startsWith(PICK_TILE)) return null;
  const at = id.indexOf("@");
  return at < 0 ? null : { candidate: id.slice(PICK_TILE.length, at) as InstanceId, base: id.slice(at + 1) };
}

/** The cards of a group's tiles among the picks. */
const pickedOfGroup = (picks: readonly string[], base: string): readonly InstanceId[] =>
  picks.flatMap((pick) => {
    const tile = parsePickTile(pick);
    return tile && tile.base === base ? [tile.candidate] : [];
  });

/** The one option of a group exhausting exactly `set`, or undefined. */
const groupWayFor = (
  choice: Pick<PendingChoice, "options">,
  base: string,
  set: readonly InstanceId[],
): ChoiceOption | undefined =>
  groupWays(choice, base).find((way) => setKey(abilityPicksOf(way.optionId)) === setKey(set));

/** The choice with each pick group's subsets replaced by one tile per card, where the group's first subset stood. */
function withPickGroups(choice: PendingChoice): PendingChoice {
  const bases = pickGroupBasesOf(choice);
  if (bases.length === 0) return choice;
  const options = choice.options.flatMap((option): ChoiceOption[] => {
    const base = baseOf(option.optionId);
    if (!bases.includes(base) || abilityPicksOf(option.optionId).length === 0) return [option];
    const ways = groupWays(choice, base);
    if (ways[0] !== option) return [];
    return [...new Set(ways.flatMap((way) => abilityPicksOf(way.optionId)))].map((candidate): ChoiceOption => {
      const alone = groupWayFor(choice, base, [candidate]);
      return {
        optionId: pickTileId(base, candidate),
        label: `Exhaust ${(alone && spendOptionNote(alone.label)) ?? "this card"}`,
        ref: { kind: "card", instanceId: candidate },
      };
    });
  });
  return { ...choice, options, maxSelections: options.length };
}

/**
 * The choice the sheet draws: the engine's options, with the exhausting cards' sets replaced by one tile per card they
 * could exhaust, right after the first one's plain option. Every other option, and every other choice, is left as it is.
 */
export function shownSpendChoice(choice: PendingChoice): PendingChoice {
  if (!isSpendChoice(choice)) return choice;
  return withPickGroups(shownHandExhaust(choice));
}

function shownHandExhaust(choice: PendingChoice): PendingChoice {
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
  const group = parsePickTile(id);
  if (group) {
    // The nearest set the engine offers (`nextPickSet`); none holding the card with the ones picked changes nothing.
    const next = nextPickSet(
      groupWays(choice, group.base).map((way) => abilityPicksOf(way.optionId)),
      pickedOfGroup(picks, group.base),
      group.candidate,
    );
    if (!next) return picks;
    const others = picks.filter((pick) => parsePickTile(pick)?.base !== group.base);
    return [...others, ...next.map((card) => pickTileId(group.base, card))];
  }
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
  const hand = picks.filter((pick) => !isExhaustTile(pick) && !parsePickTile(pick)).map(wayOf);
  const groups = pickGroupBasesOf(choice).flatMap((base) => {
    const set = pickedOfGroup(picks, base);
    const way = set.length > 0 ? groupWayFor(choice, base, set) : undefined;
    return way ? [way.optionId] : [];
  });
  return [...hand, ...groups];
}

/** For a tile, the option ids priced to read what exhausting that one card adds: the way alone, and its plain spending. */
export function exhaustTileOptionsOf(
  choice: PendingChoice,
  tileId: string,
): { readonly alone: string; readonly plain: string | null } | null {
  const group = parsePickTile(tileId);
  if (group) {
    const way = groupWayFor(choice, group.base, [group.candidate]);
    return way ? { alone: way.optionId, plain: null } : null;
  }
  if (!isExhaustTile(tileId)) return null;
  const candidate = candidateOf(tileId);
  const way = choice.options.find((option) => setKey(picksOf(option.optionId)) === candidate);
  return way ? { alone: way.optionId, plain: `hand:${spentHandCardOf(way.optionId)}` } : null;
}
