/**
 * The briefing's per-seat "Your call" (MC32 p. 5, "Campaign roles"): which seat is choosing and as which hero, the
 * four roles as explainer tiles (name, aspects, a plain-words summary, who already took it), and the confirm step
 * that stands between a tap and the record. Pure over the engine's pending choice and the box's `Campaign.roles`
 * — what is legal (the options the runner offers) is read, never recomputed here.
 */
import type { Campaign, CardId, CoreAspect } from "@mc/content";
import type { CampaignChoiceAnswer, CampaignPendingChoice } from "@mc/engine";
import { aspectStampOf, type AspectStamp } from "./aspect-stamp.js";

export interface SeatHeaderView {
  readonly seatNumber: number;
  readonly identityCardId: CardId;
  readonly heroName: string;
  /** "SEAT 1 · COLOSSUS" */
  readonly title: string;
}

/** The seat a per-seat choice belongs to, with its hero. Null for a team-wide choice or a seat the log doesn't have. */
export function seatHeaderOf(
  pending: Pick<CampaignPendingChoice, "seatNumber">,
  seats: readonly { readonly seatNumber: number; readonly identityCardId: CardId }[],
  heroNameOf: (identityCardId: CardId) => string,
): SeatHeaderView | null {
  if (pending.seatNumber === null) return null;
  const seat = seats.find((candidate) => candidate.seatNumber === pending.seatNumber);
  if (!seat) return null;
  const heroName = heroNameOf(seat.identityCardId);
  return {
    seatNumber: seat.seatNumber,
    identityCardId: seat.identityCardId,
    heroName,
    title: `Seat ${seat.seatNumber} · ${heroName}`.toUpperCase(),
  };
}

/** One line each, in plain words, grounded in what the role's two aspects do (MC32 p. 5). */
const ROLE_SUMMARIES: Readonly<Record<string, string>> = {
  brawler: "The front-line fighter: hits hard and shrugs off damage.",
  commander: "The team leader: hits hard and calls in allies.",
  defender: "The guardian: stops schemes and keeps everyone safe.",
  peacekeeper: "The organizer: stops schemes and builds the team.",
};

export const ROLE_EXPLAINER = {
  heading: "What roles do",
  upgrades:
    "Role upgrades: win the campaign side scheme to earn them. Once earned, one random upgrade from your role's set of 5 starts each game in play, and it is lost after that game.",
  building:
    "Role-building: each game you may add up to 1 event and 1 upgrade from your role's two aspects to your deck. They don't count toward deck size.",
  rule: "Each player needs a different role, and a role doesn't have to match your aspect.",
} as const;

export interface RoleTileView {
  readonly id: string;
  readonly name: string;
  readonly aspects: readonly AspectStamp[];
  /** "Aggression + Protection" */
  readonly aspectsLabel: string;
  readonly summary: string;
  /** Chosen by an earlier seat: shown, not hidden, and can't be picked. */
  readonly takenBySeat: number | null;
  readonly takenByName: string | null;
  readonly available: boolean;
}

export interface RoleCallView {
  readonly tiles: readonly RoleTileView[];
}

const capitalize = (word: string): string => word.charAt(0).toUpperCase() + word.slice(1);

/** True when `pending` is a pick of exactly one of the campaign's roles (every option is a role id). */
export function isRoleChoice(pending: CampaignPendingChoice, roles: Campaign["roles"]): boolean {
  if (!roles || roles.length === 0 || pending.random || pending.count !== 1 || pending.options.length === 0) {
    return false;
  }
  const ids = new Set(roles.map((role) => role.id));
  return pending.options.every((option) => ids.has(option));
}

/**
 * The role tiles for a role choice: every role of the box in its printed order, the ones an earlier seat took marked
 * with who took them. An earlier seat's pick is read from the answers already given to this same question.
 */
export function roleCallOf(
  pending: CampaignPendingChoice,
  roles: NonNullable<Campaign["roles"]>,
  answers: readonly CampaignChoiceAnswer[],
  seats: readonly { readonly seatNumber: number; readonly identityCardId: CardId }[],
  heroNameOf: (identityCardId: CardId) => string,
): RoleCallView {
  const takenBy = new Map<string, number>();
  for (const answer of answers) {
    if (answer.instructionId !== pending.instructionId || answer.slot !== pending.slot) continue;
    const picked = answer.picked[0];
    if (picked !== undefined && answer.seatNumber !== null) takenBy.set(picked, answer.seatNumber);
  }
  const offered = new Set(pending.options);
  return {
    tiles: roles.map((role): RoleTileView => {
      const seatNumber = takenBy.get(role.id) ?? null;
      const seat = seats.find((candidate) => candidate.seatNumber === seatNumber);
      const aspects = role.aspects as readonly CoreAspect[];
      return {
        id: role.id,
        name: role.name,
        aspects: aspects.map(aspectStampOf),
        aspectsLabel: aspects.map(capitalize).join(" + "),
        summary: ROLE_SUMMARIES[role.id] ?? `Draws on ${aspects.map(capitalize).join(" and ")}.`,
        takenBySeat: seatNumber,
        takenByName: seat ? heroNameOf(seat.identityCardId) : null,
        available: offered.has(role.id) && seatNumber === null,
      };
    }),
  };
}

/** The confirm step's words: "Colossus will be the Brawler". */
export interface RoleConfirmView {
  readonly title: string;
  readonly tile: RoleTileView;
}

export function roleConfirmOf(tile: RoleTileView, heroName: string): RoleConfirmView {
  return { title: `${heroName} will be the ${tile.name}`, tile };
}

/** The confirm flow's state: nothing records until `confirm`. */
export interface RoleCallState {
  readonly selected: string | null;
}

export const ROLE_CALL_START: RoleCallState = { selected: null };

/** Picking a tile opens its confirm step; a role someone already holds can't be opened. */
export function selectRole(state: RoleCallState, view: RoleCallView, roleId: string): RoleCallState {
  const tile = view.tiles.find((candidate) => candidate.id === roleId);
  return tile?.available ? { selected: roleId } : state;
}

export const backFromRole = (): RoleCallState => ROLE_CALL_START;

/** The one answer Confirm records, or null when there is nothing selected (or it stopped being available). */
export function confirmedRole(state: RoleCallState, view: RoleCallView): string | null {
  const tile = view.tiles.find((candidate) => candidate.id === state.selected);
  return tile?.available ? tile.id : null;
}
