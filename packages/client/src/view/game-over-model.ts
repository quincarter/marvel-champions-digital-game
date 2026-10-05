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
import { inspectModel } from "./inspect-model.js";
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
  /**
   * What ended it. Null only if the record somehow holds no last event of the right kind. `cardInstanceId` is the card
   * to show beside it, for a loss a card's own text caused (`GameOutcome` `"cardAbility"`): the scene draws its scan
   * and opens Inspect on it, where the whole text is.
   */
  readonly finalBlow: {
    readonly title: string;
    readonly body: string;
    readonly cardInstanceId?: InstanceId;
  } | null;
  /**
   * For a loss a card's own text caused, the cause in a few plain words: "Robert Kelly left play. Stalked by
   * Sabretooth ends the game." Null for every other outcome. The tall layout has no final blow box, so it prints this.
   */
  readonly cause: string | null;
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

/** The sentence of a card's current text that says the players lose ("…MaGog wins again and the players lose the game."). */
function losingSentenceOf(state: GameState, id: InstanceId, deps: EngineDeps): string | null {
  const seat = state.players[0]?.playerId;
  if (!seat) return null;
  const text = inspectModel(state, id, null, seat, deps).rulesText;
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.find((sentence) => /\blose the game\b/i.test(sentence))?.trim() ?? null;
}

/**
 * A card's name as the table shows it. A main scheme is one instance walking its stage cards, so it is named by the
 * stage that is up ("The Injured Senator"), not by its first card.
 */
function shownName(state: GameState, id: InstanceId): string {
  if (id === state.mainScheme.instanceId) return mainSchemeStage(state).name ?? cardName(state, id);
  return cardName(state, id);
}

/**
 * What the losing sentence counts, as it stands on the card now: "4 facedown cards under it", "10 ratings counters on
 * it", "12 threat on it". Read from the card's own state and offered only when the sentence names that very thing, so
 * the screen says the number the card reached rather than a threshold it would have to work out ("X is 3 more than the
 * number of players"). Null when the sentence counts something that is not on the card (two environments in play).
 */
function reachedOn(state: GameState, id: InstanceId, sentence: string): string | null {
  const instance = getInstance(state, id);
  if (!instance) return null;
  if (/\bfacedown cards? under\b/i.test(sentence)) {
    const facedown = instance.tucked.filter((tucked) => getInstance(state, tucked)?.faceup === false).length;
    if (facedown > 0) return `${plural(facedown, "facedown card")} under it`;
  }
  for (const [name, count] of Object.entries(instance.counters)) {
    if (count > 0 && sentence.toLowerCase().includes(`${name.toLowerCase()} counter`)) {
      return `${plural(count, `${name} counter`)} on it`;
    }
  }
  if (/\bthreat\b/i.test(sentence) && instance.threat > 0) return `${instance.threat} threat on it`;
  return null;
}

/** What the losing sentence says happens, without its condition: "MaGog wins again and the players lose the game." */
function consequenceOf(sentence: string): string {
  const clause = sentence.slice(sentence.lastIndexOf(", ") + 1).trim();
  return /\blose the game\b/i.test(clause) ? sentenceCase(clause) : "The players lose the game.";
}

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
  let cause: string | null = null;

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
    // RRG 1.8 "Encounter Deck" (p. 17): "If there are no cards in both the encounter deck and the encounter discard
    // pile simultaneously … the players lose."
    case "encounterDeckExhausted": {
      kicker = "The encounter deck ran dry";
      headline = `${villain} wins this one`;
      summary = `The encounter deck and its discard pile were both empty in round ${round}, with ${villain} at stage ${stage} and ${villainHp} hit points left.`;
      break;
    }
    // A card's own text ended the game, and the engine always names that card (`GameOutcome.sourceInstanceId`): not a
    // scheme win, and no scheme threat or defeated hero is the cause. The final blow is that card, with a few words
    // on why; its whole text is one Inspect away.
    //  - Another card met its condition (`causeInstanceId`: Robert Kelly leaving play under "If Robert Kelly leaves
    //    play, the players lose the game."): that card is the event, the source is what ended it.
    //  - Otherwise the card's own count did (Operation Zero Tolerance's facedown cards, The Champion's ratings
    //    counters): the number it reached, then what its text says happens.
    //  - A condition that is not a count on the card (Symbiote environments in play): its sentence, whole.
    case "cardAbility": {
      const lost = outcome?.result === "loss" && outcome.reason === "cardAbility" ? outcome : null;
      // A game saved before the engine recorded the source on every such loss can still hold none.
      const sourceId: InstanceId | undefined = lost?.sourceInstanceId;
      const source = sourceId ? shownName(state, sourceId) : null;
      const tripper = lost?.causeInstanceId ? cardName(state, lost.causeInstanceId) : null;
      kicker = "A card ended the game";
      headline = `${villain} wins this one`;
      summary = `${source ?? "A card's own text"} ended the game in round ${round}, with ${villain} at stage ${stage} and ${villainHp} hit points left.`;
      if (sourceId && source) {
        const line = losingSentenceOf(state, sourceId, deps);
        const reached = line ? reachedOn(state, sourceId, line) : null;
        if (tripper) {
          finalBlow = { title: `${tripper} left play`, body: `${source} ends the game.`, cardInstanceId: sourceId };
          cause = `${tripper} left play. ${source} ends the game.`;
        } else if (line && reached) {
          const body = `${sentenceCase(reached)}. ${consequenceOf(line)}`;
          finalBlow = { title: `${source} ended the game`, body, cardInstanceId: sourceId };
          cause = `${source}: ${reached}. ${consequenceOf(line)}`;
        } else {
          const body = line ?? `Its own text says the players lose, and its condition was met in round ${round}.`;
          finalBlow = { title: `${source} ended the game`, body, cardInstanceId: sourceId };
          cause = `${source}: ${body}`;
        }
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
    cause,
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

/** The news ribbon's phrases, in order: points earned, what a win opened, what is new in Extras. Empty when there is none. */
export function newsParts(
  news: { readonly points: number; readonly unlocked: readonly string[] } | null,
  extrasNews: number,
): readonly string[] {
  return [
    news && news.points > 0 ? `+${news.points} champion points` : null,
    news && news.unlocked.length > 0 ? `Unlocked: ${news.unlocked.join(", ")}` : null,
    extrasNews > 0 ? `${extrasNews} new in Extras` : null,
  ].filter((part): part is string => part !== null);
}
