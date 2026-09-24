/**
 * Settings ▸ Unlocks: champion points, the "Unlock everything" switch, one switch per campaign, then every wave in
 * release order with what opens it and one row per scenario and hero in it. Pure, so the wording, each switch's state and what a
 * tap costs are tested without a canvas; the scene (`scenes/unlocks.ts`) only draws these rows, asks before
 * anything costs points, and saves what a tap changes.
 */
import {
  UNLOCK_CAMPAIGNS,
  UNLOCK_HEROES,
  UNLOCK_WAVES,
  relock,
  scenarioCycleOf,
  scenarioNameOf,
  unlockByHand,
  type UnlockCampaign,
  type UnlockHero,
  type UnlockPrefs,
  type UnlockTarget,
  type Unlocks,
} from "../progression/unlocks.js";
import { POOL_SCENARIOS } from "../content/pool.js";

const formatPoints = (points: number): string => points.toLocaleString("en-US");

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
      readonly kind: "campaign" | "scenario" | "hero";
      readonly id: string;
      readonly target: UnlockTarget;
      readonly title: string;
      readonly detail: string;
      readonly state: UnlockSwitchState;
    };

export function pointsRowOf(unlocks: Unlocks): UnlockHeaderRow {
  const { earned, spent, total } = unlocks.points();
  if (unlocks.everything) {
    return {
      title: "Champion points: off",
      detail:
        "Unlock everything is on, so everything is open for free. Switch it off to earn and spend points again; " +
        "what you've earned is kept. A feature of this app, not a card-game rule; see How it works.",
    };
  }
  return {
    title: `Champion points: ${formatPoints(total)}`,
    detail: `${earnedLineOf(unlocks, earned)} Spent ${formatPoints(spent)}. A feature of this app, not a card-game rule; see How it works.`,
  };
}

/** Where every earned point came from, so a total is never a mystery: "Earned 200: first win against Rhino (+100), …". */
function earnedLineOf(unlocks: Unlocks, earned: number): string {
  const sources = unlocks.pointsSources();
  if (sources.length === 0) return "No points yet: you earn them by winning.";
  const shown = sources.slice(0, 4).map((s) => `${s.label} (+${s.points})`);
  const more = sources.length > 4 ? `, and ${sources.length - 4} more` : "";
  return `Earned ${formatPoints(earned)}: ${shown.join(", ")}${more}.`;
}

export function unlockAllRowOf(unlocks: Unlocks): UnlockAllRow {
  const detail = unlocks.devUnlockAll
    ? "Open for this session by the ?unlock=all link, whatever this switch says. Nothing is charged."
    : "Free: every wave, hero, scenario and campaign, in any order, with champion points switched off. What you've earned stays earned.";
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

  rows.push({
    kind: "section",
    id: "section:heroes",
    title: "By wave · scenarios and precon heroes · your own decks always play",
  });
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
    for (const scenario of POOL_SCENARIOS.filter((sc) => scenarioCycleOf(sc) === status.wave.cycleId)) {
      const id = scenario.id as string;
      const always = status.wave.gate === null;
      const state: UnlockSwitchState = always
        ? "always"
        : switchStateOf(unlocks, unlocks.scenarioEarned(id), (u) => u.prefs.scenarioIds.includes(id));
      rows.push({
        kind: "scenario",
        id: `scenario:${id}`,
        target: { kind: "scenario", scenarioId: id },
        title: `Scenario · ${scenarioNameOf(id)}`,
        detail:
          state === "always"
            ? "Core Set"
            : state === "earned"
              ? "Earned"
              : state === "off"
                ? (unlocks.scenarioLock(scenario) ?? "Locked")
                : state === "on"
                  ? "Unlocked by hand"
                  : "Unlocked by Unlock everything",
        state,
      });
    }
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

/** Asked before anything is unlocked by hand: what it costs, or that it can't be afforded yet. */
export interface UnlockConfirm {
  readonly target: UnlockTarget;
  readonly title: string;
  readonly body: string;
  /** False when the player hasn't earned enough points: the confirm offers only "Keep playing". */
  readonly affordable: boolean;
  /** The confirm button's label. Empty when `affordable` is false. */
  readonly confirmLabel: string;
}

/** What a tap does: saves new prefs straight away, asks first, or nothing. */
export type UnlockTap =
  | { readonly kind: "apply"; readonly prefs: UnlockPrefs }
  | { readonly kind: "confirm"; readonly confirm: UnlockConfirm }
  | null;

/**
 * Switching off is free and immediate. Switching on asks first whenever it costs points, and always for Unlock
 * everything, which is free but switches points off; something already paid for once switches straight back on.
 */
export function tapOf(unlocks: Unlocks, target: UnlockTarget, currentlyOn: boolean): UnlockTap {
  if (currentlyOn) return { kind: "apply", prefs: relock(unlocks.prefs, target) };
  const charges = unlocks.chargesFor(target);
  if (charges.length === 0 && target.kind !== "everything")
    return { kind: "apply", prefs: unlockByHand(unlocks, target) };
  return { kind: "confirm", confirm: confirmOf(unlocks, target) };
}

/** A list row's tap. */
export function rowTapOf(unlocks: Unlocks, row: UnlockListRow): UnlockTap {
  if ((row.kind !== "hero" && row.kind !== "campaign" && row.kind !== "scenario") || !switchToggleable(row.state))
    return null;
  return tapOf(unlocks, row.target, row.state === "on");
}

const lowerFirst = (text: string): string => `${text.charAt(0).toLowerCase()}${text.slice(1)}`;

/** The name and the free way in, for each kind of thing that can be bought. */
function subjectOf(
  unlocks: Unlocks,
  target: Exclude<UnlockTarget, { kind: "everything" }>,
): { name: string; title: string; free: string | null; note: string } {
  switch (target.kind) {
    case "hero": {
      const name = UNLOCK_HEROES.find((h) => h.identityCardId === target.identityCardId)?.name ?? "this hero";
      const hint = unlocks.heroHint(target.identityCardId);
      return {
        name,
        title: `Unlock ${name} by hand?`,
        free: hint ? `${lowerFirst(hint)} to unlock ${name} for free, and earn points for the win` : null,
        note: ` This is for ${name}'s precon: a ${name} deck you import or build plays already.`,
      };
    }
    case "campaign": {
      const campaign = UNLOCK_CAMPAIGNS.find((c) => c.campaignId === target.campaignId);
      const wave = UNLOCK_WAVES.find((w) => w.campaignId === target.campaignId);
      const cast =
        wave && wave.starterHeroIds !== "all"
          ? wave.starterHeroIds.map((id) => UNLOCK_HEROES.find((h) => h.identityCardId === id)?.name ?? id)
          : [];
      const name = campaign?.name ?? "this campaign";
      return {
        name,
        title: `Open ${name} by hand?`,
        free: wave?.gate ? `${lowerFirst(wave.gate.hint)} to open it for free` : null,
        note: cast.length > 0 ? ` Its cast (${cast.join(" and ")}) comes with it.` : "",
      };
    }
    case "scenario": {
      const name = scenarioNameOf(target.scenarioId);
      const scenario = POOL_SCENARIOS.find((sc) => (sc.id as string) === target.scenarioId);
      const cycleId = scenario ? scenarioCycleOf(scenario) : undefined;
      const lock = unlocks.waveLock(cycleId);
      const wave = UNLOCK_WAVES.find((w) => w.cycleId === cycleId);
      return {
        name,
        title: `Unlock ${name} by hand?`,
        free: lock ? `${lowerFirst(lock)}, for free` : null,
        note: ` This opens ${name} on its own, not the rest of ${wave?.name ?? "its wave"}.`,
      };
    }
  }
}

export function confirmOf(unlocks: Unlocks, target: UnlockTarget): UnlockConfirm {
  if (target.kind === "everything") {
    return {
      target,
      title: "Unlock everything for free?",
      body:
        "Every wave, hero, scenario and campaign opens, and nothing is charged. Champion points switch off " +
        "while it's on. Switch it off in Settings ▸ Unlocks to go back to earning and spending them; what you've " +
        "earned stays earned.",
      affordable: true,
      confirmLabel: "Unlock everything",
    };
  }
  const cost = unlocks.chargesFor(target).reduce((sum, c) => sum + c.points, 0);
  const have = unlocks.points().total;
  const subject = subjectOf(unlocks, target);
  const free = subject.free ? ` Or ${subject.free}.` : "";
  if (cost > have) {
    return {
      target,
      title: "Not enough champion points",
      body:
        `Unlocking ${subject.name} costs ${formatPoints(cost)} points, and you have ${formatPoints(have)}. ` +
        `Win games to earn more.${free} Or turn on Unlock everything in Settings ▸ Unlocks to open everything ` +
        "for free, with points off.",
      affordable: false,
      confirmLabel: "",
    };
  }
  return {
    target,
    title: subject.title,
    body:
      `This costs ${formatPoints(cost)} of your ${formatPoints(have)} champion points, leaving ` +
      `${formatPoints(have - cost)}. Switching it off later won't refund them.${free}${subject.note}`,
    affordable: true,
    confirmLabel: `Spend ${formatPoints(cost)}`,
  };
}

/** The one line Settings shows under "Unlocks". */
export function unlocksSummaryOf(unlocks: Unlocks): string {
  if (unlocks.everything) return "Unlock everything is on: everything is open, and champion points are off.";
  const points = `${formatPoints(unlocks.points().total)} champion points`;
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
