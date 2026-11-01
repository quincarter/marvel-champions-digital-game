/**
 * The Heroic level and Skirmish controls (RRG 1.8 "Modes of Play", p. 29; issue #611), shared by Table setup and the
 * campaign Briefing: the same rows, the same action strings, the same offer from `@mc/cards` (`skirmishOffer`).
 *
 * Both modes are chosen for one game and combine with Expert and each other, so they are controls of their own beside
 * the Standard/Expert choice, not more cards in that one-of-many row.
 */
import type { SkirmishOffer } from "@mc/cards";
import { HEROIC_LEVEL_MAX, type PlayModes } from "@mc/content";
import type { SetupOptionRow } from "./setup-options.js";

/** The two modes as a draft or a campaign record holds them. `undefined` and `null` skirmish are both off. */
export interface ModeChoice {
  readonly heroicLevel?: number;
  readonly skirmish?: NonNullable<PlayModes["skirmish"]> | null;
}

const ROMAN = ["0", "I", "II", "III", "IV", "V"] as const;
const romanOf = (stage: string): string => ROMAN[Number(stage)] ?? stage;

/** The modes fields a choice adds to a `PlayModes`: nothing when both are off. */
export function modesOfChoice(choice: ModeChoice): Pick<PlayModes, "heroic" | "skirmish"> {
  return {
    ...(choice.heroicLevel ? { heroic: choice.heroicLevel } : {}),
    ...(choice.skirmish ? { skirmish: choice.skirmish } : {}),
  };
}

/** A skirmish choice the offer still allows: off where it has none, the first version where the chosen one left. */
export function reconcileSkirmish(
  skirmish: ModeChoice["skirmish"],
  offer: SkirmishOffer | null,
): NonNullable<ModeChoice["skirmish"]> | null {
  if (!skirmish || !offer) return null;
  if (offer.printed) return {};
  const version = skirmish.villainVersion;
  return { villainVersion: version !== undefined && offer.versions.includes(version) ? version : offer.versions[0]! };
}

function heroicRow(level: number): SetupOptionRow {
  return {
    id: "heroic",
    name: "Heroic level",
    meta: level > 0 ? `${level} extra encounter card${level === 1 ? "" : "s"} each` : "Off",
    span: 1,
    active: level > 0,
    help: "Heroic mode: X extra encounter cards to each player in every villain phase. It does not add the Expert set.",
    control: {
      kind: "stepper",
      down: { action: "heroic:down", label: "−", selected: false, enabled: level > 0 },
      up: { action: "heroic:up", label: "+", selected: false, enabled: level < HEROIC_LEVEL_MAX },
      valueLabel: level > 0 ? String(level) : "Off",
    },
  };
}

function skirmishRow(skirmish: ModeChoice["skirmish"], offer: SkirmishOffer): SetupOptionRow {
  const help = "Skirmish mode shortens the game: play one version of the villain and remove the others.";
  if (offer.printed)
    return {
      id: "skirmish",
      name: "Skirmish",
      meta: skirmish ? "On · the scenario's own skirmish rule" : "Off",
      span: 1,
      active: Boolean(skirmish),
      help: `${help} This scenario's rulebook prints its own skirmish rule.`,
      control: { kind: "toggle", action: "skirmish:toggle" },
    };
  const version = skirmish?.villainVersion;
  return {
    id: "skirmish",
    name: "Skirmish",
    meta: version !== undefined ? `Only stage ${romanOf(version)}` : "Off",
    span: 1,
    active: version !== undefined,
    help,
    control: {
      kind: "groups",
      groups: [
        {
          label: null,
          chips: [
            { action: "skirmish:off", label: "Off", selected: version === undefined, enabled: true },
            ...offer.versions.map((stage) => ({
              action: `skirmish:${stage}`,
              label: romanOf(stage),
              selected: version === stage,
              enabled: true,
            })),
          ],
        },
      ],
    },
  };
}

/** The Heroic row, and the Skirmish row where the scenario offers it. */
export function playModeRows(choice: ModeChoice, offer: SkirmishOffer | null): readonly SetupOptionRow[] {
  return [heroicRow(choice.heroicLevel ?? 0), ...(offer ? [skirmishRow(choice.skirmish, offer)] : [])];
}

/** Applies a `heroic:` or `skirmish:` action; anything else, or an action the offer does not list, changes nothing. */
export function applyPlayModeOption(choice: ModeChoice, action: string, offer: SkirmishOffer | null): ModeChoice {
  const [kind, value] = action.split(":");
  if (kind === "heroic") {
    const level = (choice.heroicLevel ?? 0) + (value === "up" ? 1 : -1);
    return { ...choice, heroicLevel: Math.min(Math.max(0, level), HEROIC_LEVEL_MAX) };
  }
  if (kind !== "skirmish" || !offer) return choice;
  if (value === "toggle") return offer.printed ? { ...choice, skirmish: choice.skirmish ? null : {} } : choice;
  if (value === "off") return { ...choice, skirmish: null };
  return offer.versions.includes(value ?? "") ? { ...choice, skirmish: { villainVersion: value! } } : choice;
}
