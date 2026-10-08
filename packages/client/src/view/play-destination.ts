/**
 * Where an ally is played when the rules give a choice (MC45 p. 5: "either play that ally into their game area …, or
 * play it into the mission area"; `RuleSpec playDestination`, docs/phase7-wave8.md §3.34). `legalActions` lists the
 * in-play scenario areas a hand card may go to as `LegalAction.destinations`; `example` is the play to the player's own
 * area. This module turns that into the options to ask about, prices each through the engine (`playCostOf` with `into`,
 * since a reduction that reads the destination can make the price differ, §3.35) and re-aims the command at the one
 * picked. It decides no legality: only areas the engine listed are ever options.
 *
 * `destinationOnly` is the engine saying the player cannot pay for the play in their own area but can at the mission
 * (a reduction that applies only there): the own-area option is then not offered.
 */

import { playCostOf, type Command, type EngineDeps, type GameState, type LegalAction } from "@mc/engine";
import { cardName } from "./names.js";

/** One place the card can be played. */
export interface PlayDestinationOption {
  /** The `into` area name to send and to put in the payment context, or null for the player's own area. */
  readonly into: string | null;
  /** "Your area", "The mission". */
  readonly label: string;
  /** What the play costs there right now (`playCostOf`), or null for a card with no printed cost. */
  readonly cost: number | null;
  /** "Costs 2", "Free": the price in words, so a price that differs by destination is read, not guessed. */
  readonly costLabel: string;
}

export interface PlayDestinationChoice {
  /** The card being played. */
  readonly subject: string;
  /** "Where does Colossus go?" */
  readonly prompt: string;
  readonly options: readonly PlayDestinationOption[];
  /** More than one option: a question to ask. False when the engine left exactly one place (`destinationOnly`). */
  readonly needsChoice: boolean;
  /** The play is legal only at the listed areas, never to the player's own. */
  readonly destinationOnly: boolean;
  /** True when the options do not all cost the same, so the sheet should show each price. */
  readonly priceDiffers: boolean;
  /** "Only payable at the mission", set for `destinationOnly`; null otherwise. */
  readonly note: string | null;
}

export const OWN_AREA_LABEL = "Your area";

/** "The mission" for the area named "mission". */
export const areaLabel = (area: string): string => `The ${area}`;

const costWords = (cost: number | null): string => (cost === null ? "" : cost === 0 ? "Free" : `Costs ${cost}`);

/**
 * The destination question for a hand play, or null when the engine lists no destination (an ordinary play, nothing to
 * ask). A play listed with destinations is not necessarily a question: with `destinationOnly` and one area it is a
 * statement (`needsChoice` false) the sheet can show as the price's reason.
 */
export function playDestinationChoice(
  state: GameState,
  deps: EngineDeps,
  entry: LegalAction,
): PlayDestinationChoice | null {
  const { action, example } = entry;
  const areas = entry.destinations;
  if (action.kind !== "playCard" || example.type !== "playCard" || !areas || areas.length === 0) return null;
  const priced = (into: string | null): number | null =>
    playCostOf(state, example.playerId, action.instanceId, deps, null, into)?.current ?? null;
  const toOption = (into: string | null): PlayDestinationOption => {
    const cost = priced(into);
    return {
      into,
      label: into === null ? OWN_AREA_LABEL : areaLabel(into),
      cost,
      costLabel: costWords(cost),
    };
  };
  const destinationOnly = entry.destinationOnly === true;
  const options = [...(destinationOnly ? [] : [toOption(null)]), ...areas.map(toOption)];
  const costs = new Set(options.map((option) => option.cost));
  const subject = cardName(state, action.instanceId);
  return {
    subject,
    prompt: `Where does ${subject} go?`,
    options,
    needsChoice: options.length > 1,
    destinationOnly,
    priceDiffers: costs.size > 1,
    note: destinationOnly ? `Only payable at ${areaLabel(areas[0]!).toLowerCase()}` : null,
  };
}

/** `command` played into `into` (an area name), or into the player's own area with null. Other commands are unchanged. */
export function playInto(command: Command, into: string | null): Command {
  if (command.type !== "playCard") return command;
  if (into === null) {
    const { into: _into, ...own } = command;
    return own;
  }
  return { ...command, into: { scenarioPlayArea: into } };
}

/** The `PaymentContext` field for an option, so the payment step prices the play where it will happen. */
export const paymentIntoOf = (option: Pick<PlayDestinationOption, "into">): { readonly into?: string } =>
  option.into === null ? {} : { into: option.into };
