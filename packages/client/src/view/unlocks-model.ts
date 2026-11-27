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
  gateHintOf,
  relock,
  scenarioCycleOf,
  scenarioNameOf,
  unlockByHand,
  type UnlockCampaign,
  type UnlockHero,
  type UnlockPrefs,
  type UnlockTarget,
  type Unlocks,
  localName,
} from "../progression/unlocks.js";
import { POOL_SCENARIOS } from "../content/pool.js";
import { artLanguageNow } from "../art/art-source.js";
import { t, tPlural } from "../i18n/translate.js";
import {
  customFreeHint,
  customHeroMode,
  customNameOf,
  customScenarioMode,
  type CustomUnlockMode,
} from "../progression/custom-unlock.js";

const formatPoints = (points: number): string =>
  points.toLocaleString(artLanguageNow() === "en" ? "en-US" : artLanguageNow());

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
      title: t("unlocks.points.off"),
      detail: t("unlocks.points.offDetail"),
    };
  }
  return {
    title: t("unlocks.points.title", { points: formatPoints(total) }),
    detail: t("unlocks.points.detail", { earned: earnedLineOf(unlocks, earned), spent: formatPoints(spent) }),
  };
}

/** Where every earned point came from, so a total is never a mystery: "Earned 200: first win against Rhino (+100), …". */
function earnedLineOf(unlocks: Unlocks, earned: number): string {
  const sources = unlocks.pointsSources();
  if (sources.length === 0) return t("unlocks.points.none");
  const shown = sources.slice(0, 4).map((s) => `${s.label} (+${s.points})`);
  const more = sources.length > 4 ? t("unlocks.points.more", { count: sources.length - 4 }) : "";
  return t("unlocks.points.earned", { points: formatPoints(earned), list: shown.join(", "), more });
}

export function unlockAllRowOf(unlocks: Unlocks): UnlockAllRow {
  const detail = unlocks.devUnlockAll ? t("unlocks.all.dev") : t("unlocks.all.detail");
  return { title: t("unlocks.all.title"), detail, on: unlocks.prefs.unlockAll };
}

/** Settings ▸ Unlocks' "Official print-and-play sets" switch: its own opt-in, apart from Unlock everything. */
export function printAndPlayRowOf(unlocks: Unlocks): UnlockAllRow {
  return {
    title: t("unlocks.pnp.title"),
    detail: t("unlocks.pnp.detail"),
    on: unlocks.officialPrintAndPlay,
  };
}

/** The prefs after tapping the print-and-play switch: flips only that flag, free and immediate. */
export function printAndPlayTapOf(unlocks: Unlocks): UnlockPrefs {
  const { officialPrintAndPlay: _was, ...rest } = unlocks.prefs;
  return unlocks.officialPrintAndPlay ? rest : { ...rest, officialPrintAndPlay: true };
}

export function unlockListRowsOf(
  unlocks: Unlocks,
  heroes: readonly UnlockHero[] = UNLOCK_HEROES,
  campaigns: readonly UnlockCampaign[] = UNLOCK_CAMPAIGNS,
): UnlockListRow[] {
  const rows: UnlockListRow[] = [{ kind: "section", id: "section:campaigns", title: t("unlocks.section.campaigns") }];
  for (const campaign of campaigns) {
    const state = switchStateOf(unlocks, unlocks.campaignEarned(campaign.campaignId), (u) =>
      u.prefs.campaignIds.includes(campaign.campaignId),
    );
    const lock = unlocks.campaignHint(campaign.campaignId);
    rows.push({
      kind: "campaign",
      id: `campaign:${campaign.campaignId}`,
      target: { kind: "campaign", campaignId: campaign.campaignId },
      title: t("unlocks.campaignRow", { volume: campaign.volume, name: localName(campaign.name) }),
      detail:
        state === "earned"
          ? t("unlocks.state.earned")
          : state === "off"
            ? (lock ?? t("unlocks.state.locked"))
            : state === "on"
              ? t("unlocks.state.handCast")
              : t("unlocks.state.everything"),
      state,
    });
  }

  rows.push({
    kind: "section",
    id: "section:heroes",
    title: t("unlocks.section.waves"),
  });
  for (const status of unlocks.waves()) {
    rows.push({
      kind: "wave",
      id: `wave:${status.wave.cycleId}`,
      title: localName(status.wave.name),
      status:
        status.wave.gate === null
          ? t("unlocks.state.always")
          : status.earned
            ? t("unlocks.state.unlocked")
            : status.unlocked
              ? t("unlocks.state.setting")
              : (status.lockReasonIn(artLanguageNow()) ?? t("unlocks.state.locked")),
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
        title: t("unlocks.scenarioRow", { name: scenarioNameOf(id) }),
        detail:
          state === "always"
            ? t("unlocks.state.core")
            : state === "earned"
              ? t("unlocks.state.earned")
              : state === "off"
                ? (unlocks.scenarioLock(scenario) ?? t("unlocks.state.locked"))
                : state === "on"
                  ? t("unlocks.state.hand")
                  : t("unlocks.state.everything"),
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
      const hint = unlocks.heroHint(hero.identityCardId, artLanguageNow());
      rows.push({
        kind: "hero",
        id: `hero:${hero.identityCardId}`,
        target: { kind: "hero", identityCardId: hero.identityCardId },
        title: hero.name,
        detail:
          shownState === "always"
            ? t("unlocks.state.core")
            : shownState === "earned"
              ? `${t("unlocks.state.earned")}${hint ? ` · ${hint}` : ""}`
              : shownState === "off"
                ? (unlocks.heroLock(hero.identityCardId, artLanguageNow()) ?? t("unlocks.state.locked"))
                : shownState === "on"
                  ? t("unlocks.state.hand")
                  : unlocks.everything
                    ? t("unlocks.state.everything")
                    : t("unlocks.state.campaign"),
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
  state === "always"
    ? t("unlocks.switch.open")
    : state === "earned"
      ? t("unlocks.switch.earned")
      : state === "off"
        ? t("settings.toggleOff")
        : t("settings.toggleOn");

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
      const custom = customHeroMode(target.identityCardId);
      if (custom !== null) return customSubjectOf(unlocks, custom, customNameOf(target.identityCardId), "hero");
      const name = UNLOCK_HEROES.find((h) => h.identityCardId === target.identityCardId)?.name ?? t("unlock.thisHero");
      const hint = unlocks.heroHint(target.identityCardId, artLanguageNow());
      return {
        name,
        title: t("unlock.unlockByHand", { name }),
        free: hint ? t("unlock.freeHero", { hint: lowerFirst(hint), name }) : null,
        note: ` ${t("unlock.noteHero", { name })}`,
      };
    }
    case "campaign": {
      const campaign = UNLOCK_CAMPAIGNS.find((c) => c.campaignId === target.campaignId);
      const wave = UNLOCK_WAVES.find(
        (w) => w.campaignId === target.campaignId || w.alsoCampaignIds?.includes(target.campaignId),
      );
      const cast =
        wave && wave.campaignId === target.campaignId && wave.starterHeroIds !== "all"
          ? wave.starterHeroIds.map((id) => UNLOCK_HEROES.find((h) => h.identityCardId === id)?.name ?? id)
          : [];
      const name = campaign ? localName(campaign.name) : t("unlock.thisCampaign");
      return {
        name,
        title: t("unlock.openByHand", { name }),
        free: wave?.gate ? t("unlock.freeCampaign", { hint: lowerFirst(gateHintOf(wave.gate)) }) : null,
        note: cast.length > 0 ? ` ${t("unlock.noteCast", { cast: cast.join(t("unlock.castJoin")) })}` : "",
      };
    }
    case "scenario": {
      const custom = customScenarioMode(target.scenarioId);
      if (custom !== null) return customSubjectOf(unlocks, custom, customNameOf(target.scenarioId), "scenario");
      const name = scenarioNameOf(target.scenarioId);
      const scenario = POOL_SCENARIOS.find((sc) => (sc.id as string) === target.scenarioId);
      const cycleId = scenario ? scenarioCycleOf(scenario) : undefined;
      const lock = unlocks.waveLock(cycleId);
      const wave = UNLOCK_WAVES.find((w) => w.cycleId === cycleId);
      return {
        name,
        title: t("unlock.unlockByHand", { name }),
        free: lock ? t("unlock.freeScenario", { lock: lowerFirst(lock) }) : null,
        note: ` ${t("unlock.noteScenario", { name, wave: wave ? localName(wave.name) : t("unlock.itsWave") })}`,
      };
    }
  }
}

/** A custom pack's hero or scenario (issue #734): its own name, and the free way in when its creator chose wins. */
function customSubjectOf(
  unlocks: Unlocks,
  mode: CustomUnlockMode,
  found: string | undefined,
  kind: "hero" | "scenario",
): { name: string; title: string; free: string | null; note: string } {
  const name = found ?? t(kind === "hero" ? "unlock.thisHero" : "unlock.thisScenario");
  const hint = customFreeHint(mode, unlocks.progress.wonScenarioIds.length);
  return {
    name,
    title: t("unlock.unlockByHand", { name }),
    free: hint ? t("unlock.freeCustom", { hint, name }) : null,
    note: "",
  };
}

export function confirmOf(unlocks: Unlocks, target: UnlockTarget): UnlockConfirm {
  if (target.kind === "everything") {
    return {
      target,
      title: t("unlock.everythingTitle"),
      body: t("unlock.everythingBody"),
      affordable: true,
      confirmLabel: t("unlock.everything"),
    };
  }
  const cost = unlocks.chargesFor(target).reduce((sum, c) => sum + c.points, 0);
  const have = unlocks.points().total;
  const subject = subjectOf(unlocks, target);
  const free = subject.free ? ` ${t("unlock.orFree", { free: subject.free })}` : "";
  if (cost > have) {
    return {
      target,
      title: t("unlock.notEnough"),
      body:
        `${t("unlock.notEnoughCost", { name: subject.name, cost: formatPoints(cost), have: formatPoints(have) })} ` +
        `${t("unlock.winMore", { free })} ${t("unlock.orEverything")}`,
      affordable: false,
      confirmLabel: "",
    };
  }
  return {
    target,
    title: subject.title,
    body:
      `${t("unlock.costs", { cost: formatPoints(cost), have: formatPoints(have), left: formatPoints(have - cost) })} ` +
      t("unlock.noRefund", { free, note: subject.note }),
    affordable: true,
    confirmLabel: t("unlock.spend", { cost: formatPoints(cost) }),
  };
}

/** The one line Settings shows under "Unlocks". */
export function unlocksSummaryOf(unlocks: Unlocks): string {
  if (unlocks.everything) return t("settings.unlocks.everything");
  const total = unlocks.points().total;
  const points = tPlural("settings.unlocks.points", total, { points: formatPoints(total) });
  const waves = unlocks.waves();
  const open = waves.filter((w) => w.unlocked).length;
  const next = waves.find((w) => !w.unlocked);
  const byHand =
    unlocks.prefs.heroIds.filter((id) => !unlocks.heroEarned(id)).length +
    unlocks.prefs.campaignIds.filter((id) => !unlocks.campaignEarned(id)).length;
  const parts = [points, t("settings.unlocks.waves", { open, total: waves.length })];
  if (byHand > 0) parts.push(tPlural("settings.unlocks.byHand", byHand));
  const reason = next?.lockReasonIn(artLanguageNow());
  return `${parts.join(" · ")}.${reason ? ` ${t("settings.unlocks.next", { reason })}` : ""}`;
}
