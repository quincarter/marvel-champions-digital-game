/**
 * The "divide N among targets" sheet's labels (`divide`, `assignIndirectDamage`). The engine offers one option per
 * point per card (`<instanceId>#<n>`), so a Torrential Rain over two schemes was six identical tiles with nothing to
 * say which scheme each one was. This reads who each option is for and what it currently holds, and keeps a running
 * tally per card of what has been picked. Pure reading of the pending choice and the state; nothing here decides what
 * is legal.
 */

import { isMinion, type ChoiceRef, type GameState, type InstanceId, type PendingChoice } from "@mc/engine";
import { engagedNameOf, threatOnCard } from "./board-model.js";
import { engagedNoteForms } from "./choice-tile-notes.js";
import { cardName } from "./names.js";

export interface DivideOptionLabel {
  /** The card this point is for. */
  readonly name: string;
  /**
   * The seat a minion is engaged with ("Iron Man"), in a game of more than one seat, so two facedown Drones taking a
   * share of the damage read apart (issue #1001); the sheet words it with `engagedNoteForms`. Null for any other card,
   * and in a one-seat game.
   */
  readonly engaged: string | null;
  /** "Threat 3", "Damage 2" — what the card holds now, before any of the division. */
  readonly holds: string;
  /** Which point of that card this tile is ("1", "2"...), so two tiles for one card still read apart. */
  readonly ordinal: number;
}

export interface DivideSheet {
  /** The label of each option, by option id. */
  readonly labels: ReadonlyMap<string, DivideOptionLabel>;
  /** "The Break-In! 2 · Bomb Scare 1 · 1 to place" — empty while nothing is picked. */
  readonly tally: string;
  /**
   * The tally's ways to read, longest first: `tally` itself, then shorter forms that lead with what is left to place
   * and name each card as briefly as still tells it apart ("1 to place · vs P. Parker 1 · vs M. Morales 1"). A phone's
   * caption takes the first that fits, so a cut from the end costs a target's name, never the count. Empty with `tally`.
   */
  readonly tallies: readonly string[];
}

const refInstanceId = (ref: ChoiceRef): InstanceId | null =>
  ref.kind === "card" || ref.kind === "ability" ? ref.instanceId : null;

export const isDivideSheet = (choice: Pick<PendingChoice, "prompt">): boolean =>
  choice.prompt.kind === "divide" || choice.prompt.kind === "assignIndirectDamage";

/**
 * The options the sheet draws. Indirect damage offers one tile per point a card could still take before it falls (a
 * hero at 7 hit points left is seven tiles), but only `amount` points are being assigned, so a card's tiles past
 * that number can never all be picked: two indirect damage across a hero and two allies was seven or more tiles. The
 * engine's choice is untouched and answers are still its option ids; this only leaves out tiles that a full answer
 * could not reach.
 */
export function shownDivideChoice(choice: PendingChoice): PendingChoice {
  const { prompt } = choice;
  if (prompt.kind !== "assignIndirectDamage") return choice;
  const options = choice.options.filter((option) => {
    const hash = option.optionId.lastIndexOf("#");
    const point = hash < 0 ? 1 : Number(option.optionId.slice(hash + 1));
    return !(point > prompt.amount);
  });
  return options.length === choice.options.length ? choice : { ...choice, options };
}

export function divideSheetOf(
  state: GameState,
  choice: PendingChoice,
  selected: readonly string[],
): DivideSheet | null {
  const { prompt } = choice;
  if (prompt.kind !== "divide" && prompt.kind !== "assignIndirectDamage") return null;
  const what = prompt.kind === "divide" ? prompt.what : "damage";
  const ordinals = new Map<InstanceId, number>();
  const order: InstanceId[] = [];
  const owner = new Map<string, InstanceId>();
  for (const option of choice.options) {
    const instanceId = refInstanceId(option.ref);
    if (!instanceId) continue;
    const next = (ordinals.get(instanceId) ?? 0) + 1;
    ordinals.set(instanceId, next);
    if (next === 1) order.push(instanceId);
    owner.set(option.optionId, instanceId);
  }
  // Two copies of one card engaged with one hero (or two schemes of one name) are numbered in table order across every
  // target on the sheet, not just the picked ones, so a tile and its tally entry carry the same "#2" whatever is
  // picked (Codex, PR #1014).
  const engagedBy = new Map(order.map((instanceId) => [instanceId, engagedOf(state, instanceId)] as const));
  const copies = copyNumbers(order.map((instanceId) => `${cardName(state, instanceId)}|${engagedBy.get(instanceId)}`));
  const copyOf = new Map(order.map((instanceId, index) => [instanceId, copies[index]] as const));
  const named = (instanceId: InstanceId): string => {
    const copy = copyOf.get(instanceId);
    return `${cardName(state, instanceId)}${copy ? ` #${copy}` : ""}`;
  };

  const labels = new Map<string, DivideOptionLabel>();
  // Each tile's point number, in the order the engine offers a card's points.
  const seen = new Map<InstanceId, number>();
  for (const option of choice.options) {
    const instanceId = owner.get(option.optionId);
    if (!instanceId) continue;
    const ordinal = (seen.get(instanceId) ?? 0) + 1;
    seen.set(instanceId, ordinal);
    labels.set(option.optionId, {
      name: named(instanceId),
      engaged: engagedBy.get(instanceId) ?? null,
      holds: holdsOf(state, instanceId, what),
      ordinal,
    });
  }

  const counts = new Map<InstanceId, number>();
  for (const optionId of selected) {
    const instanceId = owner.get(optionId);
    if (instanceId) counts.set(instanceId, (counts.get(instanceId) ?? 0) + 1);
  }
  const left = prompt.amount - selected.length;
  const leftWords = left > 0 ? `${left} to place` : "all placed";
  const picked = order.filter((instanceId) => counts.has(instanceId));
  if (picked.length === 0) return { labels, tally: "", tallies: [] };

  const seats = order.flatMap((instanceId) => {
    const engaged = engagedBy.get(instanceId);
    return engaged ? [engaged] : [];
  });
  // A minion engaged with a seat is named by that seat alone, in the shortest form no other seat shares; targets that
  // would then read the same (two minions engaged with one hero) keep their card names, and copies their numbers.
  const seatOnly = new Map(
    order.map((instanceId) => {
      const engaged = engagedBy.get(instanceId);
      return [instanceId, engaged ? engagedNoteForms(engaged, seats).at(-1)! : cardName(state, instanceId)] as const;
    }),
  );
  const briefOf = (instanceId: InstanceId): string => {
    const name = seatOnly.get(instanceId)!;
    const shared = order.filter((other) => seatOnly.get(other) === name).length > 1;
    if (!shared || !engagedBy.get(instanceId)) return name;
    return `${named(instanceId)} ${name}`;
  };
  const fullOf = (instanceId: InstanceId): string => {
    const engaged = engagedBy.get(instanceId);
    return `${named(instanceId)}${engaged ? ` (vs ${engaged})` : ""}`;
  };
  const full = picked.map((instanceId) => `${fullOf(instanceId)} ${counts.get(instanceId)}`);
  const brief = picked.map((instanceId) => `${briefOf(instanceId)} ${counts.get(instanceId)}`);
  const tally = `${full.join(" · ")} · ${leftWords}`;
  const tallies = [...new Set([tally, [leftWords, ...full].join(" · "), [leftWords, ...brief].join(" · ")])];
  return { labels, tally, tallies };
}

/**
 * Each key's copy number among the keys that repeat, in order (1, 2, ...), or null for a key that is unique: two
 * copies of one card engaged with one hero read "#1" and "#2".
 */
export function copyNumbers(keys: readonly string[]): readonly (number | null)[] {
  const seen = new Map<string, number>();
  return keys.map((key) => {
    if (keys.filter((other) => other === key).length < 2) return null;
    const nth = (seen.get(key) ?? 0) + 1;
    seen.set(key, nth);
    return nth;
  });
}

function engagedOf(state: GameState, instanceId: InstanceId): string | null {
  if (!isMinion(state, instanceId)) return null;
  return engagedNameOf(state, state.instances[instanceId]?.engagedWith ?? null);
}

function holdsOf(state: GameState, instanceId: InstanceId, what: string): string {
  if (what === "threat") return `Threat ${threatOnCard(state, instanceId)}`;
  if (what === "damage" || what === "heal") return `Damage ${state.instances[instanceId]?.damage ?? 0}`;
  return "";
}
