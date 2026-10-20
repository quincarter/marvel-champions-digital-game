/**
 * The held-open villain-phase recap (D3 / T3 / P4): "WHAT CHANGED" tiles over five columns, one per villain step,
 * every card in the order it happened.
 *
 * Pure view model. The completed `Walkthrough` supplies the order and the wording of every beat (which is the log's
 * own wording, never retyped here); numbers come from the engine state through the selectors the board already uses
 * (`mainSchemeCalloutOf`, `seatRow`), read from the state before and after the phase. Nothing is computed that the
 * engine does not already say, and no card text is invented.
 */
import { cardOf, getCard, getInstance, getPlayer, mainSchemeStateOf, schemesInPlay } from "@mc/engine";
import type { EngineDeps, GameState, InstanceId, PlayerId } from "@mc/engine";
import { schemePanel, seatRow } from "./board-model.js";
import { cardName, shortSeatName } from "./names.js";
import { activeVillainWording } from "./villain-active-change.js";
import { mainSchemeCalloutOf } from "./villain-main-scheme.js";
import type { ActiveVillainChange, ActivationBeat, Walkthrough, WalkthroughBeat } from "./villain-walkthrough.js";

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
  /**
   * What the entry is: a `card` (a revealed card, the threat placed, the deal, the token), an `activation` (a villain or
   * minion acting, whether in step 2 or started by an encounter card), or `activeVillain` (the active counter moving).
   */
  readonly kind: "card" | "activation" | "activeVillain";
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
  full: Walkthrough,
  before: GameState | null,
  after: GameState,
  viewer: PlayerId | null,
  deps: EngineDeps,
): VillainRecap {
  // "Auto-advance paused…" beats narrate the screen's own stop, not anything that happened: the recap leaves them out.
  const walkthrough: Walkthrough = {
    ...full,
    steps: full.steps.map((step) => ({ ...step, beats: step.beats.filter((beat) => !beat.pause) })),
  };
  const seatLabel = (playerId: PlayerId | null | undefined): string | null =>
    playerId == null ? null : playerId === viewer ? "YOU" : shortSeatName(after, playerId, viewer);
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
          return {
            number: step.number,
            title: step.title,
            entries: threatEntries(step.beats, after, respond),
          };
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
            entries: revealEntries(walkthrough, step.beats, after, viewer, seatLabel, respond),
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
  kind: "card",
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

type TileFactory = (partial: Partial<RecapChange> & Pick<RecapChange, "kind" | "label">) => RecapChange;

/** The most extra scheme tiles drawn one by one; past this they fold into a single tile holding the sums. */
export const MAX_SCHEME_TILES = 2;

/**
 * The schemes other than the central main scheme that got threat this phase: a villain's own side scheme (Breakout),
 * each main scheme of Tower Defense or Kang's areas, a side scheme that came into play. The central main scheme's tile
 * says nothing about where most of a Wrecking Crew round's threat went.
 */
function otherSchemeTiles(
  before: GameState | null,
  after: GameState,
  deps: EngineDeps,
  tile: TileFactory,
): RecapChange[] {
  const central = after.mainScheme.instanceId;
  const moved: { readonly name: string; readonly from: number; readonly to: number; readonly max: number | null }[] =
    [];
  for (const id of schemesInPlay(after)) {
    if (id === central) continue;
    const to = getInstance(after, id)?.threat ?? 0;
    const from = before ? (getInstance(before, id)?.threat ?? 0) : to;
    if (from === to) continue;
    const isMain = mainSchemeStateOf(after, id) !== undefined;
    const panel = schemePanel(after, id, deps, isMain);
    moved.push({ name: panel.name, from, to, max: isMain ? panel.target : null });
  }
  if (moved.length <= MAX_SCHEME_TILES) {
    return moved.map((scheme) =>
      tile({
        kind: "threat",
        label: scheme.name.toUpperCase(),
        from: scheme.from,
        to: scheme.to,
        max: scheme.max,
        note: scheme.max === null ? "THREAT" : null,
      }),
    );
  }
  const sum = (pick: (scheme: (typeof moved)[number]) => number): number =>
    moved.reduce((total, scheme) => total + pick(scheme), 0);
  return [
    tile({
      kind: "threat",
      label: `${moved.length} SCHEMES`,
      from: sum((scheme) => scheme.from),
      to: sum((scheme) => scheme.to),
      note: "THREAT",
    }),
  ];
}

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

  changes.push(...otherSchemeTiles(before, after, deps, tile));

  const seats = [...after.players].sort((a, b) => a.seatIndex - b.seatIndex);
  const ordered = [...seats.filter((p) => p.playerId === viewer), ...seats.filter((p) => p.playerId !== viewer)];
  for (const player of ordered) {
    const now = seatRow(after, player.playerId, deps);
    const was = before && getPlayer(before, player.playerId) ? seatRow(before, player.playerId, deps) : null;
    const to = now.hp?.current ?? null;
    const from = was?.hp?.current ?? to;
    const name = shortSeatName(after, player.playerId, null).toUpperCase();
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
      text: first === viewer ? "NOW YOU" : shortSeatName(after, first, viewer),
      highlight: true,
      playerId: first,
    }),
  );
  return changes;
}

// ---- columns ----

/** The row for the active counter moving: the new active villain's card, "Active villain → Piledriver (Buddy System)". */
function activeVillainEntry(change: ActiveVillainChange, after: GameState): RecapEntry {
  return {
    ...blank(),
    kind: "activeVillain",
    headline: activeVillainWording(change, after).line,
    cardInstanceId: change.to,
  };
}

function threatEntries(
  beats: readonly WalkthroughBeat[],
  after: GameState,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry[] {
  const moves = beats.filter((beat) => beat.activeChange !== undefined);
  const rest = beats.filter((beat) => beat.activeChange === undefined);
  const placed = rest.filter((beat) => beat.eventType === "threatPlaced");
  const moved = moves.map((beat) => activeVillainEntry(beat.activeChange!, after));
  if (rest.length === 0) return moved;
  const responses = rest.filter(isResponse).map(respond);
  const [first, ...others] = placed;
  return [
    {
      ...blank(),
      headline: first?.text ?? rest[0]!.text,
      effects: others.map((beat) => beat.text),
      cardInstanceId: after.mainScheme.instanceId,
      cardType: "main_scheme",
      responses,
    },
    ...moved,
  ];
}

/** One villain or minion acting, from the beats of its activation: who it hit or schemed against, and the sum. */
function activationEntryOf(
  activation: ActivationBeat,
  members: readonly WalkthroughBeat[],
  after: GameState,
  viewer: PlayerId | null,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry {
  const target = activation.kind === "attack" ? activation.attackedPlayerId : activation.playerId;
  const enemy = cardName(after, activation.enemyInstanceId);
  const against = target === viewer ? "you" : shortSeatName(after, target, viewer);
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
    // Which scheme took the threat: a villain's own side scheme, one of two main schemes.
    detail += ` → ${cardName(after, r.schemeInstanceId)}`;
  }
  return {
    ...blank(),
    kind: "activation",
    headline: activation.kind === "attack" ? `${enemy} attacks ${against}` : `${enemy} schemes against ${against}`,
    detail,
    cardInstanceId: activation.enemyInstanceId,
    cardType: cardOf(after, activation.enemyInstanceId)?.type ?? null,
    seat: target === viewer ? "YOU" : shortSeatName(after, target, viewer),
    seatIsViewer: target === viewer,
    boostInstanceIds: activation.boosts.map((boost) => boost.instanceId),
    responses: members.filter(isResponse).map(respond),
  };
}

interface ActivationGroup {
  activation: ActivationBeat;
  beats: WalkthroughBeat[];
}
type RowItem = ActivationGroup | { readonly move: ActiveVillainChange };

function rowOf(
  item: RowItem,
  after: GameState,
  viewer: PlayerId | null,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry {
  return "move" in item
    ? activeVillainEntry(item.move, after)
    : activationEntryOf(item.activation, item.beats, after, viewer, respond);
}

/** What an activation's resolution leaves behind: its damage and threat, already in the activation's own sum. */
const AFTERMATH: ReadonlySet<string> = new Set([
  "damageDealt",
  "damagePlaced",
  "damagePrevented",
  "damageNotDealt",
  "damageCapped",
  "damageDoubled",
  "damageIncreased",
  "damageReduced",
  "damageBeyondZeroLost",
  "overkillSpilled",
  "threatPlaced",
  "threatRemoved",
  "threatPrevented",
]);

/**
 * Splits a step's beats into the activation rows and the active counter moving, in the order they happened, and (in the
 * reveal step) the beats that stay the card's own. An activation begins at the beat that `startsActivation` (the
 * engine's `enemyActivated`, or, for one an effect started, its first boost or its resolution); in step 2 everything
 * after it belongs to it until the next begins, while under an encounter card it ends with its own sum and the damage or
 * threat that sum placed, so the card's remaining text stays the card's.
 */
function splitRows(
  beats: readonly WalkthroughBeat[],
  inReveal: boolean,
): { readonly own: readonly WalkthroughBeat[]; readonly rows: readonly RowItem[] } {
  const own: WalkthroughBeat[] = [];
  const rows: RowItem[] = [];
  let open: ActivationGroup | null = null;
  let aftermath = false;
  for (const beat of beats) {
    if (beat.activeChange) {
      rows.push({ move: beat.activeChange });
      // Under a card the counter moving ends the card's own activation; in step 2 the activation goes on around it.
      if (inReveal) open = null;
      aftermath = false;
      continue;
    }
    if (aftermath && open && beat.eventType && AFTERMATH.has(beat.eventType)) {
      open.beats.push(beat);
      continue;
    }
    // Under a card the resolution ends the activation: what follows is the card going on with its text.
    if (aftermath) open = null;
    aftermath = false;
    if (beat.startsActivation && beat.activation) {
      open = { activation: beat.activation, beats: [beat] };
      rows.push(open);
      continue;
    }
    if (open && beat.activation && beat.activation.enemyInstanceId === open.activation.enemyInstanceId) {
      open.activation = beat.activation;
      open.beats.push(beat);
      if (inReveal && (beat.eventType === "attackResolved" || beat.eventType === "schemeResolved")) {
        aftermath = true;
      }
      continue;
    }
    if (inReveal) {
      open = null;
      own.push(beat);
    } else if (beat.activation) {
      open = { activation: beat.activation, beats: [beat] };
      rows.push(open);
    }
  }
  return { own, rows };
}

function activationEntries(
  beats: readonly WalkthroughBeat[],
  after: GameState,
  viewer: PlayerId | null,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry[] {
  return splitRows(beats, false).rows.map((item) => rowOf(item, after, viewer, respond));
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
    : [...counts].map(([id, n]) => `${shortSeatName(after, id, null)}: ${n}`).join(" · ") || "No cards dealt";
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

/**
 * One entry per revealed card, then, in the order it happened, a row of its own for each activation the card started
 * ("Each Masters of Evil minion attacks you") and for the active counter moving (Buddy System). They used to be folded
 * into the card's own text lines, where an attack read as one more sentence of the card's effect.
 */
function revealEntries(
  walkthrough: Walkthrough,
  beats: readonly WalkthroughBeat[],
  after: GameState,
  viewer: PlayerId | null,
  seatLabel: (id: PlayerId) => string | null,
  respond: (beat: WalkthroughBeat) => RecapResponse,
): RecapEntry[] {
  return walkthrough.encounter.revealed.flatMap((card) => {
    const under = beats.filter((beat) => beat.encounterInstanceId === card.instanceId);
    const printed = getCard(after, card.cardId);
    const { own, rows: follow } = splitRows(under, true);
    const entry: RecapEntry = {
      ...blank(),
      headline: getInstance(after, card.instanceId) ? cardName(after, card.instanceId) : (printed?.name ?? "a card"),
      cardInstanceId: card.instanceId,
      cardType: printed?.type ?? null,
      seat: seatLabel(card.playerId),
      seatIsViewer: seatLabel(card.playerId) === "YOU",
      effects: own
        .filter((beat) => beat.eventType !== "encounterCardRevealed" && !isResponse(beat))
        .map((beat) => beat.text),
      responses: own.filter(isResponse).map(respond),
    };
    return [entry, ...follow.map((item) => rowOf(item, after, viewer, respond))];
  });
}

function passEntry(before: GameState | null, after: GameState, viewer: PlayerId | null): RecapEntry {
  const word = (id: PlayerId): string => (id === viewer ? "you" : shortSeatName(after, id, viewer));
  const to = after.firstPlayerId;
  const from = before?.firstPlayerId ?? to;
  // One line: the token's whole move, so the last row of the left column is not a header with its text below the fold.
  return { ...blank(), headline: `Token passes: ${word(from)} → ${word(to)}` };
}
