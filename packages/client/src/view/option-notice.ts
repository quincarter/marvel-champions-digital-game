/**
 * The "only one option" notice (#412, the owner's pick of a notice over asking anyway): when a "choose one" had a single
 * option left, the engine takes it without asking (RRG 1.8 "Choose (Option)", p. 12; `optionChosen.onlyOption`), and
 * the player is shown every option on the card: the one taken, and each of the others disabled with why it was not
 * offered (`unavailableOptionReasons`, from what the engine recorded). Nothing here decides anything: it reads events.
 */
import type { EngineDeps, GameEvent, GameState, PlayerId } from "@mc/engine";
import { t } from "../i18n/translate.js";
import { abilityNameOf, unavailableOptionReasons, unofferedReason } from "./ability-refusal.js";
import { cardName } from "./names.js";

export type OptionNoticeRow =
  | { readonly kind: "taken"; readonly label: string }
  | { readonly kind: "unavailable"; readonly label: string; readonly why: string };

export interface OptionNotice {
  readonly title: string;
  /** The line under the title; the overlay's own "only one option" line when absent. */
  readonly lead?: string;
  /** The dismiss button's label on the last notice, when not "OK" (a translated notice). */
  readonly okLabel?: string;
  /** Offers "Don't show again", which turns these notices off (`Settings.notOfferedNotices`): an ability not offered. */
  readonly optOut?: true;
  /**
   * One more action beside OK, run after the notice is dismissed (the "Room closed" notice's "Continue in single
   * player"). It takes the place of "Don't show again", so a notice offers one or the other.
   */
  readonly action?: { readonly label: string; readonly run: () => void };
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
    return [{ title: source ? t("notice.onlyOne.titleFor", { card: source }) : t("notice.onlyOne.title"), rows }];
  });
}

/**
 * One notice per optional interrupt or response in this batch of events that answered what happened but was not
 * offered (`abilityNotOffered`, #431: Iron Lad attacks with no other ready Avenger ally), for `viewer`'s cards (every
 * seat when null), each with a `key` (card and ability) so a caller can show one only the first time. The log says it
 * every time.
 */
export function unofferedNoticesOf(
  events: readonly GameEvent[],
  state: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): { readonly key: string; readonly notice: OptionNotice }[] {
  const seen = new Set<string>();
  return events.flatMap((event) => {
    if (event.type !== "abilityNotOffered") return [];
    if (viewer !== null && event.playerId !== viewer) return [];
    const key = `${event.instanceId}:${event.abilityId}`;
    if (seen.has(key)) return [];
    seen.add(key);
    const name = cardName(state, event.instanceId);
    const printed = abilityNameOf(state, event.instanceId, event.abilityId);
    const timing = t(event.timing === "interrupt" ? "notice.timing.interrupt" : "notice.timing.response");
    const label = printed === "This ability" ? t("notice.notOffered.label", { name, timing }) : printed;
    const why = unofferedReason(state, event.instanceId, event.playerId, event.abilityId, event.reason, deps);
    const notice: OptionNotice = {
      title: t("notice.notOffered.title", { name, timing }),
      lead: t("notice.notOffered.lead"),
      rows: [{ kind: "unavailable", label, why }],
      optOut: true,
    };
    return [{ key, notice }];
  });
}
