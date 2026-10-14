/**
 * The held-open villain-phase recap (D3 / T3 / P4): "WHAT CHANGED" tiles over five columns, one per villain step,
 * every card in the order it happened.
 *
 * Pure view model. The completed `Walkthrough` supplies the order and the wording of every beat (which is the log's
 * own wording, never retyped here); numbers come from the engine state through the selectors the board already uses
 * (`mainSchemeCalloutOf`, `seatRow`), read from the state before and after the phase. Nothing is computed that the
 * engine does not already say, and no card text is invented.
 */
import { cardOf, getCard, getInstance, getPlayer } from "@mc/engine";
import type { EngineDeps, GameState, InstanceId, PlayerId } from "@mc/engine";
import { seatRow } from "./board-model.js";
import { cardName, playerName } from "./names.js";
import { mainSchemeCalloutOf } from "./villain-main-scheme.js";
import type { ActivationBeat, Walkthrough, WalkthroughBeat } from "./villain-walkthrough.js";

/** One "WHAT CHANGED" tile. */
export interface RecapChange {
  readonly kind: "threat" | "hp" | "encounterDeck" | "firstPlayer";
  /** "THE BREAK-IN!", "SPIDER-MAN · YOU", "ENCOUNTER DECK", "FIRST PLAYER". */
  readonly label: string;
  /** Before / after the phase; null on the first-player tile, which is a word rather than a number. */
  readonly from: number | null;
  readonly to: number | null;
  /** The ceiling printed after the arrow ("/ 14 THREAT", "/ 10"); null when it is not readable. */
  readonly max: number | null;
  /** The small note after the numbers: "NO DAMAGE", "1 DISCARDED", "NOW YOU"; null when there is none. */
  readonly note: string | null;
  /** The word shown instead of numbers (first-player tile only): "NOW YOU" or the hero's name. */
  readonly text: string | null;
  readonly highlight: boolean;
  /** The seat a tile is about (an HP tile). */
  readonly playerId: PlayerId | null;
}

/** A player's reaction inside an activation or under a revealed card. */
export interface RecapResponse {
  /** "YOU", the hero's name, or null when the beat cannot be attributed to a seat. */
  readonly seat: string | null;
  readonly isViewer: boolean;
  readonly playerId: PlayerId | null;
  readonly text: string;
}

export interface RecapEntry {
  readonly headline: string;
  /** "ATK 2 + boost 1 = 3", "No hazard icons"-style secondary line; null when there is none. */
  readonly detail: string | null;
  /** The card the entry is about: the activating enemy, the scheme that gained threat, the revealed card. */
  readonly cardInstanceId: InstanceId | null;
  readonly cardType: string | null;
  /** The seat the entry belongs to (who an enemy hit, who a card was revealed for). */
  readonly seat: string | null;
  readonly seatIsViewer: boolean;
  readonly boostInstanceIds: readonly InstanceId[];
  /** What the card/activation did, in the log's words (a revealed card's effects). */
  readonly effects: readonly string[];
  /** Player cards and abilities that answered. Empty means "No responses" (the scene words that). */
  readonly responses: readonly RecapResponse[];
  /** Step 3 only: every card dealt, with its recipient. */
  readonly dealt: readonly { readonly instanceId: InstanceId; readonly playerId: PlayerId; readonly seat: string }[];
}

export interface RecapColumn {
  readonly number: number;
  readonly title: string;
  readonly entries: readonly RecapEntry[];
}

export interface VillainRecap {
  readonly round: number;
  readonly changes: readonly RecapChange[];
  readonly columns: readonly RecapColumn[];
}

/** Events whose beats are a player answering (rather than the phase narrating itself). */
const RESPONSE_EVENTS: ReadonlySet<string> = new Set([
  "cardPlayed",
  "abilityResolved",
  "damagePrevented",
  "threatPrevented",
  "revealCancelled",
  "revealReplaced",
  "defenderDeclared",
  "cardDrawn",
]);

const isResponse = (beat: WalkthroughBeat): boolean =>
  beat.eventType !== undefined && RESPONSE_EVENTS.has(beat.eventType);

export function villainRecapOf(
  walkthrough: Walkthrough,
  before: GameState | null,
  after: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): VillainRecap {
  const seatLabel = (playerId: PlayerId | null | undefined): string | null =>
    playerId == null ? null : playerId === viewer ? "YOU" : playerName(after, playerId);
  const respond = (beat: WalkthroughBeat): RecapResponse => ({
    seat: seatLabel(beat.seatId),
    isViewer: beat.seatId != null && beat.seatId === viewer,
    playerId: beat.seatId ?? null,
    text: beat.text,
  });

  return {
    round: walkthrough.round,
    changes: changesOf(before, after, viewer, deps),
    columns: walkthrough.steps.map((step) => {
      switch (step.kind) {
        case "placeThreat":
          return { number: step.number, title: step.title, entries: threatEntries(step.beats, after, respond) };
        case "enemyActivations":
          return {
            number: step.number,
            title: step.title,
            entries: activationEntries(step.beats, after, viewer, respond),
          };
        case "dealEncounterCards":
          return {
            number: step.number,
            title: step.title,
            entries: dealEntries(walkthrough, after, seatLabel),
          };
        case "revealEncounterCards":
          return {
            number: step.number,
            title: step.title,
            entries: revealEntries(walkthrough, step.beats, after, seatLabel, respond),
          };
        default:
          return {
            number: step.number,
            title: step.title,
            entries: [passEntry(before, after, viewer)],
          };
      }
    }),
  };
}

const blank = (): RecapEntry => ({
  headline: "",
  detail: null,
  cardInstanceId: null,
  cardType: null,
  seat: null,
  seatIsViewer: false,
  boostInstanceIds: [],
  effects: [],
  responses: [],
  dealt: [],
});

// ---- WHAT CHANGED ----

function changesOf(
  before: GameState | null,
  after: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): RecapChange[] {
  const tile = (partial: Partial<RecapChange> & Pick<RecapChange, "kind" | "label">): RecapChange => ({
    from: null,
    to: null,
    max: null,
    note: null,
    text: null,
    highlight: false,
    playerId: null,
    ...partial,
  });
  const changes: RecapChange[] = [];

  const scheme = mainSchemeCalloutOf(after, deps).panel;
  const schemeBefore = before ? mainSchemeCalloutOf(before, deps).panel : null;
  changes.push(
    tile({
      kind: "threat",
      label: scheme.name.toUpperCase(),
      from: schemeBefore?.threat ?? scheme.threat,
      to: scheme.threat,
      max: scheme.target,
    }),
  );

  const seats = [...after.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const ordered = [...seats.filter((p) => p.playerId === viewer), ...seats.filter((p) => p.playerId !== viewer)];
  for (const player of ordered) {
    const now = seatRow(after, player.playerId, deps);
    const was = before && getPlayer(before, player.playerId) ? seatRow(before, player.playerId, deps) : null;
    const to = now.hp?.current ?? null;
    const from = was?.hp?.current ?? to;
    const name = now.name.toUpperCase();
    changes.push(
      tile({
        kind: "hp",
        label: player.playerId === viewer ? `${name} · YOU` : name,
        from,
        to,
        max: now.hp?.max ?? null,
        note: from === to ? "NO DAMAGE" : null,
        playerId: player.playerId,
      }),
    );
  }

  const deckId = after.encounterDeckOrder[0];
  const deckNow = deckId === undefined ? undefined : after.encounterDecks[deckId];
  if (deckId !== undefined && deckNow) {
    const deckWas = before?.encounterDecks[deckId];
    const discarded = deckWas ? deckNow.discard.length - deckWas.discard.length : null;
    changes.push(
      tile({
        kind: "encounterDeck",
        label: "ENCOUNTER DECK",
        from: deckWas?.deck.length ?? deckNow.deck.length,
        to: deckNow.deck.length,
        note: discarded !== null && discarded > 0 ? `${discarded} DISCARDED` : null,
      }),
    );
  }

  const first = after.firstPlayerId;
  changes.push(
    tile({
      kind: "firstPlayer",
      label: "FIRST PLAYER",
      text: first === viewer ? "NOW YOU" : playerName(after, first),
      highlight: true,
      playerId: first,
    }),
  );
  return changes;
}

// ---- columns ----

function threatEntries(
  beats: readonly WalkthroughBeat[],
  after: GameState,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry[] {
  const placed = beats.filter((beat) => beat.eventType === "threatPlaced");
  if (placed.length === 0 && beats.length === 0) return [];
  const responses = beats.filter(isResponse).map(respond);
  const [first, ...rest] = placed;
  return [
    {
      ...blank(),
      headline: first?.text ?? beats[0]!.text,
      effects: rest.map((beat) => beat.text),
      cardInstanceId: after.mainScheme.instanceId,
      cardType: "main_scheme",
      responses,
    },
  ];
}

function sameActivation(a: ActivationBeat, b: ActivationBeat): boolean {
  if (a.kind !== b.kind || a.enemyInstanceId !== b.enemyInstanceId) return false;
  // A fresh `enemyActivated` for the same enemy starts with nothing resolved after one that had resolved.
  return !(a.resolved && !b.resolved);
}

function activationEntries(
  beats: readonly WalkthroughBeat[],
  after: GameState,
  viewer: PlayerId | null,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry[] {
  const groups: { activation: ActivationBeat; beats: WalkthroughBeat[] }[] = [];
  for (const beat of beats) {
    if (!beat.activation) continue;
    const last = groups.at(-1);
    if (last && sameActivation(last.activation, beat.activation)) {
      last.activation = beat.activation;
      last.beats.push(beat);
    } else groups.push({ activation: beat.activation, beats: [beat] });
  }

  return groups.map(({ activation, beats: members }) => {
    const target = activation.kind === "attack" ? activation.attackedPlayerId : activation.playerId;
    const enemy = cardName(after, activation.enemyInstanceId);
    const against = target === viewer ? "you" : playerName(after, target);
    const isMinion = cardOf(after, activation.enemyInstanceId)?.type === "minion";
    let detail: string | null = null;
    if (activation.kind === "attack" && activation.resolved) {
      const r = activation.resolved;
      detail =
        isMinion && activation.boosts.length === 0
          ? `ATK ${r.baseAtk} · minions take no boost`
          : `ATK ${r.baseAtk} + boost ${r.boostIcons} = ${r.baseAtk + r.boostIcons}`;
    } else if (activation.kind === "scheme" && activation.resolved) {
      const r = activation.resolved;
      const bonus = r.threatBonus > 0 ? ` + ${r.threatBonus}` : "";
      detail =
        isMinion && activation.boosts.length === 0
          ? `SCH ${r.baseSch} · minions take no boost`
          : `SCH ${r.baseSch} + boost ${r.boostIcons}${bonus} = ${r.baseSch + r.boostIcons + r.threatBonus}`;
    }
    return {
      ...blank(),
      headline: activation.kind === "attack" ? `${enemy} attacks ${against}` : `${enemy} schemes against ${against}`,
      detail,
      cardInstanceId: activation.enemyInstanceId,
      cardType: cardOf(after, activation.enemyInstanceId)?.type ?? null,
      seat: target === viewer ? "YOU" : playerName(after, target),
      seatIsViewer: target === viewer,
      boostInstanceIds: activation.boosts.map((boost) => boost.instanceId),
      responses: members.filter(isResponse).map(respond),
    };
  });
}

function dealEntries(
  walkthrough: Walkthrough,
  after: GameState,
  seatLabel: (id: PlayerId) => string | null,
): RecapEntry[] {
  const dealt = walkthrough.encounter.dealt.filter((card) => !card.duringReveal);
  if (dealt.length === 0 && walkthrough.steps[2]!.beats.length === 0) return [];
  const counts = new Map<PlayerId, number>();
  for (const card of dealt) counts.set(card.playerId, (counts.get(card.playerId) ?? 0) + 1);
  const values = [...counts.values()];
  const even = values.length > 0 && values.every((n) => n === values[0]);
  const headline = even
    ? `${values[0]} card${values[0] === 1 ? "" : "s"} each, facedown`
    : [...counts].map(([id, n]) => `${playerName(after, id)}: ${n}`).join(" · ") || "No cards dealt";
  return [
    {
      ...blank(),
      headline,
      dealt: dealt.map((card) => ({
        instanceId: card.instanceId,
        playerId: card.playerId,
        seat: seatLabel(card.playerId) ?? card.playerId,
      })),
    },
  ];
}

function revealEntries(
  walkthrough: Walkthrough,
  beats: readonly WalkthroughBeat[],
  after: GameState,
  seatLabel: (id: PlayerId) => string | null,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry[] {
  return walkthrough.encounter.revealed.map((card) => {
    const under = beats.filter((beat) => beat.encounterInstanceId === card.instanceId);
    const printed = getCard(after, card.cardId);
    return {
      ...blank(),
      headline: getInstance(after, card.instanceId) ? cardName(after, card.instanceId) : (printed?.name ?? "a card"),
      cardInstanceId: card.instanceId,
      cardType: printed?.type ?? null,
      seat: seatLabel(card.playerId),
      seatIsViewer: seatLabel(card.playerId) === "YOU",
      effects: under
        .filter((beat) => beat.eventType !== "encounterCardRevealed" && !isResponse(beat))
        .map((beat) => beat.text),
      responses: under.filter(isResponse).map(respond),
    };
  });
}

function passEntry(before: GameState | null, after: GameState, viewer: PlayerId | null): RecapEntry {
  const word = (id: PlayerId): string => (id === viewer ? "you" : playerName(after, id));
  const to = after.firstPlayerId;
  const from = before?.firstPlayerId ?? to;
  return { ...blank(), headline: "Token passes", detail: `${word(from)} → ${word(to)}` };
}
