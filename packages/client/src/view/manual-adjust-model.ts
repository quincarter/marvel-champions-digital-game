/**
 * "Manual adjust" (issue #791): what the Pause menu's screen offers, read off the live game. A player fixes the table by
 * hand after a bug or a misclick, so the screen lists the things on it (your hero, the villain, schemes, allies, cards
 * in hand) and, for each, the corrections that make sense for that kind of card.
 *
 * It decides nothing about legality. Every pick is a `Command adjust` the engine judges (`engine/src/adjust.ts` has the
 * policy and the refusals); the only state read here is what a card visibly has (damage on it, a status card, counters),
 * so the screen does not offer to remove what is not there. A refusal comes back as the engine's own text.
 */
import {
  cardOf,
  categoriesOf,
  cardsInPlay,
  getInstance,
  getPlayer,
  heldStatusCapacity,
  heroFacesOf,
  playerOrder,
  type Adjustment,
  type AdjustableStatus,
  type Command,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardName, identityNameOf, playerName } from "./names.js";
import { faceVisible } from "./visibility.js";

/** One button on a target's page: what it says and the command it sends. */
export interface AdjustChoice {
  readonly id: string;
  readonly label: string;
  readonly command: Command;
}

/** One thing on the table that can be corrected, with the corrections for it. */
export interface AdjustTarget {
  readonly id: string;
  readonly name: string;
  /** What is on it now, worded for a row: "3 damage · Stunned · Exhausted". Empty when nothing is. */
  readonly detail: string;
  /** The card's id for the hover popover, or null for a card whose face this table cannot see. */
  readonly cardId: string | null;
  readonly instanceId: InstanceId;
  readonly choices: readonly AdjustChoice[];
}

export interface AdjustGroup {
  readonly id: string;
  readonly title: string;
  readonly targets: readonly AdjustTarget[];
}

export interface AdjustModel {
  /** Why nothing can be adjusted right now, or null. */
  readonly unavailable: string | null;
  readonly groups: readonly AdjustGroup[];
}

export const FINISH_CHOICE_FIRST = "Finish the open choice first.";
export const GAME_IS_OVER = "The game is over.";

const STATUSES: readonly { readonly status: AdjustableStatus; readonly word: string }[] = [
  { status: "stunned", word: "Stunned" },
  { status: "confused", word: "Confused" },
  { status: "tough", word: "Tough" },
];

/** Why a manual adjustment cannot be made now, or null: a game that is over, a choice still open, a seat that is out. */
export function adjustUnavailableReason(game: GameState, seat: PlayerId | null): string | null {
  if (game.outcome) return GAME_IS_OVER;
  if (game.pendingChoice) return FINISH_CHOICE_FIRST;
  const player = seat ? getPlayer(game, seat) : undefined;
  if (!player || player.eliminated) return "No seat is able to act.";
  return null;
}

const signed = (amount: number): string => (amount > 0 ? `+${amount}` : `${amount}`);

/**
 * The correction in words for the game log and the screen's own confirmation ("+1 damage on Rhino"). `name` words a
 * card, as the log's own card names do.
 */
export function adjustmentText(
  adjustment: Adjustment,
  name: (id: InstanceId) => string,
  seatName: (id: PlayerId) => string,
): string {
  switch (adjustment.kind) {
    case "draw":
      return `draw ${adjustment.count} card${adjustment.count === 1 ? "" : "s"} for ${seatName(adjustment.playerId)}`;
    case "discardFromHand":
      return `discard ${name(adjustment.instanceId)} from hand`;
    case "discardFromPlay":
      return `discard ${name(adjustment.instanceId)} from play`;
    case "damage":
      return `${signed(adjustment.amount)} damage on ${name(adjustment.instanceId)}`;
    case "threat":
      return `${signed(adjustment.amount)} threat on ${name(adjustment.instanceId)}`;
    case "counters":
      return `${signed(adjustment.amount)} ${adjustment.counterType} counter on ${name(adjustment.instanceId)}`;
    case "status":
      return adjustment.present
        ? `give ${name(adjustment.instanceId)} a ${adjustment.status} status card`
        : `remove the ${adjustment.status} status card from ${name(adjustment.instanceId)}`;
    case "exhaust":
      return `exhaust ${name(adjustment.instanceId)}`;
    case "ready":
      return `ready ${name(adjustment.instanceId)}`;
    case "changeForm":
      return `change form for ${seatName(adjustment.playerId)}`;
  }
}

/** The button label for an adjustment on the screen: short, the target is already named above it. */
function shortLabel(adjustment: Adjustment): string {
  switch (adjustment.kind) {
    case "damage":
      return `${signed(adjustment.amount)} damage`;
    case "threat":
      return `${signed(adjustment.amount)} threat`;
    case "counters":
      return `${signed(adjustment.amount)} ${adjustment.counterType}`;
    case "status":
      return `${adjustment.present ? "Give" : "Remove"} ${adjustment.status}`;
    case "exhaust":
      return "Exhaust";
    case "ready":
      return "Ready";
    case "discardFromHand":
      return "Discard from hand";
    case "discardFromPlay":
      return "Discard from play";
    case "draw":
      return `Draw ${adjustment.count}`;
    case "changeForm":
      return "Change form";
  }
}

const choice = (seat: PlayerId, adjustment: Adjustment, label = shortLabel(adjustment)): AdjustChoice => ({
  id: JSON.stringify(adjustment),
  label,
  command: { type: "adjust", playerId: seat, adjustment },
});

/** The counter kinds a card holds or defines, the ones a player might correct. */
function counterKinds(game: GameState, id: InstanceId): readonly string[] {
  const held = getInstance(game, id)?.counters ?? {};
  return [...new Set([...(cardOf(game, id)?.definedCounterTypes ?? []), ...Object.keys(held)])];
}

/** What is on a card now, for its row. */
function detailOf(game: GameState, id: InstanceId): string {
  const instance = getInstance(game, id);
  if (!instance) return "";
  const categories = categoriesOf(game, id);
  const parts: string[] = [];
  if (categories.includes("character") && instance.damage > 0) parts.push(`${instance.damage} damage`);
  if (categories.includes("scheme")) parts.push(`${instance.threat} threat`);
  for (const { status, word } of STATUSES) if (instance.statuses[status] > 0) parts.push(word);
  for (const kind of Object.keys(instance.counters).sort())
    if (instance.counters[kind]! > 0) parts.push(`${instance.counters[kind]} ${kind}`);
  if (instance.exhausted) parts.push("Exhausted");
  return parts.join(" · ");
}

/** The corrections for one card in play. */
function playChoices(game: GameState, seat: PlayerId, id: InstanceId): readonly AdjustChoice[] {
  const instance = getInstance(game, id)!;
  const categories = categoriesOf(game, id);
  const out: AdjustChoice[] = [];
  if (categories.includes("character")) {
    out.push(choice(seat, { kind: "damage", instanceId: id, amount: 1 }));
    if (instance.damage > 0) out.push(choice(seat, { kind: "damage", instanceId: id, amount: -1 }));
  }
  if (categories.includes("scheme")) {
    out.push(choice(seat, { kind: "threat", instanceId: id, amount: 1 }));
    if (instance.threat > 0) out.push(choice(seat, { kind: "threat", instanceId: id, amount: -1 }));
  }
  if (categories.includes("character")) {
    // Give while the character has room for another (Steady holds two stunned and two confused), remove while it
    // holds one: both can show at once.
    for (const { status } of STATUSES) {
      const held = instance.statuses[status];
      if (held < heldStatusCapacity(game, id, status)) {
        out.push(choice(seat, { kind: "status", instanceId: id, status, present: true }));
      }
      if (held > 0) out.push(choice(seat, { kind: "status", instanceId: id, status, present: false }));
    }
  }
  for (const counterType of counterKinds(game, id)) {
    out.push(choice(seat, { kind: "counters", instanceId: id, counterType, amount: 1 }));
    if ((instance.counters[counterType] ?? 0) > 0)
      out.push(choice(seat, { kind: "counters", instanceId: id, counterType, amount: -1 }));
  }
  const exhaustable =
    categories.includes("identity") ||
    categories.includes("ally") ||
    categories.includes("support") ||
    categories.includes("upgrade");
  if (exhaustable) out.push(choice(seat, { kind: instance.exhausted ? "ready" : "exhaust", instanceId: id }));
  return out;
}

/** A seat's own corrections: it draws a card, its identity changes form. */
function seatChoices(game: GameState, seat: PlayerId, playerId: PlayerId): readonly AdjustChoice[] {
  const player = getPlayer(game, playerId)!;
  const card = cardOf(game, player.identity.instanceId);
  const out: AdjustChoice[] = [choice(seat, { kind: "draw", playerId, count: 1 })];
  if (card?.type !== "hero_identity") return out;
  if (player.identity.form === "hero") {
    out.push(choice(seat, { kind: "changeForm", playerId, to: "alterEgo" }, "Change to alter-ego"));
    return out;
  }
  const faces = heroFacesOf(card);
  // A three-sided identity names the hero form to change to; any other has just the one.
  if (faces.length > 1)
    faces.forEach((face, heroForm) =>
      out.push(choice(seat, { kind: "changeForm", playerId, to: { heroForm } }, `Change to ${face.faceName}`)),
    );
  else out.push(choice(seat, { kind: "changeForm", playerId }, "Change to hero"));
  return out;
}

/**
 * Everything on the table that can be corrected, grouped, with `seat`'s own hero first. `seat` issues every command: the
 * one who acts now.
 */
export function manualAdjustModel(game: GameState, seat: PlayerId | null): AdjustModel {
  const unavailable = adjustUnavailableReason(game, seat);
  if (unavailable || !seat) return { unavailable: unavailable ?? "No seat is able to act.", groups: [] };

  const cardTarget = (id: InstanceId, choices: readonly AdjustChoice[], name = cardName(game, id)): AdjustTarget => ({
    id,
    name,
    detail: detailOf(game, id),
    cardId: faceVisible(game, id) ? (getInstance(game, id)?.cardId ?? null) : null,
    instanceId: id,
    choices,
  });
  const discardFromPlay = (id: InstanceId): AdjustChoice => choice(seat, { kind: "discardFromPlay", instanceId: id });

  const groups: AdjustGroup[] = [];
  const add = (id: string, title: string, targets: readonly AdjustTarget[]): void => {
    if (targets.length > 0) groups.push({ id, title, targets });
  };

  const players = [...playerOrder(game)].sort(
    (a, b) => Number(b.playerId === seat) - Number(a.playerId === seat) || a.seatIndex - b.seatIndex,
  );
  const identities = new Set(players.map((player) => player.identity.instanceId));
  const seats = players.filter((player) => !player.eliminated);

  add(
    "heroes",
    "Heroes",
    seats.map((player) => {
      const id = player.identity.instanceId;
      const name = identityNameOf(game, id) ?? playerName(game, player.playerId);
      return cardTarget(
        id,
        [...playChoices(game, seat, id), ...seatChoices(game, seat, player.playerId)],
        player.playerId === seat ? `${name} (you)` : name,
      );
    }),
  );

  const buckets = new Map<string, AdjustTarget[]>();
  const put = (bucket: string, target: AdjustTarget): void => {
    const list = buckets.get(bucket) ?? [];
    list.push(target);
    buckets.set(bucket, list);
  };
  for (const id of cardsInPlay(game)) {
    if (identities.has(id)) continue;
    const instance = getInstance(game, id);
    if (!instance) continue;
    const categories = categoriesOf(game, id);
    const removable = !categories.includes("villain") && !categories.includes("mainScheme");
    const choices = [...playChoices(game, seat, id), ...(removable ? [discardFromPlay(id)] : [])];
    const target = cardTarget(id, choices);
    if (categories.includes("villain")) put("villain", target);
    else if (categories.includes("minion")) put("minions", target);
    else if (categories.includes("mainScheme")) put("mainScheme", target);
    else if (categories.includes("sideScheme")) put("sideSchemes", target);
    else if (instance.attachedTo !== null) put("attachments", target);
    else if (instance.controllerId !== null && getPlayer(game, instance.controllerId))
      put(`seat:${instance.controllerId}`, target);
    else put("other", target);
  }
  const take = (bucket: string): readonly AdjustTarget[] => buckets.get(bucket) ?? [];
  add("villain", "Villain", take("villain"));
  add("minions", "Minions", take("minions"));
  add("mainScheme", "Main scheme", take("mainScheme"));
  add("sideSchemes", "Side schemes", take("sideSchemes"));
  for (const player of players)
    add(`seat:${player.playerId}`, `In play: ${playerName(game, player.playerId)}`, take(`seat:${player.playerId}`));
  add("attachments", "Attachments", take("attachments"));
  add("other", "Other cards in play", take("other"));

  for (const player of seats) {
    add(
      `hand:${player.playerId}`,
      `Hand: ${playerName(game, player.playerId)}`,
      player.hand.map((id) => ({
        ...cardTarget(id, [choice(seat, { kind: "discardFromHand", instanceId: id })]),
        detail: "",
      })),
    );
  }
  return { unavailable: null, groups };
}

/** The target `id` names in a model, or null once it is gone (a card that was discarded). */
export function adjustTargetOf(model: AdjustModel, id: string | null): AdjustTarget | null {
  if (id === null) return null;
  for (const group of model.groups) for (const target of group.targets) if (target.id === id) return target;
  return null;
}
