/**
 * The boost and remote counters of a game (#909, `docs/multiplayer-achievements-plan.md` package A3): boost icons
 * dealt to the table, and what an Epic game's remote powers and a competitive game's moves did. Folded over the game
 * record's events with the acting player (`record-actor.ts`); read back as `GameSummary.boosts`.
 *
 * Every counter is a count of events the engine emitted, attributed by the readings below; none decides a rule.
 *
 * - **An activation** is an `enemyAttack` or `enemyScheme` trigger event, from its `initiated` line to its `resolved`
 *   or `cancelled` line. It is kept open on the fold (`BoostsFoldState.open`, innermost last) so the boost cards turned
 *   faceup while it is open (`boostCardFlipped` by the same enemy) are its own, across commands (an attack waits for a
 *   defender's choice). A villainous ally's or hero's own boost card (`characterBoostCardFlipped`) is no activation's,
 *   and neither is a flip by an enemy with no activation of its open.
 * - **Against which seat**: an attack's attacked player as it closes (`attackedPlayerId` of its last line: a retarget
 *   moves it, another player's defense does not), a scheme's player. An activation is credited when it closes: a
 *   `resolved` one, and a `cancelled` one too (its boost cards were turned faceup against the seat all the same),
 *   unless an `enemyAttackedEnemy` by the same enemy replaced it while it was open (No, You Move! 56207, Provoked
 *   Response 56133: "resolve this attack against him instead"), which is no longer an attack on the seat. An
 *   activation still open at the game's end (the game ended inside it) is credited as it stands.
 * - **A boost card's icons** are the count `boostCardFlipped` carries: printed icons plus amplify and "gets +N boost
 *   icons" as the card is turned faceup, 0 for an ignored card. Engine reading: a later cancel of its icons (Lucky and
 *   Good, Attacrobatics), an interrupt's `adjustBoostCount`, icons its own Boost ability gives it and "each boost icon
 *   counts twice" are not applied: the counters are about what the card showed, not what it added.
 * - **`luckyStreakMax`** (Lucky Charm): the longest run of consecutive attacks against the seat in which every boost
 *   card turned faceup showed 0 icons. Reading: an attack with no boost card turned faceup (a stunned attacker, "that
 *   attack does not get a boost card", a boost withheld) neither extends nor breaks the run: nothing was flipped, so
 *   there was no luck either way. A scheme's boost cards are not counted here (the card is about attacks).
 * - **`bigBoosts`** (Cursed): boost cards showing 3 or more icons on activations against the seat, attacks and schemes.
 * - **`leaderRedirects`** (No, You Move!): in a competitive game, an attack by a team's enemy leader (the active villain
 *   of the team's own game area) against one of the team's players, replaced while open by an `enemyAttackedEnemy` of
 *   that leader onto the team's own leader (the active villain of the enemy team's area). Keyed by team id, the value
 *   the defending leader's card id each time, so a reader can ask for Captain America's (No, You Move!) or Captain
 *   Marvel's (Provoked Response). The engine has no player for a leader, so the key is the team, which
 *   `GameSummary.competitive.teams` maps to its players. A skipped `enemyAttackedEnemy` (a leader left play, a rule
 *   forbids the attack, a "—" ATK) is not counted: the attack never reached the leader.
 * - **`remoteDefeats`** (Epic: Mangog Hunter, Door Stop): each remote basic power that defeated or cleared the card it
 *   was made against (`remotePowerSettled` with `defeated`), credited to the player who made it.
 *
 * Plain serializable data, never mutated: each step returns a new state. No storage, no Phaser.
 */
import type { GameEvent, GameState, InstanceId, PlayerId } from "@mc/engine";
import type { RecordFold, RecordFoldContext } from "./record-actor.js";

/** How many icons a boost card shows to count toward `bigBoosts`. */
export const BIG_BOOST_ICONS = 3;

/** A remote basic power that defeated or cleared its card (`remotePowerSettled`). */
export interface RemoteDefeat {
  readonly cardId: string;
  readonly power: Extract<GameEvent, { type: "remotePowerSettled" }>["power"];
}

/** One seat's boost and remote counters in one game. */
export interface SeatBoosts {
  /** The longest run of attacks against this seat whose every boost card showed no icon (the module header). */
  readonly luckyStreakMax: number;
  /** Boost cards showing `BIG_BOOST_ICONS` or more icons on activations against this seat. */
  readonly bigBoosts: number;
  /** This seat's remote basic powers that defeated or cleared their card, in order. */
  readonly remoteDefeats: readonly RemoteDefeat[];
}

/** What the summary keeps (`GameSummary.boosts`). */
export interface BoostsCounters {
  /** Each seat's counters, by engine player id. */
  readonly seats: Readonly<Record<string, SeatBoosts>>;
  /** Competitive: by team id, the defending leader's card id for each enemy-leader attack moved onto it. */
  readonly leaderRedirects: Readonly<Record<string, readonly string[]>>;
}

/** An activation in progress (the module header): its enemy, its seat so far, and the icons of each card it flipped. */
export interface OpenActivation {
  readonly activation: "attack" | "scheme";
  readonly enemyInstanceId: InstanceId;
  readonly playerId: PlayerId;
  readonly flips: readonly number[];
  /** An `enemyAttackedEnemy` by the same enemy replaced it. */
  readonly redirected?: true;
}

/** The fold's running state, kept on the game record (`GameRecord.boosts`). Plain serializable data. */
export interface BoostsFoldState {
  readonly seats: Readonly<Record<string, SeatBoosts>>;
  readonly leaderRedirects: Readonly<Record<string, readonly string[]>>;
  /** Activations open now, outermost first. */
  readonly open?: readonly OpenActivation[];
  /** Each seat's current run of attacks with only blank boost cards. */
  readonly streaks?: Readonly<Record<string, number>>;
}

export const blankSeatBoosts = (): SeatBoosts => ({ luckyStreakMax: 0, bigBoosts: 0, remoteDefeats: [] });

const init = (): BoostsFoldState => ({ seats: {}, leaderRedirects: {} });

/** `state` with one seat's counters patched. A seat not seen before starts blank. */
function onSeat(state: BoostsFoldState, playerId: PlayerId, patch: (seat: SeatBoosts) => SeatBoosts): BoostsFoldState {
  const before = state.seats[playerId];
  const after = patch(before ?? blankSeatBoosts());
  if (after === before) return state;
  return { ...state, seats: { ...state.seats, [playerId]: after } };
}

/** `state` with its open activations replaced, the key dropped when none is left. */
function withOpen(state: BoostsFoldState, open: readonly OpenActivation[]): BoostsFoldState {
  const { open: _old, ...rest } = state;
  return open.length > 0 ? { ...rest, open } : rest;
}

/** The index of the innermost open activation matching `test`, or -1. */
function innermost(state: BoostsFoldState, test: (entry: OpenActivation) => boolean): number {
  const open = state.open ?? [];
  for (let index = open.length - 1; index >= 0; index--) if (test(open[index]!)) return index;
  return -1;
}

/** `state` with the open activation at `at` patched. */
function patchOpen(state: BoostsFoldState, at: number, patch: (entry: OpenActivation) => OpenActivation) {
  return withOpen(
    state,
    (state.open ?? []).map((entry, index) => (index === at ? patch(entry) : entry)),
  );
}

/** Credits a closed activation to its seat: big boosts, and an attack's step of the lucky streak. */
function credit(state: BoostsFoldState, entry: OpenActivation): BoostsFoldState {
  if (entry.redirected) return state;
  const seat = entry.playerId;
  const big = entry.flips.filter((icons) => icons >= BIG_BOOST_ICONS).length;
  let next = big > 0 ? onSeat(state, seat, (s) => ({ ...s, bigBoosts: s.bigBoosts + big })) : state;
  if (entry.activation !== "attack" || entry.flips.length === 0) return next;
  const lucky = entry.flips.every((icons) => icons === 0);
  const run = lucky ? (next.streaks?.[seat] ?? 0) + 1 : 0;
  next = { ...next, streaks: { ...next.streaks, [seat]: run } };
  return onSeat(next, seat, (s) => (run > s.luckyStreakMax ? { ...s, luckyStreakMax: run } : s));
}

/** The active villain of a team's game area (its enemy leader), defeated or not. */
function leaderInAreaOf(state: GameState, areaId: string | null): InstanceId | null {
  if (areaId === null) return null;
  return state.gameAreas.find((area) => area.areaId === areaId)?.activeVillainId ?? null;
}

/**
 * The team whose enemy leader `attacker` is, when `target` is that team's own leader and `playerId` sits on it (the
 * module header's `leaderRedirects`). Null outside a two-team game.
 */
function redirectedTeam(state: GameState, attacker: InstanceId, target: InstanceId, playerId: PlayerId): string | null {
  const teams = state.teams ?? [];
  if (teams.length !== 2) return null;
  const team = teams.find((candidate) => candidate.playerIds.includes(playerId));
  const enemy = teams.find((candidate) => candidate !== team);
  if (!team || !enemy) return null;
  const enemyLeader = leaderInAreaOf(state, team.areaId);
  const ownLeader = leaderInAreaOf(state, enemy.areaId);
  return enemyLeader === attacker && ownLeader === target ? team.teamId : null;
}

function step(fold: BoostsFoldState, event: GameEvent, ctx: RecordFoldContext): BoostsFoldState {
  // A record kept while this fold was a stub (summary version 7's scaffold) holds `{}`.
  const state: BoostsFoldState = fold.seats ? fold : { ...fold, ...init() };
  switch (event.type) {
    case "triggerEvent": {
      const trigger = event.event;
      if (trigger.kind !== "enemyAttack" && trigger.kind !== "enemyScheme") return state;
      const activation = trigger.kind === "enemyAttack" ? "attack" : "scheme";
      const playerId = trigger.kind === "enemyAttack" ? trigger.attackedPlayerId : trigger.playerId;
      if (event.phase === "initiated") {
        const entry: OpenActivation = { activation, enemyInstanceId: trigger.enemyInstanceId, playerId, flips: [] };
        return withOpen(state, [...(state.open ?? []), entry]);
      }
      // A line with no open match (an attack a stunned status cancelled before it began) closes nothing.
      const at = innermost(
        state,
        (entry) => entry.activation === activation && entry.enemyInstanceId === trigger.enemyInstanceId,
      );
      if (at < 0) return state;
      const closed = { ...state.open![at]!, playerId };
      return credit(
        withOpen(
          state,
          state.open!.filter((_, index) => index !== at),
        ),
        closed,
      );
    }
    case "boostCardFlipped": {
      const at = innermost(state, (entry) => entry.enemyInstanceId === event.enemyInstanceId);
      if (at < 0) return state;
      return patchOpen(state, at, (entry) => ({ ...entry, flips: [...entry.flips, event.boostIcons] }));
    }
    case "enemyAttackedEnemy": {
      const at = innermost(
        state,
        (entry) => entry.activation === "attack" && entry.enemyInstanceId === event.attackerInstanceId,
      );
      if (at < 0) return state;
      const entry = state.open![at]!;
      let next = patchOpen(state, at, (open) => ({ ...open, redirected: true }));
      if (event.skipped) return next;
      const team = redirectedTeam(ctx.state, event.attackerInstanceId, event.targetInstanceId, entry.playerId);
      const cardId = ctx.cardIdAt(event.targetInstanceId);
      if (team === null || cardId === undefined) return next;
      next = {
        ...next,
        leaderRedirects: { ...next.leaderRedirects, [team]: [...(next.leaderRedirects[team] ?? []), cardId] },
      };
      return next;
    }
    case "remotePowerSettled":
      if (!event.defeated) return state;
      return onSeat(state, event.playerId, (seat) => ({
        ...seat,
        remoteDefeats: [...seat.remoteDefeats, { cardId: event.cardId, power: event.power }],
      }));
    default:
      return state;
  }
}

/** The counters, crediting any activation the game ended inside (the module header). */
function finish(fold: BoostsFoldState): BoostsCounters {
  if (!fold.seats) return { seats: {}, leaderRedirects: {} };
  const done = [...(fold.open ?? [])].reverse().reduce(credit, fold);
  return { seats: done.seats, leaderRedirects: done.leaderRedirects };
}

export const boostsFold: RecordFold<BoostsFoldState, BoostsCounters> = { init, step, finish };
