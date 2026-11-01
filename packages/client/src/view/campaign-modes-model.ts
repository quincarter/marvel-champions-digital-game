/**
 * The Briefing's mode choice for one campaign issue: "players can choose which other mode(s) they wish to play for each
 * individual scenario" (RRG 1.8 "Campaign Mode", p. 29; FAQ p. 61), Expert, Heroic and Skirmish in any combination.
 *
 * **Where the choice lives.** On the stored record as `CampaignRecord.issueModes`: `CampaignService.compose` joins it to
 * the campaign's own modes, so the attempt carries them and the issue's `whenModes` gates and its villain stages read
 * them like any other mode. Changing it composes the issue again. It is dropped when the game is folded, so every issue,
 * and a retry after a loss (issue #611 question 4), starts from standard and may be chosen anew.
 */
import { playableScenarioOffer, type SkirmishOffer } from "@mc/cards";
import type { IssueModes } from "../engine/campaign-storage.js";
import { applyPlayModeOption, modesOfChoice, playModeRows, reconcileSkirmish } from "./play-mode-options.js";
import type { OptionChip, SetupOptionRow } from "./setup-options.js";

/** One row of the Briefing's mode section: a name, its line of state, and the row's chips. */
export interface IssueModeRow {
  readonly id: string;
  readonly name: string;
  readonly meta: string;
  readonly chips: readonly OptionChip[];
}

function skirmishOfferFor(scenarioId: string, modes: IssueModes): SkirmishOffer | null {
  try {
    return playableScenarioOffer(scenarioId, { modes }).skirmish;
  } catch {
    return null;
  }
}

const chipsOf = (row: SetupOptionRow): readonly OptionChip[] => {
  const { control } = row;
  if (control.kind === "groups") return control.groups.flatMap((group) => group.chips);
  if (control.kind === "stepper")
    return [control.down, { action: "", label: control.valueLabel, selected: false, enabled: false }, control.up];
  const on = row.active;
  return [
    { action: on ? control.action : "", label: "Off", selected: !on, enabled: on },
    { action: on ? "" : control.action, label: "On", selected: on, enabled: !on },
  ];
};

/** The Standard/Expert chips, then Heroic, then Skirmish where the scenario offers it. */
export function issueModeRowsOf(scenarioId: string, modes: IssueModes): readonly IssueModeRow[] {
  const expert = modes.expert === true;
  const rows = playModeRows(
    { heroicLevel: modes.heroic ?? 0, skirmish: modes.skirmish ?? null },
    skirmishOfferFor(scenarioId, modes),
  );
  return [
    {
      id: "expert",
      name: "Difficulty",
      meta: expert ? "Expert set added" : "Standard set only",
      chips: [
        { action: "expert:off", label: "Standard", selected: !expert, enabled: true },
        { action: "expert:on", label: "Expert", selected: expert, enabled: true },
      ],
    },
    ...rows.map((row) => ({ id: row.id, name: row.name, meta: row.meta, chips: chipsOf(row) })),
  ];
}

/** Applies one chip's action; a skirmish version the new difficulty does not use moves to the first one it does. */
export function applyIssueMode(scenarioId: string, modes: IssueModes, action: string): IssueModes {
  const offer = skirmishOfferFor(scenarioId, modes);
  if (action === "expert:on" || action === "expert:off") {
    const next: IssueModes = { ...withoutExpert(modes), ...(action === "expert:on" ? { expert: true as const } : {}) };
    const skirmish = reconcileSkirmish(next.skirmish, skirmishOfferFor(scenarioId, next));
    const { skirmish: _old, ...rest } = next;
    return { ...rest, ...(skirmish ? { skirmish } : {}) };
  }
  const choice = applyPlayModeOption(
    { heroicLevel: modes.heroic ?? 0, skirmish: modes.skirmish ?? null },
    action,
    offer,
  );
  return { ...(modes.expert ? { expert: true as const } : {}), ...modesOfChoice(choice) };
}

function withoutExpert(modes: IssueModes): IssueModes {
  const { expert: _expert, ...rest } = modes;
  return rest;
}
