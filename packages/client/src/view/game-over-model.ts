/**
 * What the game-over screen says, derived from the game.
 *
 * The design canvases (Screens - Desktop #12, Phone P11 / P17) put a story on
 * this screen — the final blow, the villain's standing, the rounds where it
 * turned — and note beside it "derived from the game log, no hidden information
 * used". This module is that derivation, and nothing on the screen is written
 * anywhere else: every sentence is built from the `GameRecord` the host folded
 * from the game's events, plus the final state. Where the record doesn't know
 * something (who a villain-phase threat step was "against", say), the sentence
 * says less rather than guessing.
 *
 * Plain data, no Phaser, so it is tested against real games.
 */

import {
  controllerOf,
  getInstance,
  mainSchemeStage,
  maxHitPoints,
  remainingHitPoints,
  scale,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
  activeVillain,
} from "@mc/engine";
import type { GameRecord } from "../engine/game-record.js";
import type { SessionConfig } from "../engine/host.js";
import { hpFraction, hpNumber } from "./hp-format.js";
import { cardName, playerName } from "./names.js";

export type GameOverTone = "win" | "loss";

export interface GameOverStat {
  readonly label: string;
  readonly value: string;
  readonly note: string;
}

/** A turning point, tagged with the round it happened in. */
export interface GameOverBeat {
  readonly round: number;
  readonly text: string;
}

export interface GameOverSeat {
  readonly name: string;
  readonly detail: string;
  readonly defeated: boolean;
}

export interface GameOverModel {
  readonly tone: GameOverTone;
  /** The small line over the headline: "The scheme succeeded", "Stage II cleared". */
  readonly kicker: string;
  readonly headline: string;
  /** "Round 6 · Standard · 1 hero". */
  readonly meta: string;
  /** One sentence for the phone layout, which has no room for the stat cards. */
  readonly summary: string;
  /** What ended it. Null only if the record somehow holds no last event of the right kind. */
  readonly finalBlow: { readonly title: string; readonly body: string } | null;
  /** The desktop's three stat cards: the villain, threat, heroes down. */
  readonly stats: readonly GameOverStat[];
  /** The phone's three number boxes. */
  readonly quickStats: readonly { readonly label: string; readonly value: string }[];
  readonly beatsHeading: string;
  /** In round order, at most four, each traceable to a count in the record. */
  readonly beats: readonly GameOverBeat[];
  readonly seats: readonly GameOverSeat[];
  /** The seat that dealt the most damage, on a win — the phone's "Table MVP". */
  readonly mvp: { readonly name: string; readonly detail: string } | null;
  readonly villainInstanceId: InstanceId;
}

const ROMAN = ["I", "II", "III", "IV", "V"] as const;
const numeral = (index: number): string => ROMAN[index] ?? String(index + 1);
const plural = (count: number, one: string, many = `${one}s`): string => `${count} ${count === 1 ? one : many}`;
const sentenceCase = (text: string): string => (text ? text[0]!.toUpperCase() + text.slice(1) : text);

/** The seat a card counts toward: its controller, or else its owner. Encounter cards count toward nobody. */
const seatOf = (state: GameState, id: InstanceId | null): PlayerId | null =>
  id ? (controllerOf(state, id) ?? getInstance(state, id)?.ownerId ?? null) : null;

export function gameOverModel(
  state: GameState,
  record: GameRecord,
  config: SessionConfig | null,
  deps: EngineDeps,
): GameOverModel {
  const outcome = state.outcome;
  /**
   * A conceded game is neither a win nor a defeat — the RRG has no concede rule at all, so calling it a loss would
   * import a meaning the game does not have (see `GameOutcome`). `tone` is the *palette* the scene draws in and it
   * only knows two, so a concession takes the non-win one; every line of copy below says conceded instead of
   * defeated, which is where the distinction actually shows.
   */
  const concededBy = outcome?.result === "conceded" ? outcome.byPlayerId : null;
  const tone: GameOverTone = outcome?.result === "win" ? "win" : "loss";
  // The villain with the active counter: with several villains, the one still standing last.
  const villainState = activeVillain(state);
  const villain = cardName(state, villainState.instanceId);
  const stage = numeral(villainState.stageIndex);
  const round = state.round;

  const scheme = mainSchemeStage(state);
  const schemeName = scheme.name ?? cardName(state, state.mainScheme.instanceId);
  const schemeTarget = scale(scheme.targetThreat, state.startingPlayerCount);

  const villainHp = hpNumber(remainingHitPoints(state, villainState.instanceId, deps) ?? 0);
  const heroesDown = record.seats.filter((seat) => seat.defeatedInRound !== null);
  const firstDown = [...heroesDown].sort((a, b) => (a.defeatedInRound ?? 0) - (b.defeatedInRound ?? 0))[0];

  const difficulty = config ? sentenceCase(config.difficulty) : null;
  const meta = [`Round ${round}`, difficulty, plural(state.players.length, "hero", "heroes")]
    .filter(Boolean)
    .join(" · ");

  let kicker: string;
  let headline: string;
  let summary: string;
  let finalBlow: GameOverModel["finalBlow"] = null;

  switch (outcome?.reason) {
    case "villainDefeated":
    case "allVillainsDefeated": {
      kicker = `Stage ${stage} cleared`;
      headline = `${villain} defeated`;
      summary = `${villain} went down in round ${round}, with ${record.damageToVillain} damage dealt to the villain across the game.`;
      const blow = record.lastVillainDamage;
      if (blow) {
        const source = blow.sourceInstanceId ? cardName(state, blow.sourceInstanceId) : null;
        const seat = seatOf(state, blow.sourceInstanceId);
        finalBlow = source
          ? {
              title: `${source} landed the last ${blow.amount}`,
              body: seat
                ? `${playerName(state, seat)} finished ${villain} in round ${blow.round}.`
                : `It finished ${villain} in round ${blow.round}.`,
            }
          : { title: `${villain} defeated`, body: `The last ${blow.amount} damage landed in round ${blow.round}.` };
      }
      break;
    }
    case "playerConceded": {
      kicker = "Game conceded";
      headline = concededBy ? `${playerName(state, concededBy)} conceded` : "The table conceded";
      summary = `The game was given up in round ${round}, with ${villain} at stage ${stage} and ${villainHp} hit points left.`;
      break;
    }
    case "allPlayersDefeated": {
      kicker = "Every hero is defeated";
      headline = `${villain} wins this one`;
      summary = `Every hero was down by round ${round}, with ${villain} at stage ${stage} and ${villainHp} hit points left.`;
      const last = record.lastEliminated;
      if (last) {
        finalBlow = {
          title: `${playerName(state, last.playerId)} was the last to fall`,
          body: `Defeated in round ${last.round}, with ${villain} still at ${villainHp} hit points.`,
        };
      }
      break;
    }
    default: {
      kicker = "The scheme succeeded";
      headline = "The scheme wins";
      summary = `${schemeName} reached ${schemeTarget} threat in round ${round}.`;
      const last = record.lastThreat;
      if (last) {
        const source = last.sourceInstanceId ? cardName(state, last.sourceInstanceId) : null;
        const against = last.againstPlayerId ? playerName(state, last.againstPlayerId) : null;
        const body =
          source && against
            ? `Placed by ${source} scheming against ${against}.`
            : source
              ? `The last ${last.amount} threat came from ${source}.`
              : `The last ${last.amount} threat went on in round ${last.round}.`;
        finalBlow = { title: `${schemeName} hit ${schemeTarget} threat`, body };
      }
      break;
    }
  }

  const stats: GameOverStat[] = [
    {
      label: villain,
      value: tone === "win" ? `Stage ${stage} cleared` : `Stage ${stage} · ${villainHp} HP left`,
      note: `${record.damageToVillain} damage dealt to ${villain}`,
    },
    {
      label: "Threat removed",
      value: `${record.threatRemoved} total`,
      note: `${record.threatPlaced} placed across ${plural(round, "round")}`,
    },
    {
      label: "Heroes down",
      value: `${heroesDown.length} of ${state.players.length}`,
      note: firstDown
        ? `${playerName(state, firstDown.playerId)} defeated in round ${firstDown.defeatedInRound}`
        : "Every hero stood to the end",
    },
  ];

  const quickStats =
    tone === "win"
      ? [
          { label: "Rounds", value: String(round) },
          { label: "Dmg dealt", value: String(record.damageToEnemies) },
          { label: "Hero KOs", value: String(heroesDown.length) },
        ]
      : [
          { label: "Rounds", value: String(round) },
          { label: "Dmg dealt", value: String(record.damageToEnemies) },
          { label: "Thwart", value: String(record.threatRemoved) },
        ];

  const seats: GameOverSeat[] = record.seats.map((seat) => {
    const player = state.players.find((candidate) => candidate.playerId === seat.playerId);
    const played = plural(seat.cardsPlayed, "card") + " played";
    if (seat.defeatedInRound !== null || !player) {
      return {
        name: playerName(state, seat.playerId),
        detail: `Defeated R${seat.defeatedInRound ?? round} · ${played}`,
        defeated: true,
      };
    }
    const id = player.identity.instanceId;
    const hp = remainingHitPoints(state, id, deps);
    const max = maxHitPoints(state, id, deps);
    const health = hp !== undefined && max !== undefined ? `${hpFraction(hp, max)} HP · ` : "";
    return { name: playerName(state, seat.playerId), detail: `${health}${played}`, defeated: false };
  });

  const topDamage = [...record.seats].sort((a, b) => b.damage - a.damage)[0];
  const mvp =
    tone === "win" && topDamage && topDamage.damage > 0
      ? { name: playerName(state, topDamage.playerId), detail: `${topDamage.damage} damage` }
      : null;

  return {
    tone,
    kicker,
    headline,
    meta,
    summary,
    finalBlow,
    stats,
    quickStats,
    beatsHeading: concededBy ? "How it went" : tone === "win" ? "How it was won" : "Where it went wrong",
    beats: turningPoints(state, record, tone, villain),
    seats,
    mvp,
    villainInstanceId: villainState.instanceId,
  };
}

/**
 * The rounds worth a line, each one a count the record actually holds: Crisis
 * blocking removals, a hero falling, the villain advancing a stage, and the
 * single heaviest round for threat. Nothing is inferred beyond those counts.
 */
export function turningPoints(
  state: GameState,
  record: GameRecord,
  tone: GameOverTone,
  villain: string,
): readonly GameOverBeat[] {
  const beats: GameOverBeat[] = [];
  for (const entry of record.rounds) {
    if (entry.crisisBlocks > 0) {
      beats.push({
        round: entry.round,
        text: `Crisis blocked ${plural(entry.crisisBlocks, "threat removal")} from the main scheme.`,
      });
    }
    for (const playerId of entry.heroesDefeated) {
      beats.push({ round: entry.round, text: `${playerName(state, playerId)} was defeated.` });
    }
    if (tone === "win" && entry.villainStageAdvanced) {
      beats.push({ round: entry.round, text: `${villain} was pushed to the next stage.` });
    }
  }
  const heaviest = [...record.rounds].sort((a, b) => b.threatPlaced - a.threatPlaced)[0];
  if (heaviest && heaviest.threatPlaced > 0) {
    beats.push({
      round: heaviest.round,
      text: `The heaviest round for threat: ${heaviest.threatPlaced} placed, ${heaviest.threatRemoved} removed.`,
    });
  }
  return beats.sort((a, b) => a.round - b.round).slice(0, 4);
}
