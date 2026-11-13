/**
 * Inspect lines for wave 8's in-play state that no stat tile or counter shows: a hit point floor a rule sets
 * (`consideredRemainingHp`, §3.10), the resource icons a card is considered to have (`consideredResourceIcon`, §3.42)
 * and what being in a scenario play area such as the mission area means for a card (§3.33, MC45 p. 5). Each answer is
 * the engine's own (`hitPointFloor`, `resourceIconsInPlay`, `scenarioPlayAreaOf`); nothing here restates a rule.
 */

import {
  cardOf,
  currentName,
  getInstance,
  cardsInPlay,
  hitPointFloor,
  resourceIconsInPlay,
  scenarioPlayAreaOf,
  textBoxBlankFor,
  textBoxBlankedFor,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type ResourcePool,
  type ResourceType,
} from "@mc/engine";
import { heldByOf, tuckedCardsUnder } from "./board-model.js";
import { playerName } from "./names.js";

/**
 * "Its text box is blank for Night Thrasher only": a per-player blank (`EffectSpec blankTextBox.forPlayers`) is blank to
 * the players it names and to no one else, so the card's text still applies to the others. Null when there is none.
 */
export function perPlayerBlankNote(state: GameState, deps: EngineDeps, id: InstanceId): string | null {
  const players = textBoxBlankedFor(state, id, deps);
  if (players.length === 0) return null;
  return `Its text box is blank for ${players.map((p) => playerName(state, p)).join(" and ")} only`;
}

/** "Considered to have at least 1 hit point", or null when no rule sets a floor on this card. */
export function hitPointFloorNote(state: GameState, id: InstanceId, deps: EngineDeps): string | null {
  const floor = hitPointFloor(state, id, deps);
  if (floor === undefined) return null;
  return `Considered to have at least ${floor} hit point${floor === 1 ? "" : "s"}`;
}

const ICON_ORDER: readonly ResourceType[] = ["physical", "mental", "energy", "wild"];

/** A pool as a list of icons, a type once for each icon: `{ wild: 2 }` is `["wild", "wild"]`. */
const iconsOf = (pool: ResourcePool): readonly ResourceType[] =>
  ICON_ORDER.flatMap((type) => Array.from({ length: pool[type] }, () => type));

/**
 * "Resource icons: energy, wild (not printed: wild)": the icons a card in play has now, with the ones a rule gives it
 * set apart from the ones it prints. Null for a card that is not in play and for one with no considered icon: the
 * printed icons are already on the card.
 */
export function resourceIconNote(state: GameState, deps: EngineDeps, id: InstanceId): string | null {
  if (!cardsInPlay(state).includes(id)) return null;
  const { icons, considered } = resourceIconsInPlay(state, deps, id);
  const extra = iconsOf(considered);
  if (extra.length === 0) return null;
  return `Resource icons: ${iconsOf(icons).join(", ")} (not printed: ${extra.join(", ")})`;
}

/**
 * What being in a scenario play area means for this card: no player controls it, a closed area is not reached by
 * abilities that do not name it, and an ally there has a blank text box except for its traits; and, for any card, a
 * per-player blank on it (`perPlayerBlankNote`). Empty for a card outside every such area with no per-player blank.
 */
export function scenarioAreaNotes(state: GameState, deps: EngineDeps, id: InstanceId): readonly string[] {
  const area = scenarioPlayAreaOf(state, id);
  // A per-player blank is shown here too, wherever the card is: these are the notes the inspect sheet lists for it.
  const blankNote = perPlayerBlankNote(state, deps, id);
  if (area === null) return blankNote ? [blankNote] : [];
  const notes = [`In the ${area} area: in play, but no player controls it`];
  if (state.scenarioPlayAreas?.[area]?.closed) notes.push("Card abilities don't reach it unless they name the area");
  if (cardOf(state, id)?.type === "ally" && textBoxBlankFor(state, id, deps)) {
    notes.push("Its text box is blank, except for traits");
  }
  if (blankNote) notes.push(blankNote);
  return notes;
}

/**
 * Where this card sits relative to another, when that is not a play area: the cards tucked under it (a facedown one is
 * only counted, never named), the card it is tucked under, the card that holds it (a held minion, a captive ally) and,
 * for an attachment sent to another host in the villain's place, whose "the villain" it now means. The cards attached
 * to it and the one it is attached to are `attachedLinks`, which the sheet draws as links. Empty for a card with none
 * of these.
 */
export function placementNotes(state: GameState, id: InstanceId): readonly string[] {
  const notes: string[] = [];
  const under = tuckedCardsUnder(state, id);
  if (under.length > 0) notes.push(`Under it: ${under.map((card) => card.name).join(", ")}`);
  const host = Object.values(state.instances).find((instance) => instance.tucked.includes(id));
  if (host) {
    const name = currentName(state, host.instanceId) ?? cardOf(state, host.instanceId)?.name ?? "a card";
    notes.push(`Tucked under ${name}: not in play`);
  }
  // A hero from the collection in play as a minion (Reluctant Foe): the card is a hero, the table plays it as an enemy.
  const treated = getInstance(state, id)?.treatedAs;
  if (treated?.kind === "minion" && cardOf(state, id)?.type === "hero_identity") {
    const by = currentName(state, treated.source) ?? cardOf(state, treated.source)?.name ?? "a card";
    notes.push(`Treated as a minion by ${by}: no player controls it, and its printed text does not apply`);
  }
  const held = heldByOf(state, id);
  if (held?.kind === "held") notes.push(`Held by ${held.hostName}: in play, engaged with no player, does not activate`);
  if (held?.kind === "captive") notes.push(`Held by ${held.hostName}: under no player's control`);
  const instance = getInstance(state, id);
  // "Text on that card that refers to 'the villain' refers to [its host] instead" (`CardInstance.villainAlias`).
  if (instance?.villainAlias) {
    const alias = nameOf(state, instance.villainAlias);
    notes.push(`Sent to ${alias} instead of the villain: "the villain" in its text means ${alias}`);
  }
  return notes;
}

/** A card the sheet can open from another: the host of an attachment, or one of the attachments on a host. */
export interface CardLink {
  readonly instanceId: InstanceId;
  readonly name: string;
}

/** What hangs on this card, and the card this one hangs on: the sheet lists each as a link that opens it. */
export interface AttachedLinks {
  /** The card this one is attached to, when it is an attachment (a held minion or captive ally has its own note). */
  readonly host: CardLink | null;
  readonly attachments: readonly CardLink[];
}

/** The links for `id`, or null for a card with no attachments that is attached to nothing. */
export function attachedLinks(state: GameState, id: InstanceId): AttachedLinks | null {
  const hostId = getInstance(state, id)?.attachedTo ?? null;
  const host = hostId !== null && !heldByOf(state, id) ? { instanceId: hostId, name: nameOf(state, hostId) } : null;
  const attachments = attachmentsOf(state, id).map(({ id: attachmentId, name }) => ({
    instanceId: attachmentId,
    name,
  }));
  return host || attachments.length > 0 ? { host, attachments } : null;
}

const nameOf = (state: GameState, id: InstanceId): string =>
  currentName(state, id) ?? cardOf(state, id)?.name ?? "a card";

/** The faceup cards attached to this one, in the order they were attached (a facedown one is only counted by the tile). */
function attachmentsOf(
  state: GameState,
  id: InstanceId,
): readonly { readonly id: InstanceId; readonly name: string }[] {
  return (getInstance(state, id)?.attachments ?? []).flatMap((attachment) =>
    getInstance(state, attachment)?.faceup === false ? [] : [{ id: attachment, name: nameOf(state, attachment) }],
  );
}

/**
 * The cards the sheet steps through (◂ ▸) when it is opened on a card with others under it or attached to it, or on one
 * of those: the host first, then what is tucked under it in order, then what is attached to it. Empty for a card in no
 * such role.
 */
export function tuckedSiblings(state: GameState, id: InstanceId): readonly InstanceId[] {
  const own = getInstance(state, id)?.tucked ?? [];
  const attached = attachmentsOf(state, id).map((card) => card.id);
  if (own.length > 0 || attached.length > 0) return [id, ...own, ...attached];
  const instance = getInstance(state, id);
  const host = Object.values(state.instances).find((candidate) => candidate.tucked.includes(id));
  if (host) return [host.instanceId, ...host.tucked, ...attachmentsOf(state, host.instanceId).map((card) => card.id)];
  const owner = instance?.attachedTo ? getInstance(state, instance.attachedTo) : undefined;
  if (owner) {
    return [owner.instanceId, ...owner.tucked, ...attachmentsOf(state, owner.instanceId).map((card) => card.id)];
  }
  return [];
}
