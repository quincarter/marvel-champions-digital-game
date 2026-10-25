/**
 * The "only one option" notice (#412, the owner's pick of a notice over asking anyway): when a "choose one" had a single
 * option left, the engine takes it without asking (RRG 1.8 "Choose (Option)", p. 12; `optionChosen.onlyOption`), and
 * the player is shown every option on the card: the one taken, and each of the others disabled with why it was not
 * offered (`unavailableOptionReasons`, from what the engine recorded). Nothing here decides anything: it reads events.
 */
import type { EngineDeps, GameEvent, GameState, PlayerId } from "@mc/engine";
import { unavailableOptionReasons } from "./ability-refusal.js";
import { cardName } from "./names.js";

export type OptionNoticeRow =
  | { readonly kind: "taken"; readonly label: string }
  | { readonly kind: "unavailable"; readonly label: string; readonly why: string };

export interface OptionNotice {
  readonly title: string;
  readonly rows: readonly OptionNoticeRow[];
}

/**
 * One notice per "choose one" in this batch of events that took its only option with the others barred, for a choice
 * `viewer` was making (every seat, when `viewer` is null: one person plays them all). In card order.
 */
export function optionNoticesOf(
  events: readonly GameEvent[],
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): OptionNotice[] {
  return events.flatMap((event): OptionNotice[] => {
    if (event.type !== "optionChosen" || !event.onlyOption || !event.unavailable) return [];
    const unavailable = event.unavailable;
    if (viewer !== null && unavailable.chooserId !== null && unavailable.chooserId !== viewer) return [];
    const placed: { readonly at: number; readonly row: OptionNoticeRow }[] = [
      { at: event.index, row: { kind: "taken", label: event.label } },
      ...unavailableOptionReasons(state, unavailable, deps).map(({ index, label, why }) => ({
        at: index,
        row: { kind: "unavailable" as const, label, why },
      })),
    ];
    const rows = placed.sort((a, b) => a.at - b.at).map(({ row }) => row);
    const source = unavailable.sourceInstanceId ? cardName(state, unavailable.sourceInstanceId) : null;
    return [{ title: source ? `${source}: only one option` : "Only one option", rows }];
  });
}
