/**
 * The `declareDefender` pending choice, worded — W6 (docs/phase4-screen-gaps.md).
 *
 * Every number here is read off `@mc/engine`'s own `defendPreview`/`stackEntries`/`legalActions`, never restated: this
 * module only turns structured engine output into the sentences the design canvases (D10, P15) call for. The one
 * exception is a handful of static captions ("range if nobody responds") that describe what the numbers *mean* rather
 * than compute one.
 *
 * `defendChoiceViewOf` returns `null` for anything but an open `declareDefender` choice, so a caller can build the
 * dedicated defend sheet exactly where the generic `ChoiceOverlay` used to fall through to its bare option list.
 */

import {
  cardOf,
  legalActions,
  maxHitPoints,
  remainingHitPoints,
  stackEntries,
  defendPreview,
  type DefendBand,
  type DefendOptionPreview,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PendingChoice,
  type PlayerId,
  type StackEntry,
  type Vars,
} from "@mc/engine";
import { cardName, faceUpName, seatName } from "./names.js";
import { decisionLabel } from "./villain-walkthrough.js";

/** One row of "your options" — a real `DefendOptionPreview`, worded. */
export interface DefendOptionView {
  readonly optionId: string;
  readonly selected: boolean;
  /** "decline" draws the quiet "No defense" row; "defender" draws a card-backed row. */
  readonly kind: "decline" | "defender";
  readonly defenderInstanceId: InstanceId | null;
  /** The card this option's thumbnail shows: the defender, or for "No defense" the character left to take the hit. */
  readonly pictureInstanceId: InstanceId;
  readonly title: string;
  readonly exhaustsNames: readonly string[];
  readonly baseAtk: number;
  readonly defenseReduction: number;
  /** "0 damage" / "3 damage" / "1–5 damage" — a single number exactly when the boost bound is a single number. */
  readonly damageHeadline: string;
  /** "12 of 16 HP" / "8–12 of 16 HP", or null when the target's HP isn't modeled (shouldn't happen for a character). */
  readonly hpAfter: string | null;
  /** Defeat threshold, Tough, Overkill, Retaliate — only the ones that actually apply to this option. */
  readonly consequences: readonly string[];
}

/**
 * Why this attack is happening — the question "X attacks you" alone never answered. Read off the stack and the
 * current step, never inferred from card text: an attack with a card's own frame underneath it was made *by that
 * card's effect* ("Klaw attacks you" off a treachery, a Quickstrike minion's reveal); one with nothing underneath
 * during step two of the villain phase is the ordinary activation (RRG 1.8 "Villain Phase", step 2).
 */
export interface DefendCauseView {
  readonly kind: "villainActivation" | "minionActivation" | "cardEffect" | "attack";
  /** "Villain phase · step 2 — the villain activates" / "Card effect — Gang-Up". */
  readonly eyebrow: string;
  /** The card whose effect made the attack happen, for its scan. Null for an ordinary activation. */
  readonly sourceInstanceId: InstanceId | null;
}

export interface DefendAttackSummaryView {
  readonly attackerName: string;
  readonly targetName: string;
  /** The enemy making the attack and the character it is aimed at — what the matchup strip draws scans of. */
  readonly attackerInstanceId: InstanceId;
  readonly targetInstanceId: InstanceId;
  /** The target's own face-up name ("She-Hulk"), even when `targetName` reads "you". */
  readonly targetCardName: string;
  /** "Attacking you — She-Hulk" / "Attacking Doctor Strange's hero". */
  readonly targetCaption: string;
  readonly cause: DefendCauseView;
  readonly baseAtk: number;
  readonly facedownCount: number;
  /** What a forced interrupt already did to this activation, from the event frame's own `vars`. */
  readonly forcedNotes: readonly string[];
  readonly boostAbilityNote: string | null;
}

export interface DefendStackRowView {
  readonly frameId: string;
  readonly label: string;
  readonly openWindow: boolean;
}

export interface DefendChoiceView {
  readonly choiceId: string;
  readonly summary: DefendAttackSummaryView;
  readonly options: readonly DefendOptionView[];
  readonly stack: readonly DefendStackRowView[];
  readonly waitingOn: string;
  /** "Play a defense event" — always sourced from `legalActions`, never computed here (see its own doc comment). */
  readonly defenseEventsNote: string;
  /** What every range in `options` is honestly conditioned on — the design's own caveat, not a rules fact. */
  readonly rangeCaveat: string;
}

/** "0 damage" / "3 damage" / "1–5 damage", off the bands' own `damageTaken` — never the client's arithmetic. */
export function damageHeadline(bands: readonly DefendBand[]): string {
  const first = bands[0];
  const last = bands[bands.length - 1];
  if (!first || !last) return "No damage";
  return first.damageTaken === last.damageTaken
    ? `${first.damageTaken} damage`
    : `${first.damageTaken}–${last.damageTaken} damage`;
}

/** "8–12 of 16 HP" — pure over the bands and the two numbers the engine's own HP query already reports. */
export function hpAfterFrom(current: number, max: number, bands: readonly DefendBand[]): string | null {
  const first = bands[0];
  const last = bands[bands.length - 1];
  if (!first || !last) return null;
  const worst = Math.max(0, current - last.damageTaken);
  const best = Math.max(0, current - first.damageTaken);
  return worst === best ? `${worst} of ${max} HP` : `${worst}–${best} of ${max} HP`;
}

/** "8–12 of 16 HP" — the target's current HP, minus the band range, so the player never does the subtraction. */
function hpAfterLine(state: GameState, preview: DefendOptionPreview, deps: EngineDeps): string | null {
  const max = maxHitPoints(state, preview.targetInstanceId, deps);
  const current = remainingHitPoints(state, preview.targetInstanceId, deps);
  if (max === undefined || current === undefined) return null;
  return hpAfterFrom(current, max, preview.bands);
}

/**
 * The RRG-specific facts a band range carries, extracted as plain data — pure over `bands`, so every case
 * `defend-preview.ts` computes (Tough, Overkill, Retaliate, a defeat threshold) can be checked without a `GameState`.
 */
export interface BandFacts {
  /** The lowest `damageTaken` at which some band reports the target defeated. */
  readonly defeatAt: number | null;
  /** The worst-case (highest) pre-tough damage a Tough status is protecting against, across the whole range. */
  readonly toughAbsorbsUpTo: number | null;
  readonly overkill: { readonly amount: number; readonly recipientInstanceId: InstanceId } | null;
  /** Fixed across the range by rule (RRG 1.8 "Retaliate X", p. 38) except where the defender is defeated. */
  readonly retaliate: number | null;
}

export function bandFactsOf(bands: readonly DefendBand[]): BandFacts {
  const defeated = bands.find((band) => band.defeated);
  const toughSpent = bands.some((band) => band.toughSpent);
  const overkillBand = [...bands]
    .reverse()
    .find((band) => band.overkillAmount > 0 && band.overkillToInstanceId !== null);
  const retaliating = bands.find((band) => !band.defeated);
  return {
    defeatAt: defeated ? defeated.damageTaken : null,
    toughAbsorbsUpTo: toughSpent ? (bands[bands.length - 1]?.damageDealt ?? 0) : null,
    overkill: overkillBand?.overkillToInstanceId
      ? { amount: overkillBand.overkillAmount, recipientInstanceId: overkillBand.overkillToInstanceId }
      : null,
    retaliate: retaliating && retaliating.retaliateToAttacker > 0 ? retaliating.retaliateToAttacker : null,
  };
}

/**
 * `BandFacts`, worded — the design's own phrasing ("5–7 damage, and at 6 or more the ally is defeated" —
 * `defend-preview.ts`'s doc comment). Pure over strings, so a case doesn't need a `GameState` to name it.
 */
export function consequenceLinesFrom(
  facts: BandFacts,
  targetName: string,
  overkillRecipientName: string | null,
  attackerName: string,
): readonly string[] {
  const lines: string[] = [];
  if (facts.defeatAt !== null) lines.push(`At ${facts.defeatAt}+ damage, ${targetName} is defeated.`);
  if (facts.toughAbsorbsUpTo !== null)
    lines.push(`Tough absorbs it — up to ${facts.toughAbsorbsUpTo} damage prevented.`);
  if (facts.overkill && overkillRecipientName)
    lines.push(`Overkill could spill up to ${facts.overkill.amount} to ${overkillRecipientName}.`);
  if (facts.retaliate !== null) lines.push(`Retaliate ${facts.retaliate} back to ${attackerName}.`);
  return lines;
}

function consequenceLines(
  state: GameState,
  attackerInstanceId: InstanceId,
  preview: DefendOptionPreview,
): readonly string[] {
  const facts = bandFactsOf(preview.bands);
  return consequenceLinesFrom(
    facts,
    faceUpName(state, preview.targetInstanceId),
    facts.overkill ? faceUpName(state, facts.overkill.recipientInstanceId) : null,
    faceUpName(state, attackerInstanceId),
  );
}

/** "You defend" only for the viewer's own identity; every other defender is named — RRG "Defend" lets any player's ready character answer. */
function optionTitle(
  state: GameState,
  preview: DefendOptionPreview,
  viewerId: PlayerId | null,
): { readonly kind: "decline" | "defender"; readonly title: string } {
  if (preview.defenderInstanceId === null) return { kind: "decline", title: "No defense" };
  const isOwnIdentity =
    cardOf(state, preview.defenderInstanceId)?.type === "hero_identity" && preview.targetPlayerId === viewerId;
  return {
    kind: "defender",
    title: isOwnIdentity ? "You defend" : `${faceUpName(state, preview.defenderInstanceId)} defends`,
  };
}

function optionViewOf(
  state: GameState,
  deps: EngineDeps,
  attackerInstanceId: InstanceId,
  preview: DefendOptionPreview,
  viewerId: PlayerId | null,
  selected: readonly string[],
): DefendOptionView {
  const { kind, title } = optionTitle(state, preview, viewerId);
  return {
    optionId: preview.optionId,
    selected: selected.includes(preview.optionId),
    kind,
    defenderInstanceId: preview.defenderInstanceId,
    pictureInstanceId: preview.defenderInstanceId ?? preview.targetInstanceId,
    title,
    exhaustsNames: preview.exhausts.map((id) => cardName(state, id)),
    baseAtk: preview.baseAtk,
    defenseReduction: preview.defenseReduction,
    damageHeadline: damageHeadline(preview.bands),
    hpAfter: hpAfterLine(state, preview, deps),
    consequences: consequenceLines(state, attackerInstanceId, preview),
  };
}

/** What a forced interrupt already changed about this activation — the event frame's own `vars` (S5.7), never re-derived. */
export function forcedNotesOf(vars: Vars): readonly string[] {
  const notes: string[] = [];
  const atkBonus = vars.atkBonus ?? 0;
  if (atkBonus !== 0) notes.push(`Forced interrupt: ${atkBonus > 0 ? "+" : ""}${atkBonus} ATK for this activation.`);
  const extraBoost = vars.extraBoost ?? 0;
  if (extraBoost > 0)
    notes.push(
      `Forced interrupt: +${extraBoost} additional boost card${extraBoost === 1 ? "" : "s"} for this activation.`,
    );
  if ((vars.overkill ?? 0) > 0) notes.push("Forced interrupt: this attack has gained Overkill.");
  return notes;
}

const STAGE_WORDS: Readonly<Record<string, string>> = {
  giveBoost: "dealing boost cards",
  declareDefender: "declaring a defender",
  flipBoosts: "flipping boost cards",
  dealDamage: "dealing damage",
  placeThreat: "placing threat",
  done: "resolved",
};

/** One stack row, worded from exactly the fields `stackEntries` reports — no new engine state. */
function stackRowLabel(state: GameState, entry: StackEntry): string {
  switch (entry.kind) {
    case "enemyAttack":
    case "enemyScheme": {
      const name = entry.subjectInstanceId ? faceUpName(state, entry.subjectInstanceId) : "The enemy";
      const stage = entry.stage ? (STAGE_WORDS[entry.stage] ?? entry.stage) : null;
      return stage ? `${name} activates — ${stage}` : `${name} activates`;
    }
    case "event": {
      const label = entry.eventKind ?? "event";
      if (entry.stage === "interrupts") return `Interrupt window — ${label}`;
      if (entry.stage === "responses") return `Response window — ${label}`;
      if (entry.stage === "apply") return `Resolving — ${label}`;
      return label;
    }
    case "window": {
      const half = entry.timing === "interrupt" ? "Interrupt window" : "Response window";
      const doing =
        entry.awaiting === "order"
          ? "ordering"
          : entry.awaiting === "pay"
            ? "paying for"
            : entry.awaiting === "select"
              ? "choosing"
              : null;
      return doing ? `${half} — ${doing}` : half;
    }
    default: {
      const name = entry.subjectInstanceId ? faceUpName(state, entry.subjectInstanceId) : null;
      return name ? `${name} resolving` : "Resolving";
    }
  }
}

function stackRowsOf(state: GameState): readonly DefendStackRowView[] {
  return stackEntries(state).map((entry) => ({
    frameId: entry.frameId,
    label: stackRowLabel(state, entry),
    openWindow: entry.openWindow,
  }));
}

/**
 * "Play a defense event", always asked of `legalActions` — never computed here. While this exact `declareDefender`
 * choice is open, `state.pendingChoice` is set, and `legalActions` (`legal.ts`) reports `{kind:"choice"}` for *any*
 * player whenever a choice is open at all, regardless of whose turn it names — the engine has already made every
 * other command illegal until this one is answered (`engine.ts`'s own guard, S5.9's Concede note documents the one
 * exemption, and it isn't this). So this note is honestly always "nothing playable" against today's engine: a card
 * whose printed timing would let it answer this exact moment must be modeled as an option of the choice itself, not
 * as a separately dispatched command — S5 doesn't add that, and this module doesn't invent it. Kept as a real query
 * (rather than a hardcoded string) so the day an engine change makes `legalActions` report something other than
 * `{kind:"choice"}` here, this starts reporting it with no client change.
 */
function defenseEventsNoteOf(state: GameState, choice: PendingChoice, deps: EngineDeps): string {
  const actions = legalActions(state, choice.playerId, deps);
  if (actions.kind !== "turn") return "Nothing playable in hand right now.";
  const events = actions.legal.filter(
    (entry) => entry.action.kind === "playCard" && cardOf(state, entry.action.instanceId)?.type === "event",
  );
  if (events.length === 0) return "Nothing playable in hand right now.";
  return events
    .map((entry) => (entry.action.kind === "playCard" ? cardName(state, entry.action.instanceId) : null))
    .filter((name): name is string => name !== null)
    .join(", ");
}

const EFFECT_FRAMES: ReadonlySet<string> = new Set(["ability", "effects", "reveal", "playCard"]);

/**
 * Pure over the stack rows, the step and the attacker's card type, so every branch is checkable without a game.
 * `entries` is `stackEntries` order: depth 0 resolving now, deeper frames queued behind it — so "underneath the
 * attack" is every entry after the `enemyAttack` procedure frame.
 */
export function defendCauseFrom(
  entries: readonly Pick<StackEntry, "kind" | "subjectInstanceId">[],
  attackerInstanceId: InstanceId,
  attackerType: string | undefined,
  inActivationStep: boolean,
  nameOf: (id: InstanceId) => string,
): DefendCauseView {
  const attackAt = entries.findIndex((entry) => entry.kind === "enemyAttack");
  const beneath = attackAt < 0 ? [] : entries.slice(attackAt + 1);
  const source = beneath.find((entry) => EFFECT_FRAMES.has(entry.kind) && entry.subjectInstanceId !== null);
  if (source?.subjectInstanceId) {
    const own = source.subjectInstanceId === attackerInstanceId;
    return {
      kind: "cardEffect",
      eyebrow: own
        ? `Card effect — ${nameOf(attackerInstanceId)}'s own ability`
        : `Card effect — ${nameOf(source.subjectInstanceId)}`,
      sourceInstanceId: own ? null : source.subjectInstanceId,
    };
  }
  if (inActivationStep) {
    return attackerType === "minion"
      ? { kind: "minionActivation", eyebrow: "Villain phase · step 2 — a minion activates", sourceInstanceId: null }
      : {
          kind: "villainActivation",
          eyebrow: "Villain phase · step 2 — the villain activates",
          sourceInstanceId: null,
        };
  }
  return { kind: "attack", eyebrow: "Enemy attack", sourceInstanceId: null };
}

/** "Declare your defender · other players may still respond after the attack resolves." / "· Peril — nobody else may act." */
function waitingOnLine(choice: PendingChoice, state: GameState, viewerId: PlayerId | null): string {
  const reason = decisionLabel(choice, state, viewerId);
  return choice.soleDecider
    ? `${reason} · Peril — nobody else may act.`
    : `${reason} · other players may still respond after the attack resolves.`;
}

/**
 * The whole defend sheet, or null when the open choice isn't `declareDefender` (or nothing is open at all) —
 * `defendPreview` already returns null for exactly that case, so this module just forwards it.
 */
export function defendChoiceViewOf(
  state: GameState,
  choice: PendingChoice,
  deps: EngineDeps,
  viewerId: PlayerId | null,
  selected: readonly string[],
): DefendChoiceView | null {
  if (choice.prompt.kind !== "declareDefender") return null;
  const previews = defendPreview(state, deps);
  if (!previews) return null;
  const [first] = previews;
  if (!first) return null;

  const attackerInstanceId = choice.prompt.attack.enemyInstanceId;
  const targetCharacterInstanceId = choice.prompt.attack.targetCharacterInstanceId;
  const forcedEntry = stackEntries(state).find((entry) => entry.kind === "event" && entry.eventKind === "enemyAttack");

  const targetSeat = seatName(state, choice.prompt.attack.targetPlayerId, viewerId);
  const targetCardName = faceUpName(state, targetCharacterInstanceId);
  const summary: DefendAttackSummaryView = {
    attackerName: faceUpName(state, attackerInstanceId),
    targetName: targetSeat === "You" ? "you" : targetCardName,
    attackerInstanceId,
    targetInstanceId: targetCharacterInstanceId,
    targetCardName,
    targetCaption:
      targetSeat === "You" ? `Attacking you — ${targetCardName}` : `Attacking ${targetSeat} — ${targetCardName}`,
    cause: defendCauseFrom(
      stackEntries(state),
      attackerInstanceId,
      cardOf(state, attackerInstanceId)?.type,
      state.step.phase === "villain" && state.step.kind === "enemyActivations",
      (id) => faceUpName(state, id),
    ),
    baseAtk: first.baseAtk,
    facedownCount: first.boost.facedownCount,
    forcedNotes: forcedNotesOf(forcedEntry?.vars ?? {}),
    boostAbilityNote: first.boost.mayTriggerBoostAbility ? "One of these may also carry a Boost ability." : null,
  };

  return {
    choiceId: choice.choiceId,
    summary,
    options: previews.map((preview) => optionViewOf(state, deps, attackerInstanceId, preview, viewerId, selected)),
    stack: stackRowsOf(state),
    waitingOn: waitingOnLine(choice, state, viewerId),
    defenseEventsNote: defenseEventsNoteOf(state, choice, deps),
    rangeCaveat: "Ranges assume nobody plays a card in response — the boost cards are still facedown.",
  };
}
