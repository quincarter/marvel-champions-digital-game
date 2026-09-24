/**
 * Settings ▸ Unlocks: champion points, the "Unlock everything" switch, one switch per campaign, then every wave in
 * release order with what opens it and one row per hero in it. Pure, so the wording, each switch's state and what a
 * tap costs are tested without a canvas; the scene (`scenes/unlocks.ts`) only draws these rows, asks before
 * anything costs points, and saves what a tap changes.
 */
import {
  POINTS,
  UNLOCK_CAMPAIGNS,
  UNLOCK_HEROES,
  UNLOCK_WAVES,
  relock,
  unlockByHand,
  type UnlockCampaign,
  type UnlockHero,
  type UnlockPrefs,
  type UnlockTarget,
  type Unlocks,
} from "../progression/unlocks.js";

const formatPoints = (points: number): string => points.toLocaleString("en-US");
const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;

export interface UnlockHeaderRow {
  readonly title: string;
  readonly detail: string;
}

export interface UnlockAllRow {
  readonly title: string;
  readonly detail: string;
  readonly on: boolean;
}

/**
 * - `always`: a Core Set hero; the Core Set is never locked.
 * - `earned`: opened by play; there is nothing to switch.
 * - `all`: everything is unlocked, so a single switch has no effect until that's off again.
 * - `on` / `off`: the thing's own switch.
 */
export type UnlockSwitchState = "always" | "earned" | "all" | "on" | "off";

export type UnlockListRow =
  | { readonly kind: "section"; readonly id: string; readonly title: string }
  | {
      readonly kind: "wave";
      readonly id: string;
      readonly title: string;
      readonly status: string;
      readonly open: boolean;
    }
  | {
      readonly kind: "campaign" | "hero";
      readonly id: string;
      readonly target: UnlockTarget;
      readonly title: string;
      readonly detail: string;
      readonly state: UnlockSwitchState;
    };

export function pointsRowOf(unlocks: Unlocks): UnlockHeaderRow {
  const { earned, spent, total } = unlocks.points();
  return {
    title: `Champion points: ${formatPoints(total)}`,
    detail:
      `Earned ${formatPoints(earned)} · spent ${formatPoints(spent)}. A first win against a villain earns ` +
      `${POINTS.firstWin} (+${POINTS.firstExpertWin} on Expert), a campaign ${POINTS.campaign} ` +
      `(+${POINTS.expertCampaign} on Expert). Unlocking by hand costs points, and they're never refunded.`,
  };
}

export function unlockAllRowOf(unlocks: Unlocks): UnlockAllRow {
  const detail = unlocks.devUnlockAll
    ? "Open for this session by the ?unlock=all link, whatever this switch says. Nothing is charged."
    : "Every wave, hero, scenario and campaign, in any order. What you've earned stays earned.";
  return { title: "Unlock everything", detail, on: unlocks.prefs.unlockAll };
}

export function unlockListRowsOf(
  unlocks: Unlocks,
  heroes: readonly UnlockHero[] = UNLOCK_HEROES,
  campaigns: readonly UnlockCampaign[] = UNLOCK_CAMPAIGNS,
): UnlockListRow[] {
  const rows: UnlockListRow[] = [{ kind: "section", id: "section:campaigns", title: "Campaigns" }];
  for (const campaign of campaigns) {
    const state = switchStateOf(unlocks, unlocks.campaignEarned(campaign.campaignId), (u) =>
      u.prefs.campaignIds.includes(campaign.campaignId),
    );
    const lock = unlocks.waveLock(campaign.cycleId);
    rows.push({
      kind: "campaign",
      id: `campaign:${campaign.campaignId}`,
      target: { kind: "campaign", campaignId: campaign.campaignId },
      title: `Vol. ${campaign.volume} · ${campaign.name}`,
      detail:
        state === "earned"
          ? "Earned"
          : state === "off"
            ? (lock ?? "Locked")
            : state === "on"
              ? "Unlocked by hand, with its cast"
              : "Unlocked by Unlock everything",
      state,
    });
  }

  rows.push({ kind: "section", id: "section:heroes", title: "Precon heroes by wave · your own decks always play" });
  for (const status of unlocks.waves()) {
    rows.push({
      kind: "wave",
      id: `wave:${status.wave.cycleId}`,
      title: status.wave.name,
      status:
        status.wave.gate === null
          ? "Always open"
          : status.earned
            ? "Unlocked"
            : status.unlocked
              ? "Unlocked by setting"
              : (status.lockReason ?? "Locked"),
      open: status.unlocked,
    });
    for (const hero of heroes.filter((h) => h.cycleId === status.wave.cycleId)) {
      const always = status.wave.gate === null;
      // A campaign opened by hand brings its cast; that hero's own switch has nothing to add until it's closed.
      const viaCampaign =
        unlocks.heroManual(hero.identityCardId) && !unlocks.prefs.heroIds.includes(hero.identityCardId);
      const state: UnlockSwitchState = always
        ? "always"
        : switchStateOf(unlocks, unlocks.heroEarned(hero.identityCardId), (u) =>
            u.prefs.heroIds.includes(hero.identityCardId),
          );
      const shownState: UnlockSwitchState = state === "off" && viaCampaign ? "all" : state;
      const hint = unlocks.heroHint(hero.identityCardId);
      rows.push({
        kind: "hero",
        id: `hero:${hero.identityCardId}`,
        target: { kind: "hero", identityCardId: hero.identityCardId },
        title: hero.name,
        detail:
          shownState === "always"
            ? "Core Set"
            : shownState === "earned"
              ? `Earned${hint ? ` · ${hint}` : ""}`
              : shownState === "off"
                ? (unlocks.heroLock(hero.identityCardId) ?? "Locked")
                : shownState === "on"
                  ? "Unlocked by hand"
                  : unlocks.everything
                    ? "Unlocked by Unlock everything"
                    : "Comes with its campaign",
        state: shownState,
      });
    }
  }
  return rows;
}

function switchStateOf(unlocks: Unlocks, earned: boolean, byHand: (u: Unlocks) => boolean): UnlockSwitchState {
  if (earned) return "earned";
  if (unlocks.everything) return "all";
  return byHand(unlocks) ? "on" : "off";
}

/** Only a thing's own `on`/`off` switch does anything when tapped. */
export const switchToggleable = (state: UnlockSwitchState): boolean => state === "on" || state === "off";

export const switchLabel = (state: UnlockSwitchState): string =>
  state === "always" ? "OPEN" : state === "earned" ? "EARNED" : state === "off" ? "OFF" : "ON";

/** Asked before anything that costs points. */
export interface UnlockConfirm {
  readonly target: UnlockTarget;
  readonly title: string;
  readonly body: string;
  readonly confirmLabel: string;
}

/** What a tap does: saves new prefs straight away, asks first, or nothing. */
export type UnlockTap =
  | { readonly kind: "apply"; readonly prefs: UnlockPrefs }
  | { readonly kind: "confirm"; readonly confirm: UnlockConfirm }
  | null;

/**
 * Switching off is free and immediate. Switching on asks first whenever it costs points; something already paid
 * for once (switched on, off, and on again) switches straight back on.
 */
export function tapOf(unlocks: Unlocks, target: UnlockTarget, currentlyOn: boolean): UnlockTap {
  if (currentlyOn) return { kind: "apply", prefs: relock(unlocks.prefs, target) };
  const charges = unlocks.chargesFor(target);
  if (charges.length === 0) return { kind: "apply", prefs: unlockByHand(unlocks, target) };
  return { kind: "confirm", confirm: confirmOf(unlocks, target) };
}

/** A list row's tap. */
export function rowTapOf(unlocks: Unlocks, row: UnlockListRow): UnlockTap {
  if ((row.kind !== "hero" && row.kind !== "campaign") || !switchToggleable(row.state)) return null;
  return tapOf(unlocks, row.target, row.state === "on");
}

export function confirmOf(unlocks: Unlocks, target: UnlockTarget): UnlockConfirm {
  const charges = unlocks.chargesFor(target);
  const cost = charges.reduce((sum, c) => sum + c.points, 0);
  const have = unlocks.points().total;
  const price =
    `This costs ${formatPoints(cost)} champion points (you have ${formatPoints(have)}, leaving ` +
    `${formatPoints(have - cost)}). Switching it off later won't refund them.`;
  switch (target.kind) {
    case "hero": {
      const name = UNLOCK_HEROES.find((h) => h.identityCardId === target.identityCardId)?.name ?? "this hero";
      const hint = unlocks.heroHint(target.identityCardId);
      return {
        target,
        title: `Unlock ${name} by hand?`,
        body:
          `${price}${hint ? ` Or ${hint.charAt(0).toLowerCase()}${hint.slice(1)} to unlock ${name} for free, and earn points for the win.` : ""}` +
          ` This is for ${name}'s precon: a ${name} deck you import or build plays already.`,
        confirmLabel: `Spend ${formatPoints(cost)}`,
      };
    }
    case "campaign": {
      const campaign = UNLOCK_CAMPAIGNS.find((c) => c.campaignId === target.campaignId);
      const wave = UNLOCK_WAVES.find((w) => w.campaignId === target.campaignId);
      const cast =
        wave && wave.starterHeroIds !== "all"
          ? wave.starterHeroIds.map((id) => UNLOCK_HEROES.find((h) => h.identityCardId === id)?.name ?? id)
          : [];
      const hint = wave?.gate?.hint;
      return {
        target,
        title: `Open ${campaign?.name ?? "this campaign"} by hand?`,
        body:
          `${price}${cast.length > 0 ? ` Its cast (${cast.join(" and ")}) comes with it.` : ""}` +
          (hint ? ` Or ${hint.charAt(0).toLowerCase()}${hint.slice(1)} to open it for free.` : ""),
        confirmLabel: `Spend ${formatPoints(cost)}`,
      };
    }
    case "everything": {
      const heroes = charges.filter((c) => c.id.startsWith("hero:")).length;
      const campaigns = charges.filter((c) => c.id.startsWith("campaign:")).length;
      const what = [
        campaigns > 0 ? plural(campaigns, "campaign") : null,
        heroes > 0 ? plural(heroes, "hero", "heroes") : null,
      ]
        .filter((part) => part !== null)
        .join(" and ");
      return {
        target,
        title: "Unlock everything?",
        body:
          `${price} It covers ${what} you haven't earned yet. Beating villains unlocks heroes for free and ` +
          `earns ${POINTS.firstWin} points for each first win.`,
        confirmLabel: `Spend ${formatPoints(cost)}`,
      };
    }
  }
}

/** The one line Settings shows under "Unlocks". */
export function unlocksSummaryOf(unlocks: Unlocks): string {
  const points = `${formatPoints(unlocks.points().total)} champion points`;
  if (unlocks.everything) return `${points} · everything is unlocked.`;
  const waves = unlocks.waves();
  const open = waves.filter((w) => w.unlocked).length;
  const next = waves.find((w) => !w.unlocked);
  const byHand =
    unlocks.prefs.heroIds.filter((id) => !unlocks.heroEarned(id)).length +
    unlocks.prefs.campaignIds.filter((id) => !unlocks.campaignEarned(id)).length;
  const parts = [points, `${open} of ${waves.length} waves open`];
  if (byHand > 0) parts.push(`${byHand} unlocked by hand`);
  return `${parts.join(" · ")}.${next?.lockReason ? ` Next: ${next.lockReason}.` : ""}`;
}
