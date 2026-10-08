/**
 * The optional setup choices Table setup offers for the scenario in the draft (docs/phase7-wave8.md section 4.1 Q1,
 * Q9, Q10, Q12): which Standard and Expert encounter set to use, threat on Gene Pool, a side per Horseman, and the
 * easier Apocalypse start.
 *
 * **The client never decides what is offered.** `playableScenarioOffer` (`@mc/cards`) does, and is asked again after
 * every change that can alter the answer (`offerOf`): the difficulty, the modular picks. This module turns the offer
 * and the draft into plain rows a scene draws (`setupOptionRowsOf`) and applies one control's action to the draft
 * (`applySetupOption`), refusing an action the offer does not list. `reconcileWithOffer` drops a stored choice that no
 * longer applies, which is how a changed difficulty or modular pick clears a Gene Pool amount or an Expert set.
 *
 * Every control is an action string (`standardSet:standard_iii`, `genePool:up`, `horseman:2:B`, `easierStart:toggle`):
 * the scene hands the string back and never interprets it, and the focus order lists the same strings.
 */
import { playableScenarioOffer, type HorsemanSide, type PlayableScenarioOffer } from "@mc/cards";
import { encounterSetId, type DifficultySetChoice } from "@mc/content";
import type { SetupDraft } from "./setup-draft.js";

/** What every scenario offers when it is not in the playable pool (a draft naming it never builds). */
const NO_OFFER: PlayableScenarioOffer = {
  difficultySets: { standard: [], expert: [] },
  horsemanSides: null,
  easierStart: false,
  genePoolThreat: null,
};

/** The offer for the draft's scenario under its difficulty and modular picks; nothing is offered for an unknown id. */
export function offerOf(draft: SetupDraft): PlayableScenarioOffer {
  try {
    return playableScenarioOffer(draft.scenarioId, {
      difficulty: draft.difficulty,
      ...(draft.modularSetIds ? { modularSetIds: draft.modularSetIds } : {}),
    });
  } catch {
    return NO_OFFER;
  }
}

/** The Expert set only matters when the game is played on expert. */
const expertSetApplies = (draft: SetupDraft): boolean => draft.difficulty === "expert";

/** The sides the four Horsemen play: the player's own, else the difficulty's default. */
export function effectiveHorsemanSides(draft: SetupDraft, offer: PlayableScenarioOffer): readonly HorsemanSide[] {
  return draft.horsemanSides ?? offer.horsemanSides?.defaultSides ?? [];
}

/**
 * `draft` with every setup choice the offer no longer lists put back to its default: a Standard or Expert set outside
 * the alternatives, an Expert set off expert, a Gene Pool amount without the Infinites set, Horseman sides away from
 * the Four Horsemen, the easier start off standard.
 */
export function reconcileWithOffer(draft: SetupDraft, offer: PlayableScenarioOffer = offerOf(draft)): SetupDraft {
  const chosen = draft.difficultySets;
  let difficultySets: DifficultySetChoice | null = null;
  if (chosen) {
    const standard =
      chosen.standard !== undefined && offer.difficultySets.standard.includes(chosen.standard as string)
        ? chosen.standard
        : undefined;
    const expert =
      chosen.expert !== undefined &&
      expertSetApplies(draft) &&
      offer.difficultySets.expert.includes(chosen.expert as string)
        ? chosen.expert
        : undefined;
    if (standard !== undefined || expert !== undefined)
      difficultySets = { ...(standard !== undefined ? { standard } : {}), ...(expert !== undefined ? { expert } : {}) };
  }
  const genePool = offer.genePoolThreat;
  return {
    ...draft,
    difficultySets,
    genePoolThreatPerPlayer: genePool ? Math.min(Math.max(0, draft.genePoolThreatPerPlayer), genePool.max) : 0,
    horsemanSides: offer.horsemanSides ? draft.horsemanSides : null,
    easierStart: offer.easierStart ? draft.easierStart : false,
  };
}

/** One button inside an option row. */
export interface OptionChip {
  /** What `applySetupOption` takes. */
  readonly action: string;
  readonly label: string;
  readonly selected: boolean;
  readonly enabled: boolean;
}

export interface OptionGroup {
  /** The small label above the chips (a Horseman's name), or null for a row whose name says it all. */
  readonly label: string | null;
  readonly chips: readonly OptionChip[];
}

export type OptionControl =
  /** Segmented chips: one group (a set choice) or several (one per Horseman). */
  | { readonly kind: "groups"; readonly groups: readonly OptionGroup[] }
  /** The whole card is the button. */
  | { readonly kind: "toggle"; readonly action: string }
  /** A minus, the value and a plus. */
  | { readonly kind: "stepper"; readonly down: OptionChip; readonly up: OptionChip; readonly valueLabel: string };

export interface SetupOptionRow {
  readonly id: "standardSet" | "expertSet" | "genePool" | "horsemanSides" | "easierStart";
  /** The card's name: a few words. */
  readonly name: string;
  /** One short line of state under the name; empty when the name and the chips say it all. */
  readonly meta: string;
  /** How many of the grid's two columns the card takes. */
  readonly span: 1 | 2;
  /** The card is showing a choice other than the default (red frame). */
  readonly active: boolean;
  /** Longer than a label: for Inspect or a help line, never drawn in the card. */
  readonly help: string;
  readonly control: OptionControl;
}

/** The label of a Standard or Expert alternative on a chip: the numeral after the classification ("Standard II" is "II"). */
export function setChipLabel(setName: string): string {
  const numeral = setName.replace(/^(standard|expert)\s*/i, "").trim();
  return numeral.length > 0 ? numeral : "I";
}

const DEFAULT_SET = "default";

/**
 * Every option card the draft's scenario offers, in the order they are drawn. `setNames` maps an encounter set id to
 * its printed name (the pool's `POOL_ENCOUNTER_SETS`).
 */
export function setupOptionRowsOf(
  draft: SetupDraft,
  setNames: ReadonlyMap<string, string>,
  offer: PlayableScenarioOffer = offerOf(draft),
): readonly SetupOptionRow[] {
  const rows: SetupOptionRow[] = [];

  const setRow = (
    kind: "standard" | "expert",
    alternatives: readonly string[],
    chosen: string | undefined,
  ): SetupOptionRow => {
    const chip = (id: string, label: string): OptionChip => ({
      action: `${kind}Set:${id}`,
      label,
      selected: id === DEFAULT_SET ? chosen === undefined : chosen === id,
      enabled: true,
    });
    return {
      id: kind === "standard" ? "standardSet" : "expertSet",
      name: kind === "standard" ? "Standard set" : "Expert set",
      meta: "",
      span: 1,
      active: chosen !== undefined,
      help:
        kind === "standard"
          ? "Standard II or III may replace the Standard encounter set (The Hood insert, Alternative Sets)."
          : "Expert II may replace the Expert encounter set (The Hood insert, Alternative Sets).",
      control: {
        kind: "groups",
        groups: [
          {
            label: null,
            chips: [
              chip(DEFAULT_SET, "I"),
              ...alternatives.map((id) => chip(id, setChipLabel(setNames.get(id) ?? id))),
            ],
          },
        ],
      },
    };
  };
  if (offer.difficultySets.standard.length > 0)
    rows.push(setRow("standard", offer.difficultySets.standard, draft.difficultySets?.standard as string | undefined));
  if (expertSetApplies(draft) && offer.difficultySets.expert.length > 0)
    rows.push(setRow("expert", offer.difficultySets.expert, draft.difficultySets?.expert as string | undefined));

  const genePool = offer.genePoolThreat;
  if (genePool) {
    const value = draft.genePoolThreatPerPlayer;
    rows.push({
      id: "genePool",
      name: "Gene Pool threat",
      meta: value > 0 ? `${value} per player` : "Off",
      span: 1,
      active: value > 0,
      help: `Infinites, Modular Difficulty: place 0 to ${genePool.max} threat per player on Gene Pool. The rulebook suggests ${genePool.recommended} for this difficulty.`,
      control: {
        kind: "stepper",
        down: { action: "genePool:down", label: "−", selected: false, enabled: value > 0 },
        up: { action: "genePool:up", label: "+", selected: false, enabled: value < genePool.max },
        valueLabel: value > 0 ? String(value) : "Off",
      },
    });
  }

  if (offer.horsemanSides) {
    const sides = effectiveHorsemanSides(draft, offer);
    rows.push({
      id: "horsemanSides",
      name: "Horsemen's sides",
      meta: "",
      span: 2,
      active: draft.horsemanSides !== null,
      help: "Each Horseman plays side A (standard) or side B (expert). The sides follow the difficulty until you change one.",
      control: {
        kind: "groups",
        groups: offer.horsemanSides.villainNames.map((name, index) => ({
          label: name,
          chips: (["A", "B"] as const).map((side) => ({
            action: `horseman:${index}:${side}`,
            label: side,
            selected: sides[index] === side,
            enabled: true,
          })),
        })),
      },
    });
  }

  if (offer.easierStart) {
    rows.push({
      id: "easierStart",
      name: "Easier start: begin at Apocalypse (I)",
      meta: draft.easierStart ? "On · begins at stage I" : "Off · begins at stage II",
      span: 2,
      active: draft.easierStart,
      help: "Apocalypse begins at stage I instead of II: more hit points to start, a gentler first turn (standard mode only).",
      control: { kind: "toggle", action: "easierStart:toggle" },
    });
  }
  return rows;
}

/** Every action the rows list, in draw order: the focus order's option stops. */
export function optionActionsOf(rows: readonly SetupOptionRow[]): readonly string[] {
  return rows.flatMap((row) =>
    row.control.kind === "groups"
      ? row.control.groups.flatMap((group) => group.chips.map((chip) => chip.action))
      : row.control.kind === "toggle"
        ? [row.control.action]
        : [row.control.down.action, row.control.up.action],
  );
}

/**
 * Applies one control's action to the draft. An action the offer does not list (a stale tap after the difficulty
 * changed) leaves the draft as it was.
 */
export function applySetupOption(draft: SetupDraft, action: string): SetupDraft {
  const offer = offerOf(draft);
  const [kind, first, second] = action.split(":");

  if (kind === "standardSet" || kind === "expertSet") {
    const which = kind === "standardSet" ? "standard" : "expert";
    const listed = offer.difficultySets[which];
    if (first !== DEFAULT_SET && !listed.includes(first ?? "")) return draft;
    if (which === "expert" && !expertSetApplies(draft)) return draft;
    const next = { ...draft.difficultySets };
    if (first === DEFAULT_SET) delete next[which];
    else next[which] = encounterSetId(first!);
    return { ...draft, difficultySets: next.standard || next.expert ? next : null };
  }

  if (kind === "genePool") {
    const offered = offer.genePoolThreat;
    if (!offered) return draft;
    const value = draft.genePoolThreatPerPlayer;
    // Turned on, it starts at the rulebook's amount for the difficulty (at least 1); stepping down to 0 turns it off.
    const next = first === "up" ? (value === 0 ? Math.max(1, offered.recommended) : value + 1) : value - 1;
    return { ...draft, genePoolThreatPerPlayer: Math.min(Math.max(0, next), offered.max) };
  }

  if (kind === "horseman") {
    if (!offer.horsemanSides) return draft;
    const index = Number(first);
    if ((second !== "A" && second !== "B") || !Number.isInteger(index)) return draft;
    const sides = [...effectiveHorsemanSides(draft, offer)];
    if (index < 0 || index >= sides.length) return draft;
    sides[index] = second;
    return { ...draft, horsemanSides: sides };
  }

  if (kind === "easierStart") {
    return offer.easierStart ? { ...draft, easierStart: !draft.easierStart } : draft;
  }
  return draft;
}
